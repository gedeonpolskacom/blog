const DEFAULT_SITE_URL = 'https://blog.gedeonpolska.com';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) {
    return DEFAULT_SITE_URL;
  }
  return stripTrailingSlash(configuredUrl);
}

export const SITE_URL = getSiteUrl();
