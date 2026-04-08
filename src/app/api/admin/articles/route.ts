/**
 * Admin Articles API — uses supabaseAdmin (service_role) to bypass RLS
 * GET  /api/admin/articles?slug=xxx          → single article by slug (any status, for preview)
 * PATCH /api/admin/articles  { id, status }  → update article status
 * DELETE /api/admin/articles?id=xxx          → archive article
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findB2BCoverImage, repairAndValidateB2BImageUrl } from '@/lib/b2b-images';
import { resolveCoverImage } from '@/lib/article-cover';
import {
  HOME_FEATURED_TAG,
  withHomeFeaturedTag,
  withoutHomeFeaturedTag,
} from '@/lib/homepage-featured';

type ContentBlock = {
  type: 'lead' | 'heading' | 'paragraph' | 'tip' | 'product-highlight' | 'cta' | 'image';
  text?: string;
  url?: string;
  ctaEn?: string;
  productIndex?: number;
  src?: string;
  alt?: string;
};

type UpdatedArticleRow = {
  id: string;
  slug: string;
  title_pl: string;
  status: string;
  cover_image?: string | null;
  cover_url?: string | null;
  gallery_images?: string[] | null;
  tags?: string[] | null;
};

function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'artykul';
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  return [];
}

function parseImageUrls(value: unknown): string[] {
  const toList = (input: string) =>
    input
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const values = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : typeof value === 'string'
      ? toList(value)
      : [];

  return Array.from(new Set(values)).slice(0, 40);
}

function textFromBlocks(blocks: ContentBlock[]) {
  return blocks
    .map((block) => block.text?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlAttribute(tag: string, attribute: string): string {
  const pattern = new RegExp(
    `${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  );
  const match = tag.match(pattern);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function normalizeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return null;
}

function parseHtmlToContentBlocks(html: string): ContentBlock[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n');

  const blocks: ContentBlock[] = [];
  let leadAdded = false;

  const blockRegex = /<img\b[^>]*\/?>|<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const fragment = match[0];

    if (/^<img\b/i.test(fragment)) {
      const src = normalizeImageUrl(extractHtmlAttribute(fragment, 'src'));
      if (!src) continue;

      const alt = stripHtml(extractHtmlAttribute(fragment, 'alt'));
      blocks.push({
        type: 'image',
        src,
        url: src,
        alt: alt || undefined,
      });
      continue;
    }

    const tagName = (match[1] ?? '').toLowerCase();
    const text = stripHtml(match[2] ?? '');
    if (!text) continue;

    if (tagName.startsWith('h')) {
      blocks.push({ type: 'heading', text });
      continue;
    }

    if (tagName === 'li') {
      blocks.push({ type: 'paragraph', text: `- ${text}` });
      continue;
    }

    if (!leadAdded) {
      blocks.push({ type: 'lead', text });
      leadAdded = true;
      continue;
    }

    blocks.push({ type: 'paragraph', text });
  }

  return blocks;
}

function toContentBlocks(value: unknown): ContentBlock[] {
  if (Array.isArray(value)) {
    const sanitized = value.filter((item): item is ContentBlock => {
      if (!item || typeof item !== 'object') return false;
      const block = item as ContentBlock;
      return typeof block.type === 'string';
    });
    if (sanitized.length > 0) return sanitized;
  }

  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return [];
  }

  if (/<\s*\/?\s*[a-z][^>]*>/i.test(text)) {
    const fromHtml = parseHtmlToContentBlocks(text);
    if (fromHtml.length > 0) {
      return fromHtml;
    }
  }

  const paragraphs = text
    .split(/\r?\n\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const blocks: ContentBlock[] = [];
  let leadAdded = false;

  for (const paragraph of paragraphs) {
    if (paragraph.startsWith('## ')) {
      blocks.push({ type: 'heading', text: paragraph.replace(/^##\s+/, '').trim() });
      continue;
    }

    if (!leadAdded) {
      blocks.push({ type: 'lead', text: paragraph });
      leadAdded = true;
      continue;
    }

    blocks.push({ type: 'paragraph', text: paragraph });
  }

  return blocks;
}

function estimateReadTime(title: string, excerpt: string, blocks: ContentBlock[]) {
  const text = `${title} ${excerpt} ${textFromBlocks(blocks)}`.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(25, Math.max(3, Math.ceil(words / 180)));
}

function deriveExcerpt(excerptInput: unknown, blocks: ContentBlock[]) {
  const given = typeof excerptInput === 'string' ? excerptInput.trim() : '';
  if (given) return given;

  const firstText = blocks.find((block) => block.text?.trim())?.text?.trim() ?? '';
  if (!firstText) return '';
  if (firstText.length <= 165) return firstText;
  return `${firstText.slice(0, 162)}...`;
}

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

function extractPrimarySku(values: Array<string | undefined>): string | null {
  const hints = extractSkuHints(values);
  return hints[0] ?? null;
}

async function resolveStrictSkuForArticle(articleId: string, fallbackValues: Array<string | undefined>) {
  const fromPim = await supabaseAdmin
    .from('pim_sync_log')
    .select('product_sku')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sku = (fromPim.data as { product_sku?: string } | null)?.product_sku?.trim().toUpperCase() ?? null;
  if (sku) {
    return sku;
  }

  return extractPrimarySku(fallbackValues);
}

function urlMatchesSku(url: string, sku: string) {
  return url.toLowerCase().includes(sku.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const titlePl = String(body?.title_pl ?? '').trim();
    const category = String(body?.category ?? 'Inne').trim() || 'Inne';
    const titleEn = String(body?.title_en ?? '').trim();
    const coverImageInput = String(body?.cover_image ?? '').trim();

    if (!titlePl) {
      return NextResponse.json({ error: 'title_pl wymagane' }, { status: 400 });
    }

    const contentBlocks = toContentBlocks(
      body?.content_pl ?? body?.content_html ?? body?.content_text ?? ''
    );
    if (contentBlocks.length === 0) {
      return NextResponse.json({ error: 'content_pl wymagane' }, { status: 400 });
    }

    const excerptPl = deriveExcerpt(body?.excerpt_pl, contentBlocks);
    const tags = parseTags(body?.tags);
    const baseSlug = slugify(String(body?.slug ?? titlePl));
    const uniqueSlug = `${baseSlug}-${Date.now()}`;
    const readTime = Number(body?.read_time) > 0
      ? Number(body.read_time)
      : estimateReadTime(titlePl, excerptPl, contentBlocks);

    const draftPayload = {
      slug: uniqueSlug,
      title_pl: titlePl,
      title_en: titleEn || null,
      excerpt_pl: excerptPl || null,
      excerpt_en: null,
      content_pl: contentBlocks,
      category,
      tags,
      cover_image: coverImageInput || null,
      cover_url: coverImageInput || null,
      gallery_images: coverImageInput ? [coverImageInput] : [],
      read_time: readTime,
      status: 'draft' as const,
      source: 'manual' as const,
      author: 'Zespol Gedeon',
      author_role: 'Panel Admin',
    };

    const tryInsert = async (payload: Record<string, unknown>) =>
      await supabaseAdmin
        .from('articles')
        .insert(payload)
        .select('id, slug, title_pl, category, cover_image, cover_url, status, source, created_at')
        .single();

    const payloadVariants: Record<string, unknown>[] = [
      draftPayload,
      { ...draftPayload, gallery_images: undefined },
      { ...draftPayload, cover_image: undefined },
      { ...draftPayload, gallery_images: undefined, cover_image: undefined },
    ];

    let result: Awaited<ReturnType<typeof tryInsert>> | null = null;
    for (const payload of payloadVariants) {
      result = await tryInsert(payload);
      if (!result.error) break;
      if (!/(gallery_images|cover_image)/i.test(result.error.message)) break;
    }

    if (!result || result.error || !result.data) {
      throw result?.error ?? new Error('Nie udało się zapisać artykułu');
    }

    const row = result.data as {
      id: string;
      slug: string;
      title_pl: string;
      category: string;
      cover_image?: string | null;
      cover_url?: string | null;
      status: 'draft' | 'scheduled' | 'published' | 'archived';
      source: 'manual' | 'ai_generated' | 'pim_trigger';
      created_at: string;
    };

    return NextResponse.json({
      success: true,
      article: {
        ...row,
        cover_image: resolveCoverImage(row),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (!slug && !id) {
      return NextResponse.json({ error: 'slug lub id wymagane' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('articles')
      .select('*, article_products(*, products(*))');

    if (slug) query = query.eq('slug', slug) as typeof query;
    if (id)   query = query.eq('id', id) as typeof query;

    const { data, error } = await query.single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    const strictSku = await resolveStrictSkuForArticle(data.id as string, [
      data?.title_pl,
      data?.slug,
      ...(data?.tags ?? []),
    ]);

    let resolvedCover = resolveCoverImage(data);
    let needsUpdate = false;

    if (resolvedCover) {
      if (strictSku && !urlMatchesSku(resolvedCover, strictSku)) {
        resolvedCover = null;
      }
    }

    if (resolvedCover) {
      const repaired = await repairAndValidateB2BImageUrl(resolvedCover);
      if (repaired) {
        if (repaired !== resolvedCover) {
          resolvedCover = repaired;
          needsUpdate = true;
        }
      } else {
        resolvedCover = null;
      }
    }

    if (!resolvedCover) {
      const discoveredCover = await findB2BCoverImage({
        category: data?.category,
        tags: data?.tags ?? [],
        title: data?.title_pl ?? data?.title_en,
        skuHints: extractSkuHints([data?.slug, data?.title_pl, data?.title_en, ...(data?.tags ?? [])]),
        strictSku: strictSku ?? undefined,
      });
      if (discoveredCover) {
        resolvedCover = discoveredCover;
        needsUpdate = true;
      }
    }

    if (resolvedCover && needsUpdate) {
      const updateResult = await supabaseAdmin
        .from('articles')
        .update({ cover_image: resolvedCover, cover_url: resolvedCover })
        .eq('id', data.id);

      if (updateResult.error && /cover_image/i.test(updateResult.error.message)) {
        await supabaseAdmin
          .from('articles')
          .update({ cover_url: resolvedCover })
          .eq('id', data.id);
      }
    }

    return NextResponse.json({
      ...data,
      cover_image: resolvedCover,
      cover_url: resolvedCover,
      gallery_images: data?.gallery_images ?? (resolvedCover ? [resolvedCover] : []),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      status,
      published_at,
      cover_image,
      gallery_images,
      title_pl,
      title_en,
      category,
      excerpt_pl,
      content_pl,
      tags,
      read_time,
      set_home_featured,
    } = body ?? {};

    if (!id) {
      return NextResponse.json({ error: 'id wymagane' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (status !== undefined) updatePayload.status = status;
    if (published_at !== undefined) updatePayload.published_at = published_at;
    if (title_pl !== undefined) {
      const value = String(title_pl ?? '').trim();
      if (!value) return NextResponse.json({ error: 'title_pl nie może być puste' }, { status: 400 });
      updatePayload.title_pl = value;
    }
    if (title_en !== undefined) updatePayload.title_en = String(title_en ?? '').trim() || null;
    if (category !== undefined) {
      const value = String(category ?? '').trim();
      if (!value) return NextResponse.json({ error: 'category nie może być pusta' }, { status: 400 });
      updatePayload.category = value;
    }
    if (tags !== undefined) updatePayload.tags = parseTags(tags);
    if (cover_image !== undefined) {
      updatePayload.cover_image = cover_image || null;
      updatePayload.cover_url = cover_image || null;
    }
    if (gallery_images !== undefined) {
      updatePayload.gallery_images = parseImageUrls(gallery_images);
    }

    let normalizedBlocks: ContentBlock[] | null = null;
    if (content_pl !== undefined) {
      normalizedBlocks = toContentBlocks(content_pl);
      if (normalizedBlocks.length === 0) {
        return NextResponse.json({ error: 'content_pl nie może być puste' }, { status: 400 });
      }
      updatePayload.content_pl = normalizedBlocks;
    }
    if (excerpt_pl !== undefined) {
      const value = String(excerpt_pl ?? '').trim();
      updatePayload.excerpt_pl = value || null;
    }
    if (read_time !== undefined && Number.isFinite(Number(read_time))) {
      updatePayload.read_time = Math.max(1, Number(read_time));
    }

    if ((title_pl !== undefined || excerpt_pl !== undefined || content_pl !== undefined) && normalizedBlocks) {
      const nextTitle = String(updatePayload.title_pl ?? '').trim();
      const nextExcerpt = typeof updatePayload.excerpt_pl === 'string'
        ? updatePayload.excerpt_pl
        : deriveExcerpt('', normalizedBlocks);
      updatePayload.excerpt_pl = nextExcerpt || null;
      if (read_time === undefined) {
        updatePayload.read_time = estimateReadTime(nextTitle || 'Artykuł', nextExcerpt, normalizedBlocks);
      }
    }

    const shouldSetHomeFeatured = set_home_featured === true;

    if (Object.keys(updatePayload).length === 0 && !shouldSetHomeFeatured) {
      return NextResponse.json({ error: 'brak danych do aktualizacji' }, { status: 400 });
    }

    let data: UpdatedArticleRow | null = null;

    if (Object.keys(updatePayload).length > 0) {
      let result = await supabaseAdmin
        .from('articles')
        .update(updatePayload)
        .eq('id', id)
        .select('id, slug, title_pl, status, cover_image, cover_url, gallery_images, tags')
        .single();

      if (result.error && /(cover_image|gallery_images)/i.test(result.error.message)) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.cover_image;
        delete fallbackPayload.gallery_images;
        result = await supabaseAdmin
          .from('articles')
          .update(fallbackPayload)
          .eq('id', id)
          .select('id, slug, title_pl, status, cover_url, gallery_images, tags')
          .single();
      }

      if (result.error) throw result.error;
      data = result.data as UpdatedArticleRow;
    }

    if (shouldSetHomeFeatured) {
      const current = await supabaseAdmin
        .from('articles')
        .select('id, status, tags')
        .eq('id', id)
        .single();

      if (current.error) throw current.error;
      if (current.data?.status !== 'published') {
        return NextResponse.json(
          { error: 'Polecany artykuł może być ustawiony tylko dla opublikowanego wpisu' },
          { status: 400 },
        );
      }

      const selectedTags = withHomeFeaturedTag((current.data.tags as string[] | null | undefined) ?? []);
      const setFeatured = await supabaseAdmin
        .from('articles')
        .update({ tags: selectedTags })
        .eq('id', id);
      if (setFeatured.error) throw setFeatured.error;

      const others = await supabaseAdmin
        .from('articles')
        .select('id, tags')
        .neq('id', id)
        .contains('tags', [HOME_FEATURED_TAG]);

      if (others.error) throw others.error;

      for (const row of (others.data ?? []) as Array<{ id: string; tags?: string[] | null }>) {
        const cleanedTags = withoutHomeFeaturedTag(row.tags);
        const clearResult = await supabaseAdmin
          .from('articles')
          .update({ tags: cleanedTags })
          .eq('id', row.id);
        if (clearResult.error) throw clearResult.error;
      }

      const refreshed = await supabaseAdmin
        .from('articles')
        .select('id, slug, title_pl, status, cover_image, cover_url, gallery_images, tags')
        .eq('id', id)
        .single();
      if (refreshed.error) throw refreshed.error;
      data = refreshed.data;
    }

    if (!data) {
      return NextResponse.json({ error: 'brak danych po aktualizacji' }, { status: 500 });
    }

    revalidatePath('/');
    revalidatePath('/blog');

    return NextResponse.json({
      success: true,
      article: {
        ...data,
        cover_image: resolveCoverImage(data),
        gallery_images: data.gallery_images ?? [],
        tags: data.tags ?? [],
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id wymagane' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('articles')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/');
    revalidatePath('/blog');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
