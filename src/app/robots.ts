import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: 'https://blog.gedeonpolska.com/sitemap.xml',
    host: 'https://blog.gedeonpolska.com',
  };
}
