import { NextResponse } from 'next/server';

interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  pubDate: string;
  image_url: string | null;
  source_id: string;
  source_name?: string;
  category: string[];
  country: string[];
}

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
}

const CATEGORY_KEYWORDS = {
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
    'senate', 'law', 'court', 'minister', 'parliament', 'war', 'military'
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

const categorizeArticle = (title: string, description: string): 'tech' | 'politics' | 'entertainment' | 'science' | 'sports' | 'other' => {
  const text = `${title} ${description}`.toLowerCase();
  const scores: Record<string, number> = {
    tech: 0,
    science: 0,
    politics: 0,
    entertainment: 0,
    sports: 0,
  };

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        scores[category] += 1;
      }
    });
  });

  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) return 'other';

  const topCategory = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
  return (topCategory as any) || 'other';
};

const extractKeyTopic = (title: string): string => {
  let cleaned = title
    .replace(/\s*-\s*[^-]+$/, '') // Remove " - Source Name" at end if present
    .trim();
  
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }
  
  return cleaned;
};

const parsePubDate = (pubDate: string): string => {
  if (!pubDate) return new Date().toISOString();
  try {
    const formatted = pubDate.includes('T') ? pubDate : pubDate.replace(' ', 'T') + 'Z';
    const date = new Date(formatted);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export async function GET(request: Request) {
  try {
    const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
    
    if (!NEWSDATA_API_KEY) {
      throw new Error('NewsData.io API key not configured (NEWSDATA_API_KEY)');
    }

    const tryFetch = async (urls: string[]): Promise<NewsDataResponse | null> => {
      for (const attemptUrl of urls) {
        try {
          const res = await fetch(attemptUrl, { cache: 'no-store' });
          if (!res.ok) {
            continue;
          }
          const json: NewsDataResponse = await res.json();
          if (json?.results && json.results.length > 0) {
            return json;
          }
        } catch {
          // Ignore individual attempt failure and proceed to next URL
        }
      }
      return null;
    };

    const attempts: string[] = [
      `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_API_KEY}&language=en&category=top`,
      `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_API_KEY}&language=en`,
    ];

    const data = await tryFetch(attempts);
    if (!data) {
      throw new Error('Failed to fetch headlines from NewsData.io after multiple attempts');
    }
    
    const topics = data.results
      .filter(article => {
        if (!article.title) return false;
        if (article.description === null && article.title.length < 10) return false;
        return true;
      })
      .slice(0, 40)
      .map(article => {
        const isoTimestamp = parsePubDate(article.pubDate);
        const publishedTime = new Date(isoTimestamp).getTime();
        const now = Date.now();
        const hoursSince = Math.max(0, (now - publishedTime) / (1000 * 60 * 60));
        const intensity = Math.max(0.3, Math.min(1, 1 - (hoursSince / 24)));
        
        return {
          id: article.article_id,
          name: extractKeyTopic(article.title),
          category: categorizeArticle(article.title, article.description || ''),
          intensity: intensity,
          summary: article.description || article.title,
          source: article.source_name || article.source_id || 'Unknown Source',
          timestamp: isoTimestamp,
          url: article.link,
        };
      });

    return NextResponse.json(
      { topics, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
    
  } catch (error) {
    console.error('Error in trends API:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch trending topics',
      },
      { status: 500 }
    );
  }
}