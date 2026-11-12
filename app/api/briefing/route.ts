import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from '@/lib/server/cache';
import { RateLimiter, DailyGlobalCap, getClientIp } from '@/lib/server/rateLimit';
import { logger } from '@/lib/server/logger';
import { generateEventBriefing } from '@/lib/server/briefingAgent';
import { BriefingData } from '@/lib/server/verifyCitations';
import { Event } from '@/lib/server/cluster';

export const dynamic = 'force-dynamic';

// 30 minute cache per eventId
const briefingCache = new LRUCache<BriefingData>(100, 30 * 60 * 1000);

// Per-IP rate limiter (10 requests/min)
const briefingIpLimiter = new RateLimiter(10, 60 * 1000);

// Global daily cap via env var AI_DAILY_CAP (default: 200)
const dailyCapLimit = parseInt(process.env.AI_DAILY_CAP || '200', 10);
const briefingDailyCap = new DailyGlobalCap(dailyCapLimit);

export async function POST(request: NextRequest) {
  try {
    // 1. Per-IP rate limiting
    const ip = getClientIp(request);
    const ipCheck = briefingIpLimiter.check(ip);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipCheck.retryAfterSeconds) },
        }
      );
    }

    // 2. Global daily cap
    const capCheck = briefingDailyCap.check();
    if (!capCheck.allowed) {
      return NextResponse.json(
        { error: 'Daily briefing generation quota reached. Please try again tomorrow.' },
        {
          status: 429,
          headers: { 'Retry-After': String(capCheck.retryAfterSeconds) },
        }
      );
    }

    // 3. Validate input
    let body: { eventId?: string; event?: Event };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { eventId, event: passedEvent } = body;
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // 4. Check 30-min LRU Cache
    const cached = briefingCache.get(eventId);
    if (cached) {
      logger.info(`Returning cached briefing for event ${eventId}`);
      return NextResponse.json({ briefing: cached, cached: true });
    }

    let targetEvent: Event | null = passedEvent || null;

    // If event object wasn't passed directly in body, fetch current events from internal endpoint
    if (!targetEvent) {
      try {
        const eventsRes = await fetch(new URL('/api/events', request.url).toString(), {
          cache: 'default',
        });
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          targetEvent = data.events?.find((e: Event) => e.id === eventId) || null;
        }
      } catch (err) {
        logger.warn('Could not fetch events list to find eventId', err);
      }
    }

    if (!targetEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 5. Generate grounded briefing
    const result = await generateEventBriefing(targetEvent);

    if ('status' in result && result.status === 'unavailable') {
      return NextResponse.json({
        status: 'unavailable',
        reason: result.reason,
      });
    }

    const briefingData = result as BriefingData;

    // 6. Cache for 30 minutes
    briefingCache.set(eventId, briefingData);

    return NextResponse.json({
      status: 'success',
      briefing: briefingData,
      cached: false,
    });
  } catch (err) {
    logger.error('Unhandled error in /api/briefing', err);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}

