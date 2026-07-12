import { z } from 'zod';

export const notificationTypeEnum = z.enum(['follow', 'like', 'comment', 'mention', 'system']);

export const listNotificationsQuerySchema = z.object({
  unread_only: z.coerce.boolean().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
