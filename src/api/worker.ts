/**
 * Exostream API - Cloudflare Workers Entry Point
 *
 * Slim orchestrator that imports modular routes, middleware, and state.
 * All business logic lives in extracted modules.
 */

import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { logger } from '../core/logger.js';
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

/**
 * Track consecutive scrape failures per provider in KV
 * Returns the current failure count after update
 */
async function trackScrapeFailure(
  kv: KVNamespace,
  provider: string,
  status: 'success' | 'error' | 'skipped'
): Promise<number> {
  // Skipped providers don't affect failure count
  if (status === 'skipped') return 0;

  const key = `scrape_failures:${provider}`;

  if (status === 'success') {
    await kv.delete(key);
    return 0;
  }

  // Increment failure counter
  const current = parseInt(await kv.get(key) || '0');
  const newCount = current + 1;
  await kv.put(key, String(newCount), {
    expirationTtl: 86400 // 24-hour TTL for auto-cleanup
  });

  return newCount;
}

// Create app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', honoLogger());
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
  logger.error('API error', { component: 'worker', error: err.message });
  return c.json({ error: 'Internal server error' }, 500);
});

// Scheduled handler for cron triggers
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const cronLogger = logger.child({ component: 'cron' });
  const startTime = Date.now();
  cronLogger.info('Scheduled scraper run triggered');

  try {
    const results = await runAllScrapers();

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    cronLogger.info('Scraper run complete', { successful, failed, skipped });

    for (const result of results) {
      if (result.status === 'success') {
        cronLogger.info('Scraper result', {
          provider: result.provider,
          status: result.status,
          modelsExtracted: result.modelsExtracted
        });
      } else if (result.status === 'skipped') {
        cronLogger.info('Scraper result', {
          provider: result.provider,
          status: result.status,
          error: result.error
        });
      } else {
        cronLogger.info('Scraper result', {
          provider: result.provider,
          status: result.status,
          error: result.error
        });
      }
    }

    // Track consecutive failures and emit alerts
    for (const result of results) {
      const failureCount = await trackScrapeFailure(
        env.API_KEYS,
        result.provider,
        result.status
      );

      if (failureCount >= 2) {
        cronLogger.error('Scrape failure threshold exceeded', {
          provider: result.provider,
          consecutive_failures: failureCount,
          alert: true  // Flag for external monitoring/log filtering
        });
      }
    }

    // Check oracle state staleness
    const { oracleState } = await import('./worker-state.js');
    const oracleAge = Date.now() - oracleState.lastUpdate.getTime();
    const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
    if (oracleAge > staleThresholdMs) {
      cronLogger.error('Oracle state is stale', {
        age_hours: Math.round(oracleAge / (60 * 60 * 1000)),
        last_update: oracleState.lastUpdate.toISOString(),
        alert: true
      });
    }
  } catch (error) {
    cronLogger.error('Fatal error in scheduled run', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const duration = Date.now() - startTime;
  cronLogger.info('Cron run complete', { duration_ms: duration });
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
};
