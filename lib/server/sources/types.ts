export interface RawItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceType: 'newsdata' | 'hackernews' | 'gdelt' | 'rss';
  publishedAt: string; // ISO 8601 string
  engagement?: number; // e.g., points + comments for HN
}

