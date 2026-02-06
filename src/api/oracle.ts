/**
 * Oracle state singleton - cached in memory for fast API responses
 *
 * Loads from database on startup, or falls back to seed files.
 * Refreshes every 5 minutes.
 */

import { getClientOrNull } from '@/db/client.js';
import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '@/core/types.js';
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

// Family lineage mapping for theta computation
// Maps current model families to their predecessor families for price history
// Only include direct lineage where price decreases are expected
const familyLineage: Record<string, string[]> = {
  'gpt-4.1': ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4.1'],  // Clear $60→$8 history
  'gpt-4o': ['gpt-4o'],  // Only GPT-4o itself (has $15→$10 drop)
  'o-series': ['o-series'],  // New, use defaults
  'claude-4': ['claude-3-opus', 'opus-4.5', 'opus-4.6'],  // $75→$45→$25 decline
  'claude-3.5': ['claude-3.5', 'sonnet-3.5', 'sonnet-4'],
  'gemini-2.5-pro': ['gemini-2.5-pro'],  // Separate from Flash
  'gemini-2.5-flash': ['gemini-2.5-flash'],  // Separate from Pro
  'gemini-2.0': ['gemini-2.0'],
  'grok-4': ['grok-3', 'grok-4'],
  'grok-4-fast': ['grok-3-mini', 'grok-4-fast'],
  'grok-3': ['grok-3'],
  'mistral-large': ['mistral-large'],  // Has $24→$12 history
  'deepseek-v3': ['deepseek-v3'],
  'deepseek-r1': ['deepseek-r1'],
};

/**
 * Compute theta from price history using log returns
 */
function computeThetaFromHistory(
  prices: SeedPrice[],
  familyId: string,
  modelId: string
): { theta: number; sigma: number } {
  // Get lineage models to include in history
  const lineageModels = familyLineage[familyId] || [familyId];

  // Collect all sync prices for the lineage, sorted by date
  // IMPORTANT: Only include prices that are from the SAME tier of model
  // (i.e., flagship models, not mixing Pro and Flash prices)
  const relevantPrices = prices
    .filter(p => {
      if (p.price_type !== 'sync') return false;
      // Check if model_id matches any lineage pattern exactly or with version suffix
      return lineageModels.some(lm => {
        // Match exact model_id or versioned variants (e.g., gpt-4, gpt-4-turbo)
        // But NOT different model tiers (e.g., don't mix Pro and Flash)
        if (p.model_id === lm) return true;
        if (p.model_id.startsWith(lm + '-') && !p.model_id.includes('mini') && !p.model_id.includes('flash') && !p.model_id.includes('nano')) {
          return true;
        }
        return false;
      });
    })
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());

  // Need at least 2 data points to compute theta
  if (relevantPrices.length < 2) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

  // Compute log returns between consecutive observations
  const logReturns: number[] = [];
  const timeDeltas: number[] = []; // in months

  for (let i = 1; i < relevantPrices.length; i++) {
    const prevPrice = relevantPrices[i - 1].beta;
    const currPrice = relevantPrices[i].beta;
    const prevDate = new Date(relevantPrices[i - 1].observed_at);
    const currDate = new Date(relevantPrices[i].observed_at);

    // Time difference in months
    const dtMonths = (currDate.getTime() - prevDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

    if (dtMonths > 0.5 && prevPrice > 0 && currPrice > 0) { // At least ~2 weeks between observations
      const logReturn = Math.log(currPrice / prevPrice);
      logReturns.push(logReturn);
      timeDeltas.push(dtMonths);
    }
  }

  if (logReturns.length === 0) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

  // Compute theta: weighted average of -logReturn / dt (newer observations weighted more)
  const lambda = 0.85;
  let weightedTheta = 0;
  let totalWeight = 0;

  for (let i = 0; i < logReturns.length; i++) {
    const weight = Math.pow(lambda, logReturns.length - 1 - i);
    const thetaObs = -logReturns[i] / timeDeltas[i];
    weightedTheta += weight * thetaObs;
    totalWeight += weight;
  }

  let theta = weightedTheta / totalWeight;

  // Clamp theta to reasonable range (1% to 15% per month)
  theta = Math.max(0.01, Math.min(0.15, theta));

  // Compute sigma: standard deviation of monthly log returns
  const monthlyReturns = logReturns.map((lr, i) => lr / timeDeltas[i]); // normalize to monthly
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / monthlyReturns.length;
  let sigma = Math.sqrt(variance);

  // Clamp sigma to reasonable range (2% to 25% per month)
  sigma = Math.max(0.02, Math.min(0.25, sigma));

  return { theta, sigma };
}

