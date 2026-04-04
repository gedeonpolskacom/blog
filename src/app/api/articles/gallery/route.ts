import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findB2BGalleryImages } from '@/lib/b2b-images';

function extractSkuHints(values: Array<string | undefined>): string[] {
  const hints = new Set<string>();
  const skuPattern = /\b[A-Z]{1,6}\d{2,}[A-Z0-9-]*\b/g;

  for (const value of values) {
    if (!value) continue;
    const upper = value.toUpperCase();
    const matches = upper.match(skuPattern) ?? [];
    for (const match of matches) {
      const cleaned = match.replace(/[^A-Z0-9-]/g, '');
      const hasStrongPrefix = /^[A-Z]{2,}/.test(cleaned);
      const startsNumeric = /^[0-9]/.test(cleaned);
      const longEnough = cleaned.length >= 6;
      if (longEnough && (hasStrongPrefix || startsNumeric)) {
        hints.add(cleaned);
      }
    }
  }

  return Array.from(hints);
}

function normalizeSku(value?: string | null) {
  return (value ?? '').trim().toUpperCase();
}

function isSkuLike(value?: string | null) {
  const sku = normalizeSku(value);
  if (!sku) return false;
  const hasStrongPrefix = /^[A-Z]{2,}/.test(sku);
  const startsNumeric = /^[0-9]/.test(sku);
  return sku.length >= 6 && (hasStrongPrefix || startsNumeric);
}

async function resolveStrictSku(articleId: string, skuHints: string[]) {
  const fromPim = await supabaseAdmin
    .from('pim_sync_log')
    .select('product_sku')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const pimSku = normalizeSku((fromPim.data as { product_sku?: string } | null)?.product_sku);
  if (!fromPim.error && isSkuLike(pimSku)) {
    return pimSku;
  }

  const hints = skuHints.map(normalizeSku).filter((hint) => isSkuLike(hint));
  if (!hints.length) {
    return null;
  }

  const exact = await supabaseAdmin
    .from('products')
    .select('sku')
    .in('sku', hints)
    .limit(10);

  if (!exact.error && exact.data?.length) {
    const exactSet = new Set(
      exact.data
        .map((row) => normalizeSku((row as { sku?: string }).sku))
        .filter(Boolean)
    );
    for (const hint of hints) {
      if (exactSet.has(hint)) {
        return hint;
      }
    }
  }

  return hints[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const runQuery = async (withCoverImage: boolean) =>
      await supabaseAdmin
        .from('articles')
        .select(
          withCoverImage
            ? 'id, slug, title_pl, title_en, tags, category, cover_image, cover_url, gallery_images, status'
            : 'id, slug, title_pl, title_en, tags, category, cover_url, gallery_images, status'
        )
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

    let { data, error } = await runQuery(true);
    if (error && /cover_image/i.test(error.message)) {
      const fallback = await runQuery(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const article = data as unknown as {
      id: string;
      slug?: string;
      title_pl?: string;
      title_en?: string;
      tags?: string[] | null;
      category?: string | null;
      gallery_images?: string[] | null;
    };

    const existing = article.gallery_images ?? [];
    if (existing.length > 1) {
      return NextResponse.json({ gallery_images: existing, source: 'db' });
    }

    const skuHints = extractSkuHints([article.slug, article.title_pl, article.title_en, ...(article.tags ?? [])]);
    const strictSku = await resolveStrictSku(article.id, skuHints);

    const gallery = await findB2BGalleryImages(
      {
        category: article.category ?? undefined,
        tags: article.tags ?? [],
        title: article.title_pl ?? article.title_en,
        skuHints,
        strictSku: strictSku ?? undefined,
      },
      8
    );

    if (gallery.length > 1) {
      await supabaseAdmin
        .from('articles')
        .update({ gallery_images: gallery })
        .eq('id', article.id);
    }

    return NextResponse.json({
      gallery_images: gallery.length ? gallery : existing,
      source: gallery.length > 1 ? 'b2b' : 'db',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
