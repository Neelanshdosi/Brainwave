import { RawItem } from './types';
import { logger } from '../logger';
import { cleanText } from '../cleanText';

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  time?: number;
  descendants?: number; // comments
  text?: string;
  type?: string;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchHackerNews(limit: number = 35): Promise<RawItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const listRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!listRes.ok) {
      logger.warn(`HN top stories returned HTTP ${listRes.status}`);
      return [];
    }

    const ids: number[] = await listRes.json();
    if (!Array.isArray(ids)) return [];

    const topIds = ids.slice(0, limit);

    // Fetch story details in parallel
    const itemPromises = topIds.map(async (id) => {
      try {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!itemRes.ok) return null;
        const item: HnItem = await itemRes.json();
        return item;
      } catch {
        return null;
      }
    });

    const items = await Promise.all(itemPromises);
    clearTimeout(timeoutId);

    const validItems: RawItem[] = [];
    const now = Date.now();

    for (const item of items) {
      if (!item || !item.title) continue;

      const itemTimeMs = item.time ? item.time * 1000 : now;
      // 24-hour max age filter
      if (now - itemTimeMs > MAX_AGE_MS) {
        continue;
      }

      const points = item.score || 0;
      const comments = item.descendants || 0;
      const engagement = points + comments;

      const publishedAt = new Date(itemTimeMs).toISOString();

      const cleanedTitle = cleanText(item.title);
      const cleanedBody = item.text ? cleanText(item.text) : '';

      // For Ask HN / Show HN / self posts, use item's own cleaned text as article body.
      // For link posts, use item's url as primary article URL so fetch_article can fetch linked page.
      const hasExternalLink = Boolean(item.url && item.url.startsWith('http'));
      const articleUrl = hasExternalLink
        ? item.url!
        : `https://news.ycombinator.com/item?id=${item.id}`;

      validItems.push({
        id: `hn-${item.id}`,
        title: cleanedTitle,
        description: cleanedBody.length > 0 ? cleanedBody : cleanedTitle,
        body: cleanedBody.length > 0 ? cleanedBody : undefined,
        url: articleUrl,
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt,
        engagement,
      });
    }

    return validItems;
  } catch (err) {
    logger.warn('Error fetching Hacker News top stories', err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
