import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type ArticleRow = {
  id: string;
  slug: string;
  views: number | null;
};

async function resolveArticle(slug?: string | null) {
  let query = supabaseAdmin
    .from('articles')
    .select('id, slug, views')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1);

  if (slug) {
    query = query.eq('slug', slug);
  }

  const { data, error } = await query.maybeSingle<ArticleRow>();
  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    const article = await resolveArticle(slug);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Brak opublikowanego artykulu do testu views.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'peek',
      article: {
        id: article.id,
        slug: article.slug,
        views: Number(article.views ?? 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; increments?: number };
    const increments = Math.max(1, Math.min(Number(body.increments ?? 1), 5));
    const article = await resolveArticle(body.slug);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Brak opublikowanego artykulu do testu views.' },
        { status: 404 }
      );
    }

    const before = Number(article.views ?? 0);
    for (let i = 0; i < increments; i += 1) {
      const rpc = await supabaseAdmin.rpc('increment_views', { article_id: article.id });
      if (rpc.error) {
        return NextResponse.json(
          { success: false, error: rpc.error.message, article: { id: article.id, slug: article.slug, before } },
          { status: 500 }
        );
      }
    }

    const { data: afterRow, error: afterError } = await supabaseAdmin
      .from('articles')
      .select('views')
      .eq('id', article.id)
      .single<{ views: number | null }>();

    if (afterError) {
      return NextResponse.json(
        { success: false, error: afterError.message, article: { id: article.id, slug: article.slug, before } },
        { status: 500 }
      );
    }

    const after = Number(afterRow.views ?? 0);
    return NextResponse.json({
      success: true,
      mode: 'increment',
      article: {
        id: article.id,
        slug: article.slug,
        before,
        after,
        delta: after - before,
        requestedIncrements: increments,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
