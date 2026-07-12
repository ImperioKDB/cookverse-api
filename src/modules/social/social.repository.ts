import { SupabaseClient } from '@supabase/supabase-js';
import { CreateCommentInput, LikeToggleInput } from './social.schema';

const COMMENT_SELECT = `
  id, author_id, commentable_type, commentable_id, parent_comment_id, body,
  like_count, created_at, updated_at,
  author:profiles(username, avatar_url)
`;

export class SocialRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async like(userId: string, input: LikeToggleInput) {
    // upsert rather than insert: liking something already-liked is a no-op,
    // not an error — the unique constraint would otherwise reject it.
    const { error } = await this.supabase
      .from('likes')
      .upsert(
        { user_id: userId, likeable_type: input.likeable_type, likeable_id: input.likeable_id },
        { onConflict: 'user_id,likeable_type,likeable_id' }
      );
    if (error) throw error;
  }

  async unlike(userId: string, input: LikeToggleInput) {
    const { error } = await this.supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('likeable_type', input.likeable_type)
      .eq('likeable_id', input.likeable_id);
    if (error) throw error;
  }

  async isLikedByMany(userId: string, likeableType: string, likeableIds: string[]) {
    if (likeableIds.length === 0) return new Set<string>();
    const { data, error } = await this.supabase
      .from('likes')
      .select('likeable_id')
      .eq('user_id', userId)
      .eq('likeable_type', likeableType)
      .in('likeable_id', likeableIds);
    if (error) throw error;
    return new Set(data.map((row) => row.likeable_id));
  }

  async listComments(commentableType: string, commentableId: string, cursor: string | undefined, limit: number) {
    let builder = this.supabase
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('commentable_type', commentableType)
      .eq('commentable_id', commentableId)
      .is('parent_comment_id', null) // top-level only; replies are fetched per-comment below
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) builder = builder.lt('created_at', cursor);

    const { data: topLevel, error } = await builder;
    if (error) throw error;
    if (topLevel.length === 0) return [];

    const { data: replies, error: repliesError } = await this.supabase
      .from('comments')
      .select(COMMENT_SELECT)
      .in(
        'parent_comment_id',
        topLevel.map((c) => c.id)
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (repliesError) throw repliesError;

    return topLevel.map((comment) => ({
      ...comment,
      replies: replies.filter((r) => r.parent_comment_id === comment.id),
    }));
  }

  async createComment(authorId: string, input: CreateCommentInput) {
    const { data, error } = await this.supabase
      .from('comments')
      .insert({ author_id: authorId, ...input })
      .select(COMMENT_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async getCommentOwner(id: string) {
    const { data, error } = await this.supabase
      .from('comments')
      .select('author_id, parent_comment_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Reads the `recipes` table directly rather than going through
   * RecipesRepository — this is a cross-module read for notification
   * purposes only, not recipe business logic, so a full module dependency
   * would be overkill for one column.
   */
  async getRecipeAuthor(recipeId: string) {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('author_id')
      .eq('id', recipeId)
      .maybeSingle();
    if (error) throw error;
    return data?.author_id ?? null;
  }

  async softDeleteComment(id: string) {
    const { error } = await this.supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
