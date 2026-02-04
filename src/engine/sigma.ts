/**
 * Sigma computation - realized monthly volatility from price history
 *
 * Purely backward-looking - computed from observed price changes.
 */

import { getClientOrNull } from '@/db/client.js';

export interface SigmaEstimate {
  modelId: string;
  sigma: number;
  nObservations: number;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Compute realized volatility for a single model
 */
export async function computeSigma(modelId: string): Promise<SigmaEstimate | null> {
  const sql = getClientOrNull();
  if (!sql) return null;

  // Get price history for this model
  const history = await sql`
    SELECT beta, observed_at
    FROM spot_prices
    WHERE model_id = ${modelId}
      AND price_type = 'sync'
    ORDER BY observed_at ASC
  `;

  if (history.length < 2) {
    // Not enough data - return default
    return {
      modelId,
      sigma: 0.02, // default low volatility
      nObservations: history.length,
      windowStart: history.length > 0 ? new Date(history[0].observed_at) : new Date(),
      windowEnd: history.length > 0 ? new Date(history[history.length - 1].observed_at) : new Date(),
    };
  }

  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prevPrice = parseFloat(history[i - 1].beta);
    const currPrice = parseFloat(history[i].beta);

    if (prevPrice > 0 && currPrice > 0) {
      logReturns.push(Math.log(currPrice / prevPrice));
    }
  }

  if (logReturns.length === 0) {
    return {
      modelId,
      sigma: 0.02,
      nObservations: history.length,
      windowStart: new Date(history[0].observed_at),
      windowEnd: new Date(history[history.length - 1].observed_at),
    };
  }

  // Calculate standard deviation of log returns
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const squaredDiffs = logReturns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / logReturns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize to monthly (assuming we have roughly monthly observations)
  // If observations are more frequent, adjust accordingly
  const firstDate = new Date(history[0].observed_at);
  const lastDate = new Date(history[history.length - 1].observed_at);
  const spanMonths = (lastDate.getTime() - firstDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
  const avgObsPerMonth = spanMonths > 0 ? logReturns.length / spanMonths : 1;

  // Scale to monthly volatility
  const monthlyVol = stdDev * Math.sqrt(avgObsPerMonth);

  return {
    modelId,
    sigma: monthlyVol,
    nObservations: history.length,
    windowStart: firstDate,
    windowEnd: lastDate,
  };
}

/**
 * Compute sigma for all active models
 */
export async function computeAllSigmas(): Promise<SigmaEstimate[]> {
  const sql = getClientOrNull();
  if (!sql) return [];

  const models = await sql`
    SELECT model_id FROM models WHERE status = 'active'
  `;

  const estimates: SigmaEstimate[] = [];

  for (const model of models) {
    const estimate = await computeSigma(model.model_id);
    if (estimate) {
      estimates.push(estimate);
    }
  }

  return estimates;
}
