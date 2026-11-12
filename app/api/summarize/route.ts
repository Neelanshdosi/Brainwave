import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from '@/lib/server/cache';
import { RateLimiter, getClientIp } from '@/lib/server/rateLimit';
import { logger } from '@/lib/server/logger';

interface SummarizeRequest {
  url?: string;
  title: string;
  description?: string;
}

// 30 min TTL LRU Cache
const summarizeCache = new LRUCache<string>(300, 30 * 60 * 1000);
// 10 requests per minute per IP
const summarizeLimiter = new RateLimiter(10, 60 * 1000);

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

async function generateSummary(content: string): Promise<string> {
  if (!HUGGINGFACE_API_KEY) {
    return content.length > 200 ? content.substring(0, 200) + '...' : content;
  }

  if (content.length < 100) {
    return content;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: content,
        parameters: {
          max_length: 130,
          min_length: 40,
          do_sample: false,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`HuggingFace API returned status ${response.status}`);
      return content.length > 200 ? content.substring(0, 200) + '...' : content;
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.summary_text) {
      return data[0].summary_text;
    } else if (data?.summary_text) {
      return data.summary_text;
    }
    
    return content.length > 200 ? content.substring(0, 200) + '...' : content;
  } catch (err) {
    logger.warn('Failed to call summarization service', err);
    return content.length > 200 ? content.substring(0, 200) + '...' : content;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Per-IP Rate Limiting (10 req/min)
    const ip = getClientIp(request);
    const rateLimit = summarizeLimiter.check(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // 2. Input Validation
    let body: SummarizeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, title, description } = body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const cacheKey = (url && url.trim().length > 0 ? url.trim() : title.trim()).toLowerCase();

    // 3. In-memory LRU Cache Check (30 min TTL)
    const cachedSummary = summarizeCache.get(cacheKey);
    if (cachedSummary) {
      return NextResponse.json({
        summary: cachedSummary,
        cached: true,
        success: true,
      });
    }

    // 4. Summarization logic
    const content = (description || title).trim();
    const summary = await generateSummary(content);

    // 5. Store in cache
    summarizeCache.set(cacheKey, summary);

    return NextResponse.json({
      summary,
      cached: false,
      success: true,
    });
  } catch (error) {
    logger.error('Unhandled error in summarize API', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
