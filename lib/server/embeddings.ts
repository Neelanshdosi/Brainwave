import { RawItem } from './sources/types';
import { logger } from './logger';
import { LRUCache } from './cache';

// Cache embeddings by item ID (capacity 1000, 2 hour TTL)
const embeddingCache = new LRUCache<number[]>(1000, 2 * 60 * 60 * 1000);

export const EMBEDDING_DIM = 768;

/**
 * L2-normalize a vector.
 */
export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec.map(() => 0);
  return vec.map((x) => x / norm);
}

/**
 * Dot product of two normalized vectors (cosine similarity).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

// Common English stopwords for TF-IDF
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself'
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Dependency-free TF-IDF Vectorizer
 */
export class TfIdfVectorizer {
  private vocab: Map<string, number> = new Map();
  private idf: number[] = [];
  public dim: number;

  constructor(maxFeatures: number = EMBEDDING_DIM) {
    this.dim = maxFeatures;
  }

  fit(documents: string[]): void {
    const docTermFreqs: Map<string, number>[] = [];
    const docFreq: Map<string, number> = new Map();

    for (const doc of documents) {
      const tokens = tokenize(doc);
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    // Select top features by document frequency
    const sortedTerms = Array.from(docFreq.entries())
      .filter(([_, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.dim)
      .map(([term]) => term);

    this.vocab.clear();
    sortedTerms.forEach((term, index) => {
      this.vocab.set(term, index);
    });

    // Compute smoothed IDF
    const N = documents.length;
    this.idf = sortedTerms.map((term) => {
      const df = docFreq.get(term) || 1;
      return Math.log((1 + N) / (1 + df)) + 1;
    });
  }

  transform(text: string): number[] {
    const vec = new Array(this.dim).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vec;

    const tf: Record<number, number> = {};
    for (const token of tokens) {
      const idx = this.vocab.get(token);
      if (idx !== undefined) {
        tf[idx] = (tf[idx] || 0) + 1;
      }
    }

    for (const [idxStr, count] of Object.entries(tf)) {
      const idx = parseInt(idxStr, 10);
      vec[idx] = (count / tokens.length) * (this.idf[idx] || 1);
    }

    return l2Normalize(vec);
  }
}

/**
 * Call Gemini batchEmbedContents API (100 per batch, taskType CLUSTERING, outputDimensionality 768)
 */
async function embedBatchWithGemini(
  texts: string[],
  apiKey: string
): Promise<number[][] | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const requests = texts.map((text) => ({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text: text.substring(0, 1000) }],
      },
      taskType: 'CLUSTERING',
      outputDimensionality: EMBEDDING_DIM,
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`Gemini batchEmbedContents failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      return null;
    }

    return data.embeddings.map((item: { values: number[] }) => l2Normalize(item.values));
  } catch (err) {
    logger.warn('Gemini batchEmbedContents network error', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface EmbedResult {
  embeddings: number[][];
  source: 'gemini' | 'tfidf';
}

/**
 * Embed titles + descriptions using Gemini with 100-batching, falling back to TF-IDF.
 * Caches embeddings by item id.
 */
export async function embedItems(items: RawItem[]): Promise<EmbedResult> {
  if (items.length === 0) {
    return { embeddings: [], source: 'tfidf' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const texts = items.map((i) => `${i.title}. ${i.description || ''}`.trim());

  // Check if all items are already cached
  const resultVectors: (number[] | null)[] = items.map((item) => embeddingCache.get(item.id) || null);
  const uncachedIndices: number[] = [];
  resultVectors.forEach((vec, idx) => {
    if (!vec) uncachedIndices.push(idx);
  });

  if (uncachedIndices.length === 0) {
    return {
      embeddings: resultVectors as number[][],
      source: 'gemini',
    };
  }

  // If Gemini API key is available, attempt batch embedding in chunks of 100
  if (apiKey) {
    try {
      const uncachedTexts = uncachedIndices.map((i) => texts[i]);
      const chunkSize = 100;
      let allGeminiVectors: number[][] = [];
      let geminiSuccess = true;

      for (let i = 0; i < uncachedTexts.length; i += chunkSize) {
        const chunk = uncachedTexts.slice(i, i + chunkSize);
        const batchVectors = await embedBatchWithGemini(chunk, apiKey);
        if (!batchVectors || batchVectors.length !== chunk.length) {
          geminiSuccess = false;
          break;
        }
        allGeminiVectors.push(...batchVectors);
      }

      if (geminiSuccess) {
        uncachedIndices.forEach((itemIdx, idxInBatch) => {
          const vec = allGeminiVectors[idxInBatch];
          embeddingCache.set(items[itemIdx].id, vec);
          resultVectors[itemIdx] = vec;
        });

        return {
          embeddings: resultVectors as number[][],
          source: 'gemini',
        };
      }
    } catch (err) {
      logger.warn('Gemini embeddings failed, falling back to TF-IDF', err);
    }
  }

  // Fallback to TF-IDF
  logger.info('Using TF-IDF vectorizer fallback for embeddings');
  const tfidf = new TfIdfVectorizer(EMBEDDING_DIM);
  tfidf.fit(texts);

  const tfidfVectors = texts.map((t, idx) => {
    const vec = tfidf.transform(t);
    embeddingCache.set(items[idx].id, vec);
    return vec;
  });

  return {
    embeddings: tfidfVectors,
    source: 'tfidf',
  };
}

/**
 * Embed a single text query or prototype description using Gemini (or fallback TF-IDF model).
 */
export async function embedSingleText(
  text: string,
  fallbackVectorizer?: TfIdfVectorizer
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const res = await embedBatchWithGemini([text], apiKey);
    if (res && res[0]) {
      return res[0];
    }
  }

  if (fallbackVectorizer) {
    return fallbackVectorizer.transform(text);
  }

  const quickTfidf = new TfIdfVectorizer(EMBEDDING_DIM);
  quickTfidf.fit([text]);
  return quickTfidf.transform(text);
}

