import { FastifyPluginAsync } from 'fastify';
import { RecipesRepository } from './recipes.repository';
import {
  RecipeForbiddenError,
  RecipeIncompleteError,
  RecipeNotFoundError,
  RecipesService,
} from './recipes.service';
import {
  createRecipeSchema,
  listRecipesQuerySchema,
  mediaUploadRequestSchema,
  updateRecipeSchema,
} from './recipes.schema';
import { SocialRepository } from '../social/social.repository';
import { CollectionsRepository } from '../collections/collections.repository';

function sendZodError(reply: import('fastify').FastifyReply, requestId: string, message?: string) {
  return reply.code(400).send({
    error: { code: 'validation_error', message: message ?? 'Invalid input', request_id: requestId },
  });
}

const recipesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RecipesService(new RecipesRepository(fastify.supabase));
  const socialRepository = new SocialRepository(fastify.supabase);
  const collectionsRepository = new CollectionsRepository(fastify.supabase);

  // --- Create -----------------------------------------------------------
  fastify.post('/recipes', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = createRecipeSchema.safeParse(request.body ?? {});
    if (!parsed.success) return sendZodError(reply, request.id, parsed.error.issues[0]?.message);

    const recipe = await service.create(request.user!.id, parsed.data.title);
    return reply.code(201).send(recipe);
  });

  // --- List / browse ------------------------------------------------------
  fastify.get('/recipes', async (request, reply) => {
    const parsed = listRecipesQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendZodError(reply, request.id, parsed.error.issues[0]?.message);

    // Optional auth: logged-out browsing is fine, but "mine=true" needs a user.
    const authHeader = request.headers.authorization;
    let viewerId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await fastify.supabase.auth.getUser(authHeader.slice('Bearer '.length));
      viewerId = data.user?.id ?? null;
    }

    const recipes = await service.list(parsed.data, viewerId);
    return { recipes };
  });

  // --- Detail ---------------------------------------------------------
  fastify.get<{ Params: { idOrSlug: string } }>('/recipes/:idOrSlug', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let viewerId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await fastify.supabase.auth.getUser(authHeader.slice('Bearer '.length));
      viewerId = data.user?.id ?? null;
    }

    try {
      const recipe = await service.getDetail(request.params.idOrSlug, viewerId);
      let is_liked = false;
      let is_saved = false;
      if (viewerId) {
        const [likedIds, savedIds] = await Promise.all([
          socialRepository.isLikedByMany(viewerId, 'recipe', [recipe.id]),
          collectionsRepository.isSavedByMany(viewerId, [recipe.id]),
        ]);
        is_liked = likedIds.has(recipe.id);
        is_saved = savedIds.has(recipe.id);
      }
      return { ...recipe, is_liked, is_saved };
    } catch (err) {
      if (err instanceof RecipeNotFoundError) {
        return reply.code(404).send({
          error: { code: 'recipe_not_found', message: 'Recipe not found', request_id: request.id },
        });
      }
      throw err;
    }
  });

  // --- Update (autosave target for every editor step) --------------------
  fastify.patch<{ Params: { id: string } }>(
    '/recipes/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = updateRecipeSchema.safeParse(request.body);
      if (!parsed.success) return sendZodError(reply, request.id, parsed.error.issues[0]?.message);

      try {
        return await service.update(request.params.id, request.user!.id, parsed.data);
      } catch (err) {
        return handleOwnershipError(err, reply, request.id);
      }
    }
  );

  // --- Publish -------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/recipes/:id/publish',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        return await service.publish(request.params.id, request.user!.id);
      } catch (err) {
        if (err instanceof RecipeIncompleteError) {
          return reply.code(422).send({
            error: {
              code: 'recipe_incomplete',
              message: `Add ${err.missing.join(' and ')} before publishing.`,
              request_id: request.id,
            },
          });
        }
        return handleOwnershipError(err, reply, request.id);
      }
    }
  );

  // --- Delete ----------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/recipes/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      try {
        await service.remove(request.params.id, request.user!.id);
        return reply.code(204).send();
      } catch (err) {
        return handleOwnershipError(err, reply, request.id);
      }
    }
  );

  // --- Cover photo / media upload URL ------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/recipes/:id/media/upload-url',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = mediaUploadRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendZodError(reply, request.id, parsed.error.issues[0]?.message);

      try {
        return await service.requestMediaUpload(request.params.id, request.user!.id, parsed.data.filename);
      } catch (err) {
        return handleOwnershipError(err, reply, request.id);
      }
    }
  );

  function handleOwnershipError(
    err: unknown,
    reply: import('fastify').FastifyReply,
    requestId: string
  ) {
    if (err instanceof RecipeNotFoundError) {
      return reply.code(404).send({
        error: { code: 'recipe_not_found', message: 'Recipe not found', request_id: requestId },
      });
    }
    if (err instanceof RecipeForbiddenError) {
      return reply.code(403).send({
        error: { code: 'forbidden', message: "This isn't your recipe to edit.", request_id: requestId },
      });
    }
    throw err;
  }
};

export default recipesRoutes;
