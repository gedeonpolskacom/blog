import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type CheckStatus = 'ok' | 'warn' | 'error' | 'skipped';

type CheckResult = {
  status: CheckStatus;
  message: string;
  details?: string;
  meta?: Record<string, unknown>;
};

export const dynamic = 'force-dynamic';

function buildResult(
  status: CheckStatus,
  message: string,
  details?: string,
  meta?: Record<string, unknown>
): CheckResult {
  return { status, message, details, meta };
}

async function checkArticlesColumns(): Promise<CheckResult> {
  const { error } = await supabaseAdmin
    .from('articles')
    .select('id, cover_image, cover_url, gallery_images')
    .limit(1);

  if (!error) {
    return buildResult(
      'ok',
      'Kolumny articles.cover_image i articles.gallery_images są dostępne.'
    );
  }

  if (/cover_image|gallery_images/i.test(error.message)) {
    return buildResult(
      'error',
      'Brak wymaganych kolumn w tabeli articles.',
      'Uruchom migracje: 20260401_cover_image_column.sql oraz 20260401_gallery_images_column.sql.',
      { code: error.code ?? null, raw: error.message }
    );
  }

  return buildResult(
    'error',
    'Nie udało się sprawdzić kolumn tabeli articles.',
    error.message,
    { code: error.code ?? null }
  );
}

async function checkTopicSuggestionUniqueConstraint(): Promise<CheckResult> {
  const probeTitle = `__diag_topic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probeSource = 'diagnostic_probe';
  let firstId: string | null = null;
  let secondId: string | null = null;

  try {
    const first = await supabaseAdmin
      .from('topic_suggestions')
      .upsert(
        {
          title_pl: probeTitle,
          title_en: probeTitle,
          category: 'diagnostic',
          keywords: ['diagnostic'],
          source: probeSource,
          status: 'pending',
        },
        { onConflict: 'source,title_pl' }
      )
      .select('id')
      .single();

    if (first.error) {
      if (/on conflict|constraint/i.test(first.error.message)) {
        return buildResult(
          'error',
          'Brak constraintu UNIQUE dla topic_suggestions(source, title_pl).',
          'Uruchom migrację 20260401_topic_suggestions_idempotency.sql.',
          { code: first.error.code ?? null, raw: first.error.message }
        );
      }

      return buildResult(
        'error',
        'Nie udało się wykonać testu upsert dla topic_suggestions.',
        first.error.message,
        { code: first.error.code ?? null }
      );
    }

    firstId = first.data?.id ?? null;

    const second = await supabaseAdmin
      .from('topic_suggestions')
      .upsert(
        {
          title_pl: probeTitle,
          title_en: `${probeTitle}-updated`,
          category: 'diagnostic',
          keywords: ['diagnostic', 'updated'],
          source: probeSource,
          status: 'pending',
        },
        { onConflict: 'source,title_pl' }
      )
      .select('id')
      .single();

    if (second.error) {
      return buildResult(
        'error',
        'Upsert conflict test dla topic_suggestions nie przeszedł.',
        second.error.message,
        { code: second.error.code ?? null }
      );
    }

    secondId = second.data?.id ?? null;

    return buildResult(
      'ok',
      'UNIQUE(source, title_pl) dla topic_suggestions działa poprawnie.',
      undefined,
      { firstId, secondId }
    );
  } finally {
    const cleanup = await supabaseAdmin
      .from('topic_suggestions')
      .delete()
      .eq('source', probeSource)
      .eq('title_pl', probeTitle);

    if (cleanup.error) {
      console.warn('[DB Diagnostics] topic_suggestions cleanup failed:', cleanup.error.message);
    }
  }
}

async function checkPimSyncUniqueConstraint(): Promise<CheckResult> {
  const probeSku = `__DIAG_SKU_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  let firstId: string | null = null;
  let secondId: string | null = null;

  try {
    const first = await supabaseAdmin
      .from('pim_sync_log')
      .upsert(
        {
          product_sku: probeSku,
          event_type: 'diagnostic_probe',
          payload: { probe: true, step: 1, at: new Date().toISOString() },
          processed: false,
        },
        { onConflict: 'product_sku' }
      )
      .select('id')
      .single();

    if (first.error) {
      if (/on conflict|constraint/i.test(first.error.message)) {
        return buildResult(
          'error',
          'Brak constraintu UNIQUE dla pim_sync_log(product_sku).',
          'Uruchom migrację 20260331_pim_sync_unique.sql.',
          { code: first.error.code ?? null, raw: first.error.message }
        );
      }

      return buildResult(
        'error',
        'Nie udało się wykonać testu upsert dla pim_sync_log.',
        first.error.message,
        { code: first.error.code ?? null }
      );
    }

    firstId = first.data?.id ?? null;

    const second = await supabaseAdmin
      .from('pim_sync_log')
      .upsert(
        {
          product_sku: probeSku,
          event_type: 'diagnostic_probe',
          payload: { probe: true, step: 2, at: new Date().toISOString() },
          processed: false,
        },
        { onConflict: 'product_sku' }
      )
      .select('id')
      .single();

    if (second.error) {
      return buildResult(
        'error',
        'Upsert conflict test dla pim_sync_log nie przeszedł.',
        second.error.message,
        { code: second.error.code ?? null }
      );
    }

    secondId = second.data?.id ?? null;

    return buildResult(
      'ok',
      'UNIQUE(product_sku) dla pim_sync_log działa poprawnie.',
      undefined,
      { firstId, secondId }
    );
  } finally {
    const cleanup = await supabaseAdmin
      .from('pim_sync_log')
      .delete()
      .eq('product_sku', probeSku);

    if (cleanup.error) {
      console.warn('[DB Diagnostics] pim_sync_log cleanup failed:', cleanup.error.message);
    }
  }
}

