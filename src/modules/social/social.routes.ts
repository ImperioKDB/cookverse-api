import { FastifyPluginAsync } from 'fastify';
import { SocialRepository } from './social.repository';
import {
  CommentForbiddenError,
  CommentNotFoundError,
  NestingTooDeepError,
  SocialService,
} from './social.service';
import { createCommentSchema, likeToggleSchema, listCommentsQuerySchema } from './social.schema';

const socialRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SocialService(new SocialRepository(fastify.supabase));

  fastify.post('/social/likes', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = likeToggleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }
    await service.like(request.user!.id, parsed.data);
    return reply.code(204).send();
  });

  fastify.delete('/social/likes', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = likeToggleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }
    await service.unlike(request.user!.id, parsed.data);
    return reply.code(204).send();
  });

  fastify.get('/social/comments', async (request, reply) => {
    const parsed = listCommentsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }
    const { commentable_type, commentable_id, cursor, limit } = parsed.data;
    const comments = await service.listComments(commentable_type, commentable_id, cursor, limit);
    return { comments };
  });

  fastify.post('/social/comments', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }

    try {
      const comment = await service.createComment(request.user!.id, parsed.data);
      return reply.code(201).send(comment);
    } catch (err) {
      if (err instanceof NestingTooDeepError) {
        return reply.code(422).send({
          error: { code: 'nesting_too_deep', message: err.message, request_id: request.id },
        });
      }
      if (err instanceof CommentNotFoundError) {
        return reply.code(404).send({
          error: { code: 'comment_not_found', message: 'Parent comment not found', request_id: request.id },
        });
      }
      throw err;
    }
  });

  fastify.delete<{ Params: { id: string } }>(
    '/social/comments/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        await service.deleteComment(request.params.id, request.user!.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof CommentNotFoundError) {
          return reply.code(404).send({
            error: { code: 'comment_not_found', message: 'Comment not found', request_id: request.id },
          });
        }
        if (err instanceof CommentForbiddenError) {
          return reply.code(403).send({
            error: { code: 'forbidden', message: "This isn't your comment to delete.", request_id: request.id },
          });
        }
        throw err;
      }
    }
  );
};

export default socialRoutes;
