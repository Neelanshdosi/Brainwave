import { RawItem } from './sources/types';

export type TrendLabel = 'emerging' | 'rising' | 'steady' | 'fading';

export interface TrendScore {
  finalScore: number; // 0 to 1
  label: TrendLabel;
  velocity: number; // 0 to 1
  diversity: number; // 0 to 1
  engagement: number; // 0 to 1
  sourceCount: number;
  itemCount: number;
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
 */
export function scoreTrend(
  items: RawItem[],
  window?: TimeWindow
): TrendScore {
  if (!items || items.length === 0) {
    return {
      finalScore: 0,
      label: 'fading',
      velocity: 0,
      diversity: 0,
      engagement: 0,
      sourceCount: 0,
      itemCount: 0,
    };
  }

  const velocity = computeVelocity(items, window);
  const { diversity, count: sourceCount } = computeSourceDiversity(items);
  const engagement = computeEngagement(items);

  const rawScore =
    velocity * TREND_WEIGHTS.velocity +
    diversity * TREND_WEIGHTS.diversity +
    engagement * TREND_WEIGHTS.engagement;

  const finalScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(4));

  let label: TrendLabel;
  if (velocity >= 0.75 && items.length <= 6) {
    label = 'emerging';
  } else if (finalScore >= 0.58 || (velocity >= 0.6 && diversity >= 0.33)) {
    label = 'rising';
  } else if (finalScore >= 0.32 && velocity >= 0.25) {
    label = 'steady';
  } else {
    label = 'fading';
  }

  return {
    finalScore,
    label,
    velocity,
    diversity,
    engagement,
    sourceCount,
    itemCount: items.length,
  };
}

