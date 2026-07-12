import { FastifyPluginAsync } from 'fastify';
import { RecipesRepository } from '../recipes/recipes.repository';
import { feedQuerySchema } from './feed.schema';

// Deliberately thin: reuses RecipesRepository.listFeed rather than
// duplicating recipe-query logic in a parallel repository/service pair —
// this module is just the route, per 13-handoff-feed-and-notifications.md.
const feedRoutes: FastifyPluginAsync = async (fastify) => {
  const recipesRepository = new RecipesRepository(fastify.supabase);

  fastify.get('/feed', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          request_id: request.id,
        },
      });
    }

    const recipes = await recipesRepository.listFeed(
      request.user!.id,
      parsed.data.cursor,
      parsed.data.limit
    );
    return { recipes };
  });
};

export default feedRoutes;