/**
 * Default theta values by family
 * Based on historical price trends in the LLM market
 */
function getDefaultTheta(familyId: string): number {
  const defaults: Record<string, number> = {
    'gpt-4.1': 0.08,      // GPT-4 family has aggressive decay: $60→$8 over 25mo
    'gpt-4o': 0.07,       // GPT-4o: $15→$10 over 5mo
    'o-series': 0.04,     // Reasoning models - newer, less history
    'claude-4': 0.05,     // Claude Opus: $75→$45 over 11mo
    'claude-3.5': 0.02,   // Sonnet stable since launch
    'gemini-2.5-pro': 0.06,   // Google tends to be aggressive on pricing
    'gemini-2.5-flash': 0.06,
    'gemini-2.0': 0.05,
    'grok-3': 0.03,       // New, less history
    'mistral-large': 0.12, // Aggressive: $24→$12 over 5mo
    'deepseek-v3': 0.02,  // Already very cheap
    'deepseek-r1': 0.03,
  };
  return defaults[familyId] ?? 0.05;
}

/**
 * Default sigma values by family
 * Monthly price volatility
 */
function getDefaultSigma(familyId: string): number {
  const defaults: Record<string, number> = {
    'gpt-4.1': 0.12,      // Moderate volatility
    'gpt-4o': 0.10,
    'o-series': 0.06,
    'claude-4': 0.08,
    'claude-3.5': 0.04,
    'gemini-2.5-pro': 0.08,
    'gemini-2.5-flash': 0.08,
    'gemini-2.0': 0.06,
    'grok-3': 0.05,
    'mistral-large': 0.15, // Higher volatility due to repricing
    'deepseek-v3': 0.03,
    'deepseek-r1': 0.04,
  };
  return defaults[familyId] ?? 0.06;
}

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
    const { theta, sigma } = computeThetaFromHistory(prices, model.family_id, model.model_id);

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
  const sql = getClientOrNull();

  if (!sql) {
    // No database - load from seed files
    console.log('No database connection - loading from seed files');
    oracleState = loadFromSeed();
    lastRefresh = new Date();
    return;
  }

  // Load Greek sheet for all active models
  const greekRows = await sql`SELECT * FROM v_greek_sheet`;

  if (greekRows.length === 0) {
    // Database exists but no data - load from seed files
    console.log('Database empty - loading from seed files');
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

// Cached seed prices for history endpoint
let cachedSeedPrices: SeedPrice[] | null = null;

/**
 * Get historical prices from seed data
 */
export async function getHistoricalPrices(
  modelId: string,
  priceType: 'sync' | 'batch'
): Promise<Array<{ beta: number; timestamp: string; source: string; provenance: string }>> {
  if (!cachedSeedPrices) {
    const seedDir = join(__dirname, '../../seed');
    cachedSeedPrices = JSON.parse(
      readFileSync(join(seedDir, 'historical_prices.json'), 'utf-8')
    );
  }

  // Get family lineage for this model
  const state = await getOracleState();
  const model = state.models.get(modelId);
  if (!model) return [];

  // Get family from models.json
  const seedDir = join(__dirname, '../../seed');
  const modelsData: SeedModel[] = JSON.parse(
    readFileSync(join(seedDir, 'models.json'), 'utf-8')
  );
  const modelInfo = modelsData.find(m => m.model_id === modelId);
  const familyId = modelInfo?.family_id;

  // Get lineage models
  const lineageModels = familyId ? (familyLineage[familyId] || [familyId]) : [modelId];

  // Filter prices for this model's lineage
  const relevantPrices = cachedSeedPrices!
    .filter(p =>
      p.price_type === priceType &&
      (lineageModels.some(lm => p.model_id.includes(lm)) || p.model_id === modelId)
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
