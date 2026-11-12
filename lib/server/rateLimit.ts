interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private records: Map<string, RateLimitRecord>;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60 * 1000) {
    this.records = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || now > record.resetAt) {
      this.records.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        retryAfterSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  reset(): void {
    this.records.clear();
  }
}

export class DailyGlobalCap {
  private count: number = 0;
  private resetAt: number = 0;
  private maxDaily: number;

  constructor(maxDaily: number = 200) {
    this.maxDaily = maxDaily;
    this.resetWindow();
  }

  private resetWindow() {
    const now = new Date();
    // Reset at midnight UTC
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    this.resetAt = nextMidnight.getTime();
    this.count = 0;
  }

  check(): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    if (now > this.resetAt) {
      this.resetWindow();
    }

    if (this.count >= this.maxDaily) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((this.resetAt - now) / 1000)),
      };
    }

    this.count += 1;
    return {
      allowed: true,
      remaining: this.maxDaily - this.count,
      retryAfterSeconds: Math.ceil((this.resetAt - now) / 1000),
    };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

