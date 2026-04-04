export const HOME_FEATURED_TAG = '__home_featured__';

export function hasHomeFeaturedTag(tags?: string[] | null): boolean {
  return Array.isArray(tags) && tags.includes(HOME_FEATURED_TAG);
}

export function withHomeFeaturedTag(tags?: string[] | null): string[] {
  const base = Array.isArray(tags) ? tags.filter(Boolean) : [];
  return base.includes(HOME_FEATURED_TAG)
    ? base
    : [...base, HOME_FEATURED_TAG];
}

export function withoutHomeFeaturedTag(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => tag && tag !== HOME_FEATURED_TAG);
}
