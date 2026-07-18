import { SupabaseClient } from '@supabase/supabase-js';
import { CreateMealPlanItemInput, UpdateMealPlanItemInput } from './meal-plans.schema';

const ITEM_SELECT = `
  id, plan_date, meal_type, servings, created_at,
  recipe:recipes(id, title, slug, cover_image_url, servings)
`;

export interface GroceryIngredientRow {
  name: string;
  unit: string | null;
  quantity: number | null;
}

export class MealPlansRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(userId: string, start: string, end: string) {
    const { data, error } = await this.supabase
      .from('meal_plan_items')
      .select(ITEM_SELECT)
      .eq('user_id', userId)
      .gte('plan_date', start)
      .lte('plan_date', end)
      .order('plan_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  /** Base servings for the recipe being slotted, used to resolve a default
   * when the create request omits `servings` entirely. */
  async getRecipeServings(recipeId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('servings')
      .eq('id', recipeId)
      .maybeSingle();
    if (error) throw error;
    return data?.servings ?? null;
  }

  async create(userId: string, input: CreateMealPlanItemInput, resolvedServings: number) {
    const { data, error } = await this.supabase
      .from('meal_plan_items')
      .insert({
        user_id: userId,
        recipe_id: input.recipe_id,
        plan_date: input.plan_date,
        meal_type: input.meal_type,
        servings: resolvedServings,
      })
      .select(ITEM_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async getOwner(id: string) {
    const { data, error } = await this.supabase
      .from('meal_plan_items')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async update(id: string, input: UpdateMealPlanItemInput) {
    const { error } = await this.supabase.from('meal_plan_items').update(input).eq('id', id);
    if (error) throw error;

    const { data, error: findError } = await this.supabase
      .from('meal_plan_items')
      .select(ITEM_SELECT)
      .eq('id', id)
      .single();
    if (findError) throw findError;
    return data;
  }

  async remove(id: string) {
    // Hard delete is fine here (unlike recipes' soft-delete) — nothing else
    // references a meal-plan slot.
    const { error } = await this.supabase.from('meal_plan_items').delete().eq('id', id);
    if (error) throw error;
  }

  /**
   * Every slotted item in range that still points at a live recipe, plus
   * that recipe's own base servings (to compute each slot's scale factor)
   * and its ingredient list. Items with a null recipe_id (the recipe was
   * deleted/unpublished after being slotted) are skipped here — the plain
   * list() call above is what surfaces the "this recipe was removed" state
   * to the frontend, not the grocery list.
   */
  async listSlottedIngredients(userId: string, start: string, end: string) {
    const { data: items, error } = await this.supabase
      .from('meal_plan_items')
      .select('id, servings, recipe:recipes(id, servings)')
      .eq('user_id', userId)
      .gte('plan_date', start)
      .lte('plan_date', end)
      .not('recipe_id', 'is', null);
    if (error) throw error;

    type SlotRow = { id: string; servings: number; recipe: { id: string; servings: number } | null };
    const slots = (items as unknown as SlotRow[]).filter((row) => row.recipe !== null);
    if (slots.length === 0) return [];

    const recipeIds = [...new Set(slots.map((slot) => slot.recipe!.id))];
    const { data: ingredientRows, error: ingredientsError } = await this.supabase
      .from('recipe_ingredients')
      .select('recipe_id, name, unit, quantity')
      .in('recipe_id', recipeIds);
    if (ingredientsError) throw ingredientsError;

    const byRecipe = new Map<string, GroceryIngredientRow[]>();
    for (const row of ingredientRows as (GroceryIngredientRow & { recipe_id: string })[]) {
      const list = byRecipe.get(row.recipe_id) ?? [];
      list.push({ name: row.name, unit: row.unit, quantity: row.quantity });
      byRecipe.set(row.recipe_id, list);
    }

    return slots.map((slot) => ({
      recipeId: slot.recipe!.id,
      scale: slot.recipe!.servings > 0 ? slot.servings / slot.recipe!.servings : 1,
      ingredients: byRecipe.get(slot.recipe!.id) ?? [],
    }));
  }
}
