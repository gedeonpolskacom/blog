/**
 * Admin Sync Proxy
 * Route: GET /api/admin/sync?autoDraft=true|false
 *
 * Called from admin panel (browser). Proxies to /api/b2b/sync
 * with server-side CRON_SECRET — never exposed to the client.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const autoDraft = searchParams.get('autoDraft') ?? 'false';

  const cronSecret = process.env.CRON_SECRET ?? '';

  // Build internal URL based on current request origin.
  // This works both for localhost and 127.0.0.1 in dev.
  const syncUrl = new URL('/api/b2b/sync', request.nextUrl.origin);
  syncUrl.searchParams.set('autoDraft', autoDraft);

  try {
    const headers: Record<string, string> = {};
    if (cronSecret) {
      headers.Authorization = `Bearer ${cronSecret}`;
    }

    const res = await fetch(syncUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const raw = await res.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: 'Sync endpoint returned non-JSON response', raw };
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy sync failed', message: String(error) },
      { status: 500 }
    );
  }
}
