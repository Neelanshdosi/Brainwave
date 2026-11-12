import { RawItem } from './sources/types';
import { TrendScore, scoreTrend, TimeWindow } from './trend';
import { cosineSimilarity, l2Normalize } from './embeddings';
import { hashString } from '../neuronPosition';
import { CategoryType, categorizeByKeywords } from './categorize';

export interface Event {
  id: string; // stable hash of the earliest article
  name: string; // for compatibility with Topic
  title: string;
  summary: string;
  category: CategoryType;
  intensity: number; // trend.finalScore
  trend: TrendScore;
  articles: RawItem[];
  centroid: number[];
  source: string;
  timestamp: string;
  url?: string;
  position?: [number, number, number];
  similarEventIds?: string[];
}

export const CATEGORY_PROTOTYPES: Record<Exclude<CategoryType, 'other'>, string> = {
  tech: 'Artificial intelligence machine learning software hardware computers algorithms programming tech startups crypto microchips smartphones cybersecurity',
  politics: 'Government elections congress president senate parliament legislation voting democracy diplomacy foreign policy court supreme prime minister',
  science: 'Science scientific research astronomy space exploration NASA physics chemistry biology clinical trial medicine climate environment genetics',
  entertainment: 'Cinema movie film actor hollywood netflix streaming music album concert celebrity pop culture gaming videogame series television',
  sports: 'Sports athletics football soccer basketball championship league tournament athlete soccer player goal grand slam tennis olympics',
};

export interface ClusterOptions {
  similarityThreshold?: number;
  embeddingSource?: 'gemini' | 'tfidf';
  window?: TimeWindow;
  categoryPrototypeEmbeddings?: Record<string, number[]>;
}

/**
 * Pure average-linkage agglomerative clustering on cosine similarity.
 */
export function clusterArticles(
  items: RawItem[],
  vectors: number[][],
  options: ClusterOptions = {}
): Event[] {
  if (items.length === 0 || vectors.length === 0) return [];

  const embeddingSource = options.embeddingSource || 'tfidf';
  // Configurable thresholds for Gemini (0.68) vs TF-IDF (0.20)
  const defaultThreshold = embeddingSource === 'gemini' ? 0.68 : 0.20;
  const threshold = options.similarityThreshold ?? defaultThreshold;

  const n = items.length;
  // Precompute pairwise similarities
  const simMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    simMatrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const s = cosineSimilarity(vectors[i], vectors[j]);
      simMatrix[i][j] = s;
      simMatrix[j][i] = s;
    }
  }

  // Initial clusters: each index is its own cluster
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

  // Average linkage distance between cluster A and cluster B
  function clusterSimilarity(c1: number[], c2: number[]): number {
    let sum = 0;
    for (const i of c1) {
      for (const j of c2) {
        sum += simMatrix[i][j];
      }
    }
    return sum / (c1.length * c2.length);
  }

  while (clusters.length > 1) {
    let bestSim = -1;
    let bestPair: [number, number] = [-1, -1];

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = clusterSimilarity(clusters[i], clusters[j]);
        if (sim > bestSim) {
          bestSim = sim;
          bestPair = [i, j];
        }
      }
    }

    if (bestSim < threshold || bestPair[0] === -1) {
      break;
    }

    const [ci, cj] = bestPair;
    // Merge cj into ci
    clusters[ci] = [...clusters[ci], ...clusters[cj]];
    clusters.splice(cj, 1);
  }

  // Convert clusters to Events
  const events: Event[] = clusters.map((clusterIndices) => {
    const clusterItems = clusterIndices.map((idx) => items[idx]);
    const clusterVectors = clusterIndices.map((idx) => vectors[idx]);

    // Sort items by publishedAt ascending to find earliest
    const sortedByTime = [...clusterItems].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    const earliest = sortedByTime[0];
    const latest = sortedByTime[sortedByTime.length - 1];

    // Compute centroid
    const dim = clusterVectors[0].length;
    const rawCentroid = new Array(dim).fill(0);
    for (const vec of clusterVectors) {
      for (let d = 0; d < dim; d++) {
        rawCentroid[d] += vec[d];
      }
    }
    const centroid = l2Normalize(rawCentroid.map((x) => x / clusterVectors.length));

    // Stable ID based on the earliest article URL / ID
    const stableId = `evt-${hashString(earliest.url || earliest.id).toString(16)}`;

    // Pick most representative title (highest engagement or earliest)
    const bestItem = [...clusterItems].sort(
      (a, b) => (b.engagement || 0) - (a.engagement || 0)
    )[0];
    const title = bestItem.title;
    const summary = bestItem.description || earliest.description || title;

    // Trend score using pure function
    const trend = scoreTrend(clusterItems, options.window);

    // Zero-shot categorization against prototypes if prototype vectors provided
    let category: CategoryType = 'other';
    if (options.categoryPrototypeEmbeddings) {
      let highestCatSim = -1;
      for (const [catName, protoVec] of Object.entries(options.categoryPrototypeEmbeddings)) {
        const sim = cosineSimilarity(centroid, protoVec);
        if (sim > highestCatSim) {
          highestCatSim = sim;
          category = catName as CategoryType;
        }
      }
      if (highestCatSim < 0.15) {
        category = 'other';
      }
    } else {
      // Fallback to keyword categorizer
      category = categorizeByKeywords(title, summary);
    }

    return {
      id: stableId,
      name: title,
      title,
      summary,
      category,
      intensity: trend.finalScore,
      trend,
      articles: clusterItems,
      centroid,
      source: bestItem.source,
      timestamp: latest.publishedAt,
      url: bestItem.url,
    };
  });

  return events;
}

