import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState, tickerIndex } from '../worker-state.js';

const greeks = new Hono<{ Bindings: Env }>();

// GET /v1/greeks - List all Greek sheets (worker.ts lines 360-383)
greeks.get('/', (c) => {
  const data = Array.from(oracleState.models.values()).map(m => ({
    ticker: m.tickerSync,
    ticker_batch: m.tickerBatch,
    model_id: m.modelId,
    display_name: m.displayName,
    provider: m.providerName,
    beta_sync: m.betaSync,
    beta_batch: m.betaBatch,
    context_window: m.contextWindow,
    r_in: m.rIn,
    r_cache: m.rCache,
    r_think: m.rThink,
    r_batch: m.rBatch,
    is_reasoning: m.isReasoning,
    theta: m.theta,
    sigma: m.sigma,
  }));
  return c.json({
    data,
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// GET /v1/greeks/:ticker - Get Greek sheet for specific ticker (worker.ts lines 386-394)
greeks.get('/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker) ||
    Array.from(oracleState.models.values()).find(m => m.tickerBatch?.toUpperCase() === ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }
  return c.json(model);
});

export default greeks;
