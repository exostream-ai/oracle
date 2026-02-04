# Exostream.ai — V1 Implementation Plan

## What We're Building

A pricing oracle for LLM inference. V1 ships three things:

1. **The Oracle Backend** — scrapers, pricing engine, database, REST API
2. **The Dashboard** — dark-themed financial terminal showing live data
3. **The MCP Server** — thin wrapper for agent-native distribution

Everything else (SDK, forward contracts, observability integrations) is V2+.

---

## Architecture Overview

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
│  ┌──────────────────────────────────────┤             │
│  │          Cloudflare CDN              │             │
│  │  (cache API responses, serve site)   │             │
│  └──────────────┬───────────────────────┘             │
└─────────────────┼─────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
Dashboard      API Users    MCP Server
(Next.js)     (curl/SDK)   (stdio/SSE)
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | TypeScript (full stack) | Single language, strong typing for financial data |
| API Framework | Hono | Lightweight, fast, Cloudflare-compatible |
| Database | PostgreSQL (Supabase or Cloud SQL) | Schema already designed, TimescaleDB-ready |
| Frontend | Next.js (App Router) | SSR for SEO, React for interactivity |
| Charts | Lightweight Charts (TradingView) | Purpose-built for financial time-series |
| Styling | Tailwind CSS | Dark theme, utility-first, fast iteration |
| MCP Server | @modelcontextprotocol/sdk | Standard MCP TypeScript SDK |
| Deployment | GCP Cloud Run + Cloudflare | Already on GCP, Cloudflare for CDN/domain |
| Scheduler | Cloud Scheduler → Cloud Run | Trigger scraper jobs on cron |

---

## Repository Structure

The project lives in an `exostream/` folder. Flat layout — no monorepo tooling. A backend and a frontend with shared types.

