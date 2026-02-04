/**
 * Theta estimation - monthly decay rate from price history
 *
 * For models with 3+ months of history: exponentially weighted decay rate
 * For new models: Bayesian blend with family prior
 */

import { getClientOrNull } from '@/db/client.js';

export interface ThetaEstimate {
  modelId: string;
  theta: number;
  familyPriorWeight: number;  // gamma_t: 0 = pure prior, 1 = pure observed
  nObservations: number;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Estimate theta for a single model
 */
export async function estimateTheta(modelId: string): Promise<ThetaEstimate | null> {
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
    // Not enough data - use family prior
    return await getFamilyPrior(modelId);
  }

  // Calculate log returns and time differences
  const logReturns: { dt: number; logReturn: number }[] = [];
  for (let i = 1; i < history.length; i++) {
    const prevPrice = parseFloat(history[i - 1].beta);
    const currPrice = parseFloat(history[i].beta);
    const prevDate = new Date(history[i - 1].observed_at);
    const currDate = new Date(history[i].observed_at);

    // Time difference in months
    const dtMonths = (currDate.getTime() - prevDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

    if (dtMonths > 0 && prevPrice > 0 && currPrice > 0) {
      const logReturn = Math.log(currPrice / prevPrice);
      logReturns.push({ dt: dtMonths, logReturn });
    }
  }

  if (logReturns.length === 0) {
    return await getFamilyPrior(modelId);
  }

  // Calculate exponentially weighted theta
  // More recent observations get higher weight
  const lambda = 0.9; // decay factor for exponential weighting
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < logReturns.length; i++) {
    const weight = Math.pow(lambda, logReturns.length - 1 - i);
    // theta = -logReturn / dt (negative because theta represents decay)
    const thetaObs = -logReturns[i].logReturn / logReturns[i].dt;
    weightedSum += weight * thetaObs;
    totalWeight += weight;
  }

  const thetaObserved = weightedSum / totalWeight;

  // Calculate history span in months
  const firstDate = new Date(history[0].observed_at);
  const lastDate = new Date(history[history.length - 1].observed_at);
  const spanMonths = (lastDate.getTime() - firstDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

  // Blend with family prior (crossover at ~2-3 months)
  let familyPriorWeight = 1.0;
  let thetaFinal = thetaObserved;

  if (spanMonths < 3) {
    // Blend with family prior
    const prior = await getFamilyPrior(modelId);
    if (prior) {
      // gamma increases from 0 to 1 as span goes from 0 to 3 months
      familyPriorWeight = 1 - Math.min(1, spanMonths / 3);
      thetaFinal = familyPriorWeight * prior.theta + (1 - familyPriorWeight) * thetaObserved;
    }
  } else {
    familyPriorWeight = 0;
  }

  return {
    modelId,
    theta: Math.max(0, thetaFinal), // theta should be non-negative for normal decay
    familyPriorWeight,
    nObservations: history.length,
    windowStart: firstDate,
    windowEnd: lastDate,
  };
}

/**
 * Get family prior theta from historical family estimates
 */
async function getFamilyPrior(modelId: string): Promise<ThetaEstimate | null> {
  const sql = getClientOrNull();
  if (!sql) return null;

  // Get family for this model
  const modelResult = await sql`
    SELECT family_id FROM models WHERE model_id = ${modelId}
  `;
  if (modelResult.length === 0) return null;

  const familyId = modelResult[0].family_id;

  // Get average theta for family
  const familyTheta = await sql`
    SELECT AVG(ep.theta) as avg_theta
    FROM extrinsic_params ep
    JOIN models m ON ep.model_id = m.model_id
    WHERE m.family_id = ${familyId}
      AND m.model_id != ${modelId}
  `;

  const avgTheta = familyTheta[0]?.avg_theta
    ? parseFloat(familyTheta[0].avg_theta)
    : getDefaultTheta(familyId);

  return {
    modelId,
    theta: avgTheta,
    familyPriorWeight: 1.0,
    nObservations: 0,
    windowStart: new Date(),
    windowEnd: new Date(),
  };
}

/**
 * Default theta values by family (from historical analysis)
 */
function getDefaultTheta(familyId: string): number {
  const defaults: Record<string, number> = {
    'claude-4': 0.031,
    'claude-3.5': 0.04,
    'gpt-4.1': 0.08,
    'gpt-4o': 0.06,
    'o-series': 0.05,
    'gemini-2.5': 0.05,
    'gemini-2.0': 0.06,
    'grok-3': 0.04,
    'mistral-large': 0.05,
    'deepseek-v3': 0.03,
    'deepseek-r1': 0.04,
  };
  return defaults[familyId] ?? 0.05;
}

/**
 * Estimate theta for all active models
 */
export async function estimateAllThetas(): Promise<ThetaEstimate[]> {
  const sql = getClientOrNull();
  if (!sql) return [];

  const models = await sql`
    SELECT model_id FROM models WHERE status = 'active'
  `;

  const estimates: ThetaEstimate[] = [];

  for (const model of models) {
    const estimate = await estimateTheta(model.model_id);
    if (estimate) {
      estimates.push(estimate);
    }
  }

  return estimates;
}

/**
 * Save theta estimates to database
 */
export async function saveThetaEstimates(estimates: ThetaEstimate[]): Promise<void> {
  const sql = getClientOrNull();
  if (!sql) return;

  for (const est of estimates) {
    // We need sigma too, so get it from the sigma module
    const sigma = 0.02; // placeholder - will be computed by sigma.ts

    await sql`
      INSERT INTO extrinsic_params (
        model_id, theta, sigma, window_start, window_end, n_observations, family_prior_weight
      ) VALUES (
        ${est.modelId}, ${est.theta}, ${sigma},
        ${est.windowStart}, ${est.windowEnd}, ${est.nObservations}, ${est.familyPriorWeight}
      )
    `;
  }
}
