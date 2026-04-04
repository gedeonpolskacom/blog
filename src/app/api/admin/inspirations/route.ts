import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const DEFAULT_BUCKET = process.env.INSPIRATIONS_BUCKET?.trim() || 'inspirations';
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_STORAGE_SCAN_ITEMS = Math.max(
  1000,
  Number(process.env.INSPIRATIONS_STORAGE_SCAN_MAX_ITEMS ?? 10000) || 10000,
);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const ALLOWED_URL_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
]);

type ProductLookupRow = {
  id: string;
  sku: string;
  name?: string | null;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  category?: string | null;
  [key: string]: unknown;
};

function pickText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return null;
}

function parseQuotaBytes() {
  const rawBytes = process.env.INSPIRATIONS_BUCKET_QUOTA_BYTES?.trim();
  const rawMb = process.env.INSPIRATIONS_BUCKET_QUOTA_MB?.trim();

  if (rawBytes) {
    const parsed = Number(rawBytes);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  if (rawMb) {
    const parsed = Number(rawMb);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed * 1024 * 1024);
    }
  }

  return null;
}

function toMegabytes(bytes: number | null) {
  if (!Number.isFinite(bytes ?? NaN) || bytes == null) return null;
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function sanitizeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function sanitizeTag(tag: string | null) {
  const normalized = (tag ?? '').trim().toLowerCase();
  if (!normalized) return 'albumy';
  return normalized.replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'albumy';
}

function normalizeAspectRatio(aspectRatio: string | null) {
  const value = (aspectRatio ?? '').trim().toLowerCase();
  if (!value) return '4/3';
  const match = value.match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return '4/3';
  return `${match[1]}/${match[2]}`;
}

function toIsoOrNow(value: string | null | undefined) {
  const candidate = (value ?? '').trim();
  if (!candidate) return new Date().toISOString();
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toIsoOrNull(value: string | null | undefined) {
  const candidate = (value ?? '').trim();
  if (!candidate) return null;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseTruthy(value: FormDataEntryValue | null, fallback = false) {
  if (value == null) return fallback;
  const normalized = value.toString().trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function normalizeUrl(url: string | null | undefined) {
  const value = (url ?? '').trim();
  if (!value) return null;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  return value;
}

function isLikelyImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    const pathname = parsed.pathname.toLowerCase();
    for (const extension of ALLOWED_URL_EXTENSIONS) {
      if (pathname.endsWith(extension)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function extractFilenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '';
    return decodeURIComponent(lastSegment);
  } catch {
    return '';
  }
}

function collectSourceUrls(formData: FormData) {
  const directValue = formData.get('source_url')?.toString() ?? '';
  const textareaValue = formData.get('source_urls')?.toString() ?? '';
  const repeatedValues = formData
    .getAll('source_urls')
    .map((entry) => entry.toString())
    .join('\n');

  const merged = [directValue, textareaValue, repeatedValues]
    .filter(Boolean)
    .join('\n');

  const unique = new Set<string>();
  const parsed: string[] = [];

  for (const rawLine of merged.split(/\r?\n/)) {
    const normalized = normalizeUrl(rawLine);
    if (!normalized) continue;
    if (!isLikelyImageUrl(normalized)) continue;
    if (unique.has(normalized)) continue;
    unique.add(normalized);
    parsed.push(normalized);
  }

  return parsed;
}

function isTruthyQueryValue(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function extractSkuFromFilename(filename: string): string | null {
  const withoutExt = filename.replace(/\.[^.]+$/, '').trim().toUpperCase();
  if (!withoutExt) return null;

  const numberedMatch = withoutExt.match(/^(.*?)[_-](\d{1,2})$/);
  if (numberedMatch) {
    const index = Number(numberedMatch[2]);
    if (Number.isFinite(index) && index >= 1 && index <= 15) {
      const base = numberedMatch[1].replace(/[^A-Z0-9-]/g, '');
      return base || null;
    }
  }

  const cleaned = withoutExt.replace(/[^A-Z0-9-]/g, '');
  return cleaned || null;
}

function mapB2BCategoryToTag(category: string | null | undefined) {
  const normalized = (category ?? '').toLowerCase();
  if (!normalized) return 'albumy';
  if (normalized.includes('album')) return 'albumy';
  if (normalized.includes('ramk') || normalized.includes('antyram')) return 'ramki';
  if (normalized.includes('media') || normalized.includes('drylab')) return 'media';
  if (normalized.includes('studio')) return 'studio';
  if (normalized.includes('kodak') || normalized.includes('papier')) return 'media';
  return 'albumy';
}

async function ensureBucket() {
  const result = await supabaseAdmin.storage.createBucket(DEFAULT_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_UPLOAD_SIZE}`,
  });

  if (!result.error) return;

  const message = result.error.message.toLowerCase();
  if (message.includes('already exists') || message.includes('duplicate')) {
    return;
  }

  throw result.error;
}

async function loadProductsBySkus(skus: string[]) {
  if (!skus.length) {
    return new Map<string, ProductLookupRow>();
  }

  const skuCandidates = Array.from(new Set(
    skus.flatMap((sku) => [sku, sku.toLowerCase(), sku.toUpperCase()]),
  ));

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .in('sku', skuCandidates);

  if (error) throw error;

  const map = new Map<string, ProductLookupRow>();
  for (const row of (data ?? []) as ProductLookupRow[]) {
    if (typeof row.sku !== 'string' || !row.sku.trim()) continue;
    map.set(row.sku.trim().toUpperCase(), row);
  }
  return map;
}

async function scanBucketUsageRecursively(
  bucket: string,
  path: string,
  state: { filesCount: number; usedBytes: number; scannedItems: number; truncated: boolean },
) {
  let offset = 0;
  const limit = 100;

  while (true) {
    if (state.scannedItems >= MAX_STORAGE_SCAN_ITEMS) {
      state.truncated = true;
      return;
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(path, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data as Array<{ id?: string | null; name?: string; metadata?: { size?: number } | null }>) {
      if (state.scannedItems >= MAX_STORAGE_SCAN_ITEMS) {
        state.truncated = true;
        return;
      }

      state.scannedItems += 1;
      const itemName = item.name ?? '';
      if (!itemName) continue;

      const size = Number(item.metadata?.size ?? 0);
      if (Number.isFinite(size) && size > 0) {
        state.filesCount += 1;
        state.usedBytes += size;
        continue;
      }

      const isFolder = !item.id;
      if (isFolder) {
        const nestedPath = path ? `${path}/${itemName}` : itemName;
        await scanBucketUsageRecursively(bucket, nestedPath, state);
        if (state.truncated) return;
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
}

async function getBucketUsage() {
  const state = {
    filesCount: 0,
    usedBytes: 0,
    scannedItems: 0,
    truncated: false,
  };

  try {
    await scanBucketUsageRecursively(DEFAULT_BUCKET, '', state);
    return {
      filesCount: state.filesCount,
      usedBytes: state.usedBytes,
      truncated: state.truncated,
      error: null as string | null,
    };
  } catch (error: unknown) {
    return {
      filesCount: 0,
      usedBytes: 0,
      truncated: false,
      error: error instanceof Error ? error.message : 'Storage usage scan failed',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 200), 1), 500);
    const tag = searchParams.get('tag');
    const includeStats = isTruthyQueryValue(searchParams.get('includeStats'));

    let query = supabaseAdmin
      .from('inspiration_photos')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tag && tag !== 'all') {
      query = query.eq('tag', sanitizeTag(tag));
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!includeStats) {
      return NextResponse.json(data ?? []);
    }

    const quotaBytes = parseQuotaBytes();
    const usage = await getBucketUsage();
    const remainingBytes = quotaBytes == null
      ? null
      : Math.max(quotaBytes - usage.usedBytes, 0);

    return NextResponse.json({
      items: data ?? [],
      storage: {
        bucket: DEFAULT_BUCKET,
        filesCount: usage.filesCount,
        usedBytes: usage.usedBytes,
        usedMb: toMegabytes(usage.usedBytes),
        quotaBytes,
        quotaMb: toMegabytes(quotaBytes),
        remainingBytes,
        remainingMb: toMegabytes(remainingBytes),
        usagePercent: quotaBytes && quotaBytes > 0
          ? Number(((usage.usedBytes / quotaBytes) * 100).toFixed(2))
          : null,
        truncated: usage.truncated,
        error: usage.error,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const fileEntries = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    const singleEntry = formData.get('file');
    const files = fileEntries.length
      ? fileEntries
      : (singleEntry instanceof File ? [singleEntry] : []);
    const sourceUrls = collectSourceUrls(formData);

    if (files.length === 0 && sourceUrls.length === 0) {
      return NextResponse.json(
        { error: 'Wymagany jest plik albo link do obrazu (source_url/source_urls).' },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: `Nieprawidlowy rozmiar pliku (${file.name}), max 10 MB.` },
          { status: 400 },
        );
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Nieobslugiwany format pliku (${file.name}).` },
          { status: 400 },
        );
      }
    }

    const autoFromB2B = parseTruthy(formData.get('auto_from_b2b'), true);
    const manualTag = sanitizeTag(formData.get('tag')?.toString() ?? null);
    const manualTitle = (formData.get('title')?.toString() ?? '').trim();
    const manualTitleEn = (formData.get('title_en')?.toString() ?? '').trim();
    const aspectRatio = normalizeAspectRatio(formData.get('aspect_ratio')?.toString() ?? null);
    const sortOrderStart = Number(formData.get('sort_order')?.toString() ?? 100);
    const displayFromIso = toIsoOrNow(formData.get('display_from')?.toString() ?? null);
    const displayUntilIso = toIsoOrNull(formData.get('display_until')?.toString() ?? null);
    const manualIsActive = parseTruthy(formData.get('is_active'), true);

    const skusToResolve = autoFromB2B
      ? Array.from(new Set(
          [
            ...files.map((file) => extractSkuFromFilename(file.name)),
            ...sourceUrls.map((url) => extractSkuFromFilename(extractFilenameFromUrl(url))),
          ]
            .filter((sku): sku is string => Boolean(sku)),
        ))
      : [];

    const productsBySku = await loadProductsBySkus(skusToResolve);

    if (files.length > 0) {
      await ensureBucket();
    }

    const createdItems: unknown[] = [];
    const failedItems: Array<{ source: string; error: string }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      try {
        const sku = extractSkuFromFilename(file.name);
        const product = sku ? productsBySku.get(sku) : null;
        const titlePlFromB2B = pickText(
          product?.tytul_b2b,
          product?.title_b2b,
          product?.name,
          product?.OpisKrotki3,
          product?.opis_krotki3,
          product?.description,
        );
        const titleEnFromB2B = pickText(
          product?.tytul_b2b_en,
          product?.title_b2b_en,
          product?.name_en,
          product?.description_en,
        );
        const categoryFromB2B = pickText(
          product?.kategoria,
          product?.category_name,
          product?.category,
        );

        const resolvedTitle = autoFromB2B
          ? (titlePlFromB2B || manualTitle || sku || null)
          : (manualTitle || sku || null);

        const resolvedTitleEn = autoFromB2B
          ? (titleEnFromB2B || manualTitleEn || null)
          : (manualTitleEn || null);

        const resolvedTag = autoFromB2B
          ? mapB2BCategoryToTag(categoryFromB2B)
          : manualTag;

        const safeName = sanitizeFilename(file.name || `inspiration-${Date.now()}`);
        const path = `${resolvedTag}/${Date.now()}-${index}-${safeName}`;
        const bytes = await file.arrayBuffer();
        const binary = Buffer.from(bytes);

        const upload = await supabaseAdmin.storage
          .from(DEFAULT_BUCKET)
          .upload(path, binary, {
            contentType: file.type,
            upsert: false,
          });

        if (upload.error) throw upload.error;

        const publicUrl = supabaseAdmin.storage
          .from(DEFAULT_BUCKET)
          .getPublicUrl(path).data.publicUrl;

        const { data, error } = await supabaseAdmin
          .from('inspiration_photos')
          .insert({
            title: resolvedTitle,
            title_en: resolvedTitleEn,
            tag: resolvedTag,
            storage_path: path,
            url: publicUrl,
            aspect_ratio: aspectRatio,
            sort_order: Number.isFinite(sortOrderStart) ? sortOrderStart + index : 100 + index,
            display_from: displayFromIso,
            display_until: displayUntilIso,
            linked_product_id: product?.id ?? null,
            is_active: manualIsActive,
          })
          .select('*')
          .single();

        if (error) {
          await supabaseAdmin.storage.from(DEFAULT_BUCKET).remove([path]);
          throw error;
        }

        createdItems.push(data);
      } catch (error: unknown) {
        failedItems.push({
          source: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    for (let index = 0; index < sourceUrls.length; index += 1) {
      const sourceUrl = sourceUrls[index];

      try {
        const filename = extractFilenameFromUrl(sourceUrl) || `external-${Date.now()}-${index}.jpg`;
        const sku = extractSkuFromFilename(filename);
        const product = sku ? productsBySku.get(sku) : null;
        const titlePlFromB2B = pickText(
          product?.tytul_b2b,
          product?.title_b2b,
          product?.name,
          product?.OpisKrotki3,
          product?.opis_krotki3,
          product?.description,
        );
        const titleEnFromB2B = pickText(
          product?.tytul_b2b_en,
          product?.title_b2b_en,
          product?.name_en,
          product?.description_en,
        );
        const categoryFromB2B = pickText(
          product?.kategoria,
          product?.category_name,
          product?.category,
        );

        const resolvedTitle = autoFromB2B
          ? (titlePlFromB2B || manualTitle || sku || filename || null)
          : (manualTitle || sku || filename || null);

        const resolvedTitleEn = autoFromB2B
          ? (titleEnFromB2B || manualTitleEn || null)
          : (manualTitleEn || null);

        const resolvedTag = autoFromB2B
          ? mapB2BCategoryToTag(categoryFromB2B)
          : manualTag;

        const { data, error } = await supabaseAdmin
          .from('inspiration_photos')
          .insert({
            title: resolvedTitle,
            title_en: resolvedTitleEn,
            tag: resolvedTag,
            storage_path: null,
            url: sourceUrl,
            aspect_ratio: aspectRatio,
            sort_order: Number.isFinite(sortOrderStart)
              ? sortOrderStart + files.length + index
              : 100 + files.length + index,
            display_from: displayFromIso,
            display_until: displayUntilIso,
            linked_product_id: product?.id ?? null,
            is_active: manualIsActive,
          })
          .select('*')
          .single();

        if (error) throw error;
        createdItems.push(data);
      } catch (error: unknown) {
        failedItems.push({
          source: sourceUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (createdItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nie udalo sie dodac zadnego pliku.', failed: failedItems },
        { status: 500 },
      );
    }

    const payload = {
      success: failedItems.length === 0,
      createdCount: createdItems.length,
      failedCount: failedItems.length,
      sourceFilesCount: files.length,
      sourceUrlsCount: sourceUrls.length,
      items: createdItems,
      failed: failedItems,
    };

    if (failedItems.length > 0) {
      return NextResponse.json(payload, { status: 207 });
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'id wymagane' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};

    if ('title' in body) {
      updatePayload.title = (body.title ?? '').toString().trim() || null;
    }
    if ('title_en' in body) {
      updatePayload.title_en = (body.title_en ?? '').toString().trim() || null;
    }
    if ('tag' in body) {
      updatePayload.tag = sanitizeTag((body.tag ?? '').toString());
    }
    if ('url' in body) {
      updatePayload.url = normalizeUrl((body.url ?? '').toString());
    }
    if ('aspect_ratio' in body) {
      updatePayload.aspect_ratio = normalizeAspectRatio((body.aspect_ratio ?? '').toString());
    }
    if ('sort_order' in body) {
      const order = Number(body.sort_order);
      if (Number.isFinite(order)) {
        updatePayload.sort_order = order;
      }
    }
    if ('display_from' in body) {
      updatePayload.display_from = toIsoOrNow(body.display_from as string | null | undefined);
    }
    if ('display_until' in body) {
      updatePayload.display_until = toIsoOrNull(body.display_until as string | null | undefined);
    }
    if ('is_active' in body) {
      updatePayload.is_active = Boolean(body.is_active);
    }
    if ('linked_product_id' in body) {
      updatePayload.linked_product_id = (body.linked_product_id ?? '').toString().trim() || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Brak danych do aktualizacji.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('inspiration_photos')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id wymagane' }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('inspiration_photos')
      .select('id, storage_path')
      .eq('id', id)
      .single();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 404 });
    }

    const storagePath = (existing as { storage_path?: string | null }).storage_path;
    if (storagePath) {
      const removeStorage = await supabaseAdmin.storage
        .from(DEFAULT_BUCKET)
        .remove([storagePath]);

      if (removeStorage.error && !removeStorage.error.message.toLowerCase().includes('not found')) {
        throw removeStorage.error;
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('inspiration_photos')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
