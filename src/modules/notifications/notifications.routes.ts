import { FastifyPluginAsync } from 'fastify';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { listNotificationsQuerySchema } from './notifications.schema';

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new NotificationsService(new NotificationsRepository(fastify.supabase));

  // Lightweight — the TopBar polls this every 30s and previously had to hit
  // GET /notifications (full list query + actor join) just to read the
  // unread_count field off the response. This is a single count(*) query.
  fastify.get('/notifications/unread-count', { preHandler: fastify.authenticate }, async (request) => {
    const unread_count = await service.unreadCount(request.user!.id);
    return { unread_count };
  });

  fastify.get('/notifications', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = listNotificationsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }

    const [notifications, unread_count] = await Promise.all([
      service.list(request.user!.id, parsed.data),
      service.unreadCount(request.user!.id),
    ]);

    return { notifications, unread_count };
  });

  fastify.post('/notifications/read-all', { preHandler: fastify.authenticate }, async (request, reply) => {
    await service.markAllRead(request.user!.id);
    return reply.code(204).send();
  });

  fastify.patch<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      await service.markOneRead(request.params.id, request.user!.id);
      return reply.code(204).send();
    }
  );
};

export default notificationsRoutes;