```
exostream/
├── docs/                              # Reference documentation (read-only specs)
│   ├── exostream_model_v3.md          # Pricing model specification
│   ├── exostream_data_sources.md      # Provider scraping map
│   ├── exostream_opportunity_map.md   # Product roadmap context
│   ├── exostream_schema.sql           # Database schema reference
│   ├── exostream_stress_test.py       # Math validation suite (Python, reference only)
│   ├── arch_notes.txt                 # Architecture decision notes
│   ├── gtm_notes.txt                  # Go-to-market strategy notes
│   ├── Website_layout_and_content_.txt # Dashboard design spec
│   └── IMG_2033.jpeg                  # Logo
│
├── src/                               # Backend source
│   ├── core/                          # Shared types + pricing math
│   │   ├── types.ts                   # Provider, Model, Greek, TaskProfile types
│   │   ├── pricing.ts                 # effectiveInputRate, kappa, spotCost, forwardPrice
│   │   ├── constants.ts               # Provider URLs, model registry, reference data
│   │   └── index.ts                   # Barrel export
│   │
│   ├── scrapers/                      # Data collection from provider pricing pages
│   │   ├── base.ts                    # Base scraper interface + shared utilities
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── google.ts
│   │   ├── xai.ts
│   │   ├── mistral.ts
│   │   ├── deepseek.ts
│   │   └── index.ts                   # runAllScrapers() orchestrator
│   │
│   ├── engine/                        # Oracle computation (θ, σ, forwards)
│   │   ├── theta.ts                   # Decay rate estimation
│   │   ├── sigma.ts                   # Realized volatility computation
│   │   ├── forwards.ts                # Forward curve generation
│   │   ├── events.ts                  # Price change detection
│   │   └── index.ts                   # recomputeAll() orchestrator
│   │
│   ├── api/                           # REST API (Hono)
│   │   ├── routes/
│   │   │   ├── spots.ts               # GET /v1/spots, /v1/spots/:ticker
│   │   │   ├── greeks.ts              # GET /v1/greeks, /v1/greeks/:ticker
│   │   │   ├── forwards.ts            # GET /v1/forwards/:ticker
│   │   │   ├── price.ts               # POST /v1/price (task pricer)
│   │   │   ├── compare.ts             # POST /v1/compare (all models)
│   │   │   ├── history.ts             # GET /v1/history/:ticker
│   │   │   └── health.ts              # GET /health
│   │   ├── middleware/
│   │   │   ├── rateLimit.ts
│   │   │   ├── cache.ts               # In-memory oracle state cache
│   │   │   └── cors.ts
│   │   ├── oracle.ts                  # Oracle state singleton (loads from DB, caches in memory)
│   │   └── index.ts                   # Hono app entrypoint
│   │
│   ├── mcp/                           # MCP Server
│   │   ├── tools/
│   │   │   ├── getSpots.ts
│   │   │   ├── getGreeks.ts
│   │   │   ├── priceTask.ts
│   │   │   └── compareModels.ts
│   │   └── index.ts                   # MCP server entrypoint
│   │
│   └── db/                            # Database utilities
│       ├── client.ts                  # PostgreSQL connection
│       ├── migrate.ts                 # Run schema.sql
│       └── seed.ts                    # Seed reference data + historical prices
│
├── frontend/                          # Next.js dashboard (existing subfolder)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Landing: hero + ticker strip + ticker board
│   │   │   ├── model/[id]/
│   │   │   │   └── page.tsx           # Model detail: forward curve + history chart
│   │   │   ├── calculator/
│   │   │   │   └── page.tsx           # Interactive cost calculator
│   │   │   ├── methodology/
│   │   │   │   └── page.tsx           # Published model spec (KaTeX equations)
│   │   │   └── api-docs/
│   │   │       └── page.tsx           # API documentation with examples
│   │   ├── components/
│   │   │   ├── TickerStrip.tsx        # Scrolling ticker bar (hero)
│   │   │   ├── TickerBoard.tsx        # Full model table (sortable)
│   │   │   ├── ModelRow.tsx           # Single row in ticker board
│   │   │   ├── ForwardCurve.tsx       # Lightweight Charts: forward curve
│   │   │   ├── HistoryChart.tsx       # Lightweight Charts: β over time
│   │   │   ├── CostCalculator.tsx     # Interactive pricer
│   │   │   └── GreekSheet.tsx         # Parameter display for single model
│   │   ├── lib/
│   │   │   ├── api.ts                 # Fetch wrapper for Exostream API
│   │   │   └── format.ts             # Number/currency/Greek formatting
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   │   └── logo.png
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── seed/                              # Seed data files
│   ├── providers.json                 # 6 providers with URLs
│   ├── families.json                  # ~6 model families with structural Greeks
│   ├── models.json                    # ~17 models with tickers, W, tiers
│   └── historical_prices.json         # Reconstructed price history from public record
│
├── tests/
│   └── pricing.test.ts               # Port of stress_test.py (37 tests, Vitest)
│
├── Dockerfile                         # API container
├── package.json                       # Root: backend dependencies + scripts
├── tsconfig.json                      # Backend TypeScript config (strict)
├── vitest.config.ts
├── .env.example
├── .gitignore
├── IMPLEMENTATION_PLAN.md             # This file
└── README.md
```

### Key structural decisions

**Why not a monorepo with Turborepo?** Overhead isn't justified. The backend is one deployable unit (API + scrapers + engine share a process and a DB connection). The frontend is one Next.js app. They share types via the API's response contract, not via import paths. `npm run build` for backend, `cd frontend && npm run build` for frontend. Done.

**The `docs/` folder is read-only reference.** The agent reads these specs but never modifies them. They are the source of truth.

**The `frontend/` subfolder already exists.** Build on whatever's there. If it's just an empty Next.js init, that's fine — scaffold on top of it.

**Meta/Llama deferred.** No canonical origin price for open-weight models. Not worth composite-reference complexity for V1. Ship with 6 providers, add Meta in V1.1 if demand warrants it.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/exostream

# API
PORT=8080
API_BASE_URL=https://api.exostream.ai

# Scraper schedule (reference — actual cron in Cloud Scheduler)
SCRAPER_INTERVAL_HOURS=1
ENGINE_RECOMPUTE_HOURS=6

# Rate limiting
RATE_LIMIT_UNAUTHENTICATED=60    # requests per hour per IP
RATE_LIMIT_FREE_KEY=100          # requests per hour per API key
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal:** Project scaffold, database live, core pricing math ported and tested.

