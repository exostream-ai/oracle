import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState } from '../worker-state.js';
import { logger } from '../../core/logger.js';

const healthLogger = logger.child({ component: 'health-route' });
const health = new Hono<{ Bindings: Env }>();

// Health check - worker.ts lines 287-294
health.get('/health', (c) => {
  const oracleAge = Date.now() - oracleState.lastUpdate.getTime();
  const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
  const isStale = oracleAge > staleThresholdMs;

  return c.json({
    status: isStale ? 'degraded' : 'ok',
    oracle: {
      last_update: oracleState.lastUpdate.toISOString(),
      age_seconds: Math.round(oracleAge / 1000),
      stale: isStale,
      model_count: oracleState.models.size,
    },
    timestamp: new Date().toISOString(),
  });
});

// Root API info - worker.ts lines 297-319
health.get('/', (c) => {
  const oracleAge = Date.now() - oracleState.lastUpdate.getTime();
  const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
  const isStale = oracleAge > staleThresholdMs;

  return c.json({
    name: 'Exostream API',
    description: 'The pricing oracle for LLM inference',
    version: '1.0.0',
    runtime: 'Cloudflare Workers',
    status: isStale ? 'degraded' : 'ok',
    oracle: {
      last_update: oracleState.lastUpdate.toISOString(),
      age_seconds: Math.round(oracleAge / 1000),
      stale: isStale,
      model_count: oracleState.models.size,
    },
    endpoints: {
      health: '/health',
      spots: '/v1/spots',
      greeks: '/v1/greeks',
      forwards: '/v1/forwards/:ticker',
      price: 'POST /v1/price',
      compare: 'POST /v1/compare',
      history: '/v1/history/:ticker',
      keys: {
        create: 'POST /v1/keys',
        usage: 'GET /v1/keys/usage',
        revoke: 'DELETE /v1/keys',
      },
    },
    documentation: 'https://exostream.ai/api-docs',
  });
});

export default health;
