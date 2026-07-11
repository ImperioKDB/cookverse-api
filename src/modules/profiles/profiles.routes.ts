import { FastifyPluginAsync } from 'fastify';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';
import { updateProfileSchema } from './profiles.schema';

const profilesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ProfilesService(new ProfilesRepository(fastify.supabase));

  fastify.get<{ Params: { username: string } }>('/profiles/:username', async (request, reply) => {
    const profile = await service.getPublicProfile(request.params.username);

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

  // Throwaway route proving the auth chain end-to-end (Phase 0 roadmap, stage 0.3).
  // Safe to delete once /profiles/me is confirmed working against a live deploy.
  fastify.get('/me/echo', { preHandler: fastify.authenticate }, async (request) => {
    return { user_id: request.user!.id, email: request.user!.email };
  });
};

export default profilesRoutes;
