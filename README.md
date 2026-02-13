# Exostream Oracle

The pricing oracle for LLM inference. Spot prices, Greeks, and forward curves for AI model costs.

Exostream tracks real-time pricing across 37 models from 6 providers and models API costs like financial instruments. Get spot prices, price drift (theta), volatility (sigma), and projected forward curves for any model. Built for developers who need accurate cost estimation and model comparison for production LLM deployments.

## Live API Examples

### Get Spot Prices

```bash
curl https://api.exostream.ai/v1/spots
```

```json
{
  "data": [
    {
      "ticker": "OPUS-4.6",
      "ticker_batch": "OPUS-4.6.B",
      "model_id": "opus-4.6",
      "display_name": "Claude Opus 4.6",
      "provider": "Anthropic",
      "beta_sync": 25,
      "beta_batch": 12.5,
      "context_window": 1000000
    },
    {
      "ticker": "SONNET-4",
      "ticker_batch": "SONNET-4.B",
      "model_id": "sonnet-4",
      "display_name": "Claude Sonnet 4",
      "provider": "Anthropic",
      "beta_sync": 15,
      "beta_batch": 7.5,
      "context_window": 200000
    },
    {
      "ticker": "GPT-4.1",
      "ticker_batch": "GPT-4.1.B",
      "model_id": "gpt-4.1",
      "display_name": "GPT-4.1",
      "provider": "OpenAI",
      "beta_sync": 8,
      "beta_batch": 4,
      "context_window": 1000000
    },
    {
      "ticker": "GEMINI-2.5-PRO",
      "ticker_batch": "GEMINI-2.5-PRO.B",
      "model_id": "gemini-2.5-pro",
      "display_name": "Gemini 2.5 Pro",
      "provider": "Google",
      "beta_sync": 10,
      "beta_batch": 5,
      "context_window": 1000000
    }
  ],
  "oracle_timestamp": "2026-02-13T21:54:05.561Z",
  "cache_age_seconds": 0
}
```

**Fields:**
- `beta_sync`: Spot price per million output tokens (synchronous API)
- `beta_batch`: Spot price per million output tokens (batch API)
- `context_window`: Maximum context length in tokens
- `oracle_timestamp`: When prices were last updated

### Price a Specific Task

```bash
curl -X POST https://api.exostream.ai/v1/price \
  -H "Content-Type: application/json" \
  -d '{
    "model": "SONNET-4",
    "n_in": 30000,
    "n_out": 800,
    "eta": 0.6
  }'
```

```json
{
  "data": {
    "model": "SONNET-4",
    "display_name": "Claude Sonnet 4",
    "spot_cost": 0.0534,
    "kappa": 4.45,
    "r_in_eff": 0.092,
    "beta_used": 15,
    "task_profile": {
      "n_in": 30000,
      "n_out": 800,
      "n_think": 0,
      "eta": 0.6
    },
    "cache_value": {
      "cost_without_cache": 0.102,
      "savings": 0.0486,
      "savings_pct": 47.65
    }
  },
  "oracle_timestamp": "2026-02-13T21:54:07.718Z",
  "cache_age_seconds": 0
}
```

**Fields:**
- `spot_cost`: Total cost in USD for this task
- `kappa`: Cost-efficiency score (output tokens per cent)
- `eta`: Cache hit rate (0.0 = no cache, 1.0 = full cache)
- `cache_value.savings`: Dollar savings from prompt caching
- `r_in_eff`: Effective input price ratio after caching

### Compare Models for a Task

```bash
curl -X POST https://api.exostream.ai/v1/compare \
  -H "Content-Type: application/json" \
  -d '{
    "models": ["SONNET-4", "GPT-4.1", "GEMINI-2.5-PRO", "GROK-4", "MISTRAL-LARGE"],
    "n_in": 30000,
    "n_out": 800,
    "eta": 0.6
  }'
```

