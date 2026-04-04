export type CoverLike = {
  cover_image?: string | null;
  cover_url?: string | null;
};

export function resolveCoverImage(row?: CoverLike | null): string | null {
  if (!row) return null;
  return row.cover_image ?? row.cover_url ?? null;
}
