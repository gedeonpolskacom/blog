export const ADMIN_COOKIE_NAME = 'admin_token';
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function getAdminToken() {
  return process.env.ADMIN_TOKEN ?? '';
}

export function isValidAdminToken(token: string | null | undefined) {
  const expectedToken = getAdminToken();
  return Boolean(expectedToken) && token === expectedToken;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  };
}
