import { ProfilesRepository } from './profiles.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { GamificationService } from '../gamification/gamification.service';
import { UpdateProfileInput } from './profiles.schema';

export class ProfilesService {
  constructor(
    private readonly repository: ProfilesRepository,
    private readonly notifications: NotificationsRepository,
    private readonly gamification: GamificationService
  ) {}

  getPublicProfile(username: string, viewerId: string | null) {
    return this.repository.findByUsername(username, viewerId);
  }

  getMyProfile(userId: string) {
    return this.repository.findById(userId);
  }

  updateMyProfile(userId: string, input: UpdateProfileInput) {
    return this.repository.updateOwnProfile(userId, input);
  }

  async follow(viewerId: string, targetUsername: string) {
    const target = await this.repository.findByUsername(targetUsername, null);
    if (!target) throw new Error('profile_not_found');

    // Check before creating the row: if target already follows viewerId,
    // this new follow completes a mutual connection — the specific case
    // 07-roadmap-and-dev-plan.md calls out for XP ("XP for publish/
    // comment/follow-back actions"), meant to reward two-way engagement
    // rather than one-way mass-following.
    const isFollowBack = await this.repository.isFollowing(target.id, viewerId);

    await this.repository.follow(viewerId, target.id);
    await this.notifications.create(target.id, viewerId, 'follow', 'profile', viewerId);

    if (isFollowBack) {
      await this.gamification.awardXp(viewerId, 'follow_back', 'profile', target.id);
    }
  }

  async unfollow(viewerId: string, targetUsername: string) {
    const target = await this.repository.findByUsername(targetUsername, null);
    if (!target) throw new Error('profile_not_found');
    await this.repository.unfollow(viewerId, target.id);
  }
}
