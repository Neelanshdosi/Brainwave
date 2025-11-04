export interface Topic {
  id: string;
  name: string;
  category: 'tech' | 'politics' | 'entertainment' | 'science' | 'sports' | 'other';
  intensity: number; // 0-1 scale
  summary: string;
  aiSummary?: string; // AI-generated summary
  source: string;
  timestamp: Date | string;
  position: [number, number, number];
  url?: string;
  redditData?: {
    score: number;
    comments: number;
  };
}

export interface NeuronData {
  position: [number, number, number];
  topic: Topic | null;
}