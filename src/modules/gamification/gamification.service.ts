import { GamificationRepository } from './gamification.repository';

const XP_VALUES = {
  recipe_published: 50,
  comment_posted: 5,
  follow_back: 20,
  daily_checkin: 10,
} as const;

export type XpEventType = keyof typeof XP_VALUES;

function xpThresholdForLevel(level: number): number {
  return 100 * (level - 1) * (level - 1);
}

export class GamificationService {
  constructor(private readonly repository: GamificationRepository) {}

  async awardXp(userId: string, eventType: XpEventType, entityType?: string, entityId?: string) {
    await this.repository.recordXpEvent(userId, eventType, XP_VALUES[eventType], entityType, entityId);
  }

  async getSummary(userId: string) {
    const profile = await this.repository.getGamificationFields(userId);
    const level = profile.current_level;
    const currentLevelFloor = xpThresholdForLevel(level);
    const nextLevelThreshold = xpThresholdForLevel(level + 1);

    return {
      xp_total: profile.xp_total,
      level,
      xp_into_level: profile.xp_total - currentLevelFloor,
      xp_for_next_level: nextLevelThreshold - currentLevelFloor,
      current_streak: profile.current_streak,
      longest_streak: profile.longest_streak,
      last_active_date: profile.last_active_date,
    };
  }

  async checkIn(userId: string) {
    const profile = await this.repository.getGamificationFields(userId);
    const today = new Date().toISOString().slice(0, 10);

    if (profile.last_active_date === today) {
      return this.getSummary(userId);
    }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const isConsecutive = profile.last_active_date === yesterday;
    const newStreak = isConsecutive ? profile.current_streak + 1 : 1;
    const newLongest = Math.max(newStreak, profile.longest_streak);

    await this.repository.updateStreak(userId, today, newStreak, newLongest);
    await this.awardXp(userId, 'daily_checkin');

    return this.getSummary(userId);
  }
}
