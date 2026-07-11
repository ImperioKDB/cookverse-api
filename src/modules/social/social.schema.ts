import { z } from 'zod';

// Only 'recipe' has a real table behind it today — see 0003_social.sql's
// comment on likeable_type/commentable_type for what's still to come.
export const likeableTypeEnum = z.enum(['recipe', 'video', 'post', 'comment']);
export const commentableTypeEnum = z.enum(['recipe', 'video', 'post']);

export const likeToggleSchema = z.object({
  likeable_type: likeableTypeEnum,
  likeable_id: z.string().uuid(),
});
export type LikeToggleInput = z.infer<typeof likeToggleSchema>;

export const createCommentSchema = z.object({
  commentable_type: commentableTypeEnum,
  commentable_id: z.string().uuid(),
  parent_comment_id: z.string().uuid().optional(),
  body: z.string().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const listCommentsQuerySchema = z.object({
  commentable_type: commentableTypeEnum,
  commentable_id: z.string().uuid(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
