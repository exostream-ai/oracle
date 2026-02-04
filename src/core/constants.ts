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
