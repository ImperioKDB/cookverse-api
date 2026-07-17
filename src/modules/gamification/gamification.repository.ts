import { SupabaseClient } from '@supabase/supabase-js';
import { XpEventType } from './gamification.service';

export class GamificationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async recordXpEvent(
    userId: string,
    action: XpEventType,
    xpAmount: number,
    entityType?: string,
    entityId?: string
  ) {
    // profiles.xp_total and .current_level are kept in sync by the
    // trg_xp_events_sync trigger on this insert — never updated directly
    // here, same pattern as every other denormalized counter in this
    // project.
    const { error } = await this.supabase
      .from('xp_events')
      .insert({
        user_id: userId,
        action,
        xp_amount: xpAmount,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
      });
    if (error) throw error;
  }

  async getGamificationFields(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('xp_total, current_level, current_streak, longest_streak, last_active_date')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateStreak(userId: string, activeDate: string, currentStreak: number, longestStreak: number) {
    const { error } = await this.supabase
      .from('profiles')
      .update({ last_active_date: activeDate, current_streak: currentStreak, longest_streak: longestStreak })
      .eq('id', userId);
    if (error) throw error;
  }
}
