/**
 * Build-time oracle state pre-computation
 * Generates src/api/oracle-state.json with all models, prices, and derived values
 * Run via: npm run build:oracle
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { computeThetaFromHistory, FAMILY_LINEAGE } from '../core/constants.js';
import type { GreekSheet, ForwardPrice, ContextTier } from '../core/types.js';

interface SeedModel {
  model_id: string;
  family_id: string;
  display_name: string;
  ticker_sync: string;
  ticker_batch: string | null;
  context_window: number;
  tiers: { tau_start: number; tau_end: number; alpha: number }[];
}

interface SeedFamily {
  family_id: string;
  provider_id: string;
  display_name: string;
  r_in: number;
  r_cache: number;
  r_think: number | null;
  r_batch: number | null;
  is_reasoning: boolean;
}

interface SeedProvider {
  provider_id: string;
  display_name: string;
}

interface SeedPrice {
  model_id: string;
  price_type: string;
  beta: number;
  observed_at: string;
  source: string;
}

interface PrecomputedState {
  models: Array<GreekSheet>;
  contextTiers: Record<string, Array<ContextTier>>;
  forwardCurves: Record<string, Array<{
    modelId: string;
    priceType: string;
    tenor: string;
    betaSpot: number;
    thetaUsed: number;
    betaForward: number;
    decayFactor: number;
  }>>;
  tickerIndex: Record<string, string>;
  generated_at: string;
  version: string;
}

/**
 * Pre-compute oracle state from seed data
 * Replicates exact logic from worker-state.ts buildOracleState()
 */
function precomputeOracleState(): PrecomputedState {
  // Read seed JSON files
  const seedPath = join(process.cwd(), 'seed');
  const providers = JSON.parse(readFileSync(join(seedPath, 'providers.json'), 'utf-8')) as SeedProvider[];
  const families = JSON.parse(readFileSync(join(seedPath, 'families.json'), 'utf-8')) as SeedFamily[];
  const models = JSON.parse(readFileSync(join(seedPath, 'models.json'), 'utf-8')) as SeedModel[];
  const historicalPrices = JSON.parse(readFileSync(join(seedPath, 'historical_prices.json'), 'utf-8')) as SeedPrice[];

  // Build provider and family maps
  const providerMap = new Map(providers.map(p => [p.provider_id, p]));
  const familyMap = new Map(families.map(f => [f.family_id, f]));

  // Compute latest prices per model
  const latestPrices = new Map<string, { beta: number; date: Date }>();
  for (const price of historicalPrices) {
    const key = `${price.model_id}:${price.price_type}`;
    const priceDate = new Date(price.observed_at);
    const existing = latestPrices.get(key);
    if (!existing || priceDate > existing.date) {
      latestPrices.set(key, { beta: price.beta, date: priceDate });
    }
  }

  // Build models array and context tiers
  const modelsArray: GreekSheet[] = [];
  const contextTiers: Record<string, Array<ContextTier>> = {};

  for (const model of models) {
    const family = familyMap.get(model.family_id);
    if (!family) continue;

    const provider = providerMap.get(family.provider_id);
    const syncPrice = latestPrices.get(`${model.model_id}:sync`);
    const batchPrice = latestPrices.get(`${model.model_id}:batch`);
    const { theta, sigma } = computeThetaFromHistory(historicalPrices, model.family_id);

    // Store context tiers
    if (model.tiers && model.tiers.length > 0) {
      contextTiers[model.model_id] = model.tiers.map(t => ({
        tauStart: t.tau_start,
        tauEnd: t.tau_end,
        alpha: t.alpha,
      }));
    }

    modelsArray.push({
      modelId: model.model_id,
      displayName: model.display_name,
      tickerSync: model.ticker_sync,
      tickerBatch: model.ticker_batch ?? undefined,
      providerName: provider?.display_name ?? family.provider_id,
      contextWindow: model.context_window,
      rIn: family.r_in,
      rCache: family.r_cache,
      rThink: family.r_think ?? undefined,
      rBatch: family.r_batch ?? undefined,
      isReasoning: family.is_reasoning,
      betaSync: syncPrice?.beta,
      betaBatch: batchPrice?.beta,
      theta,
      sigma,
    });
  }

  // Build forward curves
  const forwardCurvesObj: Record<string, Array<{
    modelId: string;
    priceType: string;
    tenor: string;
    betaSpot: number;
    thetaUsed: number;
    betaForward: number;
    decayFactor: number;
  }>> = {};

  const tenors = ['1M', '3M', '6M'] as const;
  const tenorMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };

  for (const model of modelsArray) {
    if (!model.betaSync || !model.theta) continue;

    const theta = model.theta;
    const forwards = [];

    for (const tenor of tenors) {
      const t = tenorMonths[tenor];
      const decayFactor = Math.exp(-theta * t);
      forwards.push({
        modelId: model.modelId,
        priceType: 'sync',
        tenor,
        betaSpot: model.betaSync,
        thetaUsed: theta,
        betaForward: model.betaSync * decayFactor,
        decayFactor,
      });
    }

    forwardCurvesObj[`${model.modelId}:sync`] = forwards;
  }

  // Build ticker index
  const tickerIndex: Record<string, string> = {};
  for (const model of modelsArray) {
    tickerIndex[model.tickerSync.toUpperCase()] = model.modelId;
  }

  return {
    models: modelsArray,
    contextTiers,
    forwardCurves: forwardCurvesObj,
    tickerIndex,
    generated_at: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * Main execution
 */
function main() {
  console.log('[build-oracle] Pre-computing oracle state...');

  const state = precomputeOracleState();

  const outputPath = join(process.cwd(), 'src', 'api', 'oracle-state.json');
  writeFileSync(outputPath, JSON.stringify(state), 'utf-8');

  const forwardCount = Object.values(state.forwardCurves).reduce((sum, curves) => sum + curves.length, 0);
  console.log(`[build-oracle] Generated: ${state.models.length} models, ${forwardCount} forward curves`);
  console.log(`[build-oracle] Output: ${outputPath}`);
}

main();
