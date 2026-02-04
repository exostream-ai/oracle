/**
 * Exostream Core Pricing Functions
 * Based on the model specification v3.0
 * 
 * These functions implement the intrinsic pricing math for LLM inference.
 * The math is sacred - all 37 stress tests must pass.
 */

import type { ContextTier } from './types.js';

/**
 * Compute r_in_eff: the blended input rate after tiers + cache.
 * 
 * @param rIn - Input/output price ratio (from family Greeks)
 * @param rCache - Cache discount ratio (from family Greeks)
 * @param eta - Cache hit ratio (0 to 1)
 * @param nIn - Number of input tokens
 * @param W - Maximum context window size
 * @param tiers - Context pricing tiers (tau values are fractions of W)
 * @returns The effective input rate
 * 
 * Model spec section 1.3
 */
export function effectiveInputRate(
  rIn: number,
  rCache: number,
  eta: number,
  nIn: number,
  W: number,
  tiers: ContextTier[]
): number {
  // Edge case: no input tokens
  if (nIn === 0) {
    return 0.0;
  }

  // Step 1: distribute tokens across tiers and compute depth-weighted base rate
  let rInDepth = 0.0;
  
  for (const tier of tiers) {
    // Tokens falling in this tier:
    // n_k = min(n_in, tau_end * W) - min(n_in, tau_start * W)
    const tokensInTier = Math.max(
      0,
      Math.min(nIn, tier.tauEnd * W) - Math.min(nIn, tier.tauStart * W)
    );
    rInDepth += tokensInTier * tier.alpha * rIn;
  }
  rInDepth /= nIn;

  // Step 2: apply cache
  // r_in_eff = r_in_depth * (1 - eta) + r_cache * eta
  const rInEff = rInDepth * (1 - eta) + rCache * eta;

  return rInEff;
}

/**
 * Context cost multiplier / task delta to beta.
 * 
 * kappa is the context cost multiplier: for every dollar spent on output tokens,
 * how many additional dollars does context add? It also functions as the task's
 * delta - its sensitivity to ticker price movements.
 * 
 * @param nIn - Number of input tokens
 * @param nOut - Number of output tokens
 * @param rInEff - Effective input rate (from effectiveInputRate)
 * @returns kappa value
 * 
 * Model spec section 1.4
 */
export function kappa(
  nIn: number,
  nOut: number,
  rInEff: number
): number {
  // Edge case: zero output tokens
  if (nOut === 0) {
    return Infinity;
  }
  
  return 1 + (nIn / nOut) * rInEff;
}

/**
 * Spot cost in USD.
 * 
 * S(T, M) = beta * [n_out + n_in * r_in_eff + n_think * r_think] * 10^-6
 * 
 * @param beta - Ticker price ($/M output tokens)
 * @param nOut - Number of output tokens
 * @param nIn - Number of input tokens
 * @param rInEff - Effective input rate
 * @param nThink - Number of thinking tokens (optional, for reasoning models)
 * @param rThink - Thinking token ratio (optional)
 * @returns Spot cost in USD
 * 
 * Model spec section 1.6
 */
export function spotCost(
  beta: number,
  nOut: number,
  nIn: number,
  rInEff: number,
  nThink: number = 0,
  rThink: number = 0
): number {
  return beta * (nOut + nIn * rInEff + nThink * rThink) * 1e-6;
}

/**
 * Forward ticker price.
 * 
 * beta_fwd(M, t) = beta(M) * e^(-theta(M) * t)
 * 
 * @param beta - Current spot price
 * @param theta - Monthly decay rate
 * @param t - Forward time horizon in months
 * @returns Forward price at horizon t
 * 
 * Model spec section 2.4
 */
export function forwardPrice(
  beta: number,
  theta: number,
  t: number
): number {
  return beta * Math.exp(-theta * t);
}

/**
 * Decay factor D(t).
 * 
 * D(M, t) = e^(-theta(M) * t)
 * 
 * @param theta - Monthly decay rate
 * @param t - Forward time horizon in months
 * @returns Decay factor
 * 
 * Model spec section 2.3
 */
export function decayFactor(
  theta: number,
  t: number
): number {
  return Math.exp(-theta * t);
}

/**
 * Compute full pricing result for a task profile.
 * 
 * @param params - Model pricing parameters
 * @param task - Task profile (nIn, nOut, eta, etc.)
 * @returns Complete pricing result
 */
export function priceTask(
  params: {
    beta: number;
    rIn: number;
    rCache: number;
    rThink?: number;
    W: number;
    tiers: ContextTier[];
    theta?: number;
  },
  task: {
    nIn: number;
    nOut: number;
    nThink?: number;
    eta?: number;
    horizonMonths?: number;
  }
): {
  spotCost: number;
  kappa: number;
  rInEff: number;
  forwardCost?: number;
  betaForward?: number;
  decayFactor?: number;
} {
  const eta = task.eta ?? 0;
  const nThink = task.nThink ?? 0;
  const rThink = params.rThink ?? 0;
  
  const rInEff = effectiveInputRate(
    params.rIn,
    params.rCache,
    eta,
    task.nIn,
    params.W,
    params.tiers
  );
  
  const k = kappa(task.nIn, task.nOut, rInEff);
  const S = spotCost(params.beta, task.nOut, task.nIn, rInEff, nThink, rThink);
  
  const result: ReturnType<typeof priceTask> = {
    spotCost: S,
    kappa: k,
    rInEff,
  };
  
  if (task.horizonMonths !== undefined && params.theta !== undefined) {
    const D = decayFactor(params.theta, task.horizonMonths);
    result.forwardCost = S * D;
    result.betaForward = forwardPrice(params.beta, params.theta, task.horizonMonths);
    result.decayFactor = D;
  }
  
  return result;
}
