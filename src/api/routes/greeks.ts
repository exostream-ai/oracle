/**
 * Greek sheet endpoints
 * GET /v1/greeks - all models
 * GET /v1/greeks/:ticker - single model
 */

import { Hono } from 'hono';
import { getAllModels, getModelByTicker, getCacheAge, getOracleTimestamp } from '../oracle.js';

const greeks = new Hono();

// GET /v1/greeks - full Greek sheet
greeks.get('/', async (c) => {
  const models = await getAllModels();

  const data = models.map(m => ({
    ticker: m.tickerSync,
    model_id: m.modelId,
    display_name: m.displayName,
    provider: m.providerName,
    // Spot prices
    beta_sync: m.betaSync,
    beta_batch: m.betaBatch,
    // Structural Greeks
    r_in: m.rIn,
    r_cache: m.rCache,
    r_think: m.rThink,
    r_batch: m.rBatch,
    context_window: m.contextWindow,
    is_reasoning: m.isReasoning,
    // Extrinsic Greeks
    theta: m.theta,
    sigma: m.sigma,
    family_prior_weight: m.familyPriorWeight,
  }));

  return c.json({
    data,
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

// GET /v1/greeks/:ticker - single model Greeks
greeks.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = await getModelByTicker(ticker);

  if (!model) {
    return c.json({ error: 'Model not found', ticker }, 404);
  }

  return c.json({
    data: {
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      provider: model.providerName,
      beta_sync: model.betaSync,
      beta_batch: model.betaBatch,
      r_in: model.rIn,
      r_cache: model.rCache,
      r_think: model.rThink,
      r_batch: model.rBatch,
      context_window: model.contextWindow,
      is_reasoning: model.isReasoning,
      theta: model.theta,
      sigma: model.sigma,
      family_prior_weight: model.familyPriorWeight,
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default greeks;
