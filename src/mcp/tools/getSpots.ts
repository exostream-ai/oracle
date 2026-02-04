/**
 * MCP Tool: get_spots
 *
 * Get current spot prices for all tracked models or a specific model.
 */

import { getAllModels, getModelByTicker } from '@/api/oracle.js';

export const getSpotsTool = {
  name: 'get_spots',
  description: `Get current spot prices (β) for LLM inference models from the Exostream oracle.

Returns the ticker, provider, current sync and batch prices, and context window for each model.

Use this when you need to know:
- Current pricing for a specific model
- Compare prices across providers
- Check if a model has batch pricing available`,

  inputSchema: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Optional: specific ticker to query (e.g., "OPUS-4.5", "GPT-4.1"). If omitted, returns all models.',
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
        ticker_batch: model.tickerBatch,
        display_name: model.displayName,
        provider: model.providerName,
        beta_sync: model.betaSync,
        beta_batch: model.betaBatch,
        context_window: model.contextWindow,
      };
    }

    const models = await getAllModels();
    return {
      models: models.map(m => ({
        ticker: m.tickerSync,
        ticker_batch: m.tickerBatch,
        display_name: m.displayName,
        provider: m.providerName,
        beta_sync: m.betaSync,
        beta_batch: m.betaBatch,
        context_window: m.contextWindow,
      })),
      count: models.length,
    };
  },
};