```json
{
  "data": {
    "task_profile": {
      "n_in": 30000,
      "n_out": 800,
      "n_think": 0,
      "eta": 0.6
    },
    "models": [
      {
        "ticker": "GEMINI-2.5-PRO",
        "display_name": "Gemini 2.5 Pro",
        "provider": "Google",
        "spot_cost": 0.0252,
        "kappa": 3.16,
        "beta": 10
      },
      {
        "ticker": "MISTRAL-LARGE",
        "display_name": "Mistral Large",
        "provider": "Mistral",
        "spot_cost": 0.0342,
        "kappa": 7.12,
        "beta": 6
      },
      {
        "ticker": "GPT-4.1",
        "display_name": "GPT-4.1",
        "provider": "OpenAI",
        "spot_cost": 0.0394,
        "kappa": 6.16,
        "beta": 8
      },
      {
        "ticker": "SONNET-4",
        "display_name": "Claude Sonnet 4",
        "provider": "Anthropic",
        "spot_cost": 0.0534,
        "kappa": 4.45,
        "beta": 15
      },
      {
        "ticker": "GROK-4",
        "display_name": "Grok 4",
        "provider": "xAI",
        "spot_cost": 0.0615,
        "kappa": 5.13,
        "beta": 15
      }
    ],
    "cheapest": "GEMINI-2.5-PRO",
    "most_expensive": "GROK-4"
  }
}
```

**Sorted by cost (cheapest first).** Compare any combination of models for your exact workload.

## What It Does

