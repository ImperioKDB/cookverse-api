import { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '../../lib/slugify';
import { ListRecipesQuery, UpdateRecipeInput } from './recipes.schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_SELECT = `
  id, author_id, title, slug, description, cover_image_url, difficulty,
  prep_time_minutes, cook_time_minutes, total_time_minutes, servings,
  status, visibility, view_count, save_count, like_count, comment_count,
  rating_avg, rating_count, created_at, updated_at, published_at,
  author:profiles(id, username, full_name, avatar_url),
  cuisine:cuisines(id, name, slug),
  recipe_ingredients(id, position, ingredient_group, name, quantity, unit, notes, is_optional),
  recipe_steps(id, position, instruction, image_url, timer_seconds),
  recipe_nutrition(calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg),
  recipe_tags(tags(id, name, slug))
`;

export class RecipesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(authorId: string, title?: string) {
    const recipeTitle = title?.trim() || 'Untitled recipe';

    const { data, error } = await this.supabase
      .from('recipes')
      .insert({ author_id: authorId, title: recipeTitle, slug: slugify(recipeTitle) })
      .select('id, slug, status')
      .single();

    if (error) throw error;
    return data;
  }

  async findDetail(idOrSlug: string) {
    const column = UUID_RE.test(idOrSlug) ? 'id' : 'slug';

    const { data, error } = await this.supabase
      .from('recipes')
      .select(DETAIL_SELECT)
      .eq(column, idOrSlug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Flatten recipe_ingredients/recipe_steps ordering and unwrap the
    // recipe_tags join table into a plain tags array for a cleaner API shape.
    return {
      ...data,
      recipe_ingredients: [...data.recipe_ingredients].sort((a, b) => a.position - b.position),
      recipe_steps: [...data.recipe_steps].sort((a, b) => a.position - b.position),
      tags: data.recipe_tags.map((rt: { tags: unknown }) => rt.tags),
      recipe_tags: undefined,
    };
  }

  async getOwnerAndStatus(id: string) {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('author_id, status')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async update(id: string, input: UpdateRecipeInput) {
    const { ingredients, steps, nutrition, tag_ids, ...recipeFields } = input;

    if (Object.keys(recipeFields).length > 0) {
      const { error } = await this.supabase.from('recipes').update(recipeFields).eq('id', id);
      if (error) throw error;
    }

    if (ingredients) {
      await this.supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
      if (ingredients.length > 0) {
        const rows = ingredients.map((ingredient, position) => ({
          recipe_id: id,
          position,
          ...ingredient,
        }));
        const { error } = await this.supabase.from('recipe_ingredients').insert(rows);
        if (error) throw error;
      }
    }

    if (steps) {
      await this.supabase.from('recipe_steps').delete().eq('recipe_id', id);
      if (steps.length > 0) {
        const rows = steps.map((step, position) => ({ recipe_id: id, position, ...step }));
        const { error } = await this.supabase.from('recipe_steps').insert(rows);
        if (error) throw error;
      }
    }

    if (nutrition !== undefined) {
      if (nutrition === null) {
        await this.supabase.from('recipe_nutrition').delete().eq('recipe_id', id);
      } else {
        const { error } = await this.supabase
          .from('recipe_nutrition')
          .upsert({ recipe_id: id, ...nutrition });
        if (error) throw error;
      }
    }

    if (tag_ids) {
      await this.supabase.from('recipe_tags').delete().eq('recipe_id', id);
      if (tag_ids.length > 0) {
        const rows = tag_ids.map((tag_id) => ({ recipe_id: id, tag_id }));
        const { error } = await this.supabase.from('recipe_tags').insert(rows);
        if (error) throw error;
      }
    }

    return this.findDetail(id);
  }

  async publish(id: string) {
    const { error } = await this.supabase
      .from('recipes')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return this.findDetail(id);
  }

  async remove(id: string) {
    const { error } = await this.supabase.from('recipes').update({ status: 'removed' }).eq('id', id);
    if (error) throw error;
  }

  async list(query: ListRecipesQuery, viewerId: string | null) {
    let builder = this.supabase
      .from('recipes')
      .select(
        `id, title, slug, cover_image_url, difficulty, total_time_minutes, servings,
         like_count, save_count, rating_avg, published_at,
         author:profiles(username, avatar_url),
         cuisine:cuisines(name, slug)`
      )
      .limit(query.limit);

    if (query.mine && viewerId) {
      builder = builder.eq('author_id', viewerId);
    } else {
      builder = builder.eq('status', 'published').eq('visibility', 'public');
    }

    if (query.cuisine) {
      builder = builder.eq('cuisine.slug', query.cuisine);
    }
    if (query.author) {
      builder = builder.eq('author.username', query.author);
    }
    if (query.difficulty) {
      builder = builder.eq('difficulty', query.difficulty);
    }
    if (query.max_time) {
      builder = builder.lte('total_time_minutes', query.max_time);
    }
    if (query.q) {
      builder = builder.textSearch('search_vector', query.q, { type: 'websearch' });
    }

    if (query.sort === 'trending') {
      // Simple engagement-proxy ordering for the first pass — no materialized
      // view or cursor yet (see 07-roadmap-and-dev-plan.md's Scaling Roadmap:
      // this is the "don't preemptively over-engineer" trade-off, revisited
      // once there's enough traffic for a real trending computation to matter).
      builder = builder.order('like_count', { ascending: false }).order('save_count', { ascending: false });
    } else {
      builder = builder.order('published_at', { ascending: false });
      if (query.cursor) {
        builder = builder.lt('published_at', query.cursor);
      }
    }

    const { data, error } = await builder;
    if (error) throw error;
    return data;
  }

  async createMediaUploadUrl(userId: string, recipeId: string, filename: string) {
    const path = `${userId}/${recipeId}/${Date.now()}-${filename}`;
    const { data, error } = await this.supabase.storage
      .from('recipe-media')
      .createSignedUploadUrl(path);

    if (error) throw error;
    return data; // { path, token, signedUrl } — path here always equals the one we requested
  }
}
