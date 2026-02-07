import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState } from '../worker-state.js';

const health = new Hono<{ Bindings: Env }>();

// Health check - worker.ts lines 287-294
health.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    modelCount: oracleState.models.size,
    lastUpdate: oracleState.lastUpdate.toISOString(),
  });
});

// Root API info - worker.ts lines 297-319
health.get('/', (c) => {
  return c.json({
    name: 'Exostream API',
    description: 'The pricing oracle for LLM inference',
    version: '1.0.0',
    runtime: 'Cloudflare Workers',
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
