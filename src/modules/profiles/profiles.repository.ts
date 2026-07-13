import { SupabaseClient } from '@supabase/supabase-js';
import { UpdateProfileInput } from './profiles.schema';

const PUBLIC_COLUMNS =
  'id, username, full_name, avatar_url, bio, skill_level, follower_count, following_count, recipe_count, onboarding_completed, created_at';

export class ProfilesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByUsername(username: string, viewerId: string | null) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`${PUBLIC_COLUMNS}, profile_cuisines(cuisines(id, name, slug))`)
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    let is_following = false;
    if (viewerId && viewerId !== data.id) {
      const { data: followRow } = await this.supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', viewerId)
        .eq('following_id', data.id)
        .maybeSingle();
      is_following = Boolean(followRow);
    }

    return { ...data, is_following };
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

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error("You can't follow yourself.");
    }
    const { error } = await this.supabase
      .from('follows')
      .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' });
    if (error) throw error;
  }

  async createAvatarUploadUrl(userId: string, filename: string) {
    const path = `${userId}/${Date.now()}-${filename}`;
    const { data, error } = await this.supabase.storage.from('avatars').createSignedUploadUrl(path);
    if (error) throw error;
    return data; // { path, token, signedUrl }
  }

  async unfollow(followerId: string, followingId: string) {
    const { error } = await this.supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw error;
  }
}
