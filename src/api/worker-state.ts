/**
 * Oracle state initialization and management for Cloudflare Worker
 * Extracted from worker.ts to enable modular route/middleware structure
 */

import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '../core/types.js';
import { computeThetaFromHistory, FAMILY_LINEAGE as familyLineage } from '../core/constants.js';
import providers from '../../seed/providers.json';
import families from '../../seed/families.json';
import models from '../../seed/models.json';
import historicalPrices from '../../seed/historical_prices.json';
import type { SeedModel, SeedFamily, SeedProvider, SeedPrice } from './worker-types.js';

// Module-scope state variables (mutable, exported)
export let oracleState: OracleState;
export let tickerIndex: Map<string, GreekSheet>;
export let modelContextTiers: Map<string, ContextTier[]>;

// Re-export seed data for route handlers
export { familyLineage, historicalPrices };
export const seedModels = models;

/**
 * Generate a cryptographically secure API key
 */
export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [];
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  let byteIdx = 0;
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 8; i++) {
      segment += chars[randomBytes[byteIdx++] % chars.length];
    }
    segments.push(segment);
  }
  return `exo_${segments.join('_')}`;
}

/**
 * Build oracle state from seed data (internal helper)
 */
function buildOracleState(): OracleState {
  const providerMap = new Map((providers as SeedProvider[]).map(p => [p.provider_id, p]));
  const familyMap = new Map((families as SeedFamily[]).map(f => [f.family_id, f]));
  const prices = historicalPrices as SeedPrice[];

  const latestPrices = new Map<string, { beta: number; date: Date }>();
  for (const price of prices) {
    const key = `${price.model_id}:${price.price_type}`;
    const priceDate = new Date(price.observed_at);
    const existing = latestPrices.get(key);
    if (!existing || priceDate > existing.date) {
      latestPrices.set(key, { beta: price.beta, date: priceDate });
    }
  }

  const modelsMap = new Map<string, GreekSheet>();
  const seedContextTiers = new Map<string, ContextTier[]>();

  for (const model of models as SeedModel[]) {
    const family = familyMap.get(model.family_id);
    if (!family) continue;

    const provider = providerMap.get(family.provider_id);
    const syncPrice = latestPrices.get(`${model.model_id}:sync`);
    const batchPrice = latestPrices.get(`${model.model_id}:batch`);
    const { theta, sigma } = computeThetaFromHistory(prices, model.family_id);

    if (model.tiers && model.tiers.length > 0) {
      seedContextTiers.set(model.model_id, model.tiers.map(t => ({
        tauStart: t.tau_start,
        tauEnd: t.tau_end,
        alpha: t.alpha,
      })));
    }

    // Expose tiers to module scope for pricing endpoints
    modelContextTiers = seedContextTiers;

    modelsMap.set(model.model_id, {
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
  const forwardCurves = new Map<string, ForwardPrice[]>();
  const tenors = ['1M', '3M', '6M'] as const;
  const tenorMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };

  for (const [modelId, model] of modelsMap) {
    if (!model.betaSync || !model.theta) continue;

    const theta = model.theta;
    const forwards: ForwardPrice[] = [];

    for (const tenor of tenors) {
      const t = tenorMonths[tenor];
      const decayFactor = Math.exp(-theta * t);
      forwards.push({
        modelId,
        priceType: 'sync',
        tenor,
        betaSpot: model.betaSync,
        thetaUsed: theta,
        betaForward: model.betaSync * decayFactor,
        decayFactor,
        computedAt: new Date(),
      });
    }

    forwardCurves.set(`${modelId}:sync`, forwards);
  }

  return {
    models: modelsMap,
    forwardCurves,
    lastUpdate: new Date(),
    cacheAgeSeconds: 0,
  };
}

/**
 * Initialize oracle state at module load (cold start)
 */
export function initializeOracleState() {
  oracleState = buildOracleState();
  tickerIndex = new Map();
  for (const model of oracleState.models.values()) {
    tickerIndex.set(model.tickerSync.toUpperCase(), model);
  }
}

// Initialize at module load (cold start)
initializeOracleState();
