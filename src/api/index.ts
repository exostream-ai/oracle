/**
 * Exostream API - Hono REST API
 *
 * The pricing oracle for LLM inference.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger as honoLogger } from 'hono/logger';
import { logger } from '../core/logger.js';
import 'dotenv/config';

// Middleware
import { corsMiddleware } from './middleware/cors.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { cacheMiddleware } from './middleware/cache.js';

// Routes
import health from './routes/health.js';
import spots from './routes/spots.js';
import greeks from './routes/greeks.js';
import forwards from './routes/forwards.js';
import price from './routes/price.js';
import compare from './routes/compare.js';
import history from './routes/history.js';
import events from './routes/events.js';

// Initialize oracle state
import { refreshOracleState } from './oracle.js';

const app = new Hono();

// Global middleware
app.use('*', honoLogger());
app.use('*', corsMiddleware);
app.use('*', rateLimitMiddleware);
app.use('*', cacheMiddleware);

// Mount routes
app.route('/health', health);
app.route('/v1/spots', spots);
app.route('/v1/greeks', greeks);
app.route('/v1/forwards', forwards);
app.route('/v1/price', price);
app.route('/v1/compare', compare);
app.route('/v1/history', history);
app.route('/v1/events', events);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Exostream API',
    description: 'The pricing oracle for LLM inference',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      spots: '/v1/spots',
      greeks: '/v1/greeks',
      forwards: '/v1/forwards/:ticker',
      price: 'POST /v1/price',
      compare: 'POST /v1/compare',
      history: '/v1/history/:ticker',
      events: '/v1/events',
    },
    documentation: 'https://exostream.ai/api-docs',
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  const serverLogger = logger.child({ component: 'server' });
  serverLogger.error('API error', { error: err.message });
  return c.json({
    error: 'Internal server error',
  }, 500);
});

const port = parseInt(process.env.PORT || '8080', 10);

// Initialize and start server
async function start() {
  const serverLogger = logger.child({ component: 'server' });

  serverLogger.info('Initializing oracle state');
  await refreshOracleState();
  serverLogger.info('Oracle state loaded');

  serve({
    fetch: app.fetch,
    port,
  });

  serverLogger.info('Server started', {
    port,
    endpoints: [
      '/health',
      '/v1/spots',
      '/v1/spots/:ticker',
      '/v1/greeks',
      '/v1/greeks/:ticker',
      '/v1/forwards/:ticker',
      'POST /v1/price',
      'POST /v1/compare',
      '/v1/history/:ticker',
      '/v1/events'
    ]
  });
}

start().catch(err => {
  const serverLogger = logger.child({ component: 'server' });
  serverLogger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

export default app;
