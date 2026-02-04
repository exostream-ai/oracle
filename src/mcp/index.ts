/**
 * Exostream MCP Server
 *
 * Model Context Protocol server exposing the pricing oracle to AI agents.
 *
 * Tools:
 * - get_spots: Get current spot prices
 * - get_greeks: Get full Greek sheet
 * - price_task: Calculate task cost
 * - compare_models: Compare all models for a task
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';

import { getSpotsTool } from './tools/getSpots.js';
import { getGreeksTool } from './tools/getGreeks.js';
import { priceTaskTool } from './tools/priceTask.js';
import { compareModelsTool } from './tools/compareModels.js';
import { refreshOracleState } from '@/api/oracle.js';

// All tools
const tools = [getSpotsTool, getGreeksTool, priceTaskTool, compareModelsTool];

// Create server
const server = new Server(
  {
    name: 'exostream',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

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
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

// Main entry point
async function main() {
  // Initialize oracle state
  console.error('Initializing Exostream oracle...');
  await refreshOracleState();
  console.error('Oracle state loaded');

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);
  console.error('Exostream MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { server };
