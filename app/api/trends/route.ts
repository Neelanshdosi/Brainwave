import { NextResponse } from 'next/server';

// ✅ Interfaces
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

// ✅ Keyword categories
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
    'republican', 'democrat', 'policy', 'bill', 'legislation', 'war',
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

// ✅ Subreddit → category mapping
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

// ✅ Keyword-based categorization
const categorizeByKeywords = (text: string): { category: string; confidence: number } => {
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {
    tech: 0,
    science: 0,
    politics: 0,
    entertainment: 0,
    sports: 0,
  };

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category] += 1;
      }
    });
  });

  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([_, score]) => score));
  if (maxScore === 0) return { category: 'other', confidence: 0 };

  const topCategory = entries.find(([_, score]) => score === maxScore)?.[0] || 'other';
  const confidence = maxScore / 3;
  return { category: topCategory, confidence: Math.min(confidence, 1) };
};

// ✅ Final category logic
const categorizePost = (title: string, subreddit: string, selftext?: string) => {
  const subredditCategory = SUBREDDIT_CATEGORIES[subreddit.toLowerCase()];
  if (subredditCategory) return subredditCategory as any;

  const textToAnalyze = `${title} ${selftext || ''}`.substring(0, 500);
  const { category, confidence } = categorizeByKeywords(textToAnalyze);
  return confidence > 0.3 ? category : 'other';
};

// ✅ Clean titles
const extractKeyTopic = (title: string): string => {
  let cleaned = title
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^[A-Z]+:\s*/, '')
    .trim();

  if (cleaned.length > 60) cleaned = cleaned.substring(0, 57) + '...';
  return cleaned;
};

// ✅ Main API handler
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'global';

    console.log('🌍 Fetching trends for region:', region);

    let subreddit = 'all';
    if (region === 'india') subreddit = 'india+cricket+bollywood+IndiaSpeaks';
    else if (region === 'us') subreddit = 'news+politics+nfl+nba';
    else if (region === 'uk') subreddit = 'unitedkingdom+ukpolitics+premierleague';
    else if (region === 'europe') subreddit = 'europe+soccer+formula1';

    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;
    console.log('📡 Fetching from:', url);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Brainwave/1.0' },
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`Failed to fetch from Reddit: ${response.status}`);

    const data: RedditResponse = await response.json();
    const posts = data.data.children;

    const topics = posts
      .filter(post => post.data.score > 100)
      .slice(0, 40)
      .map((post, index) => {
        const intensity = Math.min(post.data.score / (posts[0]?.data.score || 1000), 1);
        return {
          id: `reddit-${index}`,
          name: extractKeyTopic(post.data.title),
          category: categorizePost(post.data.title, post.data.subreddit, post.data.selftext),
          intensity,
          summary: `${post.data.score.toLocaleString()} upvotes • ${post.data.num_comments.toLocaleString()} comments`,
          source: `r/${post.data.subreddit}`,
          timestamp: new Date(post.data.created_utc * 1000).toISOString(),
          url: `https://reddit.com${post.data.permalink}`,
        };
      });

    return NextResponse.json({ topics, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Error in trends API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch trending topics',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
