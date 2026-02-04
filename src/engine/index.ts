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
  console.log('Starting oracle recomputation...');
  const computedAt = new Date();

  // 1. Estimate theta for all models
  console.log('Estimating theta values...');
  const thetaEstimates = await estimateAllThetas();
  console.log(`  Computed theta for ${thetaEstimates.length} models`);

  // 2. Compute sigma for all models
  console.log('Computing sigma values...');
  const sigmaEstimates = await computeAllSigmas();
  console.log(`  Computed sigma for ${sigmaEstimates.length} models`);

  // 3. Save extrinsic params to database
  console.log('Saving extrinsic parameters...');
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
  console.log('Computing forward curves...');
  const forwardCurves = await computeAllForwardCurves();
  console.log(`  Computed ${forwardCurves.length} forward curves`);

  // 5. Save forward curves
  console.log('Saving forward curves...');
  await saveForwardCurves(forwardCurves);

  // 6. Detect price changes
  console.log('Detecting price changes...');
  const priceEvents = await detectAllPriceChanges();
  console.log(`  Detected ${priceEvents.length} price events`);

  // 7. Save price events
  await savePriceEvents(priceEvents);

  console.log('Oracle recomputation complete');

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
      console.log('\nSummary:');
      console.log(`  Theta estimates: ${result.thetaEstimates.length}`);
      console.log(`  Sigma estimates: ${result.sigmaEstimates.length}`);
      console.log(`  Forward curves: ${result.forwardCurves.length}`);
      console.log(`  Price events: ${result.priceEvents.length}`);
    })
    .catch(err => {
      console.error('Recomputation failed:', err);
      process.exit(1);
    });
}
