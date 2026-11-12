export type CategoryType = 'tech' | 'politics' | 'entertainment' | 'science' | 'sports' | 'other';

export const CATEGORY_KEYWORDS: Record<Exclude<CategoryType, 'other'>, string[]> = {
  tech: [
    'ai', 'artificial intelligence', 'tech', 'technology', 'software', 'hardware',
    'computer', 'programming', 'app', 'startup', 'google', 'apple', 'microsoft',
    'meta', 'amazon', 'openai', 'chatgpt', 'crypto', 'blockchain', 'bitcoin',
    'phone', 'iphone', 'android', 'tesla', 'spacex', 'drone', 'robot'
  ],
  science: [
    'science', 'research', 'study', 'discovery', 'space', 'nasa', 'astronomy',
    'physics', 'chemistry', 'biology', 'medicine', 'health', 'disease', 'vaccine',
    'climate', 'environment', 'ocean', 'mars', 'planet', 'dna', 'gene'
  ],
  politics: [
    'politics', 'government', 'president', 'election', 'vote', 'congress',
    'senate', 'law', 'court', 'minister', 'parliament', 'war', 'military',
    'legislation', 'democracy', 'diplomacy'
  ],
  entertainment: [
    'movie', 'film', 'actor', 'hollywood', 'netflix', 'disney', 'music', 'song',
    'album', 'concert', 'celebrity', 'marvel', 'gaming', 'youtube', 'viral'
  ],
  sports: [
    'sport', 'game', 'match', 'player', 'team', 'championship', 'league',
    'nfl', 'nba', 'soccer', 'football', 'cricket', 'tennis', 'olympics'
  ],
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precompile regexes with word boundaries
const COMPILED_KEYWORDS: Record<Exclude<CategoryType, 'other'>, RegExp[]> = Object.entries(
  CATEGORY_KEYWORDS
).reduce((acc, [category, keywords]) => {
  acc[category as Exclude<CategoryType, 'other'>] = keywords.map(
    (kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i')
  );
  return acc;
}, {} as Record<Exclude<CategoryType, 'other'>, RegExp[]>);

/**
 * Categorize an article title & description using word-boundary matching.
 * Fixes false positives such as "said" or "train" matching "ai".
 */
export function categorizeByKeywords(title: string, description: string = ''): CategoryType {
  const text = `${title} ${description}`;
  const scores: Record<Exclude<CategoryType, 'other'>, number> = {
    tech: 0,
    science: 0,
    politics: 0,
    entertainment: 0,
    sports: 0,
  };

  (Object.keys(COMPILED_KEYWORDS) as Array<Exclude<CategoryType, 'other'>>).forEach((cat) => {
    COMPILED_KEYWORDS[cat].forEach((regex) => {
      if (regex.test(text)) {
        scores[cat] += 1;
      }
    });
  });

  let topCategory: CategoryType = 'other';
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCategory = cat as CategoryType;
    }
  }

  return maxScore > 0 ? topCategory : 'other';
}
