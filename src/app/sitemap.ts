import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://blog.gedeonpolska.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/inspiracje`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/nowosci`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/o-nas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/kategorie/albumy`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/kategorie/ramki`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/kategorie/media`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/kategorie/trendy`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
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
      .from('articles')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (!error && data) {
      articlePages = data.map(article => ({
        url: `${BASE_URL}/blog/${article.slug}`,
        lastModified: new Date(article.updated_at ?? article.published_at ?? new Date()),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }));
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch articles:', err);
  }

  return [...staticPages, ...articlePages];
}
