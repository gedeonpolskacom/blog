import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ExportProvider = 'mailchimp' | 'brevo';

interface ExportRequestBody {
  provider: ExportProvider;
  listId?: string | number;
  confirmedOnly?: boolean;
  dryRun?: boolean;
  tags?: string[];
}

interface NewsletterSubscriberRow {
  id: string;
  email: string;
  lang: string | null;
  source: string | null;
  confirmed: boolean | null;
  unsubscribed: boolean | null;
  created_at: string | null;
}

interface ExportOutcome {
  email: string;
  success: boolean;
  error?: string;
}

function isAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    return false;
  }

  const cookieToken = request.cookies.get('admin_token')?.value;
  const queryToken = request.nextUrl.searchParams.get('token');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  return cookieToken === expectedToken || queryToken === expectedToken || bearerToken === expectedToken;
}

async function loadSubscribers(confirmedOnly: boolean): Promise<NewsletterSubscriberRow[]> {
  let query = supabaseAdmin
    .from('newsletter_subscribers')
    .select('id,email,lang,source,confirmed,unsubscribed,created_at')
    .eq('unsubscribed', false)
    .order('created_at', { ascending: false });

  if (confirmedOnly) {
    query = query.eq('confirmed', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as NewsletterSubscriberRow[];
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(subscribers: NewsletterSubscriberRow[]): string {
  const header = ['email', 'lang', 'source', 'confirmed', 'created_at'].join(',');
  const rows = subscribers.map((subscriber) =>
    [
      escapeCsv(subscriber.email ?? ''),
      escapeCsv(subscriber.lang ?? ''),
      escapeCsv(subscriber.source ?? ''),
      escapeCsv(String(Boolean(subscriber.confirmed))),
      escapeCsv(subscriber.created_at ?? ''),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

function splitInChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function exportToMailchimp(
  subscribers: NewsletterSubscriberRow[],
  listId: string,
  tags: string[]
): Promise<ExportOutcome[]> {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    throw new Error('MAILCHIMP_API_KEY is not configured');
  }

  const dataCenter = apiKey.split('-').pop();
  if (!dataCenter || dataCenter === apiKey) {
    throw new Error('MAILCHIMP_API_KEY must include datacenter suffix, e.g. key-us21');
  }

  const baseUrl = `https://${dataCenter}.api.mailchimp.com/3.0`;
  const results: ExportOutcome[] = [];
  const chunks = splitInChunks(subscribers, 10);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (subscriber): Promise<ExportOutcome> => {
        const email = subscriber.email.trim().toLowerCase();
        const hash = createHash('md5').update(email).digest('hex');
        const endpoint = `${baseUrl}/lists/${listId}/members/${hash}`;

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `apikey ${apiKey}`,
          },
          body: JSON.stringify({
            email_address: email,
            status_if_new: 'subscribed',
            status: 'subscribed',
            tags,
            merge_fields: {
              LANG: subscriber.lang ?? '',
              SOURCE: subscriber.source ?? '',
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return {
            email: subscriber.email,
            success: false,
            error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
          };
        }

        return { email: subscriber.email, success: true };
      })
    );

    results.push(...chunkResults);
  }

  return results;
}

async function exportToBrevo(
  subscribers: NewsletterSubscriberRow[],
  listId: number | null
): Promise<ExportOutcome[]> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const results: ExportOutcome[] = [];
  const chunks = splitInChunks(subscribers, 10);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (subscriber): Promise<ExportOutcome> => {
        const response = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            email: subscriber.email,
            updateEnabled: true,
            listIds: listId ? [listId] : undefined,
            attributes: {
              LANG: subscriber.lang ?? '',
              SOURCE: subscriber.source ?? '',
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return {
            email: subscriber.email,
            success: false,
            error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
          };
        }

        return { email: subscriber.email, success: true };
      })
    );

    results.push(...chunkResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const confirmedOnly = request.nextUrl.searchParams.get('confirmedOnly') !== 'false';
    const subscribers = await loadSubscribers(confirmedOnly);
    const csv = toCsv(subscribers);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!body?.provider) {
      return NextResponse.json({ success: false, error: 'provider is required' }, { status: 400 });
    }

    if (body.provider !== 'mailchimp' && body.provider !== 'brevo') {
      return NextResponse.json({ success: false, error: 'provider must be mailchimp or brevo' }, { status: 400 });
    }

    const confirmedOnly = body.confirmedOnly !== false;
    const subscribers = await loadSubscribers(confirmedOnly);
    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        provider: body.provider,
        total: 0,
        exportedCount: 0,
        failedCount: 0,
        failures: [],
      });
    }

    if (body.dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        provider: body.provider,
        total: subscribers.length,
        sample: subscribers.slice(0, 10).map((subscriber) => ({
          email: subscriber.email,
          lang: subscriber.lang ?? '',
          source: subscriber.source ?? '',
        })),
      });
    }

    let outcomes: ExportOutcome[] = [];
    if (body.provider === 'mailchimp') {
      const listId = String(body.listId ?? process.env.MAILCHIMP_AUDIENCE_ID ?? '').trim();
      if (!listId) {
        return NextResponse.json(
          { success: false, error: 'Mailchimp listId is required (body.listId or MAILCHIMP_AUDIENCE_ID)' },
          { status: 400 }
        );
      }

      outcomes = await exportToMailchimp(subscribers, listId, body.tags ?? []);
    }

    if (body.provider === 'brevo') {
      const rawListId = body.listId ?? process.env.BREVO_LIST_ID ?? null;
      const numericListId = rawListId === null || rawListId === '' ? null : Number(rawListId);
      if (rawListId !== null && rawListId !== '' && Number.isNaN(numericListId)) {
        return NextResponse.json(
          { success: false, error: 'Brevo listId must be numeric' },
          { status: 400 }
        );
      }

      outcomes = await exportToBrevo(subscribers, numericListId);
    }

    const failures = outcomes.filter((result) => !result.success);
    const exported = outcomes.length - failures.length;

    return NextResponse.json({
      success: failures.length === 0,
      provider: body.provider,
      total: outcomes.length,
      exportedCount: exported,
      failedCount: failures.length,
      failures: failures.slice(0, 30),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
