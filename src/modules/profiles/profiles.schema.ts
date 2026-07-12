import { z } from 'zod';

export const skillLevelEnum = z.enum(['beginner', 'home_cook', 'skilled', 'professional']);

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  skill_level: skillLevelEnum.optional(),
  location_text: z.string().max(120).optional(),
  website_url: z.string().url().optional(),
  // Replaces the full favorite-cuisines set on every call — simplest correct
  // behavior for a short list; move to add/remove endpoints only if this
  // ever needs to scale past a few dozen selections.
  cuisine_ids: z.array(z.string().uuid()).max(20).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const avatarUploadRequestSchema = z.object({
  filename: z.string().min(1).max(200),
});
