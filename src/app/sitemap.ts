import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { resolveCoverImage } from "@/lib/article-cover";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticLastModified = new Date("2026-01-01T00:00:00.000Z");
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: staticLastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/inspiracje`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/nowosci`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/o-nas`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/kategorie/albumy`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kategorie/ramki`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kategorie/media`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kategorie/trendy`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kategorie/poradniki`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/kategorie/kodak`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Fetch all published article slugs from Supabase (server-side, service role)
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await supabaseAdmin
      .from("articles")
      .select("slug, updated_at, published_at, cover_image, cover_url")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (!error && data) {
      articlePages = data.map(article => ({
        url: `${SITE_URL}/blog/${article.slug}`,
        lastModified: new Date(article.updated_at ?? article.published_at ?? new Date()),
        changeFrequency: "monthly" as const,
        priority: 0.8,
        images: resolveCoverImage(article) ? [resolveCoverImage(article)!] : [],
      }));
    }
  } catch (err) {
    console.error("[sitemap] Failed to fetch articles:", err);
  }

  return [...staticPages, ...articlePages];
}
