import { supabaseAdmin } from '@/lib/supabase-admin';
import { type Article } from '@/lib/supabase';
import BlogPageClient from './BlogPageClient';

export const dynamic = 'force-dynamic';

async function getInitialArticles(): Promise<Article[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(120);

    if (error) {
      console.error('[blog/page] Failed to fetch articles:', error.message);
      return [];
    }

    return (data ?? []) as Article[];
  } catch (error) {
    console.error('[blog/page] Unexpected fetch error:', error);
    return [];
  }
}

export default async function BlogPage() {
  const initialArticles = await getInitialArticles();
  return <BlogPageClient initialArticles={initialArticles} />;
}

