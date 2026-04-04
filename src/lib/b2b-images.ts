import { supabaseAdmin } from '@/lib/supabase-admin';

const B2B_XML_URL = process.env.B2B_XML_URL ?? '';

type B2BCoverInput = {
  category?: string;
  tags?: string[];
  title?: string;
  skuHints?: string[];
  strictSku?: string;
};

type ScoredImage = {
  imageUrl: string;
  score: number;
};

type ScoredProduct = {
  sku: string;
  imageUrl: string | null;
  score: number;
};

type ProductImageRow = {
  sku: string;
  image_url: string | null;
  b2b_url?: string | null;
};

function imageBaseKey(imageUrl?: string) {
  const raw = imageUrl ?? '';
  const fileName = raw.split('/').pop() ?? '';
  return fileName
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .replace(/_\d+$/i, '');
}

function imageSequence(imageUrl?: string) {
  const raw = imageUrl ?? '';
  const fileName = raw.split('/').pop() ?? '';
  const match = fileName.match(/_(\d+)\.(jpe?g|png|webp)$/i);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function norm(value?: string) {
  return (value ?? '').trim().toLowerCase();
}

function tokenize(values: string[]) {
  return values
    .map((value) => norm(value))
    .flatMap((value) => value.split(/[\s,.;:!?()[\]-]+/g))
    .filter((token) => token.length >= 3);
}

function normalizeSku(sku?: string) {
  return (sku ?? '').trim().toUpperCase();
}

function isSkuLike(value?: string) {
  const cleaned = normalizeSku(value);
  if (!cleaned) return false;
  const hasStrongPrefix = /^[A-Z]{2,}/.test(cleaned);
  const startsNumeric = /^[0-9]/.test(cleaned);
  return cleaned.length >= 6 && (hasStrongPrefix || startsNumeric);
}

function uniqStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function toLowerAscii(value: string) {
  return value.trim().toLowerCase();
}

function buildImageUrlCandidates(url: string) {
  const candidates = [url];
  // Common typo variant from feed/manual edits: "-2.jpg" vs "_2.jpg"
  if (/-\d+\.(jpe?g|png|webp)$/i.test(url)) {
    candidates.push(url.replace(/-(\d+)\.(jpe?g|png|webp)$/i, '_$1.$2'));
  }
  return uniqStrings(candidates);
}

function isLikelyImageResponse(contentType: string | null) {
  if (!contentType) return true;
  const value = contentType.toLowerCase();
  // Some B2B servers return application/octet-stream for image assets.
  if (value.includes('text/html')) return false;
  return true;
}

async function probeImageUrl(url: string) {
  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 1200);
    const head = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: headController.signal,
    });
    clearTimeout(headTimeout);
    if (head.ok && isLikelyImageResponse(head.headers.get('content-type'))) return true;
    if (head.ok) return false;
    if (head.status !== 405) return false;
  } catch {
    // Fall through to GET probe
  }

  try {
    const getController = new AbortController();
    const getTimeout = setTimeout(() => getController.abort(), 1200);
    const get = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: getController.signal,
    });
    clearTimeout(getTimeout);
    return get.ok && isLikelyImageResponse(get.headers.get('content-type'));
  } catch {
    return false;
  }
}

