import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, sku, name, category')
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
