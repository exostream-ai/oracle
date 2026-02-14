# Exostream Oracle

**A pricing model for LLM inference costs, treating API pricing as financial instruments.**

Exostream tracks 37 models across 6 providers and computes spot prices, Greeks (theta, sigma), forward curves, and cost-efficiency metrics. The model is open — the math, the data, and the methodology are all here.

**Use the API:** `https://api.exostream.ai`
**Dashboard:** [exostream.ai](https://exostream.ai)

---

## The Pricing Model

Every LLM API call has a cost determined by the provider's per-token pricing. Exostream models this like a financial instrument:

```
                                ┌─────────────────────────────┐
                                │       SPOT PRICE (β)        │
                                │  $/M output tokens (sync)   │
                                └─────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
          ┌─────────▼─────────┐    ┌──────────▼──────────┐   ┌────────▼────────┐
          │    INPUT RATIO    │    │    CACHE RATIO      │   │  THINK RATIO    │
          │    r_in = p_in    │    │  r_cache = p_cache  │   │ r_think = p_think│
          │           ─────   │    │            ──────   │   │           ───── │
          │           p_out   │    │            p_out    │   │           p_out │
          └─────────┬─────────┘    └──────────┬──────────┘   └────────┬────────┘
                    │                         │                       │
                    └─────────────┬───────────┘                       │
                                  │                                   │
                    ┌─────────────▼─────────────┐                     │
                    │  EFFECTIVE INPUT RATE      │                     │
                    │                           │                     │
                    │  r_eff = r_in(1-η) +      │                     │
                    │         r_cache·η          │                     │
                    └─────────────┬─────────────┘                     │
                                  │                                   │
                    ┌─────────────▼───────────────────────────────────▼┐
                    │                TASK COST                         │
                    │                                                 │
                    │  S = β × [n_out + n_in·r_eff + n_think·r_think] │
                    │      × 10⁻⁶                                    │
                    └─────────────┬───────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼─────────┐ ┌──────▼──────┐  ┌─────────▼─────────┐
    │   KAPPA (κ)       │ │  THETA (θ)  │  │   SIGMA (σ)       │
    │                   │ │             │  │                   │
    │  tokens per cent  │ │ price drift │  │ price volatility  │
    │  κ = 10⁶/β       │ │  (annual)   │  │  (monthly)        │
    └───────────────────┘ └──────┬──────┘  └───────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    FORWARD PRICE        │
                    │                         │
                    │  β_fwd = β · e^(−θ·t)  │
                    │                         │
                    │  "What will this model  │
                    │   cost in 3 months?"    │
                    └─────────────────────────┘
```

**Key insight:** LLM prices consistently decline over time. Theta captures this decay rate from historical data, letting you project future costs.

---

## API

### Get Spot Prices

```bash
curl https://api.exostream.ai/v1/spots
```

```json
{
  "data": [
    {
      "ticker": "OPUS-4.6",
      "display_name": "Claude Opus 4.6",
      "provider": "Anthropic",
      "beta_sync": 25,
      "beta_batch": 12.5,
      "context_window": 1000000
    },
    {
      "ticker": "GPT-4.1",
      "display_name": "GPT-4.1",
      "provider": "OpenAI",
      "beta_sync": 8,
      "beta_batch": 4,
      "context_window": 1000000
    }
  ],
  "oracle_timestamp": "2026-02-13T21:54:05.561Z"
}
```

### Price a Task

```bash
curl -X POST https://api.exostream.ai/v1/price \
  -H "Content-Type: application/json" \
  -d '{"model": "SONNET-4", "n_in": 30000, "n_out": 800, "eta": 0.6}'
```

```json
{
  "data": {
    "model": "SONNET-4",
    "spot_cost": 0.0534,
    "kappa": 4.45,
    "r_in_eff": 0.092,
    "cache_value": {
      "cost_without_cache": 0.102,
      "savings": 0.0486,
      "savings_pct": 47.65
    }
  }
}
```

### Compare Models

```bash
curl -X POST https://api.exostream.ai/v1/compare \
  -H "Content-Type: application/json" \
  -d '{"models": ["SONNET-4", "GPT-4.1", "GEMINI-2.5-PRO"], "n_in": 30000, "n_out": 800, "eta": 0.6}'
```

Returns models sorted by cost, cheapest first.

### Get Greeks

```bash
curl https://api.exostream.ai/v1/greeks
```

Returns theta (price drift), sigma (volatility), and all pricing ratios for every model.

### Get Forward Curve

```bash
curl https://api.exostream.ai/v1/forwards/GPT-4.1
```

Returns projected prices at 30, 90, 180, and 365 days based on theta decay.

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/spots` | Spot prices for all models |
| GET | `/v1/greeks` | Greeks (theta, sigma, ratios) for all models |
| GET | `/v1/forwards/:ticker` | Forward curve for a model |
| POST | `/v1/price` | Price a task |
| POST | `/v1/compare` | Compare models for a task |

**Base URL:** `https://api.exostream.ai`

No authentication required. Rate limited to 100 requests/minute per IP.

---

## Models Tracked

| Provider | Models | Spot Range ($/M output) |
|----------|--------|------------------------|
| Anthropic | Opus 4.6, Opus 4.5, Opus 4.1, Opus 4, Sonnet 4.5, Sonnet 4, Haiku 4.5, Haiku 3.5, Haiku 3 + 3 legacy | $1.25 - $75 |
| OpenAI | GPT-4.1, GPT-4.1 mini, GPT-4.1 nano, GPT-4o, GPT-4o mini, o3, o3-mini, o4-mini, GPT-5, GPT-5.1, GPT-5.2, GPT-5 mini | $0.40 - $14 |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 3 Pro, Gemini 3 Flash | $0.40 - $12 |
| xAI | Grok 4, Grok 4 Fast, Grok 3, Grok 3 mini, Grok 4.1 Fast | $0.50 - $15 |
| Mistral | Mistral Large | $6.00 |
| DeepSeek | DeepSeek V3, DeepSeek R1 | $0.42 |

37 models total. Batch pricing available for most (typically 50% of sync).

---

## Concepts

| Symbol | Name | What it means |
|--------|------|---------------|
| **β** | Beta (spot price) | Current price per million output tokens |
| **κ** | Kappa | Tokens per cent — higher is cheaper |
| **θ** | Theta | Annual price drift rate, computed from historical data |
| **σ** | Sigma | Monthly price volatility |
| **r_in** | Input ratio | Input price as fraction of output price |
| **r_cache** | Cache ratio | Cached input price as fraction of output price |
| **η** | Eta | Cache hit rate (0 = no cache, 1 = full cache) |
| **β_fwd** | Forward price | Projected future price: β · e^(−θ·t) |

### How Theta Works

Theta is computed from real price history using exponentially-weighted log returns:

1. Collect historical prices for a model family (e.g., GPT-4 → GPT-4 Turbo → GPT-4o → GPT-4.1)
2. Calculate log returns between consecutive price observations
3. Apply exponential weighting (λ=0.85) — recent changes matter more
4. Blend with family prior via Bayesian weighting when history is short

Example: GPT-4 went from $60/M → $30 → $15 → $10 → $8 over 18 months. This yields θ ≈ 0.078, meaning the model projects ~7.8% annual price decline for that family.

---

## MCP Server

For Claude Desktop and other MCP clients:

```json
{
  "mcpServers": {
    "exostream": {
      "command": "npx",
      "args": ["tsx", "path/to/oracle/mcp/src/index.ts"]
    }
  }
}
```

Tools: `get_spot_prices`, `price_task`, `compare_models`, `get_forward_curve`

---

## License

MIT — see [LICENSE](LICENSE).

Live dashboard at [exostream.ai](https://exostream.ai).