- **Tracks 37+ models across 6 providers** - Anthropic, OpenAI, Google, xAI, Mistral, DeepSeek
- **Models API pricing like financial instruments** - spot prices, Greeks (theta/sigma), forward curves, and cost-efficiency metrics
- **Updates daily via automated scrapers** - keeps pricing data current with provider changes
- **Free public API** - no auth required, rate limited to fair use
- **Live dashboard** - visual model comparison and price trends at [exostream.ai](https://exostream.ai)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXOSTREAM ORACLE                         │
└─────────────────────────────────────────────────────────────────┘

  Data Layer                 Compute Layer              API Layer
┌─────────────┐           ┌──────────────┐         ┌──────────────┐
│   Scrapers  │──────────>│   Pricing    │────────>│   REST API   │
│   (Cron)    │           │    Engine    │         │ (Cloudflare  │
│             │           │              │         │   Workers)   │
│ • Anthropic │           │ • Core math  │         │              │
│ • OpenAI    │           │ • Greeks     │         │ api.exo      │
│ • Google    │           │ • Forwards   │         │ stream.ai    │
│ • xAI       │           │ • Kappa      │         │              │
│ • Mistral   │           │ • Cache      │         └──────┬───────┘
│ • DeepSeek  │           │   modeling   │                │
└──────┬──────┘           └──────┬───────┘                │
       │                         │                        │
       v                         v                        v
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare KV Store (Seed Data)                    │
│  • providers.json  • families.json  • models.json               │
│  • historical_prices.json                                       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    v             v             v
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │Dashboard │  │   MCP    │  │  Direct  │
            │   UI     │  │  Server  │  │API Users │
            │exostream │  │  Tools   │  │          │
            │  .ai     │  └──────────┘  └──────────┘
            └──────────┘
```

## Supported Models

| Provider   | Models                                                                 | Spot Range ($/M output) |
|------------|------------------------------------------------------------------------|-------------------------|
| Anthropic  | Opus 4.6, Opus 4.5, Opus 4.1, Opus 4, Sonnet 4.5, Sonnet 4, Sonnet 3.7, Sonnet 3.5, Haiku 4.5, Haiku 3.5, Haiku 3, Opus 3 | $1.25 - $75            |
| OpenAI     | GPT-4.1, GPT-4.1 mini, GPT-4.1 nano, GPT-4o, GPT-4o mini, o3, o3-mini, o4-mini, GPT-5, GPT-5.1, GPT-5.2, GPT-5 mini | $0.40 - $14            |
| Google     | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 3 Pro, Gemini 3 Flash | $0.40 - $12            |
| xAI        | Grok 4, Grok 4 Fast, Grok 3, Grok 3 mini, Grok 4.1 Fast               | $0.50 - $15            |
| Mistral    | Mistral Large                                                          | $6.00                  |
| DeepSeek   | DeepSeek V3, DeepSeek R1                                              | $0.42                  |

Batch API pricing available for most models (typically 50% of synchronous pricing).

## API Reference

| Method | Endpoint                          | Description                                    |
|--------|-----------------------------------|------------------------------------------------|
| GET    | `/v1/spots`                       | Get spot prices for all models                |
| GET    | `/v1/greeks/:ticker`              | Get Greeks (theta, sigma) for a model         |
| GET    | `/v1/forwards/:ticker?days=30,90` | Get forward curve projections                 |
| POST   | `/v1/price`                       | Price a specific task for one model           |
| POST   | `/v1/compare`                     | Compare multiple models for a task            |
| GET    | `/v1/models`                      | Get all model metadata                        |
| GET    | `/v1/families`                    | Get model family definitions                  |

**Base URL:** `https://api.exostream.ai`

**Rate limiting:** Fair use policy (100 req/min per IP)

**Response format:** All endpoints return JSON with `data`, `oracle_timestamp`, and `cache_age_seconds` fields.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/exostream-ai/oracle.git
cd oracle

# Install dependencies
npm install

# Run tests
npm test

# Start development server (Node.js API)
npm run dev

# Deploy to Cloudflare Workers
npx wrangler deploy src/api/worker.ts --name exostream-api

# Build and deploy frontend dashboard
cd frontend
npm install
npm run build
npx wrangler pages deploy out --project-name exostream
```

## Core Concepts

### Beta (Spot Price)
The current market price per million output tokens. Separate rates for synchronous (`beta_sync`) and batch (`beta_batch`) APIs.

### Kappa (Cost-Efficiency Score)
Output tokens you get per cent (USD). Higher is better. Formula: `kappa = 1,000,000 / beta`

Example: If beta = 15, kappa = 66,666 tokens per cent.

### Theta (Price Drift)
Annual rate of price change. Positive theta means prices are rising, negative means falling.

Calculated from historical price data using exponential decay model.

### Sigma (Volatility)
Price uncertainty. Higher sigma means less predictable future pricing.

Used for forward curve confidence intervals.

### Forward Curves
Projected future spot prices at specific time horizons (30, 90, 180, 365 days).

Formula: `beta_forward = beta_spot * e^(-theta * days/365)`

### R_in, R_cache (Input Price Ratios)
- `r_in`: Input token price as ratio of output price (typically 0.2)
- `r_cache`: Cached input token price as ratio of output price (typically 0.02)

Used to compute total task cost from mixed input/output workloads.

### Eta (Cache Hit Rate)
Fraction of input tokens served from cache (0.0 - 1.0).

Higher eta = lower effective input costs.

## MCP Server

Exostream provides Model Context Protocol (MCP) tools for Claude Desktop and other MCP clients:

- `price_task` - Get cost estimate for a specific task
- `compare_models` - Compare multiple models for a workload
- `get_spot_prices` - Fetch current spot prices
- `get_forward_curve` - Get projected future prices

Add to your MCP config:
```json
{
  "mcpServers": {
    "exostream": {
      "command": "node",
      "args": ["path/to/exostream/oracle/mcp/server.js"]
    }
  }
}
```

## Tech Stack

- **Runtime:** Cloudflare Workers (API), Node.js (scrapers/dev)
- **Framework:** Hono (API routing)
- **Language:** TypeScript
- **Storage:** Cloudflare KV Store (seed data)
- **Frontend:** Next.js (static export) on Cloudflare Pages
- **Testing:** Vitest (103 tests)
- **Pricing Engine:** Pure math in `src/core/pricing.ts`

## License

MIT License - see [LICENSE](LICENSE) file.

---

Built by the Exostream team. Live dashboard at [exostream.ai](https://exostream.ai).
