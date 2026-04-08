/**
 * Newsletter Job — natychmiastowe wysłanie zaplanowanego joba
 * Route: POST /api/newsletter/scheduled/[id]/send-now
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNewsletterJob } from '@/lib/newsletter-jobs';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await sendNewsletterJob(id);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

