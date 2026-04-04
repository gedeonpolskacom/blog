/**
 * Newsletter Scheduled Jobs
 * Route: GET  /api/newsletter/scheduled  — lista wszystkich jobów
 *        POST /api/newsletter/scheduled  — utwórz/zapisz job
 *
 * Zastępuje stary plik jobs.json — dane w tabeli newsletter_jobs (Supabase).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── GET — pobierz listę jobów ──────────────────────────────────

export async function GET() {
  try {
    const client = supabaseAdmin;
    if (!client) throw new Error('supabaseAdmin not available');

    const { data, error } = await client
      .from('newsletter_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map DB columns → format oczekiwany przez app.js
    const jobs = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name ?? row.subject,
      accountId: row.sender_account_id,
      subject: row.subject,
      html: row.html_content,
      recipients: row.recipients ?? [],
      recipientsCount: row.recipients_count,
      scheduledAt: row.scheduled_at,
      status: row.status,
      sentAt: row.sent_at,
      results: row.results ?? [],
      config: row.config ?? {},
      createdAt: row.created_at,
    }));

    return NextResponse.json(jobs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST — zapisz nowy job (scheduled lub history) ────────────

export async function POST(request: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) throw new Error('supabaseAdmin not available');

    const body = await request.json();
    const recipients: string[] = Array.isArray(body.recipients) ? body.recipients : [];

    const row = {
      name: body.name ?? body.subject,
      subject: body.subject,
      html_content: body.html,
      sender_account_id: body.accountId ?? null,
      sender_name: body.fromName ?? 'Gedeon Polska',
      sender_email: body.from ?? process.env.SMTP_USER ?? '',
      status: body.status ?? 'scheduled',
      scheduled_at: body.scheduledAt ?? null,
      sent_at: body.sentAt ?? null,
      recipients,
      recipients_count: recipients.length,
      results: body.results ?? [],
      config: body.config ?? {},
    };

    const { data, error } = await client
      .from('newsletter_jobs')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
