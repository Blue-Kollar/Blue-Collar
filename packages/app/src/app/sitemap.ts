import { MetadataRoute } from 'next';
import { routes } from '@/lib/routes';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bluecollar.app';
  const locales = ['en', 'fr', 'es', 'pt'];

  const sitemapRoutes = [
    routes.home,
    routes.workers,
    routes.about,
    routes.auth.login,
    routes.auth.register,
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  locales.forEach((locale) => {
    sitemapRoutes.forEach((route) => {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : 0.8,
      });
    });
  });

  return sitemapEntries;
}
