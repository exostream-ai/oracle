/**
 * Exostream Constants
 * Provider URLs, model registry, reference data
 */

import type { ContextTier } from './types.js';

// Default flat pricing tier (single tier, no multiplier)
export const FLAT_TIER: ContextTier[] = [
  { tauStart: 0, tauEnd: 1.0, alpha: 1.0 }
];

// Provider URLs
export const PROVIDER_URLS = {
  anthropic: {
    pricing: 'https://www.anthropic.com/pricing',
    docs: 'https://docs.anthropic.com/en/docs/about-claude/models',
    changelog: 'https://www.anthropic.com/news',
  },
  openai: {
    pricing: 'https://openai.com/api/pricing',
    docs: 'https://platform.openai.com/docs/models',
    changelog: 'https://openai.com/blog',
  },
  google: {
    pricing: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    docs: 'https://ai.google.dev/gemini-api/docs/models',
  },
  xai: {
    pricing: 'https://docs.x.ai/docs/models#models-and-pricing',
  },
  mistral: {
    pricing: 'https://mistral.ai/products/la-plateforme#pricing',
    docs: 'https://docs.mistral.ai/getting-started/models/',
  },
  deepseek: {
    pricing: 'https://api-docs.deepseek.com/quick_start/pricing',
  },
} as const;

// Forward curve tenors (months)
export const FORWARD_TENORS = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
} as const;

export type ForwardTenor = keyof typeof FORWARD_TENORS;

/**
 * Family lineage mapping for theta computation.
 * Maps current model families to their predecessor model IDs for price history.
 * Only includes direct lineage where price decreases are expected.
 */
export const FAMILY_LINEAGE: Record<string, string[]> = {
  'gpt-4.1': ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4.1'],
  'gpt-4o': ['gpt-4o'],
  'o-series': ['o-series'],
  'claude-4': ['claude-3-opus', 'opus-4.5', 'opus-4.6'],
  'claude-3.5': ['claude-3.5', 'sonnet-3.5', 'sonnet-4'],
  'claude-3': ['haiku-3', 'opus-3'],
  'gemini-2.5-pro': ['gemini-2.5-pro'],
  'gemini-2.5-flash': ['gemini-2.5-flash'],
  'gemini-2.0': ['gemini-2.0'],
  'grok-4': ['grok-3', 'grok-4'],
  'grok-4-fast': ['grok-3-mini', 'grok-4-fast'],
  'grok-3': ['grok-3'],
  'mistral-large': ['mistral-large'],
  'deepseek-v3': ['deepseek-v3'],
  'deepseek-r1': ['deepseek-r1'],
  'gpt-5': ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4.1', 'gpt-5', 'gpt-5.1', 'gpt-5.2'],
  'grok-4.1-fast': ['grok-3-mini', 'grok-4-fast', 'grok-4.1-fast'],
  'gemini-3-pro': ['gemini-1.5-pro', 'gemini-2.5-pro', 'gemini-3-pro'],
  'gemini-3-flash': ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3-flash'],
};

/**
 * Default theta values by family (monthly price decay rate).
 * Based on historical price trends in the LLM market.
 */
export const DEFAULT_THETA: Record<string, number> = {
  'gpt-4.1': 0.08,      // GPT-4 family aggressive decay: $60→$8 over 25mo
  'gpt-4o': 0.07,       // GPT-4o: $15→$10 over 5mo
  'o-series': 0.04,     // Reasoning models - newer, less history
  'claude-4': 0.05,     // Claude Opus: $75→$45 over 11mo
  'claude-3.5': 0.02,   // Sonnet stable since launch
  'claude-3': 0.02,     // Legacy Claude 3 models - stable pricing
  'gemini-2.5-pro': 0.06,
  'gemini-2.5-flash': 0.06,
  'gemini-2.0': 0.05,
  'grok-4': 0.03,       // Grok 4 - newer generation
  'grok-4-fast': 0.04,  // Grok 4 Fast variant
  'grok-3': 0.03,       // New, less history
  'mistral-large': 0.12, // Aggressive: $24→$12 over 5mo
  'deepseek-v3': 0.02,  // Already very cheap
  'deepseek-r1': 0.03,
  'gpt-5': 0.06,
  'grok-4.1-fast': 0.04,
  'gemini-3-pro': 0.06,
  'gemini-3-flash': 0.06,
};

export const DEFAULT_THETA_FALLBACK = 0.05;

/**
 * Default sigma values by family (monthly price volatility).
 */
export const DEFAULT_SIGMA: Record<string, number> = {
  'gpt-4.1': 0.12,
  'gpt-4o': 0.10,
  'o-series': 0.06,
  'claude-4': 0.08,
  'claude-3.5': 0.04,
  'claude-3': 0.04,
  'gemini-2.5-pro': 0.08,
  'gemini-2.5-flash': 0.08,
  'gemini-2.0': 0.06,
  'grok-4': 0.05,
  'grok-4-fast': 0.06,
  'grok-3': 0.05,
  'mistral-large': 0.15,
  'deepseek-v3': 0.03,
  'deepseek-r1': 0.04,
  'gpt-5': 0.10,
  'grok-4.1-fast': 0.06,
  'gemini-3-pro': 0.08,
  'gemini-3-flash': 0.08,
};

export const DEFAULT_SIGMA_FALLBACK = 0.06;

/** Lookup helpers */
export function getDefaultTheta(familyId: string): number {
  return DEFAULT_THETA[familyId] ?? DEFAULT_THETA_FALLBACK;
}

export function getDefaultSigma(familyId: string): number {
  return DEFAULT_SIGMA[familyId] ?? DEFAULT_SIGMA_FALLBACK;
}

/** Minimal price record needed for theta computation */
export interface PriceRecord {
  model_id: string;
  price_type: string;
  beta: number;
  observed_at: string;
}

/**
 * Compute theta and sigma from historical price data using log returns.
 * Uses exponentially weighted decay (lambda=0.85) with newer observations weighted more.
 */
export function computeThetaFromHistory(
  prices: PriceRecord[],
  familyId: string
): { theta: number; sigma: number } {
  const lineageModels = FAMILY_LINEAGE[familyId] || [familyId];

  const relevantPrices = prices
    .filter(p => {
      if (p.price_type !== 'sync') return false;
      return lineageModels.some(lm => {
        if (p.model_id === lm) return true;
        if (p.model_id.startsWith(lm + '-') && !p.model_id.includes('mini') && !p.model_id.includes('flash') && !p.model_id.includes('nano')) {
          return true;
        }
        return false;
      });
    })
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());

  if (relevantPrices.length < 2) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

  const logReturns: number[] = [];
  const timeDeltas: number[] = [];

  for (let i = 1; i < relevantPrices.length; i++) {
    const prevPrice = relevantPrices[i - 1].beta;
    const currPrice = relevantPrices[i].beta;
    const prevDate = new Date(relevantPrices[i - 1].observed_at);
    const currDate = new Date(relevantPrices[i].observed_at);

    const dtMonths = (currDate.getTime() - prevDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

    if (dtMonths > 0.5 && prevPrice > 0 && currPrice > 0) {
      const logReturn = Math.log(currPrice / prevPrice);
      logReturns.push(logReturn);
      timeDeltas.push(dtMonths);
    }
  }

  if (logReturns.length === 0) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

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
  theta = Math.max(0.01, Math.min(0.15, theta));

  const monthlyReturns = logReturns.map((lr, i) => lr / timeDeltas[i]);
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / monthlyReturns.length;
  let sigma = Math.sqrt(variance);
  sigma = Math.max(0.02, Math.min(0.25, sigma));

  return { theta, sigma };
}
