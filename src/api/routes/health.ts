/**
 * Health check endpoint
 * GET /health
 */

import { Hono } from 'hono';
import { checkConnection } from '@/db/client.js';
import { getOracleState, getCacheAge, getOracleTimestamp } from '../oracle.js';

const health = new Hono();

health.get('/', async (c) => {
  const dbConnected = await checkConnection();
  const state = await getOracleState();

  return c.json({
    status: dbConnected ? 'ok' : 'degraded',
    oracle_timestamp: getOracleTimestamp().toISOString(),
    models_tracked: state.models.size,
    cache_age_seconds: getCacheAge(),
    database_connected: dbConnected,
  });
});

export default health;
