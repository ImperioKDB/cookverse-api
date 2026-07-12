import { SocialRepository } from './social.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { CreateCommentInput, LikeToggleInput } from './social.schema';

export class CommentForbiddenError extends Error {}
export class CommentNotFoundError extends Error {}
export class NestingTooDeepError extends Error {
  constructor() {
    super('Replies can only go one level deep — reply to the original comment instead.');
  }
}

export class SocialService {
  constructor(
    private readonly repository: SocialRepository,
    private readonly notifications: NotificationsRepository
  ) {}

  async like(userId: string, input: LikeToggleInput) {
    await this.repository.like(userId, input);

    if (input.likeable_type === 'recipe') {
      const authorId = await this.repository.getRecipeAuthor(input.likeable_id);
      if (authorId) {
        await this.notifications.create(authorId, userId, 'like', 'recipe', input.likeable_id);
      }
    }
  }

  unlike(userId: string, input: LikeToggleInput) {
    return this.repository.unlike(userId, input);
  }

  listComments(commentableType: string, commentableId: string, cursor: string | undefined, limit: number) {
    return this.repository.listComments(commentableType, commentableId, cursor, limit);
  }

  async createComment(authorId: string, input: CreateCommentInput) {
    let parent: { author_id: string; parent_comment_id: string | null } | null = null;

    if (input.parent_comment_id) {
      parent = await this.repository.getCommentOwner(input.parent_comment_id);
      if (!parent) throw new CommentNotFoundError();
      if (parent.parent_comment_id) throw new NestingTooDeepError();
    }

    const comment = await this.repository.createComment(authorId, input);

    // Reply -> notify the parent comment's author. Top-level comment on a
    // recipe -> notify the recipe's author. Either way, entity points at
    // the recipe itself so tapping the notification lands somewhere useful.
    if (parent) {
      await this.notifications.create(
        parent.author_id,
        authorId,
        'comment',
        input.commentable_type,
        input.commentable_id
      );
    } else if (input.commentable_type === 'recipe') {
      const recipeAuthorId = await this.repository.getRecipeAuthor(input.commentable_id);
      if (recipeAuthorId) {
        await this.notifications.create(recipeAuthorId, authorId, 'comment', 'recipe', input.commentable_id);
      }
    }

    return comment;
  }

  async deleteComment(id: string, userId: string) {
    const comment = await this.repository.getCommentOwner(id);
    if (!comment) throw new CommentNotFoundError();
    if (comment.author_id !== userId) throw new CommentForbiddenError();
    await this.repository.softDeleteComment(id);
  }
}
