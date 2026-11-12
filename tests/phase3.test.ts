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

    // Story B: Old, single-source story with only 2 items from the same source
    const oldSingleSource: RawItem[] = [
      {
        id: '10',
        title: 'Routine Municipal Budget Hearing Notice',
        description: 'Local council announces meeting date',
        url: 'https://localtown.gov/notice/1',
        source: 'LocalTown',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 0.2 * 3600 * 1000).toISOString(),
        engagement: 0,
      },
      {
        id: '11',
        title: 'Municipal Budget Hearing Rescheduled',
        description: 'Meeting rescheduled to morning',
        url: 'https://localtown.gov/notice/2',
        source: 'LocalTown', // same source
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 0.5 * 3600 * 1000).toISOString(),
        engagement: 0,
      },
    ];

    const scoreFast = scoreTrend(fastGrowingMultiSource, window);
    const scoreOld = scoreTrend(oldSingleSource, window);

    expect(typeof scoreFast.velocity).toBe('number');
    expect(scoreFast.velocity).toBeGreaterThan(0.7);
    expect(scoreFast.diversity).toBeGreaterThan(0.5);
    expect(scoreFast.finalScore).toBeGreaterThan(0.6);
    expect(scoreFast.label).toMatch(/emerging|rising/);

    // Old single-source (<3 items, <2 sources) must be unrated
    expect(scoreOld.velocity).toBe('unrated');
    expect(scoreOld.label).toBe('unrated');
    expect(scoreOld.finalScore).toBe(0);
    expect(scoreFast.finalScore).toBeGreaterThan(scoreOld.finalScore);
  });

  it('correctly marks velocity as "unrated" when fewer than 3 items or fewer than 2 distinct sources', () => {
    // Case 1: 2 items, 2 distinct sources (<3 items) -> unrated
    const twoItemsTwoSources: RawItem[] = [
      {
        id: '1',
        title: 'Story Alpha',
        description: 'Desc',
        url: 'https://source1.com/a',
        source: 'Source 1',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 4 * 3600 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Story Alpha',
        description: 'Desc',
        url: 'https://source2.com/a',
        source: 'Source 2',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 5 * 3600 * 1000).toISOString(),
      },
    ];
    const scoreCase1 = scoreTrend(twoItemsTwoSources, window);
    expect(scoreCase1.velocity).toBe('unrated');
    expect(scoreCase1.label).toBe('unrated');

    // Case 2: 3 items, 1 source (<2 distinct sources) -> unrated
    const threeItemsOneSource: RawItem[] = [
      {
        id: '1',
        title: 'Single Source Update 1',
        description: 'Desc',
        url: 'https://hn.com/1',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 2 * 3600 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Single Source Update 2',
        description: 'Desc',
        url: 'https://hn.com/2',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 3 * 3600 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Single Source Update 3',
        description: 'Desc',
        url: 'https://hn.com/3',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 4 * 3600 * 1000).toISOString(),
      },
    ];
    const scoreCase2 = scoreTrend(threeItemsOneSource, window);
    expect(scoreCase2.velocity).toBe('unrated');
    expect(scoreCase2.label).toBe('unrated');

    // Case 3: 3 items, 2 distinct sources (>=3 items AND >=2 sources) -> rated!
    const threeItemsTwoSources: RawItem[] = [
      {
        id: '1',
        title: 'Multi Source 1',
        description: 'Desc',
        url: 'https://hn.com/1',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 2 * 3600 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Multi Source 2',
        description: 'Desc',
        url: 'https://bbc.com/2',
        source: 'BBC News',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 3 * 3600 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Multi Source 3',
        description: 'Desc',
        url: 'https://hn.com/3',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(baseTime + 5.5 * 3600 * 1000).toISOString(),
      },
    ];
    const scoreCase3 = scoreTrend(threeItemsTwoSources, window);
    expect(typeof scoreCase3.velocity).toBe('number');
    expect(scoreCase3.velocity).toBeGreaterThan(0);
    expect(scoreCase3.label).not.toBe('unrated');
  });

  it('enforces that "emerging" label strictly requires >=2 sources AND newest item under 6 hours old', () => {
    // 3 items from 2 sources, newest item published 8 hours ago (not under 6h)
    const window24h = {
      start: baseTime,
      end: baseTime + 20 * 3600 * 1000,
    };
    const itemsOlderThan6h: RawItem[] = [
      {
        id: '1',
        title: 'Story 1',
        description: 'Desc',
        url: 'https://a.com',
        source: 'Source A',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 10 * 3600 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Story 2',
        description: 'Desc',
        url: 'https://b.com',
        source: 'Source B',
        sourceType: 'newsdata',
        publishedAt: new Date(baseTime + 11 * 3600 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Story 3',
        description: 'Desc',
        url: 'https://a.com/3',
        source: 'Source A',
        sourceType: 'rss',
        publishedAt: new Date(baseTime + 12 * 3600 * 1000).toISOString(), // 8 hours before window.end (20h)
      },
    ];

    const score = scoreTrend(itemsOlderThan6h, window24h);
    expect(score.label).not.toBe('emerging'); // Cannot be emerging since newest is 8h old
  });

  it('handles a 57-hour-old single-item event by filtering it via the 24h max age limit', () => {
    const nowMs = baseTime + 60 * 3600 * 1000;
    const testWindow = {
      start: nowMs - 24 * 3600 * 1000,
      end: nowMs,
    };

    // Single item published 57 hours before reference time
    const singleOldItem: RawItem[] = [
      {
        id: 'old-1',
        title: 'Ancient Hacker News Post',
        description: 'Discussions from 57 hours ago',
        url: 'https://news.ycombinator.com/item?id=99999',
        source: 'Hacker News',
        sourceType: 'hackernews',
        publishedAt: new Date(nowMs - 57 * 3600 * 1000).toISOString(),
      },
    ];

    const score = scoreTrend(singleOldItem, testWindow);

    // Item must be filtered out by 24h max age, resulting in unrated
    expect(score.itemCount).toBe(0);
    expect(score.velocity).toBe('unrated');
    expect(score.label).toBe('unrated');
    expect(score.finalScore).toBe(0);
    expect(score.isUnrated).toBe(true);
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
    const pubDate1 = new Date(Date.now() - 2 * 3600 * 1000).toUTCString();
    const pubDate2 = new Date(Date.now() - 3 * 3600 * 1000).toUTCString();

    const sampleRss = `
      <rss version="2.0">
        <channel>
          <title>News Feed</title>
          <item>
            <title><![CDATA[Major Scientific Discovery in Space]]></title>
            <link>https://bbc.com/news/world-123</link>
            <description><![CDATA[Astronomers discover a new habitable planet.]]></description>
            <pubDate>${pubDate1}</pubDate>
          </item>
          <item>
            <title>Global Market Update</title>
            <link>https://bbc.com/news/business-456</link>
            <description>Stocks rise following positive earnings.</description>
            <pubDate>${pubDate2}</pubDate>
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
