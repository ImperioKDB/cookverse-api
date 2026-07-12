import { ProfilesRepository } from './profiles.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { UpdateProfileInput } from './profiles.schema';

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
