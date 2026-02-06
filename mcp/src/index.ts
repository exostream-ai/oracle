#!/usr/bin/env node
/**
 * Exostream MCP Server
 *
 * Model Context Protocol server for the Exostream LLM pricing oracle.
 * Fetches real-time pricing data from https://api.exostream.ai
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = 'https://api.exostream.ai';

// Types
interface SpotData {
  model_id: string;
  ticker: string;
  display_name: string;
  provider: string;
  beta_sync: number;
  beta_batch: number | null;
  context_window: number;
}

interface GreekData extends SpotData {
  r_in: number;
  r_cache: number;
  r_think: number | null;
  r_batch: number | null;
  is_reasoning: boolean;
  theta: number;
  sigma: number;
}

// API helpers
async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Tools
const tools = [
  {
    name: 'get_spots',
    description: `Get current spot prices for LLM models from the Exostream oracle.

Returns ticker, provider, sync/batch prices, and context window.

Use this to:
- Check current pricing for models
- Compare prices across providers
- See which models have batch pricing`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        provider: {
          type: 'string',
          description: 'Filter by provider: anthropic, openai, google, xai, mistral, deepseek',
        },
      },
      required: [],
    },
    execute: async (args: { provider?: string }) => {
      const data = await fetchApi<SpotData[]>('/v1/spots');
      let models = data;
      if (args.provider) {
        models = data.filter(m => m.provider.toLowerCase() === args.provider!.toLowerCase());
      }
      return { models, count: models.length };
    },
  },
  {
    name: 'get_greeks',
    description: `Get complete Greek sheet for a model including theta and sigma.

Parameters returned:
- r_in: Input/output price ratio
- r_cache: Cache discount ratio
- r_think: Thinking token ratio (reasoning models)
- theta: Monthly price decay rate
- sigma: Realized monthly volatility

Use this to understand pricing structure and expected cost decay.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: {
          type: 'string',
          description: 'Model ID (e.g., "opus-4.5", "gpt-4.1", "gemini-2.5-pro")',
        },
      },
      required: ['model_id'],
    },
    execute: async (args: { model_id: string }) => {
      return fetchApi<GreekData>(`/v1/greeks/${args.model_id}`);
    },
  },
  {
    name: 'price_task',
    description: `Calculate the cost of an inference task.

Returns spot cost in USD, kappa (price sensitivity), and cache savings.

Formula: S = beta × [n_out + n_in × r_in_eff] × 10^-6

Kappa tells you how many times more expensive your task is vs pure output.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: {
          type: 'string',
          description: 'Model ID (e.g., "opus-4.5")',
        },
        n_in: {
          type: 'number',
          description: 'Input tokens (context)',
        },
        n_out: {
          type: 'number',
          description: 'Output tokens',
        },
        eta: {
          type: 'number',
          description: 'Cache hit ratio 0-1 (default: 0)',
        },
      },
      required: ['model_id', 'n_in', 'n_out'],
    },
    execute: async (args: { model_id: string; n_in: number; n_out: number; eta?: number }) => {
      const params = new URLSearchParams({
        n_in: args.n_in.toString(),
        n_out: args.n_out.toString(),
      });
      if (args.eta !== undefined) {
        params.set('eta', args.eta.toString());
      }
      return fetchApi<unknown>(`/v1/price/${args.model_id}?${params}`);
    },
  },
  {
    name: 'compare_models',
    description: `Compare all models for a task profile, ranked by cost.

Returns models sorted cheapest to most expensive that can handle the input size.

Use this to find the cheapest model for your workload.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        n_in: {
          type: 'number',
          description: 'Input tokens',
        },
        n_out: {
          type: 'number',
          description: 'Output tokens',
        },
        eta: {
          type: 'number',
          description: 'Cache hit ratio 0-1 (default: 0)',
        },
      },
      required: ['n_in', 'n_out'],
    },
    execute: async (args: { n_in: number; n_out: number; eta?: number }) => {
      const params = new URLSearchParams({
        n_in: args.n_in.toString(),
        n_out: args.n_out.toString(),
      });
      if (args.eta !== undefined) {
        params.set('eta', args.eta.toString());
      }
      return fetchApi<unknown>(`/v1/compare?${params}`);
    },
  },
];

// Create server
const server = new Server(
  { name: 'exostream', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find(t => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.execute(args as any);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
});

// Main
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Exostream MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
