import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminCookieOptions, isValidAdminToken } from '@/lib/admin-auth';

function sanitizeRedirectTarget(from: string | null) {
  if (!from || !from.startsWith('/')) {
    return '/admin';
  }

  if (from.startsWith('//') || from.startsWith('/admin/login')) {
    return '/admin';
  }

  return from;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '');
  const from = sanitizeRedirectTarget(String(formData.get('from') ?? '/admin'));

  if (!isValidAdminToken(token)) {
    const redirectUrl = new URL('/admin/login', request.url);
    redirectUrl.searchParams.set('from', from);
    redirectUrl.searchParams.set('error', '1');

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(ADMIN_COOKIE_NAME);
    return response;
  }

  const redirectUrl = new URL(from, request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  return response;
}
