import { NotificationsRepository } from './notifications.repository';
import { ListNotificationsQuery } from './notifications.schema';

export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  list(recipientId: string, query: ListNotificationsQuery) {
    return this.repository.list(recipientId, query);
  }

  unreadCount(recipientId: string) {
    return this.repository.unreadCount(recipientId);
  }

  markAllRead(recipientId: string) {
    return this.repository.markAllRead(recipientId);
  }

  markOneRead(id: string, recipientId: string) {
    return this.repository.markOneRead(id, recipientId);
  }
}
