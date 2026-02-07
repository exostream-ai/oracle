/**
 * Exostream API - Cloudflare Workers Entry Point
 *
 * Slim orchestrator that imports modular routes, middleware, and state.
 * All business logic lives in extracted modules.
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Env } from './worker-types.js';

// Importing worker-state triggers initializeOracleState() at module scope (cold start)
import './worker-state.js';

// Middleware
import { workerCors } from './worker-middleware/cors.js';
import { rateLimitMiddleware } from './worker-middleware/rate-limit.js';
import { apiKeyMiddleware } from './worker-middleware/api-key.js';

// Routes
import health from './worker-routes/health.js';
import spots from './worker-routes/spots.js';
import greeks from './worker-routes/greeks.js';
import forwards from './worker-routes/forwards.js';
import price from './worker-routes/price.js';
import compare from './worker-routes/compare.js';
import history from './worker-routes/history.js';
import keys from './worker-routes/keys.js';

// Scrapers
import { runAllScrapers } from './worker-scrapers.js';

// Create app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', workerCors);

// Rate limiting and API key tracking for /v1/* routes
app.use('/v1/*', rateLimitMiddleware);
app.use('/v1/*', apiKeyMiddleware);

// Mount routes
app.route('', health);        // handles / and /health
app.route('/v1/spots', spots);
app.route('/v1/greeks', greeks);
app.route('/v1/forwards', forwards);
app.route('/v1/price', price);
app.route('/v1/compare', compare);
app.route('/v1/history', history);
app.route('/v1/keys', keys);

// 404 handler (MUST be after all routes)
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Scheduled handler for cron triggers
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const startTime = Date.now();
  console.log(`[Cron] Scheduled scraper run triggered at ${new Date().toISOString()}`);

  try {
    const results = await runAllScrapers();

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    console.log(`[Cron] Scraper run complete: ${successful} succeeded, ${failed} failed, ${skipped} skipped`);

    for (const result of results) {
      if (result.status === 'success') {
        console.log(`[Cron] ${result.provider}: extracted ${result.modelsExtracted} models`);
      } else if (result.status === 'skipped') {
        console.log(`[Cron] ${result.provider}: ${result.error}`);
      } else {
        console.log(`[Cron] ${result.provider}: ERROR - ${result.error}`);
      }
    }
  } catch (error) {
    console.error(`[Cron] Fatal error in scheduled run:`, error);
  }

  const duration = Date.now() - startTime;
  console.log(`[Cron] Total duration: ${duration}ms`);
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
};
