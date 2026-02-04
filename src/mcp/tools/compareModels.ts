/**
 * MCP Tool: compare_models
 *
 * Compare all models for a given task profile, ranked by cost.
 */

import { getAllModels, getContextTiers } from '@/api/oracle.js';
import { effectiveInputRate, kappa, spotCost } from '@/core/pricing.js';

export const compareModelsTool = {
  name: 'compare_models',
  description: `Compare all LLM models for a given task profile, ranked by cost.

Returns all models that can handle the task (input fits in context window), sorted from cheapest to most expensive.

Use this when you need to:
- Find the cheapest model for a specific task
- Compare costs across providers
- Understand the cost range for different capability levels`,

  inputSchema: {
    type: 'object',
    properties: {
      n_in: {
        type: 'number',
        description: 'Number of input tokens',
      },
      n_out: {
        type: 'number',
        description: 'Number of output tokens',
      },
      n_think: {
        type: 'number',
        description: 'Number of thinking tokens (only for reasoning models). Default: 0',
      },
      eta: {
        type: 'number',
        description: 'Cache hit ratio (0-1). Default: 0',
      },
    },
    required: ['n_in', 'n_out'],
  },

  async execute(args: {
    n_in: number;
    n_out: number;
    n_think?: number;
    eta?: number;
  }) {
    const nIn = args.n_in;
    const nOut = args.n_out;
    const nThink = args.n_think ?? 0;
    const eta = args.eta ?? 0;

    const models = await getAllModels();

    const results = await Promise.all(
      models.map(async model => {
        const beta = model.betaSync;
        if (beta === undefined) return null;

        // Skip if input exceeds context window
        if (nIn > model.contextWindow) return null;

        const tiers = await getContextTiers(model.modelId);
        const W = model.contextWindow;
        const rIn = model.rIn;
        const rCache = model.rCache;
        const rThink = model.rThink ?? 0;

        const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);
        const k = kappa(nIn, nOut, rInEff);

        // Only add think tokens if model supports reasoning
        const actualNThink = model.isReasoning ? nThink : 0;
        const S = spotCost(beta, nOut, nIn, rInEff, actualNThink, rThink);

        return {
          ticker: model.tickerSync,
          display_name: model.displayName,
          provider: model.providerName,
          spot_cost_usd: S,
          kappa: k,
          beta: beta,
          is_reasoning: model.isReasoning,
        };
      })
    );

    const validResults = results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.spot_cost_usd - b.spot_cost_usd);

    return {
      task_profile: {
        n_in: nIn,
        n_out: nOut,
        n_think: nThink,
        eta,
      },
      models: validResults,
      cheapest: validResults[0]?.ticker,
      most_expensive: validResults[validResults.length - 1]?.ticker,
      count: validResults.length,
    };
  },
};
