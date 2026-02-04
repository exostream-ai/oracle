/**
 * Cache control middleware
 */

import type { Context, Next } from 'hono';

export async function cacheMiddleware(c: Context, next: Next) {
  await next();

  // Add cache headers for GET requests
  if (c.req.method === 'GET') {
    // Cache for 60 seconds
    c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  }
}
