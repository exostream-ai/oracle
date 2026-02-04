/**
 * MCP Tool: price_task
 *
 * Calculate the cost of an inference task for a specific model.
 */

import { getModelByTicker, getModelGreeks, getContextTiers } from '@/api/oracle.js';
import { effectiveInputRate, kappa, spotCost, forwardPrice, decayFactor } from '@/core/pricing.js';

export const priceTaskTool = {
  name: 'price_task',
  description: `Calculate the cost of an LLM inference task using the Exostream pricing oracle.

Returns:
- Spot cost in USD
- κ (kappa): context cost multiplier / price sensitivity
- r_in_eff: effective input rate after cache
- Forward cost at specified horizon (optional)
- Cache savings if η > 0

The formula: S = β × [n_out + n_in × r_in_eff + n_think × r_think] × 10⁻⁶

κ tells you how many times more expensive your task is compared to pure output.
A κ of 4.5 means you're 4.5× exposed to price movements.`,

  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'Ticker or model_id (e.g., "OPUS-4.5", "gpt-4.1")',
      },
      n_in: {
        type: 'number',
        description: 'Number of input tokens (context)',
      },
      n_out: {
        type: 'number',
        description: 'Number of output tokens',
      },
      n_think: {
        type: 'number',
        description: 'Number of thinking tokens (for reasoning models). Default: 0',
      },
      eta: {
        type: 'number',
        description: 'Cache hit ratio (0-1). Default: 0',
      },
      horizon_months: {
        type: 'number',
        description: 'Forward horizon in months for forward cost calculation. If omitted, only spot is returned.',
      },
    },
    required: ['model', 'n_in', 'n_out'],
  },

  async execute(args: {
    model: string;
    n_in: number;
    n_out: number;
    n_think?: number;
    eta?: number;
    horizon_months?: number;
  }) {
    // Find model
    let model = await getModelByTicker(args.model.toUpperCase());
    if (!model) {
      model = await getModelGreeks(args.model);
    }
    if (!model) {
      return { error: `Model not found: ${args.model}` };
    }

    const beta = model.betaSync;
    if (beta === undefined) {
      return { error: 'No spot price available for model' };
    }

    // Get params
    const tiers = await getContextTiers(model.modelId);
    const nIn = args.n_in;
    const nOut = args.n_out;
    const nThink = args.n_think ?? 0;
    const eta = args.eta ?? 0;
    const W = model.contextWindow;
    const rIn = model.rIn;
    const rCache = model.rCache;
    const rThink = model.rThink ?? 0;
    const theta = model.theta ?? 0.05;

    // Calculate
    const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);
    const k = kappa(nIn, nOut, rInEff);
    const S = spotCost(beta, nOut, nIn, rInEff, nThink, rThink);

    const result: Record<string, unknown> = {
      model: model.tickerSync,
      display_name: model.displayName,
      spot_cost_usd: S,
      kappa: k,
      r_in_eff: rInEff,
      beta_used: beta,
      task_profile: {
        n_in: nIn,
        n_out: nOut,
        n_think: nThink,
        eta,
      },
    };

    // Forward cost if horizon specified
    if (args.horizon_months !== undefined && args.horizon_months > 0) {
      const D = decayFactor(theta, args.horizon_months);
      result.forward = {
        horizon_months: args.horizon_months,
        cost_usd: S * D,
        beta_forward: forwardPrice(beta, theta, args.horizon_months),
        theta_used: theta,
        decay_factor: D,
      };
    }

    // Cache value
    if (eta > 0) {
      const rInEffNoCache = effectiveInputRate(rIn, rCache, 0, nIn, W, tiers);
      const SNoCache = spotCost(beta, nOut, nIn, rInEffNoCache, nThink, rThink);
      result.cache_savings = {
        cost_without_cache_usd: SNoCache,
        savings_usd: SNoCache - S,
        savings_pct: ((SNoCache - S) / SNoCache) * 100,
      };
    }

    return result;
  },
};
