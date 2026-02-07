/**
 * Oracle state singleton - cached in memory for fast API responses
 *
 * Loads from database on startup, or falls back to seed files.
 * Refreshes every 5 minutes.
 */

import { getClientOrNull } from '@/db/client.js';
import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '@/core/types.js';
import { logger } from '../core/logger.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let oracleState: OracleState | null = null;
let lastRefresh: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Seed data types
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

// Context tiers cache for seed data
const seedContextTiers = new Map<string, ContextTier[]>();

// Family lineage and theta/sigma defaults from single source of truth
import { FAMILY_LINEAGE as familyLineage, computeThetaFromHistory } from '../core/constants.js';



/**
 * Load data from seed JSON files
 */
function loadFromSeed(): OracleState {
  const seedDir = join(__dirname, '../../seed');

  const providers: SeedProvider[] = JSON.parse(
    readFileSync(join(seedDir, 'providers.json'), 'utf-8')
  );
  const families: SeedFamily[] = JSON.parse(
    readFileSync(join(seedDir, 'families.json'), 'utf-8')
  );
  const modelsData: SeedModel[] = JSON.parse(
    readFileSync(join(seedDir, 'models.json'), 'utf-8')
  );
  const prices: SeedPrice[] = JSON.parse(
    readFileSync(join(seedDir, 'historical_prices.json'), 'utf-8')
  );

  // Create lookups
  const providerMap = new Map(providers.map(p => [p.provider_id, p]));
  const familyMap = new Map(families.map(f => [f.family_id, f]));

  // Get latest price per model/type (use most recent by date)
  const latestPrices = new Map<string, { beta: number; date: Date }>();
  for (const price of prices) {
    const key = `${price.model_id}:${price.price_type}`;
    const priceDate = new Date(price.observed_at);
    const existing = latestPrices.get(key);
    if (!existing || priceDate > existing.date) {
      latestPrices.set(key, { beta: price.beta, date: priceDate });
    }
  }

  // Build models map with computed theta and sigma
  const models = new Map<string, GreekSheet>();
  for (const model of modelsData) {
    const family = familyMap.get(model.family_id);
    if (!family) continue;

    const provider = providerMap.get(family.provider_id);
    if (!provider) continue;

    const betaSyncEntry = latestPrices.get(`${model.model_id}:sync`);
    const betaBatchEntry = latestPrices.get(`${model.model_id}:batch`);
    const betaSync = betaSyncEntry?.beta;
    const betaBatch = betaBatchEntry?.beta;

    // Compute theta and sigma from historical data
    const { theta, sigma } = computeThetaFromHistory(prices, model.family_id);

    // Store context tiers
    seedContextTiers.set(
      model.model_id,
      model.tiers.map(t => ({
        tauStart: t.tau_start,
        tauEnd: t.tau_end,
        alpha: t.alpha,
      }))
    );

    models.set(model.model_id, {
      modelId: model.model_id,
      displayName: model.display_name,
      tickerSync: model.ticker_sync,
      tickerBatch: model.ticker_batch ?? undefined,
      providerName: provider.display_name,
      contextWindow: model.context_window,
      rIn: family.r_in,
      rCache: family.r_cache,
      rThink: family.r_think ?? undefined,
      rBatch: family.r_batch ?? undefined,
      isReasoning: family.is_reasoning,
      betaSync,
      betaBatch,
      theta,
      sigma,
    });
  }

  // Build forward curves using computed theta
  const forwardCurves = new Map<string, ForwardPrice[]>();
  const tenors = ['1M', '3M', '6M'] as const;
  const tenorMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };

  for (const [modelId, model] of models) {
    if (!model.betaSync) continue;

    const theta = model.theta ?? 0.05;
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
    models,
    forwardCurves,
    lastUpdate: new Date(),
    cacheAgeSeconds: 0,
  };
}

/**
 * Get the current oracle state, refreshing if stale
 */
export async function getOracleState(): Promise<OracleState> {
  const now = new Date();

  if (!oracleState || !lastRefresh || (now.getTime() - lastRefresh.getTime()) > CACHE_TTL_MS) {
    await refreshOracleState();
  }

  return oracleState!;
}

/**
 * Force refresh the oracle state from database or seed files
 */
