import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveCoverImage } from '@/lib/article-cover';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Public client (browser + server components) ───────────────
declare global {
  var __gedeonSupabaseClient: SupabaseClient | undefined;
}

function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase =
  typeof window === 'undefined'
    ? createSupabaseClient()
    : (globalThis.__gedeonSupabaseClient ??= createSupabaseClient());

// ── Admin client przeniesiony do @/lib/supabase-admin ─────────

// ── Types matching our schema ─────────────────────────────────
export interface Article {
  id: string;
  slug: string;
  title_pl: string;
  title_en?: string;
  excerpt_pl?: string;
  excerpt_en?: string;
  content_pl?: ContentBlock[];
  content_en?: ContentBlock[];
  category: string;
  tags?: string[];
  cover_color?: string;
  cover_image?: string;
  cover_url?: string;
  gallery_images?: string[];
  author: string;
  author_role?: string;
  read_time?: number;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  published_at?: string;
  scheduled_for?: string;
  source: 'manual' | 'ai_generated' | 'pim_trigger';
  seo_title_pl?: string;
  seo_desc_pl?: string;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  category?: string;
  b2b_url?: string;
  shopify_handle?: string;
  image_url?: string;
  price_range?: string;
  is_active?: boolean;
  created_at: string;
}

export interface ArticleProduct {
  article_id: string;
  product_id: string;
  position: number;
  products: Product;
}

export interface ArticleWithProducts extends Article {
  article_products: ArticleProduct[];
}

export interface ContentBlock {
  type: 'lead' | 'heading' | 'paragraph' | 'tip' | 'product-highlight' | 'cta' | 'image';
  text?: string;
  url?: string;
  ctaEn?: string;
  productIndex?: number;
  src?: string;
  alt?: string;
}

export interface InspirationPhoto {
  id: string;
  title?: string;
  title_en?: string;
  tag: string;
  storage_path?: string;
  url?: string;
  display_from: string;
  display_until?: string;
  is_active: boolean;
  sort_order: number;
  aspect_ratio: string;
  linked_product_id?: string;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  lang: 'pl' | 'en';
  source: string;
  confirmed: boolean;
  created_at: string;
}

export interface TopicSuggestion {
  id: string;
  title_pl: string;
  title_en?: string;
  category?: string;
  keywords?: string[];
  search_volume?: number;
  difficulty?: number;
  source?: string;
  status: 'pending' | 'approved' | 'rejected' | 'generated';
  article_id?: string;
  created_at: string;
}

// ── Data access functions ─────────────────────────────────────

export async function getPublishedArticles(options?: {
  category?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options?.category && options.category !== 'all') {
    query = query.eq('category', options.category);
  }
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, (options.offset + (options.limit ?? 10)) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((article) => ({
    ...article,
    cover_image: resolveCoverImage(article),
    gallery_images: article.gallery_images ?? [],
  })) as Article[];
}

export async function getArticleBySlug(slug: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*, article_products(*, products(*))')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) return null;
  return {
    ...data,
    cover_image: resolveCoverImage(data),
    gallery_images: data.gallery_images ?? [],
  } as ArticleWithProducts;
}

export async function getInspirationPhotos(tag?: string) {
  let query = supabase
    .from('inspiration_photos')
    .select('*')
    .eq('is_active', true)
    .lte('display_from', new Date().toISOString())
    .order('sort_order', { ascending: true });

  if (tag && tag !== 'all') {
    query = query.eq('tag', tag);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as InspirationPhoto[];
}

export async function subscribeToNewsletter(email: string, lang: 'pl' | 'en' = 'pl', source = 'blog') {
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, lang, source }, { onConflict: 'email' });
  if (error) throw error;
  return true;
}

export async function incrementArticleViews(articleId: string) {
  await supabase.rpc('increment_views', { article_id: articleId });
}

export async function getTopicSuggestions(status?: string) {
  let query = supabase
    .from('topic_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data as TopicSuggestion[];
}
