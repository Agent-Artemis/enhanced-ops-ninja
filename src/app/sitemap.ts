import type { MetadataRoute } from 'next';

const SITE = 'https://enhancedops.ninja';

// Public, indexable pages only. Session-scoped funnel steps (assessment, score,
// confirmation, in-depth-ops/[id]) and the internal CRM are deliberately absent
// — listing them would invite crawls of pages that 404 or redirect without a
// session, which costs crawl budget and teaches the index that we serve dead ends.
const ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/',                   priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/assessment',         priority: 0.8, changeFrequency: 'monthly' },
  { path: '/deep-dive',          priority: 0.8, changeFrequency: 'monthly' },
  { path: '/deep-dive/schedule', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/in-depth-ops',       priority: 0.6, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
