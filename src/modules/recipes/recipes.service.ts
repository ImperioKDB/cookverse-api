import { RecipesRepository } from './recipes.repository';
import { GamificationService } from '../gamification/gamification.service';
import { ListRecipesQuery, UpdateRecipeInput } from './recipes.schema';

export class RecipeNotFoundError extends Error {}
export class RecipeForbiddenError extends Error {}
export class RecipeIncompleteError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Recipe is missing: ${missing.join(', ')}`);
  }
}

export class RecipesService {
  constructor(
    private readonly repository: RecipesRepository,
    private readonly gamification: GamificationService
  ) {}

  create(authorId: string, title?: string) {
    return this.repository.create(authorId, title);
  }

  async getDetail(idOrSlug: string, viewerId: string | null) {
    const recipe = await this.repository.findDetail(idOrSlug);
    if (!recipe) throw new RecipeNotFoundError();

    const isOwner = recipe.author_id === viewerId;
    const isPublic = recipe.status === 'published' && recipe.visibility === 'public';

    if (!isOwner && !isPublic) throw new RecipeNotFoundError();
    return recipe;
  }

  private async assertOwner(id: string, userId: string) {
    const record = await this.repository.getOwnerAndStatus(id);
    if (!record) throw new RecipeNotFoundError();
    if (record.author_id !== userId) throw new RecipeForbiddenError();
    return record;
  }

  async update(id: string, userId: string, input: UpdateRecipeInput) {
    await this.assertOwner(id, userId);
    return this.repository.update(id, input);
  }

  async publish(id: string, userId: string) {
    await this.assertOwner(id, userId);

    const recipe = await this.repository.findDetail(id);
    if (!recipe) throw new RecipeNotFoundError();

    const missing: string[] = [];
    if (!recipe.title || recipe.title === 'Untitled recipe') missing.push('title');
    if (recipe.recipe_ingredients.length === 0) missing.push('at least one ingredient');
    if (recipe.recipe_steps.length === 0) missing.push('at least one step');
    if (missing.length > 0) throw new RecipeIncompleteError(missing);

    const published = await this.repository.publish(id);

    // XP for Phase 1's gamification baseline. Only reachable via this one
    // transition into 'published' — there's no unpublish/republish flow
    // yet, so this can't double-award for the same recipe today. Revisit
    // if one is ever added.
    await this.gamification.awardXp(userId, 'recipe_published', 'recipe', id);

    return published;
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    return this.repository.remove(id);
  }

  list(query: ListRecipesQuery, viewerId: string | null) {
    return this.repository.list(query, viewerId);
  }

  async requestMediaUpload(id: string, userId: string, filename: string) {
    await this.assertOwner(id, userId);
    return this.repository.createMediaUploadUrl(userId, id, filename);
  }
}
