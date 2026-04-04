const UNSPLASH_API_URL = 'https://api.unsplash.com/search/photos';
const DEFAULT_TIMEOUT_MS = 8000;

interface UnsplashPhoto {
  id?: string;
  urls?: {
    small?: string;
    regular?: string;
    full?: string;
  };
}

function buildUnsplashQuery(category?: string, tags?: string[]) {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const base = normalizedCategory.includes('trend')
    ? ['photography trend', 'creative still life']
    : normalizedCategory.includes('porad')
      ? ['photo tutorial', 'camera setup']
      : normalizedCategory.includes('wiedz')
        ? ['photography knowledge', 'professional photo']
        : ['photo industry', 'professional photography'];
  const parts = [...base, category, ...(tags ?? []).slice(0, 4)].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeUnsplashUrl(url?: string | null) {
  const value = (url ?? '').trim();
  if (!value) return null;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  return value;
}

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function extractPhotoUrl(photo: UnsplashPhoto) {
  return normalizeUnsplashUrl(photo.urls?.regular ?? photo.urls?.small ?? photo.urls?.full ?? null);
}

async function requestUnsplash(
  query: string,
  perPage = 1,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape',
) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.warn('[Unsplash] UNSPLASH_ACCESS_KEY is missing. Skipping Unsplash lookup.');
    return null;
  }

  if (!query.trim()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${UNSPLASH_API_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          'Accept-Version': 'v1',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error('[Unsplash] Request failed:', response.status, await response.text());
      return null;
    }

    return await response.json() as { results?: UnsplashPhoto[] };
  } catch (error) {
    console.warn('[Unsplash] Request error:', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function findUnsplashCoverImage(params: { category?: string; tags?: string[] }) {
  const query = buildUnsplashQuery(params.category, params.tags);
  if (!query.trim()) {
    return null;
  }

  const data = await requestUnsplash(query, 1, 'landscape');
  const first = data?.results?.[0];
  return first ? extractPhotoUrl(first) : null;
}

export async function findUnsplashGalleryImages(
  params: { category?: string; tags?: string[] },
  max = 6,
) {
  if (max <= 0) return [];

  const query = buildUnsplashQuery(params.category, params.tags);
  if (!query.trim()) return [];

  const perPage = Math.min(Math.max(max * 2, 6), 20);
  const [landscapeData, portraitData] = await Promise.all([
    requestUnsplash(query, perPage, 'landscape'),
    requestUnsplash(query, Math.max(4, Math.floor(perPage / 2)), 'portrait'),
  ]);

  const landscape = (landscapeData?.results ?? []).map(extractPhotoUrl);
  const portrait = (portraitData?.results ?? []).map(extractPhotoUrl);

  return uniqStrings([...landscape, ...portrait]).slice(0, max);
}
