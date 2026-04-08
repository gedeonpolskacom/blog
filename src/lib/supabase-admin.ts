/**
 * Supabase Admin Client — TYLKO server-side (API routes, Server Components)
 * NIE importuj tego pliku w komponentach z 'use client'.
 */

import { createClient } from '@supabase/supabase-js';
import type { Article, TopicSuggestion } from './supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── Admin functions (service role) ────────────────────────────

export async function createArticle(article: Partial<Article>) {
  const { data, error } = await supabaseAdmin
    .from('articles')
    .insert(article)
    .select()
    .single();
  if (error) throw error;
  return data as Article;
}

export async function updateArticle(id: string, updates: Partial<Article>) {
  const { data, error } = await supabaseAdmin
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Article;
}

export async function saveTopicSuggestion(topic: Partial<TopicSuggestion>) {
  const { data, error } = await supabaseAdmin
    .from('topic_suggestions')
    .insert(topic)
    .select()
    .single();
  if (error) throw error;
  return data;
}

