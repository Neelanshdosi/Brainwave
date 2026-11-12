import { RawItem } from './types';
import { logger } from '../logger';
import { hashString } from '../../neuronPosition';
import { cleanText } from '../cleanText';

interface FeedConfig {
  name: string;
  url: string;
}

const FEEDS: FeedConfig[] = [
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];

function extractTagContent(xmlChunk: string, tagName: string): string {
  const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tagName}>`, 'i');
  const cdataMatch = xmlChunk.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  const standardRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const standardMatch = xmlChunk.match(standardRegex);
  if (standardMatch) return standardMatch[1];

  return '';
}

function extractLink(xmlChunk: string): string {
  // Try <link href="..." />
  const attrMatch = xmlChunk.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (attrMatch) return attrMatch[1].trim();

  // Try standard <link>...</link>
  const tagLink = extractTagContent(xmlChunk, 'link');
  if (tagLink) return tagLink.trim();

  return '';
}

/**
 * Dependency-free RSS 2.0 and Atom parser.
 */
export function parseFeedXml(xml: string, sourceName: string): RawItem[] {
  const items: RawItem[] = [];

  // Match all <item>...</item> (RSS) or <entry>...</entry> (Atom) blocks
  const itemBlocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];

  for (const block of itemBlocks) {
    const rawTitle = extractTagContent(block, 'title');
    const title = cleanText(rawTitle);
    if (!title || title.length < 5) continue;

    let link = extractLink(block);
    if (!link) {
      const guid = extractTagContent(block, 'guid') || extractTagContent(block, 'id');
      if (guid.startsWith('http')) link = guid.trim();
    }
    if (!link) continue;

    const rawDesc =
      extractTagContent(block, 'description') ||
      extractTagContent(block, 'summary') ||
      extractTagContent(block, 'content');
    const description = cleanText(rawDesc) || title;

    const rawDate =
      extractTagContent(block, 'pubDate') ||
      extractTagContent(block, 'published') ||
      extractTagContent(block, 'updated') ||
      extractTagContent(block, 'dc:date');

    let publishedAt = new Date().toISOString();
    if (rawDate) {
      try {
        const d = new Date(rawDate.trim());
        if (!isNaN(d.getTime())) {
          publishedAt = d.toISOString();
        }
      } catch {
        // fallback
      }
    }

    const id = `rss-${hashString(link).toString(16)}`;

    items.push({
      id,
      title,
      description,
      url: link,
      source: sourceName,
      sourceType: 'rss',
      publishedAt,
      engagement: 0,
    });
  }

  return items;
}

export async function fetchRssFeeds(): Promise<RawItem[]> {
  const feedPromises = FEEDS.map(async (feed) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(feed.url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'User-Agent': 'Brainwave-News-Aggregator/1.0',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        logger.warn(`RSS feed ${feed.name} returned HTTP ${res.status}`);
        return [];
      }

      const xml = await res.text();
      return parseFeedXml(xml, feed.name);
    } catch (err) {
      logger.warn(`Failed fetching RSS feed ${feed.name}`, err);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  });

  const results = await Promise.allSettled(feedPromises);
  const items: RawItem[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      items.push(...r.value);
    }
  }

  return items;
}
