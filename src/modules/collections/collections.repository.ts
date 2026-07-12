import { SupabaseClient } from '@supabase/supabase-js';
import { ListSavedQuery } from './collections.schema';

export class CollectionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Every user should have a default "Saved" collection from the
   * handle_new_user() trigger (see 0005_collections.sql) — this is the
   * fallback for accounts that existed before that migration landed.
   * Idempotent: safe to call on every save action without checking first.
   */
  async ensureDefaultCollection(userId: string): Promise<string> {
    const { data: existing, error: findError } = await this.supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing.id;

    const { data: created, error: createError } = await this.supabase
      .from('collections')
      .insert({ user_id: userId, name: 'Saved', is_default: true })
      .select('id')
      .single();
    if (createError) throw createError;
    return created.id;
  }

  async save(userId: string, recipeId: string) {
    const collectionId = await this.ensureDefaultCollection(userId);
    const { error } = await this.supabase
      .from('collection_items')
      .upsert({ collection_id: collectionId, recipe_id: recipeId }, { onConflict: 'collection_id,recipe_id' });
    if (error) throw error;
  }

  async unsave(userId: string, recipeId: string) {
    const collectionId = await this.ensureDefaultCollection(userId);
    const { error } = await this.supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('recipe_id', recipeId);
    if (error) throw error;
  }

  async isSavedByMany(userId: string, recipeIds: string[]) {
    if (recipeIds.length === 0) return new Set<string>();

    const { data: defaultCollection } = await this.supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();
    if (!defaultCollection) return new Set<string>();

    const { data, error } = await this.supabase
      .from('collection_items')
      .select('recipe_id')
      .eq('collection_id', defaultCollection.id)
      .in('recipe_id', recipeIds);
    if (error) throw error;
    return new Set(data.map((row) => row.recipe_id));
  }

  async listSaved(userId: string, query: ListSavedQuery) {
    const collectionId = await this.ensureDefaultCollection(userId);

    let builder = this.supabase
      .from('collection_items')
      .select(
        `added_at,
         recipe:recipes(id, title, slug, cover_image_url, difficulty, total_time_minutes, servings,
           like_count, save_count, rating_avg, published_at,
           author:profiles(username, avatar_url),
           cuisine:cuisines(name, slug))`
      )
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false })
      .limit(query.limit);

    if (query.cursor) builder = builder.lt('added_at', query.cursor);

    const { data, error } = await builder;
    if (error) throw error;
    return data.map((row) => row.recipe);
  }
}
