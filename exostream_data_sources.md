# Exostream.ai — Data Source Registry

## What the Oracle Needs to Compute

| Parameter Type | What's Computed | Refresh Cadence |
|---------------|----------------|-----------------|
| **Tickers (β, β_B)** | Current spot prices per model | Real-time / daily |
| **Structural Greeks** (r_in, r_cache, r_think, r_batch) | Price ratios per family | On change (event-driven) |
| **Context parameters** (W, τ, α) | Window sizes and tier structures | On change (event-driven) |
| **Extrinsic (θ)** | Decay rate from price history | Weekly recomputation |
| **Extrinsic (σ)** | Realized volatility | Weekly recomputation |
| **Forward prices** | β × e^(−θt) at standard tenors | Recalculated on any β or θ update |

---

## Primary Data Sources — Provider Pricing Pages

These are the authoritative sources. Everything intrinsic flows from here.

### Anthropic (Claude family)

| Source | URL | Data Extracted |
|--------|-----|---------------|
| API Pricing Page | https://www.anthropic.com/pricing | β, β_B for all Claude models; r_in, r_cache, r_think, r_batch ratios; W per model |
| API Documentation | https://docs.anthropic.com/en/docs/about-claude/models | Model list, context windows, capability flags (reasoning/standard) |
| Changelog / Blog | https://www.anthropic.com/news | Price change announcements (feeds θ history) |

**Models to track:** Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5 (and predecessors still active: 3.5 Sonnet, 3.5 Haiku)

### OpenAI (GPT family)

| Source | URL | Data Extracted |
|--------|-----|---------------|
| API Pricing Page | https://openai.com/api/pricing | β, β_B for all GPT models; ratios; W |
| Models Documentation | https://platform.openai.com/docs/models | Model list, context windows, deprecation dates |
| Blog / Changelog | https://openai.com/blog | Price changes, new model announcements |

**Models to track:** GPT-4.1, GPT-4.1 mini, GPT-4.1 nano, GPT-4o, GPT-4o mini, o3, o4-mini (and any active predecessors)

### Google (Gemini family)

| Source | URL | Data Extracted |
|--------|-----|---------------|
| Vertex AI Pricing | https://cloud.google.com/vertex-ai/generative-ai/pricing | β, β_B, ratios, W; note Google has context-length pricing tiers already (≤128K vs >128K for some models) |
| Google AI Studio Pricing | https://ai.google.dev/pricing | Consumer-tier pricing (may differ from Vertex) |
| Model Documentation | https://ai.google.dev/gemini-api/docs/models | Model list, windows, capabilities |

**Models to track:** Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash (and variants)

**Note:** Google is the most likely first mover on tiered context pricing — some Gemini models already price differently for prompts ≤128K vs >128K. This is the τ/α system in action.

### xAI (Grok family)

| Source | URL | Data Extracted |
|--------|-----|---------------|
| API Pricing | https://docs.x.ai/docs/models#models-and-pricing | β, β_B, ratios, W |

**Models to track:** Grok 3, Grok 3 mini (and variants like -fast)

### Meta (Llama family)

| Source | URL | Data Extracted |
|--------|-----|---------------|
| Llama API Pricing | https://www.llama.com/ (or via hosting partners) | β varies by hosting provider |

**Complication:** Meta's models are open-weight. There's no single "origin provider" price. Options:
1. **Use Meta's own hosted API pricing** (llama.com) as the reference rate if/when available
2. **Use the lowest-cost major cloud provider** (e.g., Together AI, Fireworks, AWS Bedrock) as a proxy reference
3. **Exclude from the oracle** until Meta establishes a canonical hosted price

**Recommendation:** If Meta hosts directly, use that. Otherwise, use the median price across the top 3 hosting providers (Together, Fireworks, Groq) as the reference. Flag it as a composite rate in the ticker metadata.

**Models to track:** Llama 4 Maverick, Llama 4 Scout (and 3.x if still priced)

### Mistral

