import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendNewsletterJob } from '@/lib/newsletter-jobs';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}

async function handleSendNewsletters(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data: jobs, error } = await supabaseAdmin
    .from('newsletter_jobs')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, processedCount: 0, jobs: [] });
  }

  const results = [];
  for (const job of jobs) {
    try {
      const result = await sendNewsletterJob(job.id);
      results.push({ id: job.id, success: true, ...result });
    } catch (err: unknown) {
      results.push({
        id: job.id,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    processedCount: results.length,
    jobs: results,
  });
}

export async function GET(request: NextRequest) {
  return handleSendNewsletters(request);
}

export async function POST(request: NextRequest) {
  return handleSendNewsletters(request);
}
