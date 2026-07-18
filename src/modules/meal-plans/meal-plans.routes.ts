import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { MealPlansRepository } from './meal-plans.repository';
import {
  MealPlanItemForbiddenError,
  MealPlanItemNotFoundError,
  MealPlansService,
  RecipeNotFoundForPlanError,
} from './meal-plans.service';
import {
  createMealPlanItemSchema,
  dateRangeQuerySchema,
  updateMealPlanItemSchema,
} from './meal-plans.schema';

function sendValidationError(reply: FastifyReply, requestId: string, message?: string) {
  return reply.code(400).send({
    error: { code: 'validation_error', message: message ?? 'Invalid input', request_id: requestId },
  });
}

function handleOwnershipError(err: unknown, reply: FastifyReply, requestId: string) {
  if (err instanceof MealPlanItemNotFoundError) {
    return reply.code(404).send({
      error: { code: 'meal_plan_item_not_found', message: 'Meal plan item not found', request_id: requestId },
    });
  }
  if (err instanceof MealPlanItemForbiddenError) {
    return reply.code(403).send({
      error: { code: 'forbidden', message: "This isn't your meal plan to edit.", request_id: requestId },
    });
  }
  throw err;
}

// Base /meal-plan, all routes authenticated — there's no public/anon read
// case here, unlike recipes (see meal-planner-backend-spec.md).
const mealPlansRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new MealPlansService(new MealPlansRepository(fastify.supabase));

  fastify.get('/meal-plan', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = dateRangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendValidationError(reply, request.id, parsed.error.issues[0]?.message);

    const items = await service.list(request.user!.id, parsed.data);
    return { items };
  });

  fastify.post('/meal-plan/items', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = createMealPlanItemSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, request.id, parsed.error.issues[0]?.message);

    try {
      const item = await service.create(request.user!.id, parsed.data);
      return reply.code(201).send(item);
    } catch (err) {
      if (err instanceof RecipeNotFoundForPlanError) {
        return reply.code(404).send({
          error: { code: 'recipe_not_found', message: 'Recipe not found', request_id: request.id },
        });
      }
      throw err;
    }
  });

  fastify.patch<{ Params: { id: string } }>(
    '/meal-plan/items/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = updateMealPlanItemSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, request.id, parsed.error.issues[0]?.message);

      try {
        return await service.update(request.params.id, request.user!.id, parsed.data);
      } catch (err) {
        return handleOwnershipError(err, reply, request.id);
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/meal-plan/items/:id',
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

  fastify.get('/meal-plan/grocery-list', { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = dateRangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendValidationError(reply, request.id, parsed.error.issues[0]?.message);

    return service.groceryList(request.user!.id, parsed.data);
  });
};

export default mealPlansRoutes;
