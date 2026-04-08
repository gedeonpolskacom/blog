/**
 * Article ↔ Products linking
 * GET    /api/article-products?article_id=xxx  — lista produktów artykułu
 * POST   /api/article-products                 — dodaj produkt do artykułu
 * DELETE /api/article-products?article_id=&product_id=  — usuń powiązanie
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const articleId = new URL(request.url).searchParams.get('article_id');
  if (!articleId) return NextResponse.json({ error: 'article_id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('article_products')
    .select('*, products(*)')
    .eq('article_id', articleId)
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const { article_id, product_id, position } = await request.json();
  if (!article_id || !product_id) {
    return NextResponse.json({ error: 'article_id i product_id wymagane' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('article_products')
    .upsert({ article_id, product_id, position: position ?? 1 }, { onConflict: 'article_id,product_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const article_id = searchParams.get('article_id');
  const product_id = searchParams.get('product_id');
  if (!article_id || !product_id) {
    return NextResponse.json({ error: 'article_id i product_id wymagane' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('article_products')
    .delete()
    .eq('article_id', article_id)
    .eq('product_id', product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

