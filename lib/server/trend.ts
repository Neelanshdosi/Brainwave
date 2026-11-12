import { RawItem } from './sources/types';

export type TrendLabel = 'emerging' | 'rising' | 'steady' | 'fading' | 'unrated';
export type VelocityValue = number | 'unrated';

export interface TrendScore {
  finalScore: number; // 0 to 1
  label: TrendLabel;
  velocity: VelocityValue;
  diversity: number; // 0 to 1
  engagement: number; // 0 to 1
  sourceCount: number;
  itemCount: number;
  isUnrated?: boolean;
}

export const TREND_WEIGHTS = {
  velocity: 0.45,
  diversity: 0.35,
  engagement: 0.20,
};

export interface TimeWindow {
  start: number;
  end: number;
}

export const MAX_ITEM_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Computes velocity: proportion of items in the newest third of the time window
 * vs the oldest third of the time window.
 * Returns a value in [0, 1].
 */
export function computeVelocity(
  items: RawItem[],
  window?: TimeWindow
): number {
  if (!items || items.length === 0) return 0;
  if (items.length === 1 && !window) return 0.5;

  const timestamps = items.map((i) => new Date(i.publishedAt).getTime()).filter((t) => !isNaN(t));
  if (timestamps.length === 0) return 0.5;

  const start = window ? window.start : Math.min(...timestamps);
  const end = window ? window.end : Math.max(...timestamps);
  const duration = end - start;

  if (duration <= 0) return 0.5;

  const t1 = start + duration / 3;
  const t2 = start + (2 * duration) / 3;

  let countNew = 0;
  let countOld = 0;

  for (const t of timestamps) {
    if (t > t2) {
      countNew++;
    } else if (t < t1) {
      countOld++;
    }
  }

  // Normalized to [0, 1]: 0.5 is neutral balance, 1.0 is all new, 0.0 is all old
  const diff = (countNew - countOld) / items.length;
  const velocity = Math.max(0, Math.min(1, 0.5 + 0.5 * diff));
  return Number(velocity.toFixed(4));
}

/**
 * Computes source diversity score in [0, 1] based on distinct sources.
 */
export function computeSourceDiversity(items: RawItem[]): { diversity: number; count: number } {
  if (!items || items.length === 0) return { diversity: 0, count: 0 };

  const sources = new Set(
    items
      .map((i) => (i.source || '').toLowerCase().trim())
      .filter((s) => s.length > 0)
  );

  const count = sources.size;
  if (count <= 1) return { diversity: 0, count };

  // 1 source -> 0.0, 2 sources -> 0.4, 3 sources -> 0.7, 4+ sources -> 1.0
  const diversity = Math.min(1, (count - 1) / 3);
  return { diversity: Number(diversity.toFixed(4)), count };
}

/**
 * Computes engagement score in [0, 1] using log scaling on HN points & comments.
 */
export function computeEngagement(items: RawItem[]): number {
  if (!items || items.length === 0) return 0;

  const totalEngagement = items.reduce((sum, item) => sum + (item.engagement || 0), 0);
  if (totalEngagement <= 0) return 0;

  // Log scale: 0 engagement -> 0; ~100 -> 0.67; >= 1000 -> 1.0
  const maxBenchmark = 1000;
  const score = Math.min(1, Math.log10(1 + totalEngagement) / Math.log10(1 + maxBenchmark));
  return Number(score.toFixed(4));
}

/**
 * Pure function: Scores a group of items and produces a 0-1 trend score and label.
 *
 * Rules:
 * 1. Max age filter: 24 hours for all sources.
 * 2. Velocity must be "unrated" when an event has fewer than 3 items OR fewer than 2 distinct sources.
 * 3. The "emerging" label strictly requires at least 2 distinct sources AND newest item under 6 hours old.
 */
export function scoreTrend(
  items: RawItem[],
  window?: TimeWindow
): TrendScore {
  const currentTime = window ? window.end : Date.now();

  // 1. Max age filter of 24 hours
  const validItems = (items || []).filter((item) => {
    const t = new Date(item.publishedAt).getTime();
    return !isNaN(t) && (currentTime - t) <= MAX_ITEM_AGE_MS;
  });

  if (validItems.length === 0) {
    return {
      finalScore: 0,
      label: 'unrated',
      velocity: 'unrated',
      diversity: 0,
      engagement: 0,
      sourceCount: 0,
      itemCount: 0,
      isUnrated: true,
    };
  }

  const { diversity, count: sourceCount } = computeSourceDiversity(validItems);
  const engagement = computeEngagement(validItems);

  // 2. Velocity must be "unrated" when an event has fewer than 3 items OR fewer than 2 distinct sources
  const isUnrated = validItems.length < 3 || sourceCount < 2;

  if (isUnrated) {
    return {
      finalScore: 0,
      label: 'unrated',
      velocity: 'unrated',
      diversity,
      engagement,
      sourceCount,
      itemCount: validItems.length,
      isUnrated: true,
    };
  }

  // Rated velocity (>= 3 items and >= 2 distinct sources)
  const numericVelocity = computeVelocity(validItems, window);

  const rawScore =
    numericVelocity * TREND_WEIGHTS.velocity +
    diversity * TREND_WEIGHTS.diversity +
    engagement * TREND_WEIGHTS.engagement;

  const finalScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(4));

  // 3. "emerging" requires at least 2 distinct sources AND newest item under 6 hours old
  const timestamps = validItems.map((i) => new Date(i.publishedAt).getTime());
  const newestTime = Math.max(...timestamps);
  const newestAgeMs = currentTime - newestTime;
  const isNewestUnder6h = newestAgeMs < 6 * 3600 * 1000;

  let label: TrendLabel;
  if (numericVelocity >= 0.75 && validItems.length <= 6 && sourceCount >= 2 && isNewestUnder6h) {
    label = 'emerging';
  } else if (finalScore >= 0.58 || (numericVelocity >= 0.6 && diversity >= 0.33)) {
    label = 'rising';
  } else if (finalScore >= 0.32 && numericVelocity >= 0.25) {
    label = 'steady';
  } else {
    label = 'fading';
  }

  return {
    finalScore,
    label,
    velocity: numericVelocity,
    diversity,
    engagement,
    sourceCount,
    itemCount: validItems.length,
    isUnrated: false,
  };
}
