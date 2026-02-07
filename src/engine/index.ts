// Engine module - oracle computation (theta, sigma, forwards)
export * from './theta.js';
export * from './sigma.js';
export * from './forwards.js';
export * from './events.js';

import { estimateAllThetas, saveThetaEstimates, type ThetaEstimate } from './theta.js';
import { computeAllSigmas, type SigmaEstimate } from './sigma.js';
import { computeAllForwardCurves, saveForwardCurves, type ForwardCurve } from './forwards.js';
import { detectAllPriceChanges, savePriceEvents, type PriceEvent } from './events.js';
import { getClientOrNull } from '@/db/client.js';
import { logger } from '../core/logger.js';

const engineLogger = logger.child({ component: 'engine' });

export interface RecomputeResult {
  thetaEstimates: ThetaEstimate[];
  sigmaEstimates: SigmaEstimate[];
  forwardCurves: ForwardCurve[];
  priceEvents: PriceEvent[];
  computedAt: Date;
}

/**
 * Recompute all oracle parameters
 */
export async function recomputeAll(): Promise<RecomputeResult> {
  engineLogger.info('Starting oracle recomputation');
  const computedAt = new Date();

  // 1. Estimate theta for all models
  engineLogger.info('Estimating theta values');
  const thetaEstimates = await estimateAllThetas();
  engineLogger.info('Theta estimation complete', { count: thetaEstimates.length });

  // 2. Compute sigma for all models
  engineLogger.info('Computing sigma values');
  const sigmaEstimates = await computeAllSigmas();
  engineLogger.info('Sigma computation complete', { count: sigmaEstimates.length });

  // 3. Save extrinsic params to database
  engineLogger.info('Saving extrinsic parameters');
  const sql = getClientOrNull();
  if (sql) {
    for (const theta of thetaEstimates) {
      const sigma = sigmaEstimates.find(s => s.modelId === theta.modelId)?.sigma ?? 0.02;
      await sql`
        INSERT INTO extrinsic_params (
          model_id, theta, sigma, window_start, window_end, n_observations, family_prior_weight
        ) VALUES (
          ${theta.modelId}, ${theta.theta}, ${sigma},
          ${theta.windowStart}, ${theta.windowEnd}, ${theta.nObservations}, ${theta.familyPriorWeight}
        )
      `;
    }
  }

  // 4. Compute forward curves
  engineLogger.info('Computing forward curves');
  const forwardCurves = await computeAllForwardCurves();
  engineLogger.info('Forward curves computed', { count: forwardCurves.length });

  // 5. Save forward curves
  engineLogger.info('Saving forward curves');
  await saveForwardCurves(forwardCurves);

  // 6. Detect price changes
  engineLogger.info('Detecting price changes');
  const priceEvents = await detectAllPriceChanges();
  engineLogger.info('Price events detected', { count: priceEvents.length });

  // 7. Save price events
  await savePriceEvents(priceEvents);

  engineLogger.info('Oracle recomputation complete');

  return {
    thetaEstimates,
    sigmaEstimates,
    forwardCurves,
    priceEvents,
    computedAt,
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  recomputeAll()
    .then(result => {
      engineLogger.info('Summary', {
        theta_estimates: result.thetaEstimates.length,
        sigma_estimates: result.sigmaEstimates.length,
        forward_curves: result.forwardCurves.length,
        price_events: result.priceEvents.length
      });
    })
    .catch(err => {
      engineLogger.error('Recomputation failed', {
        error: err instanceof Error ? err.message : String(err)
      });
      process.exit(1);
    });
}
