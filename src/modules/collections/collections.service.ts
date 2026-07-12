import { CollectionsRepository } from './collections.repository';
import { ListSavedQuery } from './collections.schema';

export class CollectionsService {
  constructor(private readonly repository: CollectionsRepository) {}

  save(userId: string, recipeId: string) {
    return this.repository.save(userId, recipeId);
  }

  unsave(userId: string, recipeId: string) {
    return this.repository.unsave(userId, recipeId);
  }

  isSavedByMany(userId: string, recipeIds: string[]) {
    return this.repository.isSavedByMany(userId, recipeIds);
  }

  listSaved(userId: string, query: ListSavedQuery) {
    return this.repository.listSaved(userId, query);
  }
}
