import { NextResponse } from 'next/server';

interface RedditPost {
  data: {
    title: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    url: string;
    selftext?: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

// Enhanced keyword-based categorization
const CATEGORY_KEYWORDS = {
  tech: [
    'ai', 'artificial intelligence', 'tech', 'technology', 'software', 'hardware',
    'computer', 'programming', 'code', 'app', 'startup', 'silicon valley',
    'google', 'apple', 'microsoft', 'meta', 'amazon', 'openai', 'chatgpt',
    'crypto', 'blockchain', 'bitcoin', 'ethereum', 'robot', 'automation',
    'cyber', 'data', 'cloud', 'chip', 'processor', 'gpu', 'nvidia', 'intel',
    'phone', 'iphone', 'android', 'samsung', 'tesla', 'ev', 'electric vehicle',
    'drone', 'vr', 'virtual reality', 'ar', 'augmented reality', 'quantum',
    'internet', 'web', 'online', 'digital', 'gadget', 'innovation'
  ],
  science: [
    'science', 'research', 'study', 'scientist', 'discovery', 'space',
    'nasa', 'astronomy', 'physics', 'chemistry', 'biology', 'medicine',
    'health', 'disease', 'vaccine', 'cancer', 'covid', 'virus', 'bacteria',
    'climate', 'environment', 'ocean', 'mars', 'planet', 'universe',
    'galaxy', 'star', 'telescope', 'experiment', 'lab', 'dna', 'gene',
    'brain', 'neuroscience', 'psychology', 'fossil', 'dinosaur', 'evolution'
  ],
  politics: [
    'politics', 'political', 'government', 'president', 'election', 'vote',
    'congress', 'senate', 'law', 'court', 'justice', 'trump', 'biden',
    'republican', 'democrat', 'policy', 'bill', 'legislation','china', 'war',
    'military', 'defense', 'nato', 'un', 'united nations', 'diplomat',
    'minister', 'parliament', 'prime minister', 'putin', 'xi jinping',
    'campaign', 'protest', 'rally', 'debate', 'scandal', 'investigation'
  ],
  entertainment: [
    'movie', 'film', 'actor', 'actress', 'director', 'hollywood', 'netflix',
    'disney', 'hbo', 'tv show', 'series', 'episode', 'season', 'streaming',
    'music', 'song', 'album', 'artist', 'singer', 'band', 'concert', 'tour',
    'festival', 'grammy', 'oscar', 'emmy', 'celebrity', 'star', 'fame',
    'taylor swift', 'beyonce', 'drake', 'marvel', 'dc', 'superhero',
    'anime', 'manga', 'gaming', 'gamer', 'esports', 'twitch', 'youtube',
    'viral', 'meme', 'tiktok', 'instagram', 'fashion', 'style'
  ],
  sports: [
    'sport', 'game', 'match', 'player', 'team', 'win', 'lose', 'score',
    'championship', 'league', 'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football',
    'basketball', 'baseball', 'hockey', 'cricket', 'tennis', 'golf',
    'olympics', 'world cup', 'super bowl', 'fifa', 'uefa', 'premier league',
    'champions league', 'ipl', 'messi', 'ronaldo', 'lebron', 'curry',
    'mahomes', 'quarterback', 'goal', 'touchdown', 'home run', 'knockout',
    'ufc', 'boxing', 'fighter', 'coach', 'athlete', 'medal', 'trophy'
  ],
};

// Subreddit-based categorization (backup)
const SUBREDDIT_CATEGORIES: Record<string, string> = {
  technology: 'tech',
  programming: 'tech',
  coding: 'tech',
  gadgets: 'tech',
  apple: 'tech',
  android: 'tech',
  science: 'science',
  space: 'science',
  askscience: 'science',
  futurology: 'tech',
  worldnews: 'politics',
  politics: 'politics',
  news: 'politics',
  geopolitics: 'politics',
  movies: 'entertainment',
  television: 'entertainment',
  music: 'entertainment',
  gaming: 'entertainment',
  entertainment: 'entertainment',
  sports: 'sports',
  cricket: 'sports',
  soccer: 'sports',
  nba: 'sports',
  nfl: 'sports',
  football: 'sports',
};

const categorizeByKeywords = (text: string): { category: string; confidence: number } => {
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {
    tech: 0,
    science: 0,
    politics: 0,
    entertainment: 0,
    sports: 0,
  };

  // Count keyword matches for each category
  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category] += 1;
      }
    });
  });

  // Find category with highest score
  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([_, score]) => score));
  
  if (maxScore === 0) {
    return { category: 'other', confidence: 0 };
  }

  const topCategory = entries.find(([_, score]) => score === maxScore)?.[0] || 'other';
  const confidence = maxScore / 3; // Normalize confidence (3+ matches = high confidence)

  return { category: topCategory, confidence: Math.min(confidence, 1) };
};

const categorizePost = (title: string, subreddit: string, selftext?: string): 'tech' | 'politics' | 'entertainment' | 'science' | 'sports' | 'other' => {
  // First try subreddit mapping
  const subredditCategory = SUBREDDIT_CATEGORIES[subreddit.toLowerCase()];
  if (subredditCategory) {
    return subredditCategory as any;
  }

  // Then use keyword analysis on title + selftext
  const textToAnalyze = `${title} ${selftext || ''}`.substring(0, 500); // Limit length
  const { category, confidence } = categorizeByKeywords(textToAnalyze);

  // If confidence is high enough, use keyword categorization
  if (confidence > 0.3) {
    return category as any;
  }

  return 'other';
};

const extractKeyTopic = (title: string): string => {
  // Remove common prefixes and clean up
  let cleaned = title
    .replace(/^\[.*?\]\s*/, '') // Remove [tags]
    .replace(/^[A-Z]+:\s*/, '') // Remove "NEWS:" etc
    .trim();
  
  // Truncate if too long
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }
  
  return cleaned;
};

export async function GET(request: Request) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'global';
    
    console.log('🌍 Fetching trends for region:', region);

    // Determine which subreddit to fetch based on region
    let subreddit = 'all';
    
    if (region === 'india') {
      subreddit = 'india+cricket+bollywood+IndiaSpeaks';
    } else if (region === 'us') {
      subreddit = 'news+politics+nfl+nba';
    } else if (region === 'uk') {
      subreddit = 'unitedkingdom+ukpolitics+premierleague';
    } else if (region === 'europe') {
      subreddit = 'europe+soccer+formula1';
    }
    
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Brainwave/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from Reddit');
    }

    const data: RedditResponse = await response.json();
    
    // Process and transform Reddit posts into our Topic format
    const topics = data.data.children
      .filter(post => post.data.score > 100) // Only high-engagement posts
      .slice(0, 40) // Limit to 40 neurons
      .map((post, index) => {
        const maxScore = data.data.children[0]?.data.score || 1000;
        const intensity = Math.min(post.data.score / maxScore, 1);
        
        return {
          id: `reddit-${index}`,
          name: extractKeyTopic(post.data.title),
          category: categorizePost(post.data.title, post.data.subreddit, post.data.selftext),
          intensity: intensity,
          summary: `${post.data.score.toLocaleString()} upvotes • ${post.data.num_comments.toLocaleString()} comments`,
          source: `r/${post.data.subreddit}`,
          timestamp: new Date(post.data.created_utc * 1000).toISOString(),
          url: `https://reddit.com${post.data.permalink}`,
          redditData: {
            score: post.data.score,
            comments: post.data.num_comments,
          },
        };
      });

    return NextResponse.json({ topics, updatedAt: new Date().toISOString() });
    
  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending topics' },
      { status: 500 }
    );
  }
}