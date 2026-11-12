import { describe, it, expect } from 'vitest';
import { clusterArticles } from '../lib/server/cluster';
import { TfIdfVectorizer } from '../lib/server/embeddings';
import { projectEventsToBrain, computeSimilarityEdges } from '../lib/server/projection';
import { inBrain, distance3, minDist } from '../lib/neuronPosition';
import { RawItem } from '../lib/server/sources/types';

describe('Phase 4: Semantic Clustering', () => {
  it('clusters two obviously different topic groups into separate clusters', () => {
    // Group 1: Deep Tech / AI
    const techItems: RawItem[] = [
      {
        id: 'tech-1',
        title: 'Deep learning neural networks reach new benchmark',
        description: 'Artificial intelligence researcher trains transformer model',
        url: 'https://example.com/tech-1',
        source: 'TechSource',
        sourceType: 'newsdata',
        publishedAt: '2026-11-11T10:00:00Z',
      },
      {
        id: 'tech-2',
        title: 'Artificial intelligence software breakthrough in neural networks',
        description: 'New deep learning algorithm accelerates transformer training',
        url: 'https://example.com/tech-2',
        source: 'TechReview',
        sourceType: 'rss',
        publishedAt: '2026-11-11T10:30:00Z',
      },
    ];

    // Group 2: European Football / Soccer
    const sportsItems: RawItem[] = [
      {
        id: 'sports-1',
        title: 'Premier league football match results in decisive victory',
        description: 'Soccer striker scores hat trick in championship tournament',
        url: 'https://example.com/sports-1',
        source: 'SportNews',
        sourceType: 'rss',
        publishedAt: '2026-11-11T09:00:00Z',
      },
      {
        id: 'sports-2',
        title: 'Championship soccer tournament match highlights',
        description: 'Football league striker celebrates tournament victory and trophy',
        url: 'https://example.com/sports-2',
        source: 'BBC Sport',
        sourceType: 'rss',
        publishedAt: '2026-11-11T09:15:00Z',
      },
    ];

    const allItems = [...techItems, ...sportsItems];
    const texts = allItems.map((i) => `${i.title} ${i.description}`);

    const vectorizer = new TfIdfVectorizer(128);
    vectorizer.fit(texts);
    const vectors = texts.map((t) => vectorizer.transform(t));

    const events = clusterArticles(allItems, vectors, {
      embeddingSource: 'tfidf',
      similarityThreshold: 0.15,
    });

    // We should have at least 2 distinct clusters
    expect(events.length).toBeGreaterThanOrEqual(2);

    // Verify that tech items are not grouped with sports items
    const techCluster = events.find((e) => e.articles.some((a) => a.id.startsWith('tech')));
    const sportsCluster = events.find((e) => e.articles.some((a) => a.id.startsWith('sports')));

    expect(techCluster).toBeDefined();
    expect(sportsCluster).toBeDefined();
    expect(techCluster?.id).not.toBe(sportsCluster?.id);

    // Ensure no tech cluster contains sports items and vice versa
    techCluster?.articles.forEach((art) => {
      expect(art.id.startsWith('tech')).toBe(true);
    });
    sportsCluster?.articles.forEach((art) => {
      expect(art.id.startsWith('sports')).toBe(true);
    });
  });
});

describe('Phase 4: Brain Volume Projection & Relaxation', () => {
  it('places all projected points inside the brain volume and respects minimum distance', () => {
    // Create 12 synthetic events with random high-dimensional centroids
    const mockEvents = Array.from({ length: 12 }, (_, i) => {
      const vec = Array.from({ length: 64 }, (_, j) => Math.sin(i * 10 + j * 0.5));
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
      const centroid = vec.map((x) => x / norm);

      return {
        id: `evt-${i}`,
        name: `Topic ${i}`,
        title: `Title ${i}`,
        summary: `Summary ${i}`,
        category: 'tech' as const,
        intensity: 0.7,
        trend: {
          finalScore: 0.7,
          label: 'rising' as const,
          velocity: 0.6,
          diversity: 0.5,
          engagement: 0.4,
          sourceCount: 2,
          itemCount: 3,
        },
        articles: [],
        centroid,
        source: 'Test',
        timestamp: new Date().toISOString(),
      };
    });

    const projected = projectEventsToBrain(mockEvents);

    // 1. Every point must be inside the brain volume
    projected.forEach((event) => {
      expect(event.position).toBeDefined();
      expect(inBrain(event.position!)).toBe(true);
    });

    // 2. Minimum distance spacing between neurons should be respected
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const d = distance3(projected[i].position!, projected[j].position!);
        // After relaxation passes, distance should be at or near minDist
        expect(d).toBeGreaterThanOrEqual(minDist * 0.85);
      }
    }
  });

  it('computes top-3 similarity edges between events', () => {
    const mockEvents = Array.from({ length: 6 }, (_, i) => ({
      id: `evt-${i}`,
      name: `Topic ${i}`,
      title: `Title ${i}`,
      summary: `Summary ${i}`,
      category: 'science' as const,
      intensity: 0.5,
      trend: {
        finalScore: 0.5,
        label: 'steady' as const,
        velocity: 0.5,
        diversity: 0.3,
        engagement: 0.2,
        sourceCount: 1,
        itemCount: 1,
      },
      articles: [],
      centroid: [i === 0 || i === 1 ? 1 : 0, i === 0 || i === 1 ? 0 : 1, 0],
      source: 'Test',
      timestamp: new Date().toISOString(),
      position: [0, 1, 0] as [number, number, number],
    }));

    const { eventsWithEdges, edges } = computeSimilarityEdges(mockEvents, 0.1);
    expect(eventsWithEdges[0].similarEventIds).toBeDefined();
    expect(eventsWithEdges[0].similarEventIds!.length).toBeLessThanOrEqual(3);
    expect(edges.length).toBeGreaterThan(0);
  });
});

