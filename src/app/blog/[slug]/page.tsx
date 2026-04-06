/**
 * Blog Post Page — Server Component
 * Exports generateMetadata for SEO/OG tags, then renders the client component.
 */

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import BlogPostClient from './BlogPostClient';
import { resolveCoverImage } from '@/lib/article-cover';
import { HOME_FEATURED_TAG } from '@/lib/homepage-featured';
import { SITE_URL } from '@/lib/site-url';

type Props = {
  params: Promise<{ slug: string }>;
};

type MetadataArticle = {
  title_pl: string;
  excerpt_pl?: string | null;
  cover_image?: string | null;
  cover_url?: string | null;
  tags?: string[] | null;
  published_at?: string | null;
};

// ── SEO Metadata (server-side) ────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const runQuery = async (withCoverImage: boolean) =>
      await supabaseAdmin
        .from('articles')
        .select(
          withCoverImage
            ? 'title_pl, title_en, excerpt_pl, excerpt_en, cover_image, cover_url, category, tags, published_at'
            : 'title_pl, title_en, excerpt_pl, excerpt_en, cover_url, category, tags, published_at'
        )
        .eq('slug', slug)
        .single();

    let { data, error } = await runQuery(true);
    if (error && /cover_image/i.test(error.message)) {
      const fallback = await runQuery(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    const article = data as unknown as MetadataArticle | null;
    if (!article) {
      return {
        title: 'Artykuł nie znaleziony | Blog Gedeon Polska',
        description: 'Strona nie istnieje.',
      };
    }

    const title = `${article.title_pl} | Blog Gedeon Polska`;
    const description = article.excerpt_pl ?? 'Artykuł na blogu Gedeon Polska — albumy, ramki, media fotograficzne.';
    const imageUrl = resolveCoverImage(article) ?? `${SITE_URL}/og-default.jpg`;
    const articleUrl = `${SITE_URL}/blog/${slug}`;

    return {
      title,
      description,
      keywords: (article.tags ?? []).filter((tag) => tag !== HOME_FEATURED_TAG).join(', '),
      openGraph: {
        type: 'article',
        url: articleUrl,
        title: article.title_pl,
        description,
        siteName: 'Blog Gedeon Polska',
        publishedTime: article.published_at ?? undefined,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: article.title_pl,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title_pl,
        description,
        images: [imageUrl],
      },
      alternates: {
        canonical: articleUrl,
      },
    };
  } catch {
    return {
      title: 'Blog Gedeon Polska',
      description: 'Artykuły o fotografii, albumach i produktach Gedeon.',
    };
  }
}

// ── Page Component ────────────────────────────────────────────

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  return <BlogPostClient slug={slug} />;
}
