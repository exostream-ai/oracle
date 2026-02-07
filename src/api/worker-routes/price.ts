import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState, tickerIndex, modelContextTiers } from '../worker-state.js';
import { effectiveInputRate, kappa as computeKappa, spotCost as computeSpotCost, forwardPrice as computeForwardPrice, decayFactor as computeDecayFactor } from '../../core/pricing.js';
import type { GreekSheet } from '../../core/types.js';

const price = new Hono<{ Bindings: Env }>();

// POST /v1/price - Calculate task price (worker.ts lines 424-534)
price.post('/', async (c) => {
  const body = await c.req.json();
  const { model: modelParam, modelId, ticker, n_in, n_out, n_think, eta = 0, horizon_months } = body;
  // Support both camelCase and snake_case parameter names
  const nIn = n_in ?? body.nIn;
  const nOut = n_out ?? body.nOut;
  const nThink = n_think ?? body.nThink;
  const horizonMonths = horizon_months ?? body.horizonMonths;

  // Input validation
  const lookupKey = modelParam || ticker || modelId;
  if (!lookupKey) {
    return c.json({ error: 'Missing required field: model, ticker, or modelId' }, 400);
  }
  if (nIn !== undefined && (typeof nIn !== 'number' || nIn < 0)) {
    return c.json({ error: 'n_in must be a non-negative number' }, 400);
  }
  if (nOut !== undefined && (typeof nOut !== 'number' || nOut < 0)) {
    return c.json({ error: 'n_out must be a non-negative number' }, 400);
  }
  if (nThink !== undefined && (typeof nThink !== 'number' || nThink < 0)) {
    return c.json({ error: 'n_think must be a non-negative number' }, 400);
  }
  if (typeof eta !== 'number' || eta < 0 || eta > 1) {
    return c.json({ error: 'eta must be a number between 0 and 1' }, 400);
  }
  if (horizonMonths !== undefined && (typeof horizonMonths !== 'number' || horizonMonths <= 0)) {
    return c.json({ error: 'horizon_months must be a positive number' }, 400);
  }

  // Find model by ID, ticker, or model param (which is ticker from frontend)
  let model: GreekSheet | undefined;
  {
    // Try exact model ID match first
    model = oracleState.models.get(lookupKey);
    // Then try ticker match
    if (!model) {
      model = tickerIndex.get(lookupKey.toUpperCase());
    }
  }

  if (!model) {
    return c.json({ error: 'Model not found' }, 404);
  }

  if (!model.betaSync) {
    return c.json({ error: 'No spot price available for model' }, 400);
  }

  const beta = model.betaSync;
  const rIn = model.rIn;
  const rCache = model.rCache;
  const rThink = model.rThink ?? 0;
  const W = model.contextWindow;
  const tiers = modelContextTiers.get(model.modelId) ?? [{ tauStart: 0, tauEnd: 1, alpha: 1 }];

  // Use core pricing functions (same math as Node.js API)
  const rInEff = effectiveInputRate(rIn, rCache, eta, nIn || 0, W, tiers);
  const k = computeKappa(nIn || 0, nOut || 0, rInEff);
  const S = computeSpotCost(beta, nOut || 0, nIn || 0, rInEff, nThink || 0, rThink);

  // Calculate cost without cache for savings comparison
  const rInEffNoCache = effectiveInputRate(rIn, rCache, 0, nIn || 0, W, tiers);
  const SNoCache = computeSpotCost(beta, nOut || 0, nIn || 0, rInEffNoCache, nThink || 0, rThink);
  const cacheSavings = SNoCache - S;

  const result: any = {
    data: {
      model: model.tickerSync,
      display_name: model.displayName,
      spot_cost: S,
      kappa: k,
      r_in_eff: rInEff,
      beta_used: beta,
      task_profile: {
        n_in: nIn || 0,
        n_out: nOut || 0,
        n_think: nThink || 0,
        eta: eta,
      },
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  };

  // Calculate forward cost if horizon specified
  if (horizonMonths && model.theta) {
    const D = computeDecayFactor(model.theta, horizonMonths);
    const forwardCost = S * D;
    const betaForward = computeForwardPrice(beta, model.theta, horizonMonths);

    result.data.forward = {
      horizon_months: horizonMonths,
      cost: forwardCost,
      beta_forward: betaForward,
      theta_used: model.theta,
      decay_factor: D,
    };
  }

  // Add cache value if caching is being used
  if (eta > 0 && cacheSavings > 0) {
    result.data.cache_value = {
      cost_without_cache: SNoCache,
      savings: cacheSavings,
      savings_pct: (cacheSavings / SNoCache) * 100,
    };
  }

  return c.json(result);
});

export default price;
