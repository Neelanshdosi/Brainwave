import { RawItem } from './types';
import { logger } from '../logger';
import { cleanText } from '../cleanText';

interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  pubDate: string;
  source_id: string;
  source_name?: string;
}

interface NewsDataResponse {
  status: string;
  results?: NewsDataArticle[];
}

export async function fetchNewsData(): Promise<RawItem[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    logger.info('NewsData API key not set, skipping newsdata source');
    return [];
  }

  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&language=en`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`NewsData fetch returned HTTP ${res.status}`);
      return [];
    }

    const json: NewsDataResponse = await res.json();
    if (!json.results || !Array.isArray(json.results)) {
      return [];
    }

    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;

    return json.results
      .filter((art) => {
        if (!art.title || art.title.length <= 5) return false;
        try {
          const d = new Date(art.pubDate);
          return !isNaN(d.getTime()) && now - d.getTime() <= maxAgeMs;
        } catch {
          return true;
        }
      })
      .map((art) => {
        let publishedAt: string;
        try {
          const d = new Date(art.pubDate);
          publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        } catch {
          publishedAt = new Date().toISOString();
        }

        return {
          id: `nd-${art.article_id || Math.random().toString(36).substring(2)}`,
          title: cleanText(art.title),
          description: cleanText(art.description || art.title),
          url: art.link,
          source: art.source_name || art.source_id || 'NewsData',
          sourceType: 'newsdata',
          publishedAt,
          engagement: 0,
        };
      });
  } catch (err) {
    logger.warn('Error fetching from NewsData source', err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