| Source | URL | Data Extracted |
|--------|-----|---------------|
| API Pricing | https://mistral.ai/products/la-plateforme#pricing | β, β_B, ratios, W |
| Model Documentation | https://docs.mistral.ai/getting-started/models/ | Model list, capabilities |

**Models to track:** Mistral Large, Mistral Medium, Mistral Small, Codestral

### DeepSeek

| Source | URL | Data Extracted |
|--------|-----|---------------|
| API Pricing | https://api-docs.deepseek.com/quick_start/pricing | β, ratios, W |

**Models to track:** DeepSeek-V3, DeepSeek-R1

**Note:** DeepSeek pricing is notably aggressive — lowest cost frontier reasoning model. Important for competitive dynamics and θ estimation across the market.

---

## Secondary Data Sources — Historical Price Reconstruction

For bootstrapping θ at oracle launch and maintaining the historical price database.

| Source | What It Provides | Reliability |
|--------|-----------------|-------------|
| **Wayback Machine** (web.archive.org) | Archived snapshots of provider pricing pages | High — major pricing pages are frequently crawled |
| **Provider blogs / changelogs** | Dated announcements of price changes | High — first-party, timestamped |
| **Developer community trackers** | Aggregated pricing histories (e.g., LLM pricing comparison sites) | Medium — useful for cross-referencing |
| **API response headers** | Some providers include model version / pricing metadata | Low — inconsistent |

### Known Historical Price Points for θ Bootstrap

| Model | Date | Price ($/M output) | Source |
|-------|------|-------------------|--------|
| GPT-4 | Mar 2023 | $60.00 | OpenAI blog |
| GPT-4 Turbo | Nov 2023 | $30.00 | OpenAI blog |
| GPT-4o | May 2024 | $15.00 | OpenAI blog |
| GPT-4o (repriced) | Late 2024 | $10.00 | OpenAI pricing page |
| GPT-4.1 | Apr 2025 | $8.00 | OpenAI pricing page |
| Claude 3 Opus | Mar 2024 | $75.00 | Anthropic blog |
| Claude 3.5 Sonnet | Jun 2024 | $15.00 | Anthropic blog |
| Claude 4 Opus | ~2025 | $45.00 | Anthropic pricing page |

This is enough to fit initial θ estimates per family.

---

## Tertiary Data Sources — Market Context

Not required for core parameters but valuable for oracle analytics, research products, and contextual intelligence.

| Source | What It Provides | Use Case |
|--------|-----------------|----------|
| **Cloud GPU pricing** (AWS, GCP, Lambda Labs, CoreWeave) | H100/B200 spot and reserved pricing | Rho analysis (future); production cost floor estimates |
| **Semiconductor industry data** (TSMC earnings, NVIDIA supply) | Chip supply/demand dynamics | Long-term θ trend context |
| **LLM benchmark leaderboards** (LMSYS Chatbot Arena, MMLU, HumanEval) | Model quality rankings | Separate quality index product (not core oracle) |
| **Provider status pages** | Uptime, capacity constraints | Could signal supply-side pricing pressure |
| **Developer forums / X** | Early signals of pricing changes, new model releases | Event detection (informal) |
| **SEC filings** (for public companies) | Revenue disclosures related to API services | Inference market sizing |
| **On-chain inference protocols** (Ritual, Bittensor, etc.) | Decentralized inference pricing | Alternative price discovery; future rho source |

---

## Data Collection Architecture

### Ingestion Tiers

| Tier | Cadence | Method | Sources |
|------|---------|--------|---------|
| **Tier 1: Real-time** | Every 1–6 hours | Automated scraping + API calls | Provider pricing pages |
| **Tier 2: Event-driven** | On detection | RSS/webhook + manual verification | Provider blogs, changelogs, announcements |
| **Tier 3: Weekly** | Weekly batch | Computed from Tier 1 data | θ, σ recomputation; forward curve updates |
| **Tier 4: Reference** | Monthly / as needed | Manual curation | Historical reconstruction, market context |

### Scraping Considerations

