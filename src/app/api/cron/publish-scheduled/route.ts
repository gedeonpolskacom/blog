import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}

async function handlePublishScheduled(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: scheduledArticles, error: fetchError } = await supabaseAdmin
    .from('articles')
    .select('id, slug')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!scheduledArticles || scheduledArticles.length === 0) {
    return NextResponse.json({ success: true, publishedCount: 0, articles: [] });
  }

  const articleIds = scheduledArticles.map((article) => article.id);

  const { error: updateError } = await supabaseAdmin
    .from('articles')
    .update({
      status: 'published',
      published_at: now,
    })
    .in('id', articleIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    publishedCount: scheduledArticles.length,
    articles: scheduledArticles,
  });
}

export async function GET(request: NextRequest) {
  return handlePublishScheduled(request);
}

export async function POST(request: NextRequest) {
  return handlePublishScheduled(request);
}
