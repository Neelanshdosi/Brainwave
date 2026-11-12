import { RawItem } from './types';
import { fetchNewsData } from './newsdata';
import { fetchHackerNews } from './hackernews';
import { fetchGdelt } from './gdelt';
import { fetchRssFeeds } from './rss';
import { logger } from '../logger';

export * from './types';
export * from './newsdata';
export * from './hackernews';
export * from './gdelt';
export * from './rss';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'oc',
]);

/**
 * Normalizes a URL for deduplication:
 * - strips tracking query params
 * - strips fragments/hash
 * - strips trailing slash
 * - converts hostname/path to lowercase
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((k) => parsed.searchParams.delete(k));

    let clean = parsed.toString().toLowerCase();
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Fetch all sources in parallel with Promise.allSettled and 6s timeout each.
 * Deduplicates by normalized URL and caps at maxItems (~150).
 */
export async function fetchAllSources(maxItems: number = 150): Promise<RawItem[]> {
  logger.info('Starting multi-source ingestion pipeline...');
  const startTime = Date.now();

  const results = await Promise.allSettled([
    fetchNewsData(),
    fetchHackerNews(35),
    fetchGdelt(),
    fetchRssFeeds(),
  ]);

  const rawList: RawItem[] = [];
  results.forEach((res, index) => {
    const sourceNames = ['NewsData', 'HackerNews', 'GDELT', 'RSS'];
    if (res.status === 'fulfilled') {
      logger.info(`Source ${sourceNames[index]} returned ${res.value.length} items`);
      rawList.push(...res.value);
    } else {
      logger.warn(`Source ${sourceNames[index]} rejected`, res.reason);
    }
  });

  // Deduplicate by normalized URL
  const seenUrls = new Set<string>();
  const deduped: RawItem[] = [];

  for (const item of rawList) {
    if (!item.url || !item.title) continue;
    const norm = normalizeUrl(item.url);
    if (seenUrls.has(norm)) continue;
    seenUrls.add(norm);
    deduped.push(item);
  }

  // Sort by publishedAt descending so newer items are prioritized
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const capped = deduped.slice(0, maxItems);
  logger.info(
    `Ingestion complete: ${rawList.length} raw -> ${deduped.length} unique -> ${capped.length} capped in ${Date.now() - startTime}ms`
  );

  return capped;
}