| Provider | Page Structure | Scraping Difficulty | Notes |
|----------|---------------|-------------------|-------|
| Anthropic | Static HTML pricing table | Low | Clean structure, infrequent changes |
| OpenAI | Dynamic / JS-rendered | Medium | May need headless browser; frequently restructured |
| Google | Vertex AI docs (structured) | Medium | Multiple pages (Vertex vs AI Studio); tiered pricing adds complexity |
| xAI | API docs page | Low | Simple structure |
| Mistral | Static pricing page | Low | Clean structure |
| DeepSeek | API docs page | Low | Simple structure |
| Meta/Llama | Varies by host | High | No single source; requires multi-provider aggregation |

### Change Detection

The oracle needs to detect pricing changes *faster than the market*. Two approaches:

1. **Polling:** Scrape pricing pages on a fixed schedule (every 1–6 hours). Compare hashes or extracted values against last known state. Alert on any change.

2. **Signal monitoring:** Watch provider blogs, RSS feeds, X accounts, developer forums for early signals of price changes. Many providers announce changes via blog post before updating the pricing page.

**Recommended:** Both. Polling as the reliable baseline; signal monitoring for early detection.

---

## Data Quality & Validation

### Cross-Validation Rules

| Rule | Check | Action on Failure |
|------|-------|-------------------|
| **Ratio consistency** | r_in × β should match published input price | Flag; investigate page structure change |
| **Batch consistency** | β_B should equal β × r_batch (within rounding) | Flag; may indicate independent batch repricing (legitimate) |
| **Window consistency** | W should match model documentation | Flag; update |
| **Historical continuity** | New β should be within 3σ of recent history | Alert; likely legitimate price change but verify |
| **Cross-provider sanity** | Same model on different providers should be within reasonable spread of origin | Informational; feeds future arbitrage analytics |

### Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Pricing page restructured | Scraper breaks | Multiple parser strategies; alert on extraction failure; manual fallback |
| Price change undetected | Stale β | Hash-based change detection; multi-source cross-check |
| Provider removes model | Ticker goes dark | Detect 404/removal; mark ticker as deprecated; freeze last known β |
| New model released | Missing ticker | Monitor announcement channels; onboard new model within 24 hours |
| Ambiguous pricing (e.g., promotional rates) | Incorrect β | Distinguish standard vs promotional pricing in parser; flag promotional rates |

---

## Coverage Matrix — What's Needed per Provider

| Data Point | Anthropic | OpenAI | Google | xAI | Meta | Mistral | DeepSeek |
|-----------|-----------|--------|--------|-----|------|---------|----------|
| Output price (β) | ✓ Direct | ✓ Direct | ✓ Direct | ✓ Direct | △ Composite | ✓ Direct | ✓ Direct |
| Batch price (β_B) | ✓ Direct | ✓ Direct | ✓ Direct | ✓ Check | △ Varies | ✓ Check | ✓ Check |
| Input ratio (r_in) | ✓ Derivable | ✓ Derivable | ✓ Derivable | ✓ Derivable | △ Varies | ✓ Derivable | ✓ Derivable |
| Cache ratio (r_cache) | ✓ Published | ✓ Published | ✓ Published | ✓ Check | △ Varies | ✓ Check | ✓ Published |
| Think ratio (r_think) | ✓ Published | ✓ Published | ✓ Published | ✓ Check | N/A | N/A | ✓ Published |
| Context window (W) | ✓ Documented | ✓ Documented | ✓ Documented | ✓ Documented | ✓ Documented | ✓ Documented | ✓ Documented |
| Context tiers (τ, α) | ✗ Flat | ✗ Flat | ⚠ Partial | ✗ Flat | N/A | ✗ Flat | ✗ Flat |
| Price history | ✓ Recoverable | ✓ Recoverable | ✓ Recoverable | △ Limited | △ Limited | △ Limited | △ Limited |

**Legend:** ✓ = available, △ = partial/composite, ✗ = not applicable, ⚠ = exists but non-standard
