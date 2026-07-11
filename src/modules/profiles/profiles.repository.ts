import { SupabaseClient } from '@supabase/supabase-js';
import { UpdateProfileInput } from './profiles.schema';

const PUBLIC_COLUMNS =
  'id, username, full_name, avatar_url, bio, skill_level, follower_count, following_count, recipe_count, created_at';

export class ProfilesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByUsername(username: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`${PUBLIC_COLUMNS}, profile_cuisines(cuisines(id, name, slug))`)
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findById(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(PUBLIC_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateOwnProfile(userId: string, input: UpdateProfileInput) {
    const { cuisine_ids, ...profileFields } = input;

    if (Object.keys(profileFields).length > 0) {
      const { error } = await this.supabase
        .from('profiles')
        .update({ ...profileFields, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
    }

    if (cuisine_ids) {
      const { error: deleteError } = await this.supabase
        .from('profile_cuisines')
        .delete()
        .eq('profile_id', userId);
      if (deleteError) throw deleteError;

      if (cuisine_ids.length > 0) {
        const rows = cuisine_ids.map((cuisine_id) => ({ profile_id: userId, cuisine_id }));
        const { error: insertError } = await this.supabase.from('profile_cuisines').insert(rows);
        if (insertError) throw insertError;
      }
    }

    return this.findById(userId);
  }
}
