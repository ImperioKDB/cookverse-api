import { GamificationRepository } from './gamification.repository';

// Matches gamification-backend-spec.md's three P0 trigger points exactly
// — follow_back is deliberately left out of this pass per that doc's own
// flag: the source PRD/roadmap docs don't consistently list follow-back
// as in scope, and there's no agreed detection logic for it yet. The
// underlying Postgres enum still has an unused 'follow_back' value (can't
// cleanly drop enum values), but nothing writes it.
const XP_VALUES = {
  recipe_published: 25,
  comment_created: 5,
  daily_checkin: 10,
} as const;

export type XpEventType = keyof typeof XP_VALUES;

// Level curve: level N needs a cumulative 100*(N-1)^2 XP — matches the
// same formula the sync_xp_total() DB trigger uses to keep
// profiles.current_level in sync, so the API's own math and the stored
// column never disagree. gamification-backend-spec.md explicitly left the
// formula as an open decision rather than mandating one; this is that
// decision, not an assumption — not tuned against real engagement data
// yet since there isn't any, revisit once there's usage to tune it against.
function xpThresholdForLevel(level: number): number {
  return 100 * (level - 1) * (level - 1);
}

export class GamificationService {
  constructor(private readonly repository: GamificationRepository) {}

  async awardXp(userId: string, eventType: XpEventType, entityType?: string, entityId?: string) {
    await this.repository.recordXpEvent(userId, eventType, XP_VALUES[eventType], entityType, entityId);
  }

  // Response shape matches gamification-backend-spec.md's GET /gamification/me
  // exactly: xp, level, xp_into_level, xp_for_next_level, streak_current,
  // streak_longest, last_checkin_date. Field names differ from the
  // underlying profiles columns (xp_total, current_streak, ...) — that's
  // deliberate, the DB column names are an internal detail, the response
  // shape below is the actual contract with the frontend.
  async getSummary(userId: string) {
    const profile = await this.repository.getGamificationFields(userId);
    const level = profile.current_level; // stored column, kept in sync by the DB trigger — not recomputed here
    const currentLevelFloor = xpThresholdForLevel(level);
    const nextLevelThreshold = xpThresholdForLevel(level + 1);

    return {
      xp: profile.xp_total,
      level,
      xp_into_level: profile.xp_total - currentLevelFloor,
      xp_for_next_level: nextLevelThreshold - currentLevelFloor,
      streak_current: profile.current_streak,
      streak_longest: profile.longest_streak,
      last_checkin_date: profile.last_active_date,
    };
  }

  // Response shape matches gamification-backend-spec.md's POST /checkin
  // exactly — deliberately NOT the same shape as getSummary(). The spec's
  // reasoning holds: the frontend needs to distinguish "this call actually
  // counted" (already_checked_in_today) from a silent no-op, and needs
  // xp_awarded specifically to drive a "+10 XP" toast/animation on a real
  // check-in without having to diff two GET calls itself.
  async checkIn(userId: string) {
    const profile = await this.repository.getGamificationFields(userId);
    const today = new Date().toISOString().slice(0, 10); // UTC calendar day, matches the spec's suggested default

    if (profile.last_active_date === today) {
      // Idempotent — second call same day is a no-op, not an error, so a
      // client-side double-tap or retry never costs a streak point.
      return {
        already_checked_in_today: true,
        streak_current: profile.current_streak,
        streak_longest: profile.longest_streak,
        xp_awarded: 0,
        xp: profile.xp_total,
      };
    }

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const isConsecutive = profile.last_active_date === yesterday;
    // Gap of >=2 days resets to 1, not 0 — matches the spec's suggested
    // default exactly (checking in today after a gap starts a new streak
    // of 1, since you did just check in).
    const newStreak = isConsecutive ? profile.current_streak + 1 : 1;
    const newLongest = Math.max(newStreak, profile.longest_streak);

    await this.repository.updateStreak(userId, today, newStreak, newLongest);
    await this.awardXp(userId, 'daily_checkin');

    // Re-fetch rather than compute xp_total locally — the DB trigger is
    // the one source of truth for it, same principle as current_level.
    const updated = await this.repository.getGamificationFields(userId);

    return {
      already_checked_in_today: false,
      streak_current: newStreak,
      streak_longest: newLongest,
      xp_awarded: XP_VALUES.daily_checkin,
      xp: updated.xp_total,
    };
  }
}
