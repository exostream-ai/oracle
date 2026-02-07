import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState, tickerIndex } from '../worker-state.js';
import { logger } from '../../core/logger.js';

const spotsLogger = logger.child({ component: 'spots-route' });
const spots = new Hono<{ Bindings: Env }>();

// GET /v1/spots - List all spot prices (worker.ts lines 322-338)
spots.get('/', (c) => {
  const data = Array.from(oracleState.models.values()).map(m => ({
    ticker: m.tickerSync,
    ticker_batch: m.tickerBatch,
    model_id: m.modelId,
    display_name: m.displayName,
    provider: m.providerName,
    beta_sync: m.betaSync,
    beta_batch: m.betaBatch,
    context_window: m.contextWindow,
  }));
  return c.json({
    data,
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// GET /v1/spots/:ticker - Get spot price for specific ticker (worker.ts lines 341-357)
spots.get('/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker) ||
    Array.from(oracleState.models.values()).find(m => m.tickerBatch?.toUpperCase() === ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }
  return c.json({
    ticker: model.tickerSync,
    modelId: model.modelId,
    displayName: model.displayName,
    provider: model.providerName,
    betaSync: model.betaSync,
    betaBatch: model.betaBatch,
    timestamp: oracleState.lastUpdate.toISOString(),
  });
});

export default spots;
