import { MealPlansRepository } from './meal-plans.repository';
import { CreateMealPlanItemInput, DateRangeQuery, UpdateMealPlanItemInput } from './meal-plans.schema';

export class MealPlanItemNotFoundError extends Error {}
export class MealPlanItemForbiddenError extends Error {}
export class RecipeNotFoundForPlanError extends Error {}

export interface GroceryListItem {
  name: string;
  unit: string | null;
  quantity: number | null;
  sources: string[];
}

export class MealPlansService {
  constructor(private readonly repository: MealPlansRepository) {}

  list(userId: string, range: DateRangeQuery) {
    return this.repository.list(userId, range.start, range.end);
  }

  async create(userId: string, input: CreateMealPlanItemInput) {
    let servings = input.servings;
    if (servings === undefined) {
      const recipeServings = await this.repository.getRecipeServings(input.recipe_id);
      if (recipeServings === null) throw new RecipeNotFoundForPlanError();
      servings = recipeServings;
    }
    return this.repository.create(userId, input, servings);
  }

  private async assertOwner(id: string, userId: string) {
    const record = await this.repository.getOwner(id);
    if (!record) throw new MealPlanItemNotFoundError();
    if (record.user_id !== userId) throw new MealPlanItemForbiddenError();
  }

  async update(id: string, userId: string, input: UpdateMealPlanItemInput) {
    await this.assertOwner(id, userId);
    return this.repository.update(id, input);
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    return this.repository.remove(id);
  }

  /**
   * Naive exact-match consolidation per meal-planner-backend-spec.md: merge
   * only on (lower(name), unit) equality, scaled by each slot's
   * servings/recipe.servings. Anything without a clean quantity+unit to
   * scale, or that doesn't share an exact (name, unit) key with anything
   * else, falls into `unmerged` rather than attempting fuzzy matching —
   * that's explicitly out of scope here (Phase 4/5 AI territory).
   */
  async groceryList(userId: string, range: DateRangeQuery) {
    const slots = await this.repository.listSlottedIngredients(userId, range.start, range.end);

    const merged = new Map<string, GroceryListItem>();
    const unmerged: GroceryListItem[] = [];

    for (const slot of slots) {
      for (const ingredient of slot.ingredients) {
        const name = ingredient.name.trim().toLowerCase();

        // A missing quantity can't be scaled or summed at all — those go
        // straight to unmerged. A missing *unit* is still mergeable with
        // other same-name/no-unit ingredients (null matches null), it just
        // can't merge with a unit'd version of the same ingredient.
        if (ingredient.quantity === null) {
          unmerged.push({
            name: ingredient.name,
            unit: ingredient.unit,
            quantity: ingredient.quantity,
            sources: [slot.recipeId],
          });
          continue;
        }

        const scaledQuantity = Math.round(ingredient.quantity * slot.scale * 100) / 100;
        const key = `${name}|${ingredient.unit ?? '__no_unit__'}`;
        const existing = merged.get(key);

        if (existing) {
          existing.quantity = Math.round(((existing.quantity ?? 0) + scaledQuantity) * 100) / 100;
          if (!existing.sources.includes(slot.recipeId)) existing.sources.push(slot.recipeId);
        } else {
          merged.set(key, {
            name: ingredient.name,
            unit: ingredient.unit,
            quantity: scaledQuantity,
            sources: [slot.recipeId],
          });
        }
      }
    }

    return { items: [...merged.values()], unmerged };
  }
}
