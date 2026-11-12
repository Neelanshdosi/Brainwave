import { RawItem } from './types';
import { logger } from '../logger';
import { hashString } from '../../neuronPosition';
import { cleanText } from '../cleanText';

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string; // e.g. 20261111T120000Z or 20261111120000
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

function parseGdeltDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    // Check format YYYYMMDDTHHMMSSZ
    if (dateStr.includes('T')) {
      const formatted = dateStr.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
        '$1-$2-$3T$4:$5:$6Z'
      );
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) return d.toISOString();
    } else if (dateStr.length >= 14) {
      // Format YYYYMMDDHHMMSS
      const formatted = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:${dateStr.substring(12, 14)}Z`;
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  } catch {
    // fallback
  }
  return new Date().toISOString();
}

export async function fetchGdelt(): Promise<RawItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const url =
    'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:eng&mode=artlist&maxrecords=50&format=json&timespan=6h';

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`GDELT fetch returned HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    let json: GdeltResponse;
    try {
      json = JSON.parse(text);
    } catch {
      logger.warn('Failed to parse GDELT response as JSON');
      return [];
    }

    if (!json.articles || !Array.isArray(json.articles)) {
      return [];
    }

    return json.articles
      .filter((art) => art.title && art.title.length > 5 && art.url)
      .map((art) => {
        const id = `gdelt-${hashString(art.url).toString(16)}`;
        const cleanedTitle = cleanText(art.title);
        return {
          id,
          title: cleanedTitle,
          description: cleanedTitle,
          url: art.url,
          source: art.domain || 'GDELT',
          sourceType: 'gdelt',
          publishedAt: parseGdeltDate(art.seendate),
          engagement: 0,
        };
      });
  } catch (err) {
    logger.warn('Error fetching from GDELT DOC API', err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