#### Plan 1.1: Project Scaffold
- Initialize root `package.json` with TypeScript, Vitest, Hono dependencies
- Set up `tsconfig.json` (strict mode, ES2022 target, path aliases for `@/core`, `@/scrapers`, etc.)
- Create the `src/` directory structure: `core/`, `scrapers/`, `engine/`, `api/`, `mcp/`, `db/`
- Create stub `index.ts` in each directory
- Set up Vitest config
- Initialize git, `.gitignore` (node_modules, .env, dist/, .next/), `.env.example`
- **Verify:** `npx tsc --noEmit` succeeds, `npx vitest run` runs (0 tests initially)

#### Plan 1.2: Core Pricing Library
- Read `docs/exostream_model_v3.md` — sections 1.3 through 1.6 define the equations
- Read `docs/exostream_stress_test.py` — this is the test oracle with all expected values
- Implement in `src/core/pricing.ts`:
  - `effectiveInputRate(rIn, rCache, eta, nIn, W, tiers)` — model spec section 1.3
  - `kappa(nIn, nOut, rInEff)` — model spec section 1.4
  - `spotCost(beta, nOut, nIn, rInEff, nThink?, rThink?)` — model spec section 1.6
  - `forwardPrice(beta, theta, t)` — model spec section 2.4
  - `decayFactor(theta, t)` — model spec section 2.3
- Define types in `src/core/types.ts`:
  - `Provider`, `ModelFamily`, `Model`, `ContextTier`
  - `SpotPrice`, `ExtrinsicParams`, `ForwardPrice`
  - `TaskProfile`, `PricingResult`, `OracleState`
- Port all 37 tests from `docs/exostream_stress_test.py` to `tests/pricing.test.ts`
  - Match every expected value exactly (use the same tolerances from the Python suite)
  - Include all edge cases: zero input, 100% cache, max window, tiered pricing, boundary inputs
- **Verify:** ALL 37 TESTS PASS. The math is the product. Zero tolerance.

#### Plan 1.3: Database Setup
- PostgreSQL connection in `src/db/client.ts`
- Migration script `src/db/migrate.ts` that runs `docs/exostream_schema.sql`
- Seed script `src/db/seed.ts` loading from `seed/` JSON files:
  - 6 providers (Anthropic, OpenAI, Google, xAI, Mistral, DeepSeek)
  - ~6 model families with structural Greeks (r_in, r_cache, r_think, r_batch)
  - ~17 models with tickers, context windows, launch dates
  - Context tiers (flat for all current models; tiered for Gemini >128K)
  - Historical price points (reconstructed from public record — see known data points in `docs/exostream_data_sources.md`)
- Populate `seed/*.json` with real data. For current prices, scrape the provider pages manually and hardcode.
- **Verify:** Run migrate + seed. `SELECT * FROM v_greek_sheet` returns all active models with resolved parameters.

---

### Phase 2: Data Pipeline (Days 3-4)

**Goal:** Scrapers running, change detection working, oracle state computable.

#### Plan 2.1: Scraper Framework
- Build base scraper in `src/scrapers/base.ts`:
  - `fetchPage(url) → { html, hash }` — fetches HTML, computes SHA-256 content hash
  - `detectChange(provider, newHash) → boolean` — compares against last hash in `scrape_log`
  - `logScrape(provider, url, status, hash, duration)` — writes to `scrape_log` table
  - `saveSnapshot(scrapeId, provider, url, html, hash)` — writes to `page_snapshots`
- Define `ScrapedPricing` type: structured output per provider with model-level pricing data
- **Verify:** Framework can fetch, hash, and store any URL

#### Plan 2.2: Provider Scrapers
One scraper per provider in `src/scrapers/`. Each implements: `scrape() → ScrapedPricing`

Build in priority order:
1. **Anthropic** (`anthropic.ts`): https://www.anthropic.com/pricing
2. **OpenAI** (`openai.ts`): https://openai.com/api/pricing
3. **Google** (`google.ts`): Vertex AI pricing. IMPORTANT: parse tiered pricing (≤128K / >128K for Gemini)
4. **DeepSeek** (`deepseek.ts`): API docs pricing
5. **xAI** (`xai.ts`): docs pricing
6. **Mistral** (`mistral.ts`): platform pricing

