import { NextResponse } from 'next/server';
import { LRUCache } from '@/lib/server/cache';
import { logger } from '@/lib/server/logger';
import { fetchAllSources, RawItem } from '@/lib/server/sources';
import { embedItems } from '@/lib/server/embeddings';
import { clusterArticles, Event } from '@/lib/server/cluster';
import { projectEventsToBrain, computeSimilarityEdges, SimilarityEdge } from '@/lib/server/projection';
import { mockTopics } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

interface EventsApiResponse {
  events: Event[];
  edges: SimilarityEdge[];
  updatedAt: string;
}

// 10 minutes server-side cache
const eventsCache = new LRUCache<EventsApiResponse>(5, 10 * 60 * 1000);
const CACHE_KEY = 'global_events_cache';

export async function GET() {
  try {
    // 1. Check server-side 10-minute cache
    const cached = eventsCache.get(CACHE_KEY);
    if (cached) {
      logger.info('Returning events from 10-minute server cache');
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60',
        },
      });
    }

    logger.info('Building fresh events pipeline...');
    const startTime = Date.now();

    // 2. Fetch raw items from all sources in parallel (6s timeout)
    let rawItems: RawItem[] = [];
    try {
      rawItems = await fetchAllSources(150);
    } catch (sourceErr) {
      logger.warn('Failed to fetch from live sources', sourceErr);
    }

    // Fallback to mock topics if all external sources failed
    if (rawItems.length === 0) {
      logger.info('Using mock topics as fallback pool');
      rawItems = mockTopics.map((m, idx) => ({
        id: `mock-${idx}`,
        title: m.name,
        description: m.summary,
        url: m.url || 'https://news.google.com',
        source: m.source,
        sourceType: 'newsdata',
        publishedAt: new Date(m.timestamp).toISOString(),
        engagement: 50,
      }));
    }

    // 3. Embed items with Gemini batchEmbedContents or TF-IDF
    const { embeddings, source } = await embedItems(rawItems);

    // 4. Time window for velocity scoring
    const timestamps = rawItems
      .map((i) => new Date(i.publishedAt).getTime())
      .filter((t) => !isNaN(t));
    const window = timestamps.length > 0
      ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
      : undefined;

    // 5. Cluster items into events with agglomerative average-linkage
    const clusteredEvents = clusterArticles(rawItems, embeddings, {
      embeddingSource: source,
      window,
    });

    // Rank events by cluster size & trend momentum, keeping only the top 15 news nodes
    clusteredEvents.sort((a, b) => {
      const scoreA = a.articles.length * 0.35 + a.trend.finalScore * 0.65;
      const scoreB = b.articles.length * 0.35 + b.trend.finalScore * 0.65;
      return scoreB - scoreA;
    });

    const topEvents = clusteredEvents.slice(0, 15);
    logger.info(`Selected top ${topEvents.length} events across all 15 brain zones`);

    // 6. Project centroids to 3D brain volume via PCA and relaxation
    const projectedEvents = projectEventsToBrain(topEvents);

    // 7. Compute top-3 similarity edges
    const threshold = source === 'gemini' ? 0.35 : 0.08;
    const { eventsWithEdges, edges } = computeSimilarityEdges(projectedEvents, threshold);

    const payload: EventsApiResponse = {
      events: eventsWithEdges,
      edges,
      updatedAt: new Date().toISOString(),
    };

    // Store in 10-minute cache
    eventsCache.set(CACHE_KEY, payload);

    logger.info(
      `Events pipeline completed in ${Date.now() - startTime}ms: ${eventsWithEdges.length} events, ${edges.length} edges`
    );

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    logger.error('Unhandled error in /api/events', err);
    return NextResponse.json(
      { error: 'Failed to retrieve news events' },
      { status: 500 }
    );
  }
}