async function checkIncrementViewsRpc(): Promise<CheckResult> {
  const { data: article, error: findError } = await supabaseAdmin
    .from('articles')
    .select('id, slug, views')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    return buildResult(
      'error',
      'Nie udało się pobrać artykułu do testu increment_views.',
      findError.message,
      { code: findError.code ?? null }
    );
  }

  if (!article) {
    return buildResult(
      'skipped',
      'Brak opublikowanych artykułów - test increment_views pominięty.'
    );
  }

  const before = Number(article.views ?? 0);

  const rpc = await supabaseAdmin.rpc('increment_views', { article_id: article.id });
  if (rpc.error) {
    return buildResult(
      'error',
      'Wywołanie RPC increment_views nie powiodło się.',
      rpc.error.message,
      { code: rpc.error.code ?? null, slug: article.slug }
    );
  }

  const { data: afterRow, error: afterError } = await supabaseAdmin
    .from('articles')
    .select('views')
    .eq('id', article.id)
    .single();

  if (afterError) {
    return buildResult(
      'error',
      'RPC increment_views wywołane, ale nie udało się odczytać nowej wartości views.',
      afterError.message,
      { code: afterError.code ?? null, slug: article.slug }
    );
  }

  const after = Number(afterRow.views ?? 0);

  const rollback = await supabaseAdmin
    .from('articles')
    .update({ views: before })
    .eq('id', article.id);

  const rollbackOk = !rollback.error;

  if (after === before + 1) {
    return buildResult(
      rollbackOk ? 'ok' : 'warn',
      rollbackOk
        ? 'RPC increment_views działa poprawnie (rollback wykonany).'
        : 'RPC increment_views działa, ale rollback views się nie powiódł.',
      rollbackOk ? undefined : rollback.error?.message,
      { slug: article.slug, before, after, rollbackOk }
    );
  }

  return buildResult(
    'error',
    'RPC increment_views nie zwiększył licznika o 1.',
    undefined,
    { slug: article.slug, before, after, rollbackOk }
  );
}

export async function GET() {
  const [columns, topicConstraint, pimConstraint, incrementViews] = await Promise.all([
    checkArticlesColumns(),
    checkTopicSuggestionUniqueConstraint(),
    checkPimSyncUniqueConstraint(),
    checkIncrementViewsRpc(),
  ]);

  const checks = {
    articlesColumns: columns,
    topicSuggestionsUnique: topicConstraint,
    pimSyncUnique: pimConstraint,
    incrementViewsRpc: incrementViews,
  };

  const statusRank: Record<CheckStatus, number> = {
    ok: 0,
    skipped: 1,
    warn: 2,
    error: 3,
  };

  const overall =
    Object.values(checks).reduce<CheckStatus>((acc, current) => {
      return statusRank[current.status] > statusRank[acc] ? current.status : acc;
    }, 'ok');

  return NextResponse.json({
    success: overall !== 'error',
    overall,
    timestamp: new Date().toISOString(),
    checks,
    migrationHints: [
      'supabase/migrations/20260331_pim_sync_unique.sql',
      'supabase/migrations/20260401_topic_suggestions_idempotency.sql',
      'supabase/migrations/20260401_cover_image_column.sql',
      'supabase/migrations/20260401_cover_image_backfill.sql',
      'supabase/migrations/20260401_gallery_images_column.sql',
    ],
  });
}
