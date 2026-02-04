/**
 * Oracle state singleton - cached in memory for fast API responses
 *
 * Loads from database on startup, refreshes every 5 minutes.
 */

import { getClientOrNull } from '@/db/client.js';
import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '@/core/types.js';

let oracleState: OracleState | null = null;
let lastRefresh: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Force refresh the oracle state from database
 */
export async function refreshOracleState(): Promise<void> {
  const sql = getClientOrNull();

  if (!sql) {
    // No database - create empty state
    oracleState = {
      models: new Map(),
      forwardCurves: new Map(),
      lastUpdate: new Date(),
      cacheAgeSeconds: 0,
    };
    lastRefresh = new Date();
    return;
  }

  // Load Greek sheet for all active models
  const greekRows = await sql`SELECT * FROM v_greek_sheet`;

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
