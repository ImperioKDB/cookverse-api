/**
 * Turns a title into a URL-safe slug and appends a short random suffix so
 * two recipes named "Jollof Rice" don't collide on the unique slug column.
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'recipe'}-${suffix}`;
}
