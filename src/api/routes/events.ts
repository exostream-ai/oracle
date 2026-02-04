/**
 * Price events endpoint
 * GET /v1/events
 */

import { Hono } from 'hono';
import { getClientOrNull } from '@/db/client.js';
import { getCacheAge, getOracleTimestamp } from '../oracle.js';

const events = new Hono();

// GET /v1/events
events.get('/', async (c) => {
  const since = c.req.query('since');

  const sql = getClientOrNull();
  if (!sql) {
    return c.json({
      data: { events: [] },
      oracle_timestamp: getOracleTimestamp().toISOString(),
      cache_age_seconds: getCacheAge(),
    });
  }

  // Default: last 24 hours
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const eventRows = await sql`
    SELECT
      pe.model_id,
      m.ticker_sync,
      m.display_name,
      pe.price_type,
      pe.beta_before,
      pe.beta_after,
      pe.pct_change,
      pe.detected_at,
      pe.source_event
    FROM price_events pe
    JOIN models m ON pe.model_id = m.model_id
    WHERE pe.detected_at >= ${sinceDate}
    ORDER BY pe.detected_at DESC
    LIMIT 100
  `;

  const eventData = eventRows.map(e => ({
    ticker: e.ticker_sync,
    model_id: e.model_id,
    display_name: e.display_name,
    price_type: e.price_type,
    beta_before: parseFloat(e.beta_before),
    beta_after: parseFloat(e.beta_after),
    pct_change: parseFloat(e.pct_change),
    pct_change_display: `${(parseFloat(e.pct_change) * 100).toFixed(1)}%`,
    detected_at: new Date(e.detected_at).toISOString(),
    event_type: e.source_event,
  }));

  return c.json({
    data: {
      events: eventData,
      count: eventData.length,
      since: sinceDate,
    },
    oracle_timestamp: getOracleTimestamp().toISOString(),
    cache_age_seconds: getCacheAge(),
  });
});

export default events;
