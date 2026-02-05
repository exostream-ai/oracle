# Exostream.ai — Backlog

## Critical (blocks launch)

- [ ] Fix OpenAI scraper — returning 403. Needs user-agent rotation, headless browser, or API-based price verification as fallback
- [x] Complete Cloudflare deployment — frontend to Cloudflare Pages, API to Cloudflare Workers or proxied Cloud Run. Domain exostream.ai pointing to frontend, api.exostream.ai to API. GCP org policy blocks public Cloud Run access, so Cloudflare is the path
- [ ] Fix chart x-axis — Lightweight Charts showing 1970 epoch. Forward curve needs labels (Spot, 1M, 3M, 6M). Price history needs actual dates (Mar 2023, Jun 2024, etc.)
- [ ] Data integrity audit — manually verify every scraped β for all 17 models against live provider pricing pages. Flag and fix any discrepancies
- [ ] Compute real θ and σ — currently showing identical -5.0% and 10.0% for all models. Run oracle engine on historical price data. GPT-4 family θ should be ~0.05-0.10 based on $60→$8 trajectory
- [ ] Cron scheduling — scrapers need to run on a schedule (hourly). Set up Cloud Scheduler or Cloudflare Cron Triggers
- [ ] Historical price data — insert all known historical prices from docs/exostream_data_sources.md into spot_prices table with source='historical:public-record'

## High Priority (ship within first week)

- [ ] MCP server distribution — publish @exostream/mcp to npm, submit to mcp.so and Smithery
- [ ] Use cases page — /use-cases with sections for AI Engineers, Finance/Procurement, LLM Tooling Platforms, AI Analysts/Investors, Agentic Systems
- [ ] Model coverage gap — check if xAI has shipped Grok 4.x models since seed data was created. Add any missing models across all providers
- [ ] Embeddable widget — small iframe/React component showing live ticker for a single model. Bloggers and docs sites can embed it. Every embed is a backlink
- [ ] API key system — even though launch is free, set up optional API keys for tracking usage and future rate limit tiers

## GTM & Launch (do after deployment)

- [ ] X account — create @exostream, set up profile with dashboard screenshot
- [ ] Launch X thread — 8-10 posts walking through the thesis. Lead with a surprising real number from live data (fastest θ). End with dashboard link. Pin it
- [ ] Hacker News post — "Show HN: Exostream — a pricing oracle for LLM inference." Lead with dashboard screenshot, not API
- [ ] LinkedIn post — frame around budget forecasting for enterprise/finance audience
- [ ] Outreach emails — LiteLLM (replace hardcoded pricing), Langfuse (oracle integration for cost tracking), one AI newsletter writer (exclusive early data). Under 150 words each
- [ ] First Inference Market Report — current spot prices ranked, θ trends by family, which provider cuts fastest, forward curve implications, one surprising finding
- [ ] Newsletter outreach — pitch The Batch, Ben's Bites, The Neuron, Latent Space, AI Supremacy for coverage
- [ ] MCP registry listings — list on mcp.so, Smithery, awesome-mcp-servers repos
- [ ] GitHub presence — open issues/PRs on LiteLLM, Langfuse, Helicone offering free integration

## V2 Features (after launch traction)

- [ ] Pricing SDK — Python/TypeScript one-liners: exostream.spot("opus-4.5", n_in=30000, n_out=800, eta=0.6). Product 2.1 from opportunity map
- [ ] Cost alerts — notify users when β changes, θ shifts, σ spikes, or a cheaper model crosses below their current one. Email/webhook/Telegram
- [ ] Inference Cost Index — composite weighted index tracking average inference cost across the market. "The Exostream Index fell 6% this quarter." Product 3.1
- [ ] Cost-aware router middleware — proxy layer routing to cheapest model meeting quality constraints. Uses live oracle pricing. Product 2.2
- [ ] Observability integrations — plug into Langfuse, Helicone, Braintrust, LangSmith. Replace their hardcoded cost tracking. Product 2.3
- [ ] Context Optimization Advisor — analyze user request logs, show where κ is highest, where cache could improve, what Syngraph compression saves. Product 2.4. The Syngraph sales funnel
- [ ] Inference Budget Planner — input monthly volume × task profile, get spot + forward cost projections at 1M/3M/6M. Product 1.4
- [ ] x402 integration — API responses in x402-consumable format for machine-to-machine inference pricing. Map to 402 payment header fields
- [ ] Multi-modality support — image, audio, video token pricing as providers ship these capabilities
- [ ] Agent P&L calculator — agents query oracle mid-task to estimate profitability: expected revenue minus C(T,M,t). Real-time budget management for agentic workflows
- [ ] Forward contracts on-chain — Solana SPL tokens representing claims on fixed β for fixed tenor. Settlement against oracle spot price. Product 3.2
- [ ] Paid tiers — $0 free (delayed, spot only), $49-99/mo developer (real-time, historical), $299-499/mo enterprise (WebSocket, forwards, bulk export, SLA)
- [ ] Historical data product — sell structured pricing database to researchers/analysts. $500-2K/yr academic, $5-10K/yr commercial
- [ ] Developer-friendly language — API docs and calculator should use plain language (κ = "your price exposure multiplier", Δ_cache = "what caching saves you per query"). Save finance jargon for methodology page

## Known Issues

- [ ] OpenAI returns 403 on scraping
- [ ] GCP org policy (Syngraph Workspace) blocks allUsers IAM on Cloud Run
- [ ] θ and σ showing dummy identical values across all models
- [ ] Chart x-axis rendering 1970 epoch dates
- [ ] Gemini 2.5 Flash showing minor r_in/r_cache discrepancy vs live pricing
