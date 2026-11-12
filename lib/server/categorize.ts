export type CategoryType =
  | 'tech'
  | 'sports'
  | 'politics'
  | 'business'
  | 'science'
  | 'entertainment';

export const CATEGORY_KEYWORDS: Record<CategoryType, string[]> = {
  tech: [
    'ai', 'artificial intelligence', 'tech', 'technology', 'software', 'hardware',
    'computer', 'programming', 'app', 'startup', 'google', 'apple', 'microsoft',
    'meta', 'amazon', 'openai', 'chatgpt', 'crypto', 'blockchain', 'bitcoin',
    'phone', 'iphone', 'android', 'tesla', 'spacex', 'drone', 'robot', 'semiconductor',
    'cybersecurity', 'cloud', 'algorithm', 'developer', 'coding', 'gpu', 'microchip'
  ],
  sports: [
    'sport', 'sports', 'game', 'match', 'player', 'team', 'championship', 'league',
    'nfl', 'nba', 'soccer', 'football', 'cricket', 'tennis', 'olympics', 'athlete',
    'tournament', 'coach', 'world cup', 'premier league', 'super bowl', 'grand slam',
    'formula 1', 'f1', 'athletics', 'racing', 'baseball', 'basketball'
  ],
  politics: [
    'politics', 'government', 'president', 'election', 'vote', 'voting', 'congress',
    'senate', 'law', 'court', 'minister', 'parliament', 'war', 'military',
    'legislation', 'democracy', 'diplomacy', 'treaty', 'sanctions', 'geopolitics',
    'prime minister', 'state', 'policy', 'white house', 'kremlin', 'supreme court',
    'justice', 'civil rights', 'nato', 'united nations', 'defense'
  ],
  business: [
    'business', 'economy', 'economic', 'market', 'stock', 'stocks', 'nasdaq', 'dow',
    'investor', 'inflation', 'bank', 'banking', 'interest rate', 'fed', 'federal reserve',
    'revenue', 'profit', 'quarterly', 'earnings', 'ipo', 'startup', 'funding', 'trade',
    'commerce', 'tariff', 'jobs', 'labor', 'employment', 'merger', 'acquisition',
    'wall street', 'finance', 'shares', 'gdp', 'recession'
  ],
  science: [
    'science', 'scientific', 'research', 'study', 'discovery', 'space', 'nasa', 'astronomy',
    'physics', 'chemistry', 'biology', 'medicine', 'health', 'disease', 'vaccine',
    'climate', 'environment', 'ocean', 'mars', 'planet', 'dna', 'gene', 'medical',
    'clinical', 'hospital', 'patient', 'doctor', 'treatment', 'cancer', 'epidemiology',
    'astrophysics', 'ecology', 'biodiversity', 'quantum'
  ],
  entertainment: [
    'movie', 'film', 'actor', 'actress', 'hollywood', 'netflix', 'disney', 'music', 'song',
    'album', 'concert', 'celebrity', 'marvel', 'gaming', 'video game', 'youtube', 'viral',
    'series', 'cinema', 'tv', 'television', 'grammy', 'oscar', 'box office', 'streaming',
    'culture', 'art', 'theatre', 'broadway', 'festival'
  ],
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precompile regexes with word boundaries
const COMPILED_KEYWORDS: Record<CategoryType, RegExp[]> = Object.entries(
  CATEGORY_KEYWORDS
).reduce((acc, [category, keywords]) => {
  acc[category as CategoryType] = keywords.map(
    (kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i')
  );
  return acc;
}, {} as Record<CategoryType, RegExp[]>);

/**
 * Categorize an article title & description using word-boundary matching and argmax.
 * Every event is assigned to exactly one of the six real categories.
 * If every keyword score is zero, defaults to "politics" (world news).
 */
export function categorizeByKeywords(title: string, description: string = ''): CategoryType {
  const text = `${title} ${description}`.trim();
  const scores: Record<CategoryType, number> = {
    tech: 0,
    sports: 0,
    politics: 0,
    business: 0,
    science: 0,
    entertainment: 0,
  };

  (Object.keys(COMPILED_KEYWORDS) as CategoryType[]).forEach((cat) => {
    COMPILED_KEYWORDS[cat].forEach((regex) => {
      if (regex.test(text)) {
        scores[cat] += 1;
      }
    });
  });

  let topCategory: CategoryType = 'politics';
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCategory = cat as CategoryType;
    }
  }

  return topCategory;
}
