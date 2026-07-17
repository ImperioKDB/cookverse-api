import { ProfilesRepository } from './profiles.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { UpdateProfileInput } from './profiles.schema';

// No GamificationService dependency here — follow-back XP is deliberately
// left out of this pass per gamification-backend-spec.md's own flag: the
// source PRD/roadmap docs don't consistently list follow-back as in P0
// scope, and there's no agreed detection logic yet. ProfilesRepository
// still has isFollowing() available (harmless, small, genuinely useful)
// for whenever this gets picked back up with a real decision behind it.
export class ProfilesService {
  constructor(
    private readonly repository: ProfilesRepository,
    private readonly notifications: NotificationsRepository
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

    await this.repository.follow(viewerId, target.id);
    await this.notifications.create(target.id, viewerId, 'follow', 'profile', viewerId);
  }

  async unfollow(viewerId: string, targetUsername: string) {
    const target = await this.repository.findByUsername(targetUsername, null);
    if (!target) throw new Error('profile_not_found');
    await this.repository.unfollow(viewerId, target.id);
  }
}
