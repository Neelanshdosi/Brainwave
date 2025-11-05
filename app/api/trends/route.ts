import { NextResponse } from 'next/server';

interface NewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
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
    .replace(/\s*-\s*[^-]+$/, '') // Remove " - Source Name" at end
    .trim();
  
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }
  
  return cleaned;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Region parameter ignored; always use global headlines
    
    const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
    
    if (!NEWSAPI_KEY) {
      throw new Error('NewsAPI key not configured');
    }

    console.log('📰 Fetching global news');

    // Country-based selection removed; global only

    // Helper to try multiple URLs in order
    const tryFetch = async (urls: string[]): Promise<NewsAPIResponse | null> => {
      for (const attemptUrl of urls) {
        try {
          console.log('📡 Fetching from NewsAPI URL:', attemptUrl.replace(NEWSAPI_KEY, '***'));
          const res = await fetch(attemptUrl, { cache: 'no-store' });
          if (!res.ok) {
            const err = await res.json().catch(() => ({} as any));
            console.warn('⚠️ Attempt failed:', res.status, err?.message);
            continue;
          }
          const json: NewsAPIResponse = await res.json();
          if (json?.articles && json.articles.length > 0) {
            return json;
          }
          console.warn('⚠️ Attempt returned 0 articles');
        } catch (e) {
          console.warn('⚠️ Attempt error:', e);
        }
      }
      return null;
    };

    // Build ordered attempts
    const attempts: string[] = [
      `https://newsapi.org/v2/top-headlines?category=general&language=en&pageSize=40&apiKey=${NEWSAPI_KEY}`,
    ];

    const data = await tryFetch(attempts);
    if (!data) {
      throw new Error('Failed to fetch headlines after multiple attempts');
    }
    console.log('✅ Received articles:', data.articles.length);
    
    // Process articles into topics
    const topics = data.articles
      .filter(article => article.title && article.title !== '[Removed]')
      .slice(0, 40)
      .map((article, index) => {
        // Calculate intensity based on recency (newer = higher intensity)
        const publishedTime = new Date(article.publishedAt).getTime();
        const now = Date.now();
        const hoursSince = (now - publishedTime) / (1000 * 60 * 60);
        const intensity = Math.max(0.3, Math.min(1, 1 - (hoursSince / 24)));
        
        return {
          id: `news-${index}`,
          name: extractKeyTopic(article.title),
          category: categorizeArticle(article.title, article.description || ''),
          intensity: intensity,
          summary: article.description || article.title,
          source: article.source.name,
          timestamp: article.publishedAt,
          url: article.url,
          redditData: {
            score: Math.floor(intensity * 10000),
            comments: Math.floor(Math.random() * 500),
          },
        };
      });

    console.log('✅ Processed topics:', topics.length);

    return NextResponse.json(
      { topics, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
    
  } catch (error) {
    console.error('❌ Error in trends API:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch trending topics',
      },
      { status: 500 }
    );
  }
}