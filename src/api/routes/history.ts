/**
 * Price history endpoint
 * GET /v1/history/:ticker
 */

import { Hono } from 'hono';
import { getClientOrNull } from '@/db/client.js';
import { getModelByTicker, getCacheAge, getOracleTimestamp } from '../oracle.js';

const history = new Hono();

// GET /v1/history/:ticker
history.get('/:ticker', async (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = await getModelByTicker(ticker);

  if (!model) {
    return c.json({ error: 'Model not found', ticker }, 404);
  }

  // Determine if batch ticker
  const isBatch = ticker.endsWith('.B');
  const priceType = isBatch ? 'batch' : 'sync';

  // Get query params
  const from = c.req.query('from');
  const to = c.req.query('to');

  const sql = getClientOrNull();
  if (!sql) {
    return c.json({
      data: {
        ticker,
        model_id: model.modelId,
        prices: [],
      },
      oracle_timestamp: getOracleTimestamp().toISOString(),
      cache_age_seconds: getCacheAge(),
    });
  }

  // Build query
  let prices;
  if (from && to) {
    prices = await sql`
      SELECT beta, observed_at, source
      FROM spot_prices
      WHERE model_id = ${model.modelId}
        AND price_type = ${priceType}
        AND observed_at >= ${from}
        AND observed_at <= ${to}
      ORDER BY observed_at ASC
    `;
  } else if (from) {
    prices = await sql`
      SELECT beta, observed_at, source
      FROM spot_prices
      WHERE model_id = ${model.modelId}
        AND price_type = ${priceType}
        AND observed_at >= ${from}
      ORDER BY observed_at ASC
    `;
  } else {
    // Default: last 12 months
    prices = await sql`
      SELECT beta, observed_at, source
      FROM spot_prices
      WHERE model_id = ${model.modelId}
        AND price_type = ${priceType}
        AND observed_at >= NOW() - INTERVAL '12 months'
      ORDER BY observed_at ASC
    `;
  }

  const priceData = prices.map(p => ({
    beta: parseFloat(p.beta),
    timestamp: new Date(p.observed_at).toISOString(),
    source: p.source,
    provenance: p.source.startsWith('seed:') ? 'reconstructed' : 'live',
  }));

  return c.json({
    data: {
      ticker,
      model_id: model.modelId,
      display_name: model.displayName,
      price_type: priceType,
      prices: priceData,
      count: priceData.length,
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default history;
