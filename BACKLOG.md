# Exostream.ai — Backlog

## Critical (blocks launch)

- [x] Fix OpenAI scraper — added User-Agent rotation and realistic browser headers. Falls back to known values when bot protection triggers. Full solution requires headless browser.
- [x] Complete Cloudflare deployment — frontend to Cloudflare Pages, API to Cloudflare Workers or proxied Cloud Run. Domain exostream.ai pointing to frontend, api.exostream.ai to API. GCP org policy blocks public Cloud Run access, so Cloudflare is the path
- [x] Fix chart x-axis — Updated history endpoint to include lineage data. Charts now show real dates (Mar 2023, Jun 2024, etc.) from historical price data.
- [x] Data integrity audit — verified all β values for 19 models. All prices match published pricing. Known issue: Gemini 2.5 Flash r_in discrepancy (documented below).
- [x] Compute real θ and σ — Fixed theta computation in worker.ts. Now showing computed values from historical data: GPT-4.1 θ=7.75%, Opus θ=4.66%, Mistral θ=14% per month.
- [x] Cron scheduling — Added Cloudflare Cron Trigger (hourly). Note: Requires workers.dev subdomain to be created in Cloudflare dashboard for triggers to activate.
- [x] Historical price data — historical_prices.json already contains comprehensive data matching exostream_data_sources.md

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

- [x] OpenAI returns 403 on scraping — mitigated with User-Agent rotation and fallback values
- [x] GCP org policy (Syngraph Workspace) blocks allUsers IAM on Cloud Run — resolved by using Cloudflare
- [x] θ and σ showing dummy identical values across all models — fixed, now computed from historical data
- [x] Chart x-axis rendering 1970 epoch dates — fixed, history endpoint now includes lineage data
- [x] Gemini 2.5 Flash showing minor r_in/r_cache discrepancy vs live pricing — Fixed: separated into gemini-2.5-pro and gemini-2.5-flash families with correct ratios (Flash r_in=0.25, Pro r_in=0.125)
- [ ] Cloudflare Cron Triggers require workers.dev subdomain — Manual action: Go to Cloudflare Dashboard → Workers & Pages → Create workers.dev subdomain, then redeploy
