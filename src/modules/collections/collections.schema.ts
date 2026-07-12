import { z } from 'zod';

export const listSavedQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListSavedQuery = z.infer<typeof listSavedQuerySchema>;
