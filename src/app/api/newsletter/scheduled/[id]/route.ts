/**
 * Newsletter Job — operacje na konkretnym rekordzie
 * Route: DELETE /api/newsletter/scheduled/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const client = supabaseAdmin;
    if (!client) throw new Error('supabaseAdmin not available');

    const { error } = await client.from('newsletter_jobs').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

