import { FastifyPluginAsync } from 'fastify';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
import { listSavedQuerySchema } from './collections.schema';

// Save/unsave live under /recipes/:id/save (matches the existing
// action-on-a-resource convention, e.g. /recipes/:id/publish) even though
// the module doing the work is `collections` — the "list what I've saved"
// endpoint below is what actually belongs to the collections resource.
const collectionsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new CollectionsService(new CollectionsRepository(fastify.supabase));

  fastify.post<{ Params: { id: string } }>(
    '/recipes/:id/save',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      await service.save(request.user!.id, request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/recipes/:id/save',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      await service.unsave(request.user!.id, request.params.id);
      return reply.code(204).send();
    }
  );

  fastify.get('/collections/me/saved', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = listSavedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }

    const recipes = await service.listSaved(request.user!.id, parsed.data);
    return { recipes };
  });
};

export default collectionsRoutes;
