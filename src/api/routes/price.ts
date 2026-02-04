/**
 * Task pricer endpoint
 * POST /v1/price
 */

import { Hono } from 'hono';
import { getModelByTicker, getModelGreeks, getContextTiers, getCacheAge, getOracleTimestamp } from '../oracle.js';
import { effectiveInputRate, kappa, spotCost, forwardPrice, decayFactor } from '@/core/pricing.js';

const price = new Hono();

interface PriceRequest {
  model: string;  // ticker or model_id
  n_in: number;
  n_out: number;
  n_think?: number;
  eta?: number;           // cache hit ratio (0-1)
  horizon_months?: number;
}

// POST /v1/price
price.post('/', async (c) => {
  const body = await c.req.json<PriceRequest>();

  // Validate required fields
  if (!body.model || body.n_in === undefined || body.n_out === undefined) {
    return c.json({
      error: 'Missing required fields: model, n_in, n_out',
    }, 400);
  }

  // Find model by ticker or model_id
  let model = await getModelByTicker(body.model.toUpperCase());
  if (!model) {
    model = await getModelGreeks(body.model);
  }
  if (!model) {
    return c.json({ error: 'Model not found', model: body.model }, 404);
  }

  // Get context tiers
  const tiers = await getContextTiers(model.modelId);

  // Get parameters
  const beta = model.betaSync;
  if (beta === undefined) {
    return c.json({ error: 'No spot price available for model' }, 400);
  }

  const nIn = body.n_in;
  const nOut = body.n_out;
  const nThink = body.n_think ?? 0;
  const eta = body.eta ?? 0;
  const W = model.contextWindow;
  const rIn = model.rIn;
  const rCache = model.rCache;
  const rThink = model.rThink ?? 0;
  const theta = model.theta ?? 0.05;

  // Compute effective input rate
  const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);

  // Compute kappa (delta)
  const k = kappa(nIn, nOut, rInEff);

  // Compute spot cost
  const S = spotCost(beta, nOut, nIn, rInEff, nThink, rThink);

  // Build response
  const response: Record<string, unknown> = {
    data: {
      model: model.tickerSync,
      display_name: model.displayName,
      spot_cost: S,
      kappa: k,
      r_in_eff: rInEff,
      beta_used: beta,
      task_profile: {
        n_in: nIn,
        n_out: nOut,
        n_think: nThink,
        eta,
      },
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  };

  // Add forward cost if horizon specified
  if (body.horizon_months !== undefined && body.horizon_months > 0) {
    const D = decayFactor(theta, body.horizon_months);
    const forwardCost = S * D;
    const betaFwd = forwardPrice(beta, theta, body.horizon_months);

    (response.data as Record<string, unknown>).forward = {
      horizon_months: body.horizon_months,
      cost: forwardCost,
      beta_forward: betaFwd,
      theta_used: theta,
      decay_factor: D,
    };
  }

  // Add cache value (what you save vs 0% cache)
  if (eta > 0) {
    const rInEffNoCache = effectiveInputRate(rIn, rCache, 0, nIn, W, tiers);
    const SNoCache = spotCost(beta, nOut, nIn, rInEffNoCache, nThink, rThink);
    const cacheSavings = SNoCache - S;

    (response.data as Record<string, unknown>).cache_value = {
      cost_without_cache: SNoCache,
      savings: cacheSavings,
      savings_pct: (cacheSavings / SNoCache) * 100,
    };
  }

  return c.json(response);
});

export default price;
