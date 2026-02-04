/**
 * Rate limiting middleware
 *
 * - Unauthenticated: 60 requests/hour per IP
 * - API key (free tier): 100 requests/hour per key
 */

import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipLimits = new Map<string, RateLimitEntry>();
const keyLimits = new Map<string, RateLimitEntry>();

const HOUR_MS = 60 * 60 * 1000;
const UNAUTHENTICATED_LIMIT = parseInt(process.env.RATE_LIMIT_UNAUTHENTICATED ?? '60', 10);
const FREE_KEY_LIMIT = parseInt(process.env.RATE_LIMIT_FREE_KEY ?? '100', 10);

function getOrCreateEntry(map: Map<string, RateLimitEntry>, key: string, limit: number): RateLimitEntry {
  const now = Date.now();
  let entry = map.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + HOUR_MS };
    map.set(key, entry);
  }

  return entry;
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key');

  if (apiKey) {
    // API key rate limiting
    const entry = getOrCreateEntry(keyLimits, apiKey, FREE_KEY_LIMIT);
    entry.count++;

    c.header('X-RateLimit-Limit', String(FREE_KEY_LIMIT));
    c.header('X-RateLimit-Remaining', String(Math.max(0, FREE_KEY_LIMIT - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.floor(entry.resetAt / 1000)));

    if (entry.count > FREE_KEY_LIMIT) {
      return c.json({
        error: 'Rate limit exceeded',
        limit: FREE_KEY_LIMIT,
        resetAt: new Date(entry.resetAt).toISOString(),
      }, 429);
    }
  } else {
    // IP-based rate limiting
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? c.req.header('CF-Connecting-IP')
      ?? 'unknown';

    const entry = getOrCreateEntry(ipLimits, ip, UNAUTHENTICATED_LIMIT);
    entry.count++;

    c.header('X-RateLimit-Limit', String(UNAUTHENTICATED_LIMIT));
    c.header('X-RateLimit-Remaining', String(Math.max(0, UNAUTHENTICATED_LIMIT - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.floor(entry.resetAt / 1000)));

    if (entry.count > UNAUTHENTICATED_LIMIT) {
      return c.json({
        error: 'Rate limit exceeded',
        limit: UNAUTHENTICATED_LIMIT,
        resetAt: new Date(entry.resetAt).toISOString(),
      }, 429);
    }
  }

  await next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipLimits) {
    if (now >= entry.resetAt) ipLimits.delete(key);
  }
  for (const [key, entry] of keyLimits) {
    if (now >= entry.resetAt) keyLimits.delete(key);
  }
}, HOUR_MS);
