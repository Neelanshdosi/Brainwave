import { describe, it, expect } from 'vitest';
import {
  hashString,
  getDeterministicNeuronPosition,
  inBrain,
  distance3,
} from '../lib/neuronPosition';
import { categorizeByKeywords } from '../lib/server/categorize';
import { LRUCache } from '../lib/server/cache';
import { RateLimiter } from '../lib/server/rateLimit';

describe('Phase 2: Deterministic Neuron Positions', () => {
  it('generates the exact same position for the same topic id', () => {
    const id = 'article-xyz-123';
    const pos1 = getDeterministicNeuronPosition(id);
    const pos2 = getDeterministicNeuronPosition(id);

    expect(pos1[0]).toBeCloseTo(pos2[0], 5);
    expect(pos1[1]).toBeCloseTo(pos2[1], 5);
    expect(pos1[2]).toBeCloseTo(pos2[2], 5);
  });

  it('keeps generated points strictly inside the brain volume', () => {
    const testIds = ['topic-1', 'topic-2', 'topic-apple', 'topic-space', 'tech-crypto-99'];
    for (const id of testIds) {
      const pos = getDeterministicNeuronPosition(id);
      expect(inBrain(pos)).toBe(true);
    }
  });

  it('produces different positions for different topic ids', () => {
    const posA = getDeterministicNeuronPosition('topic-alpha');
    const posB = getDeterministicNeuronPosition('topic-beta');
    const dist = distance3(posA, posB);
    expect(dist).toBeGreaterThan(0.01);
  });
});

describe('Phase 2: Word-Boundary Keyword Categorization', () => {
  it('does NOT categorize words like "said" or "train" as tech', () => {
    const result1 = categorizeByKeywords('He said that it was raining', 'The morning train was delayed');
    expect(result1).not.toBe('tech');
  });

  it('correctly categorizes standalone "AI" or tech keywords as tech', () => {
    const result = categorizeByKeywords('New AI model released by research lab', 'Software engineer builds app');
    expect(result).toBe('tech');
  });

  it('categorizes sports, politics, and science correctly', () => {
    expect(categorizeByKeywords('Championship football match ends in draw')).toBe('sports');
    expect(categorizeByKeywords('Presidential election results announced by parliament')).toBe('politics');
    expect(categorizeByKeywords('NASA discovers new planet in deep space')).toBe('science');
  });

  it('assigns every event to one of the 6 real categories with no "other", even for gibberish or empty titles', () => {
    const validCategories = ['tech', 'sports', 'politics', 'business', 'science', 'entertainment'];

    // Empty title & description
    const emptyResult = categorizeByKeywords('', '');
    expect(validCategories).toContain(emptyResult);
    expect(emptyResult).toBe('politics'); // default world news fallback

    // Random gibberish
    const gibberishResult = categorizeByKeywords('asdfghjkl qwertyuiop zxcvbnm', '1234567890 !@#$%^&*()');
    expect(validCategories).toContain(gibberishResult);
    expect(gibberishResult).toBe('politics');

    // Business keywords
    const businessResult = categorizeByKeywords('Federal Reserve raises interest rates to combat inflation', 'Wall Street stock market reacts');
    expect(validCategories).toContain(businessResult);
    expect(businessResult).toBe('business');

    // Entertainment keywords
    const entResult = categorizeByKeywords('New blockbuster movie premieres in Hollywood cinema', 'Pop star releases album on streaming');
    expect(validCategories).toContain(entResult);
    expect(entResult).toBe('entertainment');
  });
});

describe('Phase 2: In-Memory LRU Cache', () => {
  it('stores and retrieves cached values and respects capacity', () => {
    const cache = new LRUCache<string>(2, 10000);
    cache.set('k1', 'val1');
    cache.set('k2', 'val2');
    expect(cache.get('k1')).toBe('val1');

    // Inserting k3 should evict k2 (since k1 was accessed most recently)
    cache.set('k3', 'val3');
    expect(cache.get('k1')).toBe('val1');
    expect(cache.get('k2')).toBeUndefined();
    expect(cache.get('k3')).toBe('val3');
  });

  it('expires entries after TTL', () => {
    const cache = new LRUCache<string>(10, -100); // already expired TTL
    cache.set('key', 'expired_val');
    expect(cache.get('key')).toBeUndefined();
  });
});

describe('Phase 2: Rate Limiter', () => {
  it('allows requests up to max and blocks thereafter', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.check('ip1').allowed).toBe(true);
    expect(limiter.check('ip1').allowed).toBe(true);
    expect(limiter.check('ip1').allowed).toBe(true);

    const blocked = limiter.check('ip1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Another IP is unaffected
    expect(limiter.check('ip2').allowed).toBe(true);
  });
});

