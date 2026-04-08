import { cache } from "react";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveCoverImage } from "@/lib/article-cover";
import { HOME_FEATURED_TAG } from "@/lib/homepage-featured";
import { SITE_URL } from "@/lib/site-url";
import { type ArticleWithProducts } from "@/lib/supabase";
import BlogPostClient from "./BlogPostClient";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

const DEFAULT_OG_IMAGE = `${SITE_URL}/android-chrome-512x512.png`;

const getPublishedArticleBySlug = cache(async (slug: string): Promise<ArticleWithProducts | null> => {
  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("*, article_products(*, products(*))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("[blog/[slug]] Failed to fetch article:", error.message);
    return null;
  }

  return (data as ArticleWithProducts | null) ?? null;
});

function buildArticleJsonLd(article: ArticleWithProducts) {
  const articleUrl = `${SITE_URL}/blog/${article.slug}`;
  const imageUrl = resolveCoverImage(article) ?? DEFAULT_OG_IMAGE;
  const description =
    article.excerpt_pl ??
    "Artykuł na blogu Gedeon - albumy, ramki i media fotograficzne dla rynku B2B.";
  const publishedAt = article.published_at ?? article.created_at;
  const updatedAt = article.updated_at ?? publishedAt;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${articleUrl}#article`,
        mainEntityOfPage: articleUrl,
        headline: article.title_pl,
        description,
        image: [imageUrl],
        datePublished: publishedAt,
        dateModified: updatedAt,
        articleSection: article.category,
        author: {
          "@type": "Person",
          name: article.author || "Zespół Gedeon",
        },
        publisher: {
          "@type": "Organization",
          name: "Gedeon",
          logo: {
            "@type": "ImageObject",
            url: DEFAULT_OG_IMAGE,
          },
        },
        keywords: (article.tags ?? []).filter((tag) => tag !== HOME_FEATURED_TAG),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Blog",
            item: `${SITE_URL}/blog`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: article.title_pl,
            item: articleUrl,
          },
        ],
      },
    ],
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const isPreview = query.preview === "1";
  const articleUrl = `${SITE_URL}/blog/${slug}`;

  if (isPreview) {
    return {
      title: "Podgląd artykułu | Blog Gedeon",
      description: "Podgląd roboczej wersji artykułu.",
      alternates: {
        canonical: articleUrl,
      },
      robots: {
        index: false,
        follow: false,
        noarchive: true,
        nosnippet: true,
      },
    };
  }

  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return {
      title: "Artykuł nie znaleziony | Blog Gedeon",
      description: "Strona nie istnieje.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = article.title_pl;
  const description =
    article.excerpt_pl ??
    "Artykuł na blogu Gedeon - albumy, ramki i media fotograficzne dla rynku B2B.";
  const imageUrl = resolveCoverImage(article) ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    keywords: (article.tags ?? []).filter((tag) => tag !== HOME_FEATURED_TAG),
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      type: "article",
      url: articleUrl,
      title,
      description,
      siteName: "Gedeon Blog",
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at ?? undefined,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BlogPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const isPreview = query.preview === "1";

  const initialArticle = isPreview ? null : await getPublishedArticleBySlug(slug);
  const articleJsonLd = initialArticle ? buildArticleJsonLd(initialArticle) : null;
  const articleJsonLdString = articleJsonLd
    ? JSON.stringify(articleJsonLd).replace(/</g, "\\u003c")
    : null;

  return (
    <>
      {articleJsonLdString ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: articleJsonLdString }}
        />
      ) : null}
      <BlogPostClient slug={slug} initialArticle={initialArticle} />
    </>
  );
}
