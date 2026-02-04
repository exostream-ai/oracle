/**
 * Forward curve endpoint
 * GET /v1/forwards/:ticker
 */

import { Hono } from 'hono';
import { getModelByTicker, getForwardCurve, getCacheAge, getOracleTimestamp } from '../oracle.js';
import { decayFactor, forwardPrice } from '@/core/pricing.js';

const forwards = new Hono();

// GET /v1/forwards/:ticker
forwards.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = await getModelByTicker(ticker);

  if (!model) {
    return c.json({ error: 'Model not found', ticker }, 404);
  }

  // Determine if batch ticker
  const isBatch = ticker.endsWith('.B');
  const priceType = isBatch ? 'batch' : 'sync';

  // Get stored forward curve
  let curve = await getForwardCurve(model.modelId, priceType);

  // If no stored curve, compute on the fly
  if (curve.length === 0 && model.theta !== undefined) {
    const beta = isBatch ? model.betaBatch : model.betaSync;
    if (beta !== undefined) {
      const tenors = ['1M', '3M', '6M'] as const;
      const tenorMonths = { '1M': 1, '3M': 3, '6M': 6 };

      curve = tenors.map(tenor => ({
        modelId: model.modelId,
        priceType,
        tenor,
        betaSpot: beta,
        thetaUsed: model.theta!,
        betaForward: forwardPrice(beta, model.theta!, tenorMonths[tenor]),
        decayFactor: decayFactor(model.theta!, tenorMonths[tenor]),
        computedAt: new Date(),
      }));
    }
  }

  const betaSpot = isBatch ? model.betaBatch : model.betaSync;
  const theta = model.theta ?? 0.05;

  return c.json({
    data: {
      ticker,
      model_id: model.modelId,
      display_name: model.displayName,
      spot: betaSpot,
      theta,
      forwards: curve.map(f => ({
        tenor: f.tenor,
        beta_forward: f.betaForward,
        decay_factor: f.decayFactor,
      })),
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default forwards;
