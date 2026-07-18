import { z } from 'zod';

export const mealTypeEnum = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

// plan_date is a real calendar date (YYYY-MM-DD), not a datetime — deliberately
// not reusing the z.string().datetime() pattern the cursor fields use
// elsewhere in this project, since a meal-plan slot has no time component.
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format');

// Both GET /meal-plan and GET /meal-plan/grocery-list take the same range
// shape — required, not optional, per meal-planner-backend-spec.md (there's
// no "give me everything" case for a plan that could span years).
export const dateRangeQuerySchema = z
  .object({
    start: dateStringSchema,
    end: dateStringSchema,
  })
  .refine((range) => range.start <= range.end, {
    message: 'start must be on or before end',
    path: ['end'],
  });
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const createMealPlanItemSchema = z.object({
  recipe_id: z.string().uuid(),
  plan_date: dateStringSchema,
  meal_type: mealTypeEnum,
  // Defaults to the recipe's own base servings if omitted — resolved in the
  // service layer, not here, since it needs a lookup.
  servings: z.number().int().positive().optional(),
});
export type CreateMealPlanItemInput = z.infer<typeof createMealPlanItemSchema>;

// One flexible PATCH, same pattern as recipes/profiles — covers both
// "change the day/slot" and "adjust servings" with one endpoint.
export const updateMealPlanItemSchema = z
  .object({
    plan_date: dateStringSchema.optional(),
    meal_type: mealTypeEnum.optional(),
    servings: z.number().int().positive().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateMealPlanItemInput = z.infer<typeof updateMealPlanItemSchema>;
