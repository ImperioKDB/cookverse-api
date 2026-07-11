import { SocialRepository } from './social.repository';
import { CreateCommentInput, LikeToggleInput } from './social.schema';

export class CommentForbiddenError extends Error {}
export class CommentNotFoundError extends Error {}
export class NestingTooDeepError extends Error {
  constructor() {
    super('Replies can only go one level deep — reply to the original comment instead.');
  }
}

export class SocialService {
  constructor(private readonly repository: SocialRepository) {}

  like(userId: string, input: LikeToggleInput) {
    return this.repository.like(userId, input);
  }

  unlike(userId: string, input: LikeToggleInput) {
    return this.repository.unlike(userId, input);
  }

  listComments(commentableType: string, commentableId: string, cursor: string | undefined, limit: number) {
    return this.repository.listComments(commentableType, commentableId, cursor, limit);
  }

  async createComment(authorId: string, input: CreateCommentInput) {
    if (input.parent_comment_id) {
      const parent = await this.repository.getCommentOwner(input.parent_comment_id);
      if (!parent) throw new CommentNotFoundError();
      if (parent.parent_comment_id) throw new NestingTooDeepError();
    }
    return this.repository.createComment(authorId, input);
  }

  async deleteComment(id: string, userId: string) {
    const comment = await this.repository.getCommentOwner(id);
    if (!comment) throw new CommentNotFoundError();
    if (comment.author_id !== userId) throw new CommentForbiddenError();
    await this.repository.softDeleteComment(id);
  }
}
