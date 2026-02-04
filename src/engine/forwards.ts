/**
 * Forward curve generation
 *
 * Computes forward prices at standard tenors (1M, 3M, 6M) using spot + theta.
 */

import { getClientOrNull } from '@/db/client.js';
import { forwardPrice, decayFactor } from '@/core/pricing.js';
import { FORWARD_TENORS, type ForwardTenor } from '@/core/constants.js';

export interface ForwardCurve {
  modelId: string;
  priceType: 'sync' | 'batch';
  betaSpot: number;
  thetaUsed: number;
  tenors: {
    tenor: ForwardTenor;
    betaForward: number;
    decayFactor: number;
  }[];
  computedAt: Date;
}

/**
 * Compute forward curve for a single model
 */
export async function computeForwardCurve(
  modelId: string,
  priceType: 'sync' | 'batch' = 'sync'
): Promise<ForwardCurve | null> {
  const sql = getClientOrNull();
  if (!sql) return null;

  // Get current spot price
  const spotResult = await sql`
    SELECT beta FROM spot_prices
    WHERE model_id = ${modelId} AND price_type = ${priceType}
    ORDER BY observed_at DESC
    LIMIT 1
  `;

  if (spotResult.length === 0) return null;

  const betaSpot = parseFloat(spotResult[0].beta);

  // Get current theta
  const thetaResult = await sql`
    SELECT theta FROM extrinsic_params
    WHERE model_id = ${modelId}
    ORDER BY computed_at DESC
    LIMIT 1
  `;

  // Use default theta if not available
  const thetaUsed = thetaResult.length > 0 ? parseFloat(thetaResult[0].theta) : 0.05;

  // Compute forward prices at each tenor
  const tenors = (Object.keys(FORWARD_TENORS) as ForwardTenor[]).map(tenor => {
    const t = FORWARD_TENORS[tenor];
    return {
      tenor,
      betaForward: forwardPrice(betaSpot, thetaUsed, t),
      decayFactor: decayFactor(thetaUsed, t),
    };
  });

  return {
    modelId,
    priceType,
    betaSpot,
    thetaUsed,
    tenors,
    computedAt: new Date(),
  };
}

/**
 * Compute forward curves for all active models
 */
export async function computeAllForwardCurves(): Promise<ForwardCurve[]> {
  const sql = getClientOrNull();
  if (!sql) return [];

  const models = await sql`
    SELECT model_id, ticker_batch FROM models WHERE status = 'active'
  `;

  const curves: ForwardCurve[] = [];

  for (const model of models) {
    // Sync forward curve
    const syncCurve = await computeForwardCurve(model.model_id, 'sync');
    if (syncCurve) {
      curves.push(syncCurve);
    }

    // Batch forward curve (if model has batch pricing)
    if (model.ticker_batch) {
      const batchCurve = await computeForwardCurve(model.model_id, 'batch');
      if (batchCurve) {
        curves.push(batchCurve);
      }
    }
  }

  return curves;
}

/**
 * Save forward curves to database
 */
export async function saveForwardCurves(curves: ForwardCurve[]): Promise<void> {
  const sql = getClientOrNull();
  if (!sql) return;

  for (const curve of curves) {
    for (const t of curve.tenors) {
      await sql`
        INSERT INTO forward_prices (
          model_id, price_type, tenor, beta_spot, theta_used, beta_forward, decay_factor, computed_at
        ) VALUES (
          ${curve.modelId}, ${curve.priceType}, ${t.tenor},
          ${curve.betaSpot}, ${curve.thetaUsed}, ${t.betaForward}, ${t.decayFactor},
          ${curve.computedAt}
        )
      `;
    }
  }
}
