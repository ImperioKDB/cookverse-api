import { ProfilesRepository } from './profiles.repository';
import { UpdateProfileInput } from './profiles.schema';

export class ProfilesService {
  constructor(private readonly repository: ProfilesRepository) {}

  getPublicProfile(username: string) {
    return this.repository.findByUsername(username);
  }

  getMyProfile(userId: string) {
    return this.repository.findById(userId);
  }

  updateMyProfile(userId: string, input: UpdateProfileInput) {
    return this.repository.updateOwnProfile(userId, input);
  }
}
