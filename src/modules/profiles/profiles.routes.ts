import { FastifyPluginAsync } from 'fastify';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';
import { updateProfileSchema } from './profiles.schema';
import { NotificationsRepository } from '../notifications/notifications.repository';

const profilesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ProfilesService(
    new ProfilesRepository(fastify.supabase),
    new NotificationsRepository(fastify.supabase)
  );

  // Optional auth: profiles are publicly readable, but a logged-in viewer
  // also gets `is_following` on the response.
  async function getViewerId(authHeader: string | undefined): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const { data } = await fastify.supabase.auth.getUser(authHeader.slice('Bearer '.length));
    return data.user?.id ?? null;
  }

  fastify.get<{ Params: { username: string } }>('/profiles/:username', async (request, reply) => {
    const viewerId = await getViewerId(request.headers.authorization);
    const profile = await service.getPublicProfile(request.params.username, viewerId);

    if (!profile) {
      return reply.code(404).send({
        error: {
          code: 'profile_not_found',
          message: 'No profile with that username',
          request_id: request.id,
        },
      });
    }

    return profile;
  });

  fastify.get('/profiles/me', { preHandler: fastify.authenticate }, async (request) => {
    return service.getMyProfile(request.user!.id);
  });

  fastify.patch('/profiles/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }

    return service.updateMyProfile(request.user!.id, parsed.data);
  });

  fastify.post<{ Params: { username: string } }>(
    '/profiles/:username/follow',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        await service.follow(request.user!.id, request.params.username);
        return reply.code(204).send();
      } catch (err) {
        return handleFollowError(err, reply, request.id);
      }
    }
  );

  fastify.delete<{ Params: { username: string } }>(
    '/profiles/:username/follow',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        await service.unfollow(request.user!.id, request.params.username);
        return reply.code(204).send();
      } catch (err) {
        return handleFollowError(err, reply, request.id);
      }
    }
  );

  function handleFollowError(err: unknown, reply: import('fastify').FastifyReply, requestId: string) {
    const message = err instanceof Error ? err.message : 'Could not update follow status';
    if (message === 'profile_not_found') {
      return reply.code(404).send({
        error: { code: 'profile_not_found', message: 'No profile with that username', request_id: requestId },
      });
    }
    return reply.code(400).send({ error: { code: 'follow_error', message, request_id: requestId } });
  }

  // Throwaway route proving the auth chain end-to-end (Phase 0 roadmap, stage 0.3).
  // Safe to delete once /profiles/me is confirmed working against a live deploy.
  fastify.get('/me/echo', { preHandler: fastify.authenticate }, async (request) => {
    return { user_id: request.user!.id, email: request.user!.email };
  });
};

export default profilesRoutes;
