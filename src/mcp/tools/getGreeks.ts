/**
 * MCP Tool: get_greeks
 *
 * Get the full Greek sheet for all models or a specific model.
 */

import { getAllModels, getModelByTicker } from '@/api/oracle.js';

export const getGreeksTool = {
  name: 'get_greeks',
  description: `Get the complete Greek sheet for LLM pricing models from the Exostream oracle.

Returns structural Greeks (r_in, r_cache, r_think, r_batch) and extrinsic Greeks (θ, σ).

Key parameters:
- r_in: Input/output price ratio
- r_cache: Cache discount ratio
- r_think: Thinking token price ratio (reasoning models)
- θ (theta): Monthly price decay rate
- σ (sigma): Realized monthly volatility

Use this when you need to:
- Understand the pricing structure of a model
- Calculate expected cost decay over time
- Identify reasoning-capable models`,

  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Optional: specific ticker to query. If omitted, returns all models.',
      },
    },
    required: [],
  },

  async execute(args: { ticker?: string }) {
    if (args.ticker) {
      const model = await getModelByTicker(args.ticker.toUpperCase());
      if (!model) {
        return { error: `Model not found: ${args.ticker}` };
      }
      return {
        ticker: model.tickerSync,
        display_name: model.displayName,
        provider: model.providerName,
        beta_sync: model.betaSync,
        beta_batch: model.betaBatch,
        r_in: model.rIn,
        r_cache: model.rCache,
        r_think: model.rThink,
        r_batch: model.rBatch,
        is_reasoning: model.isReasoning,
        theta: model.theta,
        sigma: model.sigma,
        context_window: model.contextWindow,
      };
    }

    const models = await getAllModels();
    return {
      models: models.map(m => ({
        ticker: m.tickerSync,
        display_name: m.displayName,
        provider: m.providerName,
        beta_sync: m.betaSync,
        r_in: m.rIn,
        r_cache: m.rCache,
        r_think: m.rThink,
        is_reasoning: m.isReasoning,
        theta: m.theta,
        sigma: m.sigma,
      })),
      count: models.length,
    };
  },
};
