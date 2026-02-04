/**
 * Price change detection and event recording
 */

import { getClientOrNull } from '@/db/client.js';

export interface PriceEvent {
  modelId: string;
  priceType: 'sync' | 'batch';
  betaBefore: number;
  betaAfter: number;
  pctChange: number;
  detectedAt: Date;
  sourceEvent?: string;
}

/**
 * Detect price changes for a model
 */
export async function detectPriceChange(
  modelId: string,
  priceType: 'sync' | 'batch' = 'sync'
): Promise<PriceEvent | null> {
  const sql = getClientOrNull();
  if (!sql) return null;

  // Get two most recent prices
  const prices = await sql`
    SELECT beta, observed_at
    FROM spot_prices
    WHERE model_id = ${modelId} AND price_type = ${priceType}
    ORDER BY observed_at DESC
    LIMIT 2
  `;

  if (prices.length < 2) return null;

  const betaAfter = parseFloat(prices[0].beta);
  const betaBefore = parseFloat(prices[1].beta);

  // Only report if price actually changed
  if (betaAfter === betaBefore) return null;

  const pctChange = (betaAfter - betaBefore) / betaBefore;

  return {
    modelId,
    priceType,
    betaBefore,
    betaAfter,
    pctChange,
    detectedAt: new Date(prices[0].observed_at),
  };
}

/**
 * Detect and record all price changes
 */
export async function detectAllPriceChanges(): Promise<PriceEvent[]> {
  const sql = getClientOrNull();
  if (!sql) return [];

  const models = await sql`
    SELECT model_id, ticker_batch FROM models WHERE status = 'active'
  `;

  const events: PriceEvent[] = [];

  for (const model of models) {
    const syncEvent = await detectPriceChange(model.model_id, 'sync');
    if (syncEvent) {
      events.push(syncEvent);
    }

    if (model.ticker_batch) {
      const batchEvent = await detectPriceChange(model.model_id, 'batch');
      if (batchEvent) {
        events.push(batchEvent);
      }
    }
  }

  return events;
}

/**
 * Save price events to database
 */
export async function savePriceEvents(events: PriceEvent[]): Promise<void> {
  const sql = getClientOrNull();
  if (!sql) return;

  for (const event of events) {
    await sql`
      INSERT INTO price_events (
        model_id, price_type, beta_before, beta_after, pct_change, detected_at, source_event
      ) VALUES (
        ${event.modelId}, ${event.priceType}, ${event.betaBefore}, ${event.betaAfter},
        ${event.pctChange}, ${event.detectedAt}, ${event.sourceEvent ?? null}
      )
    `;
  }
}

/**
 * Get recent price events
 */
export async function getRecentEvents(since?: Date): Promise<PriceEvent[]> {
  const sql = getClientOrNull();
  if (!sql) return [];

  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24h

  const results = await sql`
    SELECT model_id, price_type, beta_before, beta_after, pct_change, detected_at, source_event
    FROM price_events
    WHERE detected_at >= ${sinceDate}
    ORDER BY detected_at DESC
  `;

  return results.map(row => ({
    modelId: row.model_id,
    priceType: row.price_type,
    betaBefore: parseFloat(row.beta_before),
    betaAfter: parseFloat(row.beta_after),
    pctChange: parseFloat(row.pct_change),
    detectedAt: new Date(row.detected_at),
    sourceEvent: row.source_event,
  }));
}
