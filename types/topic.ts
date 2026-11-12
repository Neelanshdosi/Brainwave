import { RawItem } from '@/lib/server/sources/types';
import { TrendScore } from '@/lib/server/trend';

export type Category = 'tech' | 'sports' | 'politics' | 'business' | 'science' | 'entertainment';

export interface Topic {
  id: string;
  name: string;
  title?: string;
  category: Category;
  intensity: number; // 0-1 scale (from trend.finalScore)
  trend?: TrendScore;
  summary: string;
  aiSummary?: string;
  source: string;
  timestamp: Date | string;
  position: [number, number, number];
  url?: string;
  articles?: RawItem[];
  similarEventIds?: string[];
}

export interface SimilarityEdgeData {
  fromId: string;
  toId: string;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
  similarity: number;
}

export interface NeuronData {
  position: [number, number, number];
  topic: Topic | null;
}
