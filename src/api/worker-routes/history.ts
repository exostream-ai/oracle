import { Hono } from 'hono';
import type { Env, SeedModel, SeedPrice } from '../worker-types.js';
import { oracleState, tickerIndex, familyLineage, historicalPrices, seedModels } from '../worker-state.js';
import { logger } from '../../core/logger.js';

const historyLogger = logger.child({ component: 'history-route' });
const history = new Hono<{ Bindings: Env }>();

// GET /v1/history/:ticker - Get price history (worker.ts lines 607-653)
history.get('/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker);

  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }

  // Get family ID for this model to include lineage data
  const modelInfo = (seedModels as SeedModel[]).find(m => m.model_id === model.modelId);
  const familyId = modelInfo?.family_id;
  const lineageModels = familyId ? (familyLineage[familyId] || [familyId]) : [model.modelId];

  // Filter prices for this model's lineage (same logic as theta computation)
  const prices = (historicalPrices as SeedPrice[])
    .filter(p => {
      if (p.price_type !== 'sync') return false;
      // Match model_id against lineage patterns
      return lineageModels.some(lm => {
        if (p.model_id === lm) return true;
        if (p.model_id.startsWith(lm + '-') && !p.model_id.includes('mini') && !p.model_id.includes('flash') && !p.model_id.includes('nano')) {
          return true;
        }
        return false;
      });
    })
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())
    .map(p => ({
      beta: p.beta,
      timestamp: p.observed_at,
      source: p.source,
      provenance: p.source.includes('historical') ? 'reconstructed' : 'live',
    }));

  return c.json({
    data: {
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      price_type: 'sync',
      prices,
      count: prices.length,
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

export default history;
