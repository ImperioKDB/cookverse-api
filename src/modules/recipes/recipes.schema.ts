import { z } from 'zod';

export const difficultyEnum = z.enum(['easy', 'medium', 'hard', 'expert']);
export const visibilityEnum = z.enum(['public', 'followers', 'private']);

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

const ingredientSchema = z.object({
  ingredient_group: z.string().max(80).optional().nullable(),
  name: z.string().min(1).max(120),
  quantity: z.number().nonnegative().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  is_optional: z.boolean().optional(),
});

const stepSchema = z.object({
  instruction: z.string().min(1).max(2000),
  image_url: z.string().url().optional().nullable(),
  timer_seconds: z.number().int().positive().optional().nullable(),
});

const nutritionSchema = z.object({
  calories: z.number().int().nonnegative().optional().nullable(),
  protein_g: z.number().nonnegative().optional().nullable(),
  carbs_g: z.number().nonnegative().optional().nullable(),
  fat_g: z.number().nonnegative().optional().nullable(),
  fiber_g: z.number().nonnegative().optional().nullable(),
  sugar_g: z.number().nonnegative().optional().nullable(),
  sodium_mg: z.number().nonnegative().optional().nullable(),
});

// One flexible PATCH covers every step of the multi-step editor — each step
// autosaves by sending just the fields it owns. See 10-ui-pages-and-layout.md,
// "Recipe Editor" and 06-design-system.md, "Forms & feedback".
export const updateRecipeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  cover_image_url: z.string().url().optional().nullable(),
  cuisine_id: z.string().uuid().optional().nullable(),
  difficulty: difficultyEnum.optional(),
  prep_time_minutes: z.number().int().nonnegative().optional().nullable(),
  cook_time_minutes: z.number().int().nonnegative().optional().nullable(),
  servings: z.number().int().positive().optional(),
  visibility: visibilityEnum.optional(),
  ingredients: z.array(ingredientSchema).max(100).optional(),
  steps: z.array(stepSchema).max(100).optional(),
  nutrition: nutritionSchema.optional().nullable(),
  tag_ids: z.array(z.string().uuid()).max(20).optional(),
});
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export const listRecipesQuerySchema = z.object({
  cuisine: z.string().optional(),
  difficulty: difficultyEnum.optional(),
  max_time: z.coerce.number().int().positive().optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['new', 'trending']).default('new'),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  mine: z.coerce.boolean().optional(),
  author: z.string().optional(), // username — for a profile page's recipe grid
});
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;

export const mediaUploadRequestSchema = z.object({
  filename: z.string().min(1).max(200),
});