export async function repairAndValidateB2BImageUrl(url?: string | null) {
  if (!url) return null;
  for (const candidate of buildImageUrlCandidates(url)) {
    if (await probeImageUrl(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function resolveReliableSku(input: B2BCoverInput) {
  const strictSku = normalizeSku(input.strictSku);
  const candidateHints = uniqStrings([strictSku, ...((input.skuHints ?? []).map(normalizeSku))])
    .filter((value) => isSkuLike(value))
    .slice(0, 8);

  if (!candidateHints.length) {
    return null;
  }

  if (candidateHints.length === 1) {
    return candidateHints[0];
  }

  const exactRows = await supabaseAdmin
    .from('products')
    .select('sku')
    .in('sku', candidateHints);

  if (!exactRows.error && exactRows.data?.length) {
    const exactSkus = new Set(
      exactRows.data
        .map((row) => normalizeSku((row as { sku?: string }).sku))
        .filter(Boolean)
    );

    for (const hint of candidateHints) {
      if (exactSkus.has(hint)) {
        return hint;
      }
    }
  }

  return candidateHints[0];
}

async function findProductBySku(sku: string): Promise<ProductImageRow | null> {
  const normalized = normalizeSku(sku);
  if (!isSkuLike(normalized)) {
    return null;
  }

  const exact = await supabaseAdmin
    .from('products')
    .select('sku, image_url, b2b_url')
    .eq('sku', normalized)
    .maybeSingle();

  if (!exact.error && exact.data) {
    return exact.data as ProductImageRow;
  }

  const prefix = await supabaseAdmin
    .from('products')
    .select('sku, image_url, b2b_url')
    .ilike('sku', `${normalized}%`)
    .limit(1)
    .maybeSingle();

  if (!prefix.error && prefix.data) {
    return prefix.data as ProductImageRow;
  }

  return null;
}

async function collectImagesFromKnownUrl(imageUrl?: string | null, max = 6) {
  if (!imageUrl) {
    return [] as string[];
  }

  const repairedSeed = await repairAndValidateB2BImageUrl(imageUrl);
  const seed = repairedSeed ?? imageUrl;
  const match = seed.match(/^(https?:\/\/.+\/)([^/.]+)\.(jpe?g|png|webp)$/i);
  if (!match) {
    return repairedSeed ? [repairedSeed] : [];
  }

  const baseDir = match[1];
  const stem = match[2];
  const ext = match[3].toLowerCase();
  const base = stem.replace(/(?:[_-]\d+)$/i, '');
  const exts = uniqStrings([ext, 'jpg', 'jpeg', 'png', 'webp']);
  const stems = uniqStrings([stem, base]);
  const suffixes = [
    '',
    ...Array.from({ length: 15 }, (_, index) => `_${index + 1}`),
    ...Array.from({ length: 15 }, (_, index) => `-${index + 1}`),
  ];

  const urls = new Set<string>();
  if (repairedSeed) {
    urls.add(repairedSeed);
  }

  for (const root of stems) {
    for (const suffix of suffixes) {
      for (const currentExt of exts) {
        urls.add(`${baseDir}${toLowerAscii(root)}${suffix}.${currentExt}`);
      }
    }
  }

  const found: string[] = [];
  for (const url of urls) {
    if (await probeImageUrl(url)) {
      found.push(url);
      if (found.length >= max) {
        return uniqStrings(found).slice(0, max);
      }
    }
  }

  return uniqStrings(found).slice(0, max);
}

function scoreCandidate(
  input: B2BCoverInput,
  fields: { name?: string; category?: string; sku?: string; imageUrl?: string }
) {
  const title = norm(input.title);
  const category = norm(input.category);
  const key = imageBaseKey(fields.imageUrl);
  const haystack = `${norm(fields.name)} ${norm(fields.category)} ${norm(fields.sku)} ${key}`;

  let score = 0;
  if (category && haystack.includes(category)) score += 5;
  if (category && norm(fields.category).includes(category)) score += 3;

  const tokens = tokenize([...(input.tags ?? []), title]);
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }

  const sku = normalizeSku(fields.sku);
  const skuHints = (input.skuHints ?? []).map(normalizeSku).filter(Boolean);
  if (sku && skuHints.includes(sku)) {
    score += 12;
  }

  // Prefer primary image file (no _2/_3 suffix) for article covers.
  if (imageSequence(fields.imageUrl) === 1) score += 1;

  return score;
}

function pickBestImage(candidates: ScoredImage[]) {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  return sorted[0].imageUrl;
}

function pickBestProduct(candidates: ScoredProduct[]) {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl));
  });
  return sorted[0];
}

