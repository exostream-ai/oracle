import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState, tickerIndex, modelContextTiers } from '../worker-state.js';
import { effectiveInputRate, kappa as computeKappa, spotCost as computeSpotCost } from '../../core/pricing.js';

const compare = new Hono<{ Bindings: Env }>();

// POST /v1/compare - Compare multiple models (worker.ts lines 537-604)
compare.post('/', async (c) => {
  const body = await c.req.json();
  const { models: modelIds } = body;
  // Support both camelCase and snake_case parameter names
  const nIn = body.n_in ?? body.nIn ?? 0;
  const nOut = body.n_out ?? body.nOut ?? 0;
  const nThink = body.n_think ?? body.nThink ?? 0;
  const eta = body.eta ?? 0;

  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    return c.json({ error: 'models array is required' }, 400);
  }
  if (typeof nIn !== 'number' || nIn < 0) {
    return c.json({ error: 'n_in must be a non-negative number' }, 400);
  }
  if (typeof nOut !== 'number' || nOut < 0) {
    return c.json({ error: 'n_out must be a non-negative number' }, 400);
  }
  if (typeof eta !== 'number' || eta < 0 || eta > 1) {
    return c.json({ error: 'eta must be a number between 0 and 1' }, 400);
  }

  const results = [];
  for (const id of modelIds) {
    const model = oracleState.models.get(id) || tickerIndex.get(id.toUpperCase());

    if (!model || !model.betaSync) continue;

    const beta = model.betaSync;
    const W = model.contextWindow;
    const rIn = model.rIn;
    const rCache = model.rCache;
    const rThink = model.rThink ?? 0;
    const tiers = modelContextTiers.get(model.modelId) ?? [{ tauStart: 0, tauEnd: 1, alpha: 1 }];

    // Use core pricing functions (same math as Node.js API)
    const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);
    const k = computeKappa(nIn, nOut, rInEff);
    const actualNThink = model.isReasoning ? nThink : 0;
    const S = computeSpotCost(beta, nOut, nIn, rInEff, actualNThink, rThink);

    results.push({
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      provider: model.providerName,
      spot_cost: S,
      kappa: k,
      beta,
      is_reasoning: model.isReasoning,
      theta: model.theta,
    });
  }

  results.sort((a, b) => a.spot_cost - b.spot_cost);

  return c.json({
    data: {
      task_profile: { n_in: nIn, n_out: nOut, n_think: nThink, eta },
      models: results,
      cheapest: results[0]?.ticker,
      most_expensive: results[results.length - 1]?.ticker,
      count: results.length,
    },
    oracle_timestamp: oracleState.lastUpdate.toISOString(),
    cache_age_seconds: 0,
  });
});

export default compare;
