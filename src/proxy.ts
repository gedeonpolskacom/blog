import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminCookieOptions, isValidAdminToken } from '@/lib/admin-auth';

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = new URL('/admin/login', request.url);
  const from = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('from', from);
  return loginUrl;
}

function clearTokenFromUrl(request: NextRequest) {
  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete('token');
  return cleanUrl;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  const queryToken = searchParams.get('token');
  const cookieToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const queryTokenValid = isValidAdminToken(queryToken);
  const cookieTokenValid = isValidAdminToken(cookieToken);

  if (queryTokenValid) {
    const response = pathname.startsWith('/api/admin/')
      ? NextResponse.next()
      : NextResponse.redirect(clearTokenFromUrl(request));

    response.cookies.set(ADMIN_COOKIE_NAME, queryToken!, getAdminCookieOptions());
    return response;
  }

  if (cookieTokenValid) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(buildLoginRedirect(request));
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
