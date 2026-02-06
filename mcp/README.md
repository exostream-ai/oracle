# @exostream/mcp

MCP (Model Context Protocol) server for the [Exostream](https://exostream.ai) LLM pricing oracle.

Get real-time inference costs for Claude, GPT, Gemini, Grok, Mistral, DeepSeek and more — directly in your AI agent workflows.

## Installation

```bash
npm install -g @exostream/mcp
```

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "exostream": {
      "command": "npx",
      "args": ["@exostream/mcp"]
    }
  }
}
```

## Available Tools

### `get_spots`
Get current spot prices for all models or a specific provider.

```
Input: { provider?: "anthropic" | "openai" | "google" | "xai" | "mistral" | "deepseek" }
Output: Array of { model_id, ticker, beta_sync, beta_batch }
```

### `get_greeks`
Get full Greek sheet for a model including theta (price decay), sigma (volatility), and forward prices.

```
Input: { model_id: string }
Output: { model_id, ticker, beta_sync, beta_batch, theta, sigma, kappa, forwards: [...] }
```

### `price_task`
Calculate the cost of a specific inference task.

```
Input: {
  model_id: string,
  n_in: number,      // input tokens
  n_out: number,     // output tokens
  n_cache?: number,  // cached tokens (optional)
  eta?: number       // cache hit rate 0-1 (optional)
}
Output: { model_id, cost, breakdown: { input, output, cache_savings } }
```

### `compare_models`
Compare costs across all models for a given task profile.

```
Input: {
  n_in: number,
  n_out: number,
  n_cache?: number,
  eta?: number
}
Output: Array of { model_id, ticker, cost, provider } sorted by cost
```

## Examples

### Check current Opus pricing
```
get_greeks({ model_id: "opus-4.5" })
```

### Calculate cost for a coding task
```
price_task({
  model_id: "sonnet-4",
  n_in: 50000,
  n_out: 2000
})
```

### Find cheapest model for your workload
```
compare_models({
  n_in: 30000,
  n_out: 1000,
  eta: 0.5
})
```

## API

The MCP server connects to the public Exostream API at `https://api.exostream.ai`. No API key required.

## Links

- [Dashboard](https://exostream.ai) — Live pricing terminal
- [API Docs](https://exostream.ai/api-docs) — REST API documentation
- [Methodology](https://exostream.ai/methodology) — How we compute prices

## License

MIT
