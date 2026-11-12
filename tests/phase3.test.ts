import { describe, it, expect } from 'vitest';
import { scoreTrend, computeVelocity, computeSourceDiversity, computeEngagement } from '../lib/server/trend';
import { normalizeUrl } from '../lib/server/sources';
import { parseFeedXml } from '../lib/server/sources/rss';
import { RawItem } from '../lib/server/sources/types';

describe('Phase 3: Trend & Velocity Scoring', () => {
  const baseTime = 1700000000000; // Reference timestamp in ms
  const window = {
    start: baseTime,
    end: baseTime + 6 * 3600 * 1000, // 6 hour window
  };

  it('proves a fast-growing, multi-source story outscores an old single-source one', () => {
    // Story A: Fast-growing story published in the newest third of the window across 4 distinct sources with HN engagement
    const fastGrowingMultiSource: RawItem[] = [
      {
        id: '1',
        title: 'New Breakthrough in Quantum Computing',
        description: 'Details about quantum computing',
        url: 'https://news.ycombinator.com/item?id=100',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 5.5 * 3600 * 1000).toISOString(), // newest third
        engagement: 450,
      },
      {
        id: '2',
        title: 'Quantum Leap Announced Today',
        description: 'Global researchers unveil device',
        url: 'https://bbc.com/news/tech-quantum',
        source: 'BBC News',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 5.2 * 3600 * 1000).toISOString(), // newest third
      },
      {
        id: '3',
        title: 'Major Discovery by Physics Lab',
        description: 'Guardian report on quantum processor',
        url: 'https://theguardian.com/science/quantum',
        source: 'The Guardian',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 4.9 * 3600 * 1000).toISOString(), // newest third
      },
      {
        id: '4',
        title: 'Tech Industry Reacts to Quantum Breakthrough',
        description: 'NewsData report',
        url: 'https://reuters.com/tech/quantum',
        source: 'Reuters',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 4.5 * 3600 * 1000).toISOString(), // newest third
      },
    ];

    // Story B: Old, single-source story published in the oldest third with no engagement
    const oldSingleSource: RawItem[] = [
      {
        id: '10',
        title: 'Routine Municipal Budget Hearing Notice',
        description: 'Local council announces meeting date',
        url: 'https://localtown.gov/notice/1',
        source: 'LocalTown',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 0.2 * 3600 * 1000).toISOString(), // oldest third
        engagement: 0,
      },
      {
        id: '11',
        title: 'Municipal Budget Hearing Rescheduled',
        description: 'Meeting rescheduled to morning',
        url: 'https://localtown.gov/notice/2',
        source: 'LocalTown', // same source
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 0.5 * 3600 * 1000).toISOString(), // oldest third
        engagement: 0,
      },
    ];

    const scoreFast = scoreTrend(fastGrowingMultiSource, window);
    const scoreOld = scoreTrend(oldSingleSource, window);

    expect(scoreFast.velocity).toBeGreaterThan(scoreOld.velocity);
    expect(scoreFast.diversity).toBeGreaterThan(scoreOld.diversity);
    expect(scoreFast.finalScore).toBeGreaterThan(scoreOld.finalScore);
    expect(scoreFast.label).toMatch(/emerging|rising/);
    expect(scoreOld.label).toBe('fading');
  });

  it('correctly calculates velocity for items concentrated in the newest third', () => {
    const items: RawItem[] = [
      {
        id: 'a',
        title: 'Event A',
        description: 'Desc',
        url: 'http://a.com',
        source: 'S1',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 5 * 3600 * 1000).toISOString(),
      },
      {
        id: 'b',
        title: 'Event B',
        description: 'Desc',
        url: 'http://b.com',
        source: 'S2',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 5.5 * 3600 * 1000).toISOString(),
      },
    ];

    const velocity = computeVelocity(items, window);
    expect(velocity).toBe(1.0);
  });
});

describe('Phase 3: URL Normalization', () => {
  it('strips tracking parameters, hashes, and trailing slashes', () => {
    const url1 = 'https://Example.com/article/?utm_source=twitter&utm_medium=social#heading';
    const url2 = 'https://example.com/article?fbclid=12345';
    expect(normalizeUrl(url1)).toBe('https://example.com/article');
    expect(normalizeUrl(url2)).toBe('https://example.com/article');
  });
});

describe('Phase 3: Dependency-Free RSS / Atom Parser', () => {
  it('parses RSS 2.0 xml feeds into RawItem structures', () => {
    const sampleRss = `
      <rss version="2.0">
        <channel>
          <title>News Feed</title>
          <item>
            <title><![CDATA[Major Scientific Discovery in Space]]></title>
            <link>https://bbc.com/news/world-123</link>
            <description><![CDATA[Astronomers discover a new habitable planet.]]></description>
            <pubDate>Wed, 11 Nov 2026 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Global Market Update</title>
            <link>https://bbc.com/news/business-456</link>
            <description>Stocks rise following positive earnings.</description>
            <pubDate>Wed, 11 Nov 2026 11:30:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const parsed = parseFeedXml(sampleRss, 'BBC News');
    expect(parsed.length).toBe(2);
    expect(parsed[0].title).toBe('Major Scientific Discovery in Space');
    expect(parsed[0].description).toBe('Astronomers discover a new habitable planet.');
    expect(parsed[0].url).toBe('https://bbc.com/news/world-123');
    expect(parsed[0].source).toBe('BBC News');
    expect(parsed[0].sourceType).toBe('rss');
  });
});

