const PEXELS_API_URL = 'https://api.pexels.com/v1/search';
const DEFAULT_TIMEOUT_MS = 8000;

interface PexelsPhoto {
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    landscape?: string;
    portrait?: string;
  };
}

type PexelsOrientation = 'landscape' | 'portrait' | 'square';

function buildPexelsQuery(category?: string, tags?: string[]) {
  const normalizedCategory = (category ?? '').trim().toLowerCase();
  const base = normalizedCategory.includes('trend')
    ? ['photography trend', 'creative studio']
    : normalizedCategory.includes('porad')
      ? ['photo tutorial', 'camera setup']
      : normalizedCategory.includes('wiedz')
        ? ['photography knowledge', 'professional photo']
        : ['photo industry', 'professional photography'];
  const parts = [...base, category, ...(tags ?? []).slice(0, 4)].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizePexelsUrl(url?: string | null) {
  const value = (url ?? '').trim();
  if (!value) return null;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  return value;
}

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function extractPhotoUrl(photo: PexelsPhoto) {
  const src = photo.src;
  return normalizePexelsUrl(
    src?.landscape ??
    src?.large2x ??
    src?.large ??
    src?.medium ??
    src?.original ??
    src?.portrait ??
    null,
  );
}

function getPexelsApiKey() {
  return (
    process.env.PEXELS_API_KEY ??
    process.env.PEXELS_ACCESS_KEY ??
    process.env.PEXEL_ACCESS_KEY ??
    ''
  ).trim();
}

async function requestPexels(
  query: string,
  perPage = 1,
  orientation: PexelsOrientation = 'landscape',
) {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    console.warn('[Pexels] Missing API key. Set PEXELS_API_KEY or PEXEL_ACCESS_KEY.');
    return null;
  }

  if (!query.trim()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${PEXELS_API_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&locale=pl-PL`,
      {
        headers: {
          Authorization: apiKey,
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error('[Pexels] Request failed:', response.status, await response.text());
      return null;
    }

    return await response.json() as { photos?: PexelsPhoto[] };
  } catch (error) {
    console.warn('[Pexels] Request error:', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function findPexelsCoverImage(params: { category?: string; tags?: string[] }) {
  const query = buildPexelsQuery(params.category, params.tags);
  if (!query.trim()) return null;

  const data = await requestPexels(query, 1, 'landscape');
  const first = data?.photos?.[0];
  return first ? extractPhotoUrl(first) : null;
}

export async function findPexelsGalleryImages(
  params: { category?: string; tags?: string[] },
  max = 6,
) {
  if (max <= 0) return [];

  const query = buildPexelsQuery(params.category, params.tags);
  if (!query.trim()) return [];

  const perPage = Math.min(Math.max(max * 2, 6), 30);
  const [landscapeData, portraitData, squareData] = await Promise.all([
    requestPexels(query, perPage, 'landscape'),
    requestPexels(query, Math.max(4, Math.floor(perPage / 2)), 'portrait'),
    requestPexels(query, Math.max(4, Math.floor(perPage / 2)), 'square'),
  ]);

  const landscape = (landscapeData?.photos ?? []).map(extractPhotoUrl);
  const portrait = (portraitData?.photos ?? []).map(extractPhotoUrl);
  const square = (squareData?.photos ?? []).map(extractPhotoUrl);

  return uniqStrings([...landscape, ...portrait, ...square]).slice(0, max);
}
