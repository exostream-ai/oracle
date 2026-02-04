/**
 * Compare models endpoint
 * POST /v1/compare
 */

import { Hono } from 'hono';
import { getAllModels, getContextTiers, getCacheAge, getOracleTimestamp } from '../oracle.js';
import { effectiveInputRate, kappa, spotCost } from '@/core/pricing.js';

const compare = new Hono();

interface CompareRequest {
  n_in: number;
  n_out: number;
  n_think?: number;
  eta?: number;
}

// POST /v1/compare
compare.post('/', async (c) => {
  const body = await c.req.json<CompareRequest>();

  // Validate required fields
  if (body.n_in === undefined || body.n_out === undefined) {
    return c.json({
      error: 'Missing required fields: n_in, n_out',
    }, 400);
  }

  const nIn = body.n_in;
  const nOut = body.n_out;
  const nThink = body.n_think ?? 0;
  const eta = body.eta ?? 0;

  // Get all models
  const models = await getAllModels();

  // Calculate cost for each model
  const results = await Promise.all(
    models.map(async model => {
      const beta = model.betaSync;
      if (beta === undefined) {
        return null;
      }

      const tiers = await getContextTiers(model.modelId);
      const W = model.contextWindow;
      const rIn = model.rIn;
      const rCache = model.rCache;
      const rThink = model.rThink ?? 0;

      // Skip if input exceeds context window
      if (nIn > W) {
        return null;
      }

      const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);
      const k = kappa(nIn, nOut, rInEff);

      // Only add think tokens if model supports reasoning
      const actualNThink = model.isReasoning ? nThink : 0;
      const S = spotCost(beta, nOut, nIn, rInEff, actualNThink, rThink);

      return {
        ticker: model.tickerSync,
        model_id: model.modelId,
        display_name: model.displayName,
        provider: model.providerName,
        spot_cost: S,
        kappa: k,
        beta: beta,
        is_reasoning: model.isReasoning,
        theta: model.theta,
      };
    })
  );

  // Filter nulls and sort by cost
  const validResults = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.spot_cost - b.spot_cost);

  return c.json({
    data: {
      task_profile: {
        n_in: nIn,
        n_out: nOut,
        n_think: nThink,
        eta,
      },
      models: validResults,
      cheapest: validResults[0]?.ticker,
      most_expensive: validResults[validResults.length - 1]?.ticker,
      count: validResults.length,
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default compare;
