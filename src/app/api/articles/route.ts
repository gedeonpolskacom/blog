/**
 * Articles API — publiczny endpoint dla newslettera (D&D)
 * Route: GET /api/articles?limit=20&status=published
 *
 * Zwraca uproszczoną listę artykułów do wciągnięcia do newslettera.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveCoverImage } from '@/lib/article-cover';

type ArticleRow = {
  id: string;
  slug: string;
  title_pl?: string;
  title_en?: string;
  excerpt_pl?: string;
  category?: string;
  tags?: string[] | null;
  cover_image?: string | null;
  cover_url?: string | null;
  cover_color?: string | null;
  gallery_images?: string[] | null;
  read_time?: number;
  published_at?: string | null;
  created_at?: string;
  status?: string;
  source?: string | null;
  scheduled_for?: string | null;
  views?: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
    const status = searchParams.get('status') ?? 'published';

    const runQuery = async (withGallery: boolean, withCoverImage: boolean) => {
      const fields = [
        'id',
        'slug',
        'title_pl',
        'title_en',
        'excerpt_pl',
        'category',
        'tags',
        ...(withCoverImage ? ['cover_image'] : []),
        'cover_url',
        'cover_color',
        ...(withGallery ? ['gallery_images'] : []),
        'read_time',
        'published_at',
        'created_at',
        'status',
        'source',
        'scheduled_for',
        'views',
      ].join(', ');

      let query = supabaseAdmin
        .from('articles')
        .select(fields)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      return await query;
    };

    let { data, error } = await runQuery(true, true);
    if (error && /(gallery_images|cover_image)/i.test(error.message)) {
      // Backward compatibility: DB migration may not be applied yet.
      const fallbackWithGallery = !/gallery_images/i.test(error.message);
      const fallbackWithCoverImage = !/cover_image/i.test(error.message);
      const fallback = await runQuery(fallbackWithGallery, fallbackWithCoverImage);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;

    const rows = (data ?? []) as unknown as ArticleRow[];
    const articles = rows.map((a) => {
      const resolvedCover = resolveCoverImage(a);
      return {
      id: a.id,
      slug: a.slug,
      title: a.title_pl,
      title_pl: a.title_pl,
      titleEn: a.title_en,
      excerpt: a.excerpt_pl,
      category: a.category,
      tags: a.tags ?? [],
      image: resolvedCover,
      cover_image: resolvedCover,
      gallery_images: a.gallery_images ?? [],
      coverColor: a.cover_color ?? null,
      readTime: a.read_time,
      publishedAt: a.published_at ?? a.created_at,
      created_at: a.created_at,
      status: a.status,
      source: a.source ?? 'manual',
      scheduled_for: a.scheduled_for,
      views: a.views ?? 0,
      url: `/blog/${a.slug}`,
      };
    });

    return NextResponse.json(articles);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

