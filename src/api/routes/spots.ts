/**
 * Spot price endpoints
 * GET /v1/spots - all models
 * GET /v1/spots/:ticker - single model
 */

import { Hono } from 'hono';
import { getAllModels, getModelByTicker, getCacheAge, getOracleTimestamp } from '../oracle.js';

const spots = new Hono();

// GET /v1/spots - all models
spots.get('/', async (c) => {
  const models = await getAllModels();

  const data = models.map(m => ({
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
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

// GET /v1/spots/:ticker - single model
spots.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = await getModelByTicker(ticker);

  if (!model) {
    return c.json({ error: 'Model not found', ticker }, 404);
  }

  return c.json({
    data: {
      ticker: model.tickerSync,
      ticker_batch: model.tickerBatch,
      model_id: model.modelId,
      display_name: model.displayName,
      provider: model.providerName,
      beta_sync: model.betaSync,
      beta_batch: model.betaBatch,
      context_window: model.contextWindow,
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default spots;
