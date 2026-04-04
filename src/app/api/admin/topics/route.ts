/**
 * Admin Topics API — uses supabaseAdmin (service_role) to bypass RLS
 * GET  /api/admin/topics?status=pending&limit=100&offset=0
 * PATCH /api/admin/topics  { id, status }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'pending';
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500);
    const offset = Number(searchParams.get('offset') ?? 0);
    const countOnly = searchParams.get('countOnly') === 'true';
    const q = (searchParams.get('q') ?? '').trim();

    if (countOnly) {
      let countQuery = supabaseAdmin
        .from('topic_suggestions')
        .select('id', { count: 'exact', head: true });
      if (status !== 'all') countQuery = countQuery.eq('status', status);
      if (q) countQuery = countQuery.ilike('title_pl', `%${q}%`);
      const { count, error } = await countQuery;
      if (error) throw error;
      return NextResponse.json({ count: count ?? 0 });
    }

    let query = supabaseAdmin
      .from('topic_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (q) query = query.ilike('title_pl', `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id i status wymagane' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('topic_suggestions')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