async function findImageFromProductsTable(input: B2BCoverInput) {
  const strictSku = normalizeSku(input.strictSku);
  if (isSkuLike(strictSku)) {
    const exact = await supabaseAdmin
      .from('products')
      .select('image_url')
      .eq('sku', strictSku)
      .maybeSingle();

    if (!exact.error && exact.data?.image_url) {
      const repaired = await repairAndValidateB2BImageUrl(exact.data.image_url as string);
      if (repaired) return repaired;
    }

    const fromPattern = await findImageBySkuPattern({ skuHints: [strictSku] });
    if (fromPattern) return fromPattern;

    // Strict mode: do not fall back to fuzzy matching (prevents wrong product image).
    return null;
  }

  const normalizedHints = (input.skuHints ?? []).map(normalizeSku).filter(Boolean);

  if (normalizedHints.length > 0) {
    // 1) Hard match by SKU first (exact), then prefix.
    for (const hint of normalizedHints) {
      const exact = await supabaseAdmin
        .from('products')
        .select('sku, image_url')
        .eq('sku', hint)
        .maybeSingle();

      if (!exact.error && exact.data?.image_url) {
        const repaired = await repairAndValidateB2BImageUrl(exact.data.image_url as string);
        if (repaired) return repaired;
      }
    }

    for (const hint of normalizedHints) {
      const prefix = await supabaseAdmin
        .from('products')
        .select('sku, image_url')
        .ilike('sku', `${hint}%`)
        .limit(10);

      if (prefix.error || !prefix.data?.length) continue;

      for (const row of prefix.data) {
        const imageUrl = (row.image_url as string | null) ?? null;
        if (!imageUrl) continue;
        const repaired = await repairAndValidateB2BImageUrl(imageUrl);
        if (repaired) return repaired;
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('image_url, name, category, sku')
    .limit(2000);

  if (error || !data) {
    if (error) {
      console.error('[B2B Images] products query failed:', error.message);
    }
    return null;
  }

  const scoredProducts = data.map((row) => ({
      sku: (row.sku as string) ?? '',
      imageUrl: (row.image_url as string | null) ?? null,
      score: scoreCandidate(input, {
        name: row.name as string,
        category: row.category as string,
        sku: row.sku as string,
        imageUrl: (row.image_url as string | undefined) ?? undefined,
      }),
    }));

  const withImage = scoredProducts
    .filter((row) => row.imageUrl)
    .sort((a, b) => b.score - a.score);
  for (const row of withImage.slice(0, 8)) {
    const imageUrl = row.imageUrl;
    if (!imageUrl) continue;
    for (const candidate of buildImageUrlCandidates(imageUrl)) {
      if (await probeImageUrl(candidate)) {
        return candidate;
      }
    }
  }

  const bestProduct = pickBestProduct(scoredProducts);
  if (!bestProduct) return null;

  const topSkuHints = scoredProducts
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((row) => row.sku)
    .filter(Boolean);

  const bySku = await findImageBySkuPattern({ skuHints: [bestProduct.sku, ...topSkuHints] });
  if (bySku) return bySku;

  return null;
}

async function findImageFromXmlFeed(input: B2BCoverInput) {
  if (!B2B_XML_URL) {
    return null;
  }

  const response = await fetch(B2B_XML_URL, {
    headers: { Accept: 'application/xml, text/xml' },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    console.error('[B2B Images] XML fetch failed:', response.status);
    return null;
  }

  const xmlText = await response.text();
  const productMatches = xmlText.matchAll(/<product[^>]*>([\s\S]*?)<\/product>/g);
  const scored: ScoredImage[] = [];

  for (const match of productMatches) {
    const block = match[1];
    const name =
      block.match(/<name[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/name>/)?.[1]
      ?? block.match(/<name[^>]*>([^<]*)<\/name>/)?.[1]
      ?? '';
    const sku =
      block.match(/<sku[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/sku>/)?.[1]
      ?? block.match(/<sku[^>]*>([^<]*)<\/sku>/)?.[1]
      ?? '';
    const categories = [...block.matchAll(/<category[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)]
      .map((item) => item[1])
      .join(' ');
    const imageUrl = block.match(/<photo[^>]*url="([^"]+)"/)?.[1];

    if (!imageUrl) continue;
    scored.push({
      imageUrl,
      score: scoreCandidate(input, { name, category: categories, sku, imageUrl }),
    });
  }

  return pickBestImage(scored);
}

async function findProductPageUrlBySku(sku: string) {
  const row = await findProductBySku(sku);
  if (!row?.b2b_url) return null;
  return row.b2b_url;
}

async function collectImagesFromProductPage(input: B2BCoverInput, max = 6) {
  const strictSku = normalizeSku(input.strictSku);
  const candidateSku = isSkuLike(strictSku)
    ? strictSku
    : normalizeSku((input.skuHints ?? [])[0]);

  if (!isSkuLike(candidateSku)) {
    return [] as string[];
  }

  const productUrl = await findProductPageUrlBySku(candidateSku);
  if (!productUrl) {
    return [] as string[];
  }

  try {
    const response = await fetch(productUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) return [] as string[];

    const html = await response.text();
    const host = 'https://www.b2b.gedeonpolska.com';

    const abs = [...html.matchAll(/https?:\/\/(?:www\.)?b2b\.gedeonpolska\.com\/zasoby\/import\/[^\s"'<>]+\.(?:jpe?g|png|webp)/gi)]
      .map((m) => m[0]);
    const rel = [...html.matchAll(/\/zasoby\/import\/[^\s"'<>]+\.(?:jpe?g|png|webp)/gi)]
      .map((m) => `${host}${m[0]}`);

    const allCandidates = uniqStrings([...abs, ...rel]);
    const candidatesWithSku = allCandidates
      .filter((url) => url.toLowerCase().includes(candidateSku.toLowerCase()));
    const candidates = candidatesWithSku.length > 0 ? candidatesWithSku : allCandidates;

    const found: string[] = [];
    for (const candidate of candidates) {
      const repaired = await repairAndValidateB2BImageUrl(candidate);
      if (repaired) {
        found.push(repaired);
        if (found.length >= max) break;
      }
    }

    return uniqStrings(found).slice(0, max);
  } catch {
    return [] as string[];
  }
}

async function collectImagesBySkuPattern(input: B2BCoverInput, max = 6) {
  const hints = (input.skuHints ?? []).map(normalizeSku).filter(Boolean).slice(0, 3);
  if (!hints.length) return [] as string[];

  const host = 'https://www.b2b.gedeonpolska.com/zasoby/import';
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  const found: string[] = [];

  for (const sku of hints) {
    const file = sku.toLowerCase();
    const folder = file.charAt(0);
    const folderCandidates = [folder, ''];

    const suffixes = [
      '',
      ...Array.from({ length: 15 }, (_, index) => `_${index + 1}`),
      ...Array.from({ length: 15 }, (_, index) => `-${index + 1}`),
    ];
    for (const suffix of suffixes) {
      for (const ext of exts) {
        for (const dir of folderCandidates) {
          const base = dir ? `${host}/${dir}` : host;
          const url = `${base}/${file}${suffix}.${ext}`;
          if (await probeImageUrl(url)) {
            found.push(url);
            if (found.length >= max) {
              return uniqStrings(found).slice(0, max);
            }
          }
        }
      }
    }
  }

  return uniqStrings(found).slice(0, max);
}

async function findImageBySkuPattern(input: B2BCoverInput) {
  const images = await collectImagesBySkuPattern(input, 1);
  return images[0] ?? null;
}

export async function findB2BCoverImage(input: B2BCoverInput) {
  const strictSku = await resolveReliableSku(input);
  if (isSkuLike(strictSku ?? undefined)) {
    const product = await findProductBySku(strictSku as string);
    const fromKnown = await collectImagesFromKnownUrl(product?.image_url ?? null, 1);
    if (fromKnown[0]) return fromKnown[0];

    const strictPattern = await findImageBySkuPattern({ skuHints: [strictSku as string] });
    if (strictPattern) return strictPattern;

    const fromPage = await collectImagesFromProductPage({ ...input, strictSku: strictSku as string }, 1);
    if (fromPage[0]) return fromPage[0];
  }

  const fromProducts = await findImageFromProductsTable(input);
  if (fromProducts) {
    return fromProducts;
  }

  const fromSkuPattern = await findImageBySkuPattern(input);
  if (fromSkuPattern) {
    return fromSkuPattern;
  }

  return await findImageFromXmlFeed(input);
}

export async function findB2BGalleryImages(input: B2BCoverInput, max = 6) {
  const strictSku = await resolveReliableSku(input);
  if (isSkuLike(strictSku ?? undefined)) {
    const product = await findProductBySku(strictSku as string);
    const fromKnown = await collectImagesFromKnownUrl(product?.image_url ?? null, max);
    const strictImages = await collectImagesBySkuPattern({ skuHints: [strictSku as string] }, max);
    const fromPage = await collectImagesFromProductPage({ ...input, strictSku: strictSku as string }, max);

    const merged = uniqStrings([...fromKnown, ...strictImages, ...fromPage]).slice(0, max);
    if (merged.length > 0) {
      return merged;
    }

    return strictImages.slice(0, max);
  }

  const patternImages = await collectImagesBySkuPattern(input, max);
  if (patternImages.length) {
    return patternImages.slice(0, max);
  }

  const cover = await findB2BCoverImage(input);
  return cover ? [cover] : [];
}