Each scraper: fetch page → parse to `ScrapedPricing` → compare to last known β → write to `spot_prices` if changed → log to `scrape_log` → store snapshot

`src/scrapers/index.ts`: `runAllScrapers()` runs all providers, handles per-provider errors (one failure doesn't block others), returns summary.

- **Verify:** Run each scraper. Cross-check every extracted β against the live provider pricing page (manual). All must match.

#### Plan 2.3: Oracle Engine
Implement in `src/engine/`:

- `theta.ts`: θ estimation from price history + family prior blend
- `sigma.ts`: realized volatility from log returns
- `forwards.ts`: β_fwd at 1M/3M/6M tenors
- `events.ts`: detect and record price changes
- `index.ts`: `recomputeAll()` orchestrator

- **Verify:** Run engine on seeded history. θ for GPT-4 family ≈ 0.05-0.10/month. 3M forward for Opus 4.5 ≈ $41 (per model spec Appendix A.3).

---

### Phase 3: API (Days 5-6)

**Goal:** Full REST API serving oracle data, cached in memory, rate-limited.

#### Plan 3.1: API Core + Cache
- Hono app in `src/api/index.ts` with CORS, JSON errors
- Oracle state cache in `src/api/oracle.ts`: load from DB on startup, refresh every 5 min
- Rate limiting: 60/hour unauthenticated (IP), 100/hour with `X-API-Key`
- `GET /health` → status, oracle_timestamp, models_tracked, cache_age
- **Verify:** Server starts, `/health` returns valid response

#### Plan 3.2: Data Feed Endpoints
- `GET /v1/spots` — all models, current β (sync + batch)
- `GET /v1/spots/:ticker` — single model
- `GET /v1/greeks` — full Greek sheet
- `GET /v1/greeks/:ticker` — single model Greeks
- `GET /v1/forwards/:ticker` — forward curve (spot, 1M, 3M, 6M, θ, decay factors)
- `GET /v1/history/:ticker?from=&to=` — price history time series
- `GET /v1/events?since=` — recent price changes
- All responses: `{ data, oracle_timestamp, cache_age_seconds }`
- **Verify:** curl every endpoint, data matches DB

#### Plan 3.3: Task Pricer Endpoints
- `POST /v1/price` → `{ model, n_in, n_out, n_think?, eta?, horizon_months? }` returns spot cost, forward cost, κ, r_in_eff, delta_cache
- `POST /v1/compare` → `{ n_in, n_out, n_think?, eta? }` returns all models ranked by cost
- Both compute from cache + `src/core/pricing.ts` — no DB hit
- **Verify:** Validated RAG example returns $0.162 spot, κ = 4.49

#### Plan 3.4: Deployment
- `Dockerfile` (Node.js 20 slim, multi-stage)
- npm scripts: `start`, `scrape`, `recompute`
- Deploy API to Cloud Run
- Cloud Scheduler: hourly scrape, 6-hourly recompute
- Cloudflare: proxy api.exostream.ai, cache GETs 60s TTL
- **Verify:** `curl https://api.exostream.ai/v1/spots` returns live data

---

### Phase 4: Dashboard (Days 7-10)

**Goal:** Dark-themed financial terminal. The screenshot that goes viral.

Reference: `docs/Website_layout_and_content_.txt` for layout, `docs/IMG_2033.jpeg` for logo.

#### Plan 4.1: Frontend Scaffold + Design System
- Work within existing `frontend/` directory
- Configure Tailwind dark theme: bg `#0a0a0a`, surface `#141414`, text `#e5e5e5`/`#737373`, accent cyan, green/red for financial movements
- Typography: JetBrains Mono for numbers/tickers, system sans for prose
- Root layout: minimal nav, full dark background
- API client in `frontend/src/lib/api.ts`
- **Verify:** Dark theme renders correctly

#### Plan 4.2: Hero + Ticker Strip
- Logo centered, tagline "The pricing oracle for LLM inference"
- Scrolling ticker strip: top 6 models with β and θ, CSS animation, polls API every 60s
- **Verify:** Ticker shows real data

#### Plan 4.3: Live Ticker Board
- Full table: Ticker, Provider, β (sync), β (batch), r_in, θ, σ, 3M Forward
- Sortable, monospace numbers, green/red θ coloring, click → model detail
- **Verify:** All models render, sorting works

#### Plan 4.4: Model Detail Page
- Forward curve (Lightweight Charts): spot → 1M → 3M → 6M with interactive crosshair
- Historical β chart: provenance markers (hollow = reconstructed, solid = live), "Oracle live since" marker
- Greek sheet panel
- **Verify:** Charts render with real data

#### Plan 4.5: Cost Calculator
- Model selector, sliders for n_in/n_out/n_think/η, preset profiles (RAG, Code Gen, Summarization)
- Live results: spot cost, κ with explanation, forward cost, cache savings
- Output uncertainty: cost range across different n_out values
- **Verify:** RAG example returns $0.162, κ = 4.49

#### Plan 4.6: Static Pages + Footer
- `/methodology`: model_v3.md rendered with KaTeX
- `/api-docs`: endpoint reference, curl examples
- Footer: API Docs, Methodology, X link
- **Verify:** Equations render, links work

---

### Phase 5: MCP Server (Day 11)

#### Plan 5.1: Implementation
4 tools in `src/mcp/`: `get_spots`, `get_greeks`, `price_task`, `compare_models`
Stdio + SSE transports. Tool descriptions written for LLM consumption.
- **Verify:** All 4 tools work from Claude Code

#### Plan 5.2: Distribution
Publish `@exostream/mcp` to npm. Submit to mcp.so, Smithery.
- **Verify:** Installable, listed

---

### Phase 6: Polish + Launch (Days 12-14)

#### Plan 6.1: Data Integrity Audit
Manual cross-check of all prices. Run test suite against live API.

#### Plan 6.2: Performance + Reliability
Load test, Cloudflare cache verification, monitoring setup.

#### Plan 6.3: Launch Assets
Dashboard screenshot, X thread, HN post, outreach drafts.

---

## Development Principles

1. **Plan before building.** Each plan is 2-3 tasks. Don't drift.
2. **Atomic commits.** `feat(core): port pricing functions`, `feat(scrapers): anthropic provider`, etc.
3. **Fresh context per phase.** New agent session per phase, load only relevant docs.
4. **The math is sacred.** Failing test = stop everything.
5. **Ship ugly infrastructure, ship pretty dashboard.**
6. **No premature abstraction.** 17 models, 6 providers. Hardcode what's known.

---

## Context Loading Per Phase

| Phase | Load These Files |
|-------|-----------------|
| 1 — Foundation | `docs/exostream_model_v3.md`, `docs/exostream_schema.sql`, `docs/exostream_stress_test.py` |
| 2 — Pipeline | `docs/exostream_data_sources.md`, `docs/exostream_schema.sql`, `src/core/types.ts` |
| 3 — API | `docs/exostream_model_v3.md`, `src/core/`, `docs/exostream_schema.sql` (views = endpoints) |
| 4 — Dashboard | `docs/Website_layout_and_content_.txt`, `docs/IMG_2033.jpeg`, API routes from Phase 3 |
| 5 — MCP | `src/api/routes/`, `src/core/types.ts` |
| 6 — Polish | `docs/exostream_stress_test.py`, `docs/gtm_notes.txt` |

---

## Success Criteria

V1 is done when:

- [ ] ~17 models showing live spot prices, scraped within the last hour
- [ ] Greek sheet fully populated for all active models
- [ ] Forward curves at 1M/3M/6M for all models
- [ ] Historical price chart with provenance markers
- [ ] Cost calculator: validated RAG example returns $0.162, κ = 4.49
- [ ] API endpoints < 100ms from cache
- [ ] Dashboard looks like a financial terminal
- [ ] MCP server installable with 4 working tools
- [ ] Live at exostream.ai
- [ ] All 37 pricing tests passing
