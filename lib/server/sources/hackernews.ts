import { RawItem } from './types';
import { logger } from '../logger';

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

export async function fetchHackerNews(limit: number = 30): Promise<RawItem[]> {
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

    for (const item of items) {
      if (!item || !item.title) continue;
      const points = item.score || 0;
      const comments = item.descendants || 0;
      const engagement = points + comments;

      const publishedAt = item.time
        ? new Date(item.time * 1000).toISOString()
        : new Date().toISOString();

      validItems.push({
        id: `hn-${item.id}`,
        title: item.title.trim(),
        description: item.text ? item.text.replace(/<[^>]+>/g, '').trim() : item.title.trim(),
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
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

