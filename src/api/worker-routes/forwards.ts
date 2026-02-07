import { Hono } from 'hono';
import type { Env } from '../worker-types.js';
import { oracleState, tickerIndex } from '../worker-state.js';
import { logger } from '../../core/logger.js';

const forwardsLogger = logger.child({ component: 'forwards-route' });
const forwards = new Hono<{ Bindings: Env }>();

// GET /v1/forwards/:ticker - Get forward curve for ticker (worker.ts lines 397-421)
forwards.get('/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }

  const forwardCurve = oracleState.forwardCurves.get(`${model.modelId}:sync`) || [];
  return c.json({
    data: {
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      spot: model.betaSync,
      theta: model.theta,
      forwards: forwardCurve.map(f => ({
        tenor: f.tenor,
        beta_forward: f.betaForward,
        decay_factor: f.decayFactor,
      })),
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

export default forwards;
