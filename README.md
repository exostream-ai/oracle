# Exostream

**The pricing oracle for LLM inference.**

Canonical price feeds, forward curves, and Greek sheets for the cost of intelligence.

## What It Does

Exostream tracks real-time pricing data for every major LLM provider and publishes:

- **Spot prices (β)** - current $/M output token pricing
- **Structural Greeks** - r_in, r_cache, r_think, r_batch ratios
- **Extrinsic Greeks** - θ (decay rate), σ (volatility)
- **Forward curves** - 1M, 3M, 6M projections

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GCP (Cloud Run)                   │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ Scrapers │──▶│ Pricing  │──▶│   REST API        │ │
│  │ (cron)   │   │ Engine   │   │   /v1/spots       │ │
│  └──────────┘   └──────────┘   │   /v1/greeks      │ │
│       │              │         │   /v1/forwards     │ │
│       ▼              ▼         │   /v1/price        │ │
│  ┌──────────────────────────┐  │   /v1/compare      │ │
│  │      PostgreSQL          │  └────────┬───────────┘ │
│  │  (Supabase or Cloud SQL) │           │             │
│  └──────────────────────────┘           │             │
│                                         │             │
└─────────────────────────────────────────┼─────────────┘
                                          │
    ┌─────────────┬─────────────┬─────────┘
    │             │             │
    ▼             ▼             ▼
Dashboard      API Users    MCP Server
(Next.js)     (curl/SDK)   (stdio/SSE)
```

## Quick Start

### Backend

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run database migration
npm run migrate

# Seed with initial data
npm run seed

# Start API server
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

### MCP Server

```bash
npm run mcp
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/spots` | All models with current β |
| GET | `/v1/spots/:ticker` | Single model spot |
| GET | `/v1/greeks` | Full Greek sheet |
| GET | `/v1/greeks/:ticker` | Single model Greeks |
| GET | `/v1/forwards/:ticker` | Forward curve (spot, 1M, 3M, 6M) |
| POST | `/v1/price` | Task pricer (returns cost, κ, r_in_eff) |
| POST | `/v1/compare` | Compare all models for a task |
| GET | `/v1/history/:ticker` | Price history |
| GET | `/v1/events` | Recent price changes |
| GET | `/health` | Server health |

### Example: Price a Task

```bash
curl -X POST http://localhost:8080/v1/price \
  -H "Content-Type: application/json" \
  -d '{
    "model": "OPUS-4.5",
    "n_in": 30000,
    "n_out": 800,
    "eta": 0.6,
    "horizon_months": 3
  }'
```

Response:
```json
{
  "data": {
    "model": "OPUS-4.5",
    "spot_cost": 0.162,
    "kappa": 4.49,
    "r_in_eff": 0.093,
    "forward": {
      "horizon_months": 3,
      "cost": 0.148,
      "beta_forward": 41.01
    }
  }
}
```

## Pricing Model

### The Fundamental Equation

```
C(T, M, t) = S(T, M) × D(M, t)
```

- **S** = Spot cost (intrinsic value)
- **D** = Decay factor (extrinsic dynamics)

### κ (Kappa) - Task Delta

```
κ = 1 + (n_in / n_out) × r_in_eff
```

κ is both:
1. **Context cost multiplier**: task costs κ× more than output alone
2. **Price sensitivity**: if β moves by $1/M, cost moves by κ × n_out × 10⁻⁶

### Forward Price

```
β_fwd(t) = β × e^(-θ × t)
```

## Providers Tracked

- **Anthropic** - Claude Opus 4.5, Sonnet 4, 3.5 Sonnet, 3.5 Haiku
- **OpenAI** - GPT-4.1, 4.1 mini, 4.1 nano, GPT-4o, o3, o4-mini
- **Google** - Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash
- **xAI** - Grok 3, Grok 3 mini
- **Mistral** - Mistral Large
- **DeepSeek** - DeepSeek V3, DeepSeek R1

## MCP Tools

The MCP server exposes 4 tools for AI agents:

- `get_spots` - Get current spot prices
- `get_greeks` - Get full Greek sheet
- `price_task` - Calculate task cost
- `compare_models` - Compare all models for a task

## Development

```bash
# Run tests (37 pricing tests)
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Tech Stack

- **Backend**: TypeScript, Hono, PostgreSQL
- **Frontend**: Next.js, Tailwind CSS, Lightweight Charts
- **MCP**: @modelcontextprotocol/sdk

## License

MIT
