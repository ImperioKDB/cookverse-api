import { SupabaseClient } from '@supabase/supabase-js';
import { ListNotificationsQuery } from './notifications.schema';

export type NotificationType = 'follow' | 'like' | 'comment' | 'mention' | 'system';

const SELECT = `
  id, type, entity_type, entity_id, is_read, created_at,
  actor:profiles!notifications_actor_id_fkey(username, avatar_url)
`;

export class NotificationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fire-and-forget-ish creation for a cross-cutting side effect (follow,
   * like, comment). Always call this from a service method, right after the
   * write that triggers it succeeds — never expose an insert endpoint for
   * this table to the client (see 0004_notifications.sql's RLS comment).
   * Silently no-ops on self-notification (recipient === actor).
   */
  async create(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    entityType: string,
    entityId: string
  ) {
    if (recipientId === actorId) return;

    const { error } = await this.supabase
      .from('notifications')
      .insert({ recipient_id: recipientId, actor_id: actorId, type, entity_type: entityType, entity_id: entityId });

    // Notifications are a side effect, not the primary action — log and move
    // on rather than failing the follow/like/comment the person actually
    // asked for. Swap for real error tracking (Sentry, etc.) once that exists.
    if (error) console.error('Failed to create notification:', error);
  }

  async list(recipientId: string, query: ListNotificationsQuery) {
    let builder = this.supabase
      .from('notifications')
      .select(SELECT)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (query.unread_only) builder = builder.eq('is_read', false);
    if (query.cursor) builder = builder.lt('created_at', query.cursor);

    const { data, error } = await builder;
    if (error) throw error;
    return data;
  }

  async unreadCount(recipientId: string) {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  }

  async markAllRead(recipientId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);
    if (error) throw error;
  }

  async markOneRead(id: string, recipientId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', recipientId); // ownership check baked into the filter, not a separate step
    if (error) throw error;
  }
}