export async function refreshOracleState(): Promise<void> {
  const oracleLogger = logger.child({ component: 'oracle' });
  const sql = getClientOrNull();

  if (!sql) {
    // No database - load from seed files
    oracleLogger.info('No database connection - loading from seed files');
    oracleState = loadFromSeed();
    lastRefresh = new Date();
    return;
  }

  // Load Greek sheet for all active models
  const greekRows = await sql`SELECT * FROM v_greek_sheet`;

  if (greekRows.length === 0) {
    // Database exists but no data - load from seed files
    oracleLogger.info('Database empty - loading from seed files');
    oracleState = loadFromSeed();
    lastRefresh = new Date();
    return;
  }

  const models = new Map<string, GreekSheet>();
  for (const row of greekRows) {
    models.set(row.model_id, {
      modelId: row.model_id,
      displayName: row.display_name,
      tickerSync: row.ticker_sync,
      tickerBatch: row.ticker_batch,
      providerName: row.provider_name,
      contextWindow: row.context_window,
      rIn: parseFloat(row.r_in),
      rCache: parseFloat(row.r_cache),
      rThink: row.r_think ? parseFloat(row.r_think) : undefined,
      rBatch: row.r_batch ? parseFloat(row.r_batch) : undefined,
      isReasoning: row.is_reasoning,
      betaSync: row.beta_sync ? parseFloat(row.beta_sync) : undefined,
      betaBatch: row.beta_batch ? parseFloat(row.beta_batch) : undefined,
      theta: row.theta ? parseFloat(row.theta) : undefined,
      sigma: row.sigma ? parseFloat(row.sigma) : undefined,
      familyPriorWeight: row.family_prior_weight ? parseFloat(row.family_prior_weight) : undefined,
    });
  }

  // Load forward curves
  const forwardRows = await sql`SELECT * FROM v_current_forwards`;

  const forwardCurves = new Map<string, ForwardPrice[]>();
  for (const row of forwardRows) {
    const key = `${row.model_id}:${row.price_type}`;
    if (!forwardCurves.has(key)) {
      forwardCurves.set(key, []);
    }
    forwardCurves.get(key)!.push({
      modelId: row.model_id,
      priceType: row.price_type,
      tenor: row.tenor,
      betaSpot: parseFloat(row.beta_spot),
      thetaUsed: parseFloat(row.theta_used),
      betaForward: parseFloat(row.beta_forward),
      decayFactor: parseFloat(row.decay_factor),
      computedAt: new Date(row.computed_at),
    });
  }

  oracleState = {
    models,
    forwardCurves,
    lastUpdate: new Date(),
    cacheAgeSeconds: 0,
  };

  lastRefresh = new Date();
}

/**
 * Get a single model's Greek sheet
 */
export async function getModelGreeks(modelId: string): Promise<GreekSheet | null> {
  const state = await getOracleState();
  return state.models.get(modelId) ?? null;
}

/**
 * Get model by ticker
 */
export async function getModelByTicker(ticker: string): Promise<GreekSheet | null> {
  const state = await getOracleState();
  for (const model of state.models.values()) {
    if (model.tickerSync === ticker || model.tickerBatch === ticker) {
      return model;
    }
  }
  return null;
}

/**
 * Get all models
 */
export async function getAllModels(): Promise<GreekSheet[]> {
  const state = await getOracleState();
  return Array.from(state.models.values());
}

/**
 * Get forward curve for a model
 */
export async function getForwardCurve(
  modelId: string,
  priceType: 'sync' | 'batch' = 'sync'
): Promise<ForwardPrice[]> {
  const state = await getOracleState();
  return state.forwardCurves.get(`${modelId}:${priceType}`) ?? [];
}

/**
 * Get context tiers for a model
 */
export async function getContextTiers(modelId: string): Promise<ContextTier[]> {
  // Check seed cache first
  const seedTiers = seedContextTiers.get(modelId);
  if (seedTiers) {
    return seedTiers;
  }

  const sql = getClientOrNull();
  if (!sql) {
    return [{ tauStart: 0, tauEnd: 1, alpha: 1 }];
  }

  const rows = await sql`
    SELECT tau_start, tau_end, alpha
    FROM v_active_tiers
    WHERE model_id = ${modelId}
    ORDER BY tier_index
  `;

  if (rows.length === 0) {
    return [{ tauStart: 0, tauEnd: 1, alpha: 1 }];
  }

  return rows.map(row => ({
    tauStart: parseFloat(row.tau_start),
    tauEnd: parseFloat(row.tau_end),
    alpha: parseFloat(row.alpha),
  }));
}

/**
 * Get cache age in seconds
 */
export function getCacheAge(): number {
  if (!lastRefresh) return 0;
  return Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
}

/**
 * Get oracle timestamp
 */
export function getOracleTimestamp(): Date {
  return oracleState?.lastUpdate ?? new Date();
}

// Cached seed data for history endpoint
let cachedSeedPrices: SeedPrice[] | null = null;
let cachedModelFamilies: Map<string, string> | null = null;

/**
 * Get historical prices from seed data
 */
export async function getHistoricalPrices(
  modelId: string,
  priceType: 'sync' | 'batch'
): Promise<Array<{ beta: number; timestamp: string; source: string; provenance: string }>> {
  const seedDir = join(__dirname, '../../seed');
  if (!cachedSeedPrices) {
    cachedSeedPrices = JSON.parse(
      readFileSync(join(seedDir, 'historical_prices.json'), 'utf-8')
    );
  }
  if (!cachedModelFamilies) {
    const modelsData: SeedModel[] = JSON.parse(
      readFileSync(join(seedDir, 'models.json'), 'utf-8')
    );
    cachedModelFamilies = new Map(modelsData.map(m => [m.model_id, m.family_id]));
  }

  // Get family lineage for this model
  const state = await getOracleState();
  const model = state.models.get(modelId);
  if (!model) return [];

  const familyId = cachedModelFamilies.get(modelId);

  // Get lineage models
  const lineageModels = familyId ? (familyLineage[familyId] || [familyId]) : [modelId];

  // Filter prices for this model's lineage
  const relevantPrices = cachedSeedPrices!
    .filter(p =>
      p.price_type === priceType &&
      (lineageModels.some(lm => p.model_id === lm || p.model_id.startsWith(lm + '-')) || p.model_id === modelId)
    )
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())
    .map(p => ({
      beta: p.beta,
      timestamp: p.observed_at,
      source: p.source,
      provenance: p.source.includes('historical') ? 'reconstructed' : 'live',
    }));

  return relevantPrices;
}
