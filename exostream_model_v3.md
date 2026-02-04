# Exostream.ai — LLM Inference Pricing Oracle

## Model Specification v3.0

---

## Core Thesis

LLM tokens are consumable commodities with observable market prices but no financial infrastructure — no canonical price feeds, no forward curves, no benchmark indices. Exostream builds this infrastructure. The oracle publishes a parameter set that fully describes the inference pricing market, enabling cost optimization, budget planning, hedging, and eventually tradable instruments.

---

## Structural Principle: Intrinsic vs Extrinsic Value

Every parameter in the model falls into one of two categories:

**Intrinsic value** — observable, deterministic, derived directly from published provider pricing. No estimation, no modeling, no judgment. This is the spot price engine. It answers: *what does this task cost right now?*

**Extrinsic value** — estimated from historical price data through mechanical computation. No forecasting, no editorial judgment, no event prediction. This is the dynamics engine. It answers: *what trajectory is the market revealing?*

The separation is load-bearing. Intrinsic value is the settlement price for any future tradable instrument. Extrinsic value is the risk surface around it. Contaminating one with the other destroys the oracle's authority as a reference rate.

**The line:** both sides are computed from observables. Intrinsic uses *current* published prices. Extrinsic uses *historical* published prices. Neither involves forecasting discrete events, rating quality, or expressing views. The oracle is infrastructure, not a ratings agency.

---

## The Fundamental Equation

$$C(T, M, t) = S(T, M) \times D(M, t)$$

| Term | Name | Domain |
|------|------|--------|
| **C** | Total expected cost of an inference task | Full model |
| **S** | Spot cost — intrinsic value of the task at current prices | Intrinsic |
| **D** | Decay factor — extrinsic dynamics of the model's price trajectory | Extrinsic |

Where **T** is the task profile (token counts, cache behavior), **M** is the model, and **t** is the forward time horizon in months (t = 0 for spot).

At spot (t = 0), D = 1 and C = S. The user gets an exact, observable cost. For any t > 0, D captures the market-revealed price trajectory.

---

## Part I: Intrinsic Value — The Spot Price Engine

### 1.1 Ticker Price β

The anchor of the entire model:

$$\beta(M) = \text{published output token price, sync mode, at origin provider}$$

Units: USD per million tokens ($/M).

**Origin provider** = the model developer (Anthropic for Claude, OpenAI for GPT, Google for Gemini). This is the reference rate. Downstream provider pricing is spread over this base — useful for arbitrage but not for the canonical price.

Each model has two tickers reflecting two genuinely independent products:

| Ticker | Description |
|--------|-------------|
| `MODEL` | Sync output — the reference price |
| `MODEL.B` | Batch output — different latency contract, different user population |

Batch carries independent price risk (providers can reprice batch without touching sync), so it warrants its own ticker.

### 1.2 Structural Greeks

Greeks are ratios and parameters **set by the provider** as part of the pricing structure. They don't fluctuate independently — they move only when the provider explicitly changes them. The oracle observes and publishes them.

| Greek | Definition | Typical Range |
|-------|-----------|---------------|
| r_in(F) | Input/output price ratio for model family F | 0.20 – 0.50 |
| r_cache(F) | Cache price as fraction of output price | 0.01 – 0.10 |
| r_think(F) | Thinking token price ratio (reasoning models) | 0.50 – 1.00+ |
| r_batch(F) | Batch discount ratio (batch / sync price) | 0.40 – 0.60 |
| W(M) | Maximum context window size (tokens) | 128K – 2M |

**Family-level parameters.** r_in, r_cache, r_think, and r_batch are typically constant across a model family (e.g., all Claude 4.x models share the same ratios). The oracle publishes at the family level and flags any model-specific overrides.

### 1.3 The Context Cost Curve

Context depth is the largest variable cost lever for most inference tasks. The current market prices context (input tokens) as a flat ratio of output tokens, but this is a temporary equilibrium. As context windows scale to 1M+ tokens, providers will inevitably introduce tiered pricing that reflects the superlinear compute cost of attention at depth.

The oracle must be forward-compatible with this transition.

#### Context Tiers — Normalized by Provider Window

To handle provider variability, tiers are defined as **fractions of the provider's maximum context window W(M)**. This normalizes across providers automatically — a task using 50% of any provider's window maps to the same tier, regardless of whether that's 64K or 500K tokens.

Define context tier boundaries as fractions of W(M):

$$\tau_0 = 0, \quad \tau_1, \quad \tau_2, \quad \ldots, \quad \tau_K = 1$$

Each tier k has its own input rate multiplier α_k:

| Tier | Window Fraction | Rate Multiplier | Current Market |
|------|----------------|-----------------|----------------|
| Tier 0 | 0 – τ₁ | α₀ = 1.0 | Flat pricing |
| Tier 1 | τ₁ – τ₂ | α₁ ≥ 1.0 | Not yet observed |
| Tier 2 | τ₂ – 1.0 | α₂ ≥ α₁ | Not yet observed |

**Today:** All providers are single-tier (K = 1, α₀ = 1.0). The model degrades gracefully to the simple flat case.

**Tomorrow:** When a provider introduces tiered context pricing, the oracle adds breakpoints and multipliers. No structural change — just additional published parameters.

#### Computing the Effective Input Rate

For a task consuming n_in input tokens on model M with cache hit ratio η:

**Step 1 — Distribute tokens across tiers.**

The token count falling in tier k:

$$n_k = \min(n_{in},\ \tau_{k+1} \cdot W) - \min(n_{in},\ \tau_k \cdot W)$$

**Step 2 — Compute the depth-weighted base input rate.**

$$\bar{r}_{in}^{depth} = \frac{1}{n_{in}} \sum_{k=0}^{K-1} n_k \cdot \alpha_k \cdot r_{in}(F)$$

When pricing is flat (single tier, α₀ = 1), this reduces to just r_in(F).

**Step 3 — Apply cache.**

Cache reduces the effective input rate. Cached tokens bypass full input processing:

$$\bar{r}_{in}^{eff} = \bar{r}_{in}^{depth} \times (1 - \eta) + r_{cache}(F) \times \eta$$

Where η is the user's cache hit ratio (0 to 1). Cache savings are multiplicative with context depth — the absolute dollar savings scale with both η and n_in.

### 1.4 κ — The Task's Delta to β

κ is the **context cost multiplier**: for every dollar spent on output tokens, how many additional dollars does context add? But κ also functions as the task's **delta** — its sensitivity to ticker price movements.

$$\kappa(n_{in}, n_{out}, \eta, M) = 1 + \frac{n_{in}}{n_{out}} \times \bar{r}_{in}^{eff}$$

**As a cost multiplier:** the task costs κ times more than output tokens alone.

**As delta:** if β moves by Δβ, the task's cost moves by:

$$\Delta S = \kappa \times n_{out} \times \Delta\beta \times 10^{-6}$$

A heavy-context user (κ = 4.5) is 4.5× more exposed to a ticker price change than a thin-context user (κ ≈ 1). This reframes cost optimization as exposure management — reducing κ reduces your delta to the market.

**Properties of κ:**

- **κ = 1** when n_in = 0 (pure generation, no context). Cost = output tokens only.
- **κ scales linearly** with context depth under flat pricing (current market).
- **κ scales superlinearly** under tiered pricing (future market).
- **κ decreases with η** — cache always reduces exposure.
- **κ is provider-normalized** — tier boundaries as fractions of W(M) make κ values comparable across providers at equivalent resource intensity.

### 1.5 ω (Omega) — Depth Convexity

Omega measures the **acceleration of cost as context depth increases** — the second derivative of spot cost with respect to input token count.

$$\omega(n_{in}, M) = \frac{\partial^2 S}{\partial n_{in}^2}$$

Under flat pricing:

$$\omega = 0 \quad \text{everywhere}$$

Cost is linear in context depth. Each additional token of context costs exactly the same as the last.

Under tiered pricing, at a tier boundary where the rate multiplier steps from α_k to α_{k+1}:

$$\omega > 0$$

Each additional token of context becomes more expensive than the last. The cost curve is convex.

**Why ω matters:** agentic systems and dynamic-context workflows need to know not just their current cost (S) or their price sensitivity (κ), but whether that sensitivity is accelerating. ω = 0 means linear scaling — safe to expand context freely. ω > 0 means convex scaling — context expansion has increasing marginal cost, and the system should optimize for compression or pruning.

**Current value:** ω = 0 for all models (flat pricing regime). The parameter is structurally defined and architecturally ready for the market transition to tiered pricing.

### 1.6 The Spot Cost Function

Assembling everything:

$$S(T, M) = \beta(M) \times \left[ n_{out} \times \kappa + n_{think} \times r_{think}(F) \right] \times 10^{-6}$$

Equivalently, expanded:

$$S = \beta \times \left[ n_{out} + n_{in} \times \bar{r}_{in}^{eff} + n_{think} \times r_{think} \right] \times 10^{-6}$$

Where:
- **β** = ticker price ($/M output tokens, sync)
- **n_out** = output tokens (the base unit, priced at β)
- **n_in** = input tokens, priced through the context cost curve
- **r̄_in^eff** = effective input rate (depth-tiered, cache-adjusted)
- **n_think** = thinking/reasoning tokens (reasoning models; zero for standard models)
- **r_think** = thinking token ratio
- **10⁻⁶** = conversion from per-million pricing to per-token

**For batch mode:** replace β with the batch ticker price β_B, or equivalently:

$$S_B = S_{sync} \times r_{batch}(F)$$

### 1.7 Intrinsic Parameters Published by Oracle

Per model family (~6 families):

| Parameter | Count per Family | Description |
|-----------|-----------------|-------------|
| r_in | 1 | Input/output price ratio |
| r_cache | 1 | Cache discount ratio |
| r_think | 1 | Thinking token ratio (reasoning families only) |
| r_batch | 1 | Batch discount ratio |

Per model (~17 models):

| Parameter | Count per Model | Description |
|-----------|----------------|-------------|
| β | 1 | Sync output ticker price |
| β_B | 1 | Batch output ticker price |
| W | 1 | Maximum context window |
| {τ_k, α_k} | 2K | Context tier boundaries and multipliers |
| ω | 1 | Depth convexity (derived from tier structure) |

---

## Part II: Extrinsic Value — The Dynamics Engine

### 2.1 The Decay Rate θ

LLM token prices exhibit secular decline. GPT-4 launched at $60/M output; GPT-4.1 is $8/M. This makes every spot price a depreciating asset. The oracle captures this through a single reduced-form parameter.

$$\theta(M) = \text{continuous monthly decay rate}$$

θ is estimated mechanically from historical price data. It absorbs *all* sources of price decline — competitive pressure, new model releases, hardware cost reductions, efficiency gains, strategic repricing — into a single continuous rate. This is the standard reduced-form approach to pricing depreciating assets, directly analogous to:

- **Emerging market currency depreciation rates** — fitted from price history, implicitly capturing discrete devaluations, political events, and policy changes without modeling any of them individually.
- **TIPS breakeven inflation rates** — continuous rates estimated from market data that embed all discrete inflationary events.

The oracle does not forecast individual events. It observes the aggregate price trajectory the market is revealing.

#### θ Estimation Methodology

**For models with 3+ months of price history:**

θ is computed as an exponentially weighted decay rate from observed price changes over a trailing window of 3–6 months. Recent observations carry more weight, making θ responsive to regime changes while smooth enough to filter noise.

$$\theta = -\frac{1}{\Delta t} \sum_{i} w_i \cdot \ln\!\left(\frac{\beta_{t_i}}{\beta_{t_{i-1}}}\right)$$

Where w_i are exponentially decaying weights (recent observations weighted more heavily).

**For newly launched models (< 3 months history):**

θ is initialized from the **family prior** — the average θ across previous models in the same family, weighted by recency. Claude 5's θ at launch would be initialized from the observed decay rates of Claude 4.x and Claude 3.x models.

As the model accumulates its own price history, the oracle gradually shifts weight from the family prior to the model-specific estimate (empirical Bayes). The blending:

$$\theta_{effective} = (1 - \gamma_t) \cdot \theta_{family} + \gamma_t \cdot \theta_{observed}$$

Where γ_t increases from 0 toward 1 as the model's own data accumulates. The crossover (γ_t = 0.5) occurs at approximately 2–3 months of price history.

**For oracle cold start (Exostream launch):**

Initial θ values are bootstrapped from the public record — provider pricing page change logs, announcement archives, and cached pricing data. GPT-4's trajectory from $60/M to $30/M to $8/M, Claude's pricing history from Anthropic announcements, and similar recoverable data provide sufficient price points to fit initial estimates.

#### θ Sign and Interpretation

- **θ > 0** (typical): Price is declining. Forward curve slopes downward. Asset is depreciating.
- **θ ≈ 0**: Price is stable. Flat forward curve.
- **θ < 0** (rare): Price is increasing. Forward curve slopes upward (backwardation). Signals supply constraints, demand surge, or provider capturing monopoly rents on newest capability.

The term structure of θ across model vintages is itself informative — it reveals the typical lifecycle of pricing power for inference models.

### 2.2 Realized Volatility σ

$$\sigma(M) = \text{realized monthly volatility of } \beta(M)$$

σ is purely backward-looking — computed from observed price changes, no forecast involved. It measures price stability.

- **Low σ**: Stable pricing regime. The decay rate θ is reliable.
- **Elevated σ**: Price is in flux. A repricing event is *happening* (not predicted — observed).
- **σ spike**: Regime change underway. θ may be stale. Users should expect the forward curve to shift.

σ is computed as the standard deviation of log price returns over the trailing window, annualized to monthly.

### 2.3 The Decay Factor

$$D(M, t) = e^{-\theta(M) \cdot t}$$

Clean, single-parameter, mechanically computed from price history. All discrete events (model releases, price cuts, competitive moves) are absorbed into θ through the historical price series — just as currency forwards absorb discrete devaluation risk through the interest rate differential.

### 2.4 Forward Price

$$\beta_{fwd}(M, t) = \beta(M) \times e^{-\theta(M) \cdot t}$$

The oracle publishes forward prices at standard tenors:

| Instrument | Description |
|------------|-------------|
| `MODEL-1M` | 30-day forward price |
| `MODEL-3M` | 90-day forward price |
| `MODEL-6M` | 180-day forward price |

**Term structure interpretation:**

- **Steep contango** (forward << spot): High θ. Market history shows rapid depreciation. Likely competitive pressure or approaching obsolescence.
- **Flat curve** (forward ≈ spot): Low θ. Stable pricing regime.
- **Backwardation** (forward > spot): Negative θ. Unusual — signals appreciation, possibly a frontier model in its early monopoly-rent phase.

### 2.5 Extrinsic Parameters Published by Oracle

Per model (~17 models):

| Parameter | Count per Model | Description |
|-----------|----------------|-------------|
| θ | 1 | Monthly decay rate |
| σ | 1 | Realized monthly volatility |

---

## Part III: The Complete Model

### 3.1 Full Cost Equation

$$C(T, M, t) = S(T, M) \times D(M, t)$$

**Intrinsic (spot, t = 0):**

$$S = \beta \times \left[ n_{out} + n_{in} \times \bar{r}_{in}^{eff}(\eta, M) + n_{think} \times r_{think}(F) \right] \times 10^{-6}$$

Where:

$$\bar{r}_{in}^{eff} = \left( \frac{1}{n_{in}} \sum_{k} n_k \cdot \alpha_k \cdot r_{in} \right)(1 - \eta) \ + \ r_{cache} \cdot \eta$$

**Extrinsic (forward, t > 0):**

$$D(M, t) = e^{-\theta(M) \cdot t}$$

**Combined — expected cost of a task profile at forward horizon t:**

$$C = \beta \times \left[ n_{out} + n_{in} \times \bar{r}_{in}^{eff} + n_{think} \times r_{think} \right] \times 10^{-6} \times e^{-\theta \cdot t}$$

### 3.2 The Greek Sheet

**Task-level Greeks (computed per task profile):**

| Greek | Symbol | Formula | Interpretation |
|-------|--------|---------|----------------|
| Delta | κ | 1 + (n_in / n_out) × r̄_in^eff | Price sensitivity — cost multiplier per $1/M move in β |
| Omega | ω | ∂²S / ∂n_in² | Depth convexity — cost acceleration at context depth |

**Model-level Greeks (structural, set by provider):**

| Greek | Symbol | Scope | Description |
|-------|--------|-------|-------------|
| Input ratio | r_in | Family | Input/output price ratio |
| Cache ratio | r_cache | Family | Cache discount as fraction of output price |
| Think ratio | r_think | Family | Thinking token price ratio |
| Batch ratio | r_batch | Family | Batch/sync price ratio |

**Market-level Greeks (extrinsic, computed by oracle):**

| Greek | Symbol | Scope | Description |
|-------|--------|-------|-------------|
| Decay | θ | Model | Monthly price decay rate |
| Volatility | σ | Model | Realized monthly price volatility |

### 3.3 Derived Metrics

| Metric | Formula | Use |
|--------|---------|-----|
| β_fwd | β × e^(−θt) | Forward ticker price at horizon t |
| Δ_cache | S(η=0) − S(η=η̂) | Dollar savings from caching at hit rate η̂ |
| Δ_compress | S(n_in=N) − S(n_in=N') | Dollar savings from context compression N→N' |
| S_batch | S_sync × r_batch | Batch-equivalent spot cost |

Δ_cache and Δ_compress directly quantify the economic value of cache optimization and context compression (e.g., Syngraph) at any ticker price and task profile.

---

## Part IV: Ticker Design & Scale

### 4.1 Ticker Structure

**Spot tickers** (independent price risk):

| Format | Example | Description |
|--------|---------|-------------|
| `MODEL` | `OPUS-4.5` | Sync output reference price |
| `MODEL.B` | `OPUS-4.5.B` | Batch output |

**Forward tickers** (standard tenors):

| Format | Example | Description |
|--------|---------|-------------|
| `MODEL-1M` | `OPUS-4.5-1M` | 30-day forward |
| `MODEL-3M` | `OPUS-4.5-3M` | 90-day forward |
| `MODEL-6M` | `OPUS-4.5-6M` | 180-day forward |
| `MODEL.B-{tenor}` | `OPUS-4.5.B-3M` | Batch forward |

### 4.2 Parameter Count

For ~17 actively traded models across ~6 provider families:

**Intrinsic parameters:**

| Category | Count | Notes |
|----------|-------|-------|
| Sync tickers (β) | 17 | One per model |
| Batch tickers (β_B) | 17 | One per model |
| Family Greeks | ~24 | r_in, r_cache, r_think, r_batch × ~6 families |
| Context windows (W) | 17 | One per model |
| Context tiers ({τ_k, α_k}) | ~34 | 2 per model at K=1 (scales with tiering) |

**Extrinsic parameters:**

| Category | Count | Notes |
|----------|-------|-------|
| Decay rates (θ) | 17 | One per model |
| Volatility (σ) | 17 | One per model |

**Task-level (computed on demand, not stored):**

| Category | Notes |
|----------|-------|
| κ (delta) | Function of task profile |
| ω (omega) | Derived from tier structure; currently 0 for all |

**Total published parameters: ~143**

(Grows modestly with new models. Scales with context tier introduction.)

---

## Part V: Design Decisions

### Included — and why

1. **Ticker = output token price at origin provider.** Output is the product. Input is a structural cost modifier captured by the context curve.
2. **Batch is a separate ticker.** Different product, different latency contract, independent price risk.
3. **Intrinsic/extrinsic separation is structural.** Settlement prices never depend on estimated dynamics. Both sides derived from observables — current prices (intrinsic) or historical prices (extrinsic).
4. **Context tiers normalized by window fraction.** Provider-agnostic comparison of context intensity. Forward-compatible with tiered pricing.
5. **Cache is structural, applied by user.** Fixed ratio set by provider × user's own hit rate η.
6. **κ as delta.** Reframes cost optimization as exposure management. Users understand not just "what does this cost" but "how exposed am I to price moves."
7. **ω (omega) as depth convexity.** Architecturally defined even though currently zero. Ready for the tiered pricing transition. Critical for agentic systems that dynamically scale context.
8. **θ as reduced-form decay.** Single parameter absorbing all sources of price decline. Analogous to EM currency depreciation rates. Estimated mechanically from price history with family-prior Bayesian initialization for new models.
9. **Forward prices at standard tenors.** 1M, 3M, 6M — short-dated to respect depreciation dynamics.

### Excluded — and why

1. **No provider dimension.** Oracle publishes origin price only. Downstream spreads are for arbitrageurs, not the reference rate. We are the NYSE, not tracking every OTC venue.
2. **No volume tiers.** Bilateral private deals. OTC, not reference rate material.
3. **No quality score (Q).** The oracle is pricing infrastructure, not a ratings agency. Quality-adjusted analytics are a separate product built on top of the price feed.
4. **No input ticker.** Input/output ratio is structural, set by provider. No independent price risk.
5. **No event parameters (λ, E[J]).** Event frequency and expected jump size are forecasts — editorial, not infrastructure. θ absorbs event impact through the historical price series, just as currency forwards absorb devaluation risk through the rate differential. Bitcoin halvings are perfectly predictable yet futures don't mechanistically price them as discrete parameters. The oracle doesn't predict events; it observes the aggregate trajectory.
6. **No rho (compute cost sensitivity).** Conceptually valid — sensitivity to underlying GPU cost — but GPU cost per token is unobservable from public data. Too many intermediate variables (model architecture, hardware mix, utilization, optimization stack) between headline GPU-hour price and token production cost. Revisit if on-chain inference markets or other mechanisms make compute cost per token publicly observable.

---

## Appendix A: Validated Example

### A.1 Spot Cost — RAG Application on Opus 4.5

Task profile: 30K context tokens, 800 output tokens, 60% cache hit, sync mode, flat pricing.

**Parameters:**
- β = $45.00/M
- r_in = 0.20
- r_cache = 0.022
- η = 0.60
- W = 200K
- K = 1 (flat pricing), α₀ = 1.0

**Step 1 — Effective input rate:**

$$\bar{r}_{in}^{eff} = 0.20 \times (1 - 0.60) + 0.022 \times 0.60 = 0.080 + 0.013 = 0.093$$

**Step 2 — κ (delta):**

$$\kappa = 1 + \frac{30{,}000}{800} \times 0.093 = 1 + 3.49 = 4.49$$

Interpretation: this task profile is 4.49× exposed to ticker price movements. A $1/M move in β changes cost by 4.49× more than for a zero-context task.

**Step 3 — Spot cost:**

$$S = 45 \times \left[ 800 + 30{,}000 \times 0.093 \right] \times 10^{-6} = 45 \times 3{,}590 \times 10^{-6} = \$0.162$$

### A.2 Context Compression Value (Syngraph)

Compressing context from 30K → 3K tokens:

$$\kappa_{new} = 1 + \frac{3{,}000}{800} \times 0.093 = 1.35$$

$$S_{new} = 45 \times 1{,}079 \times 10^{-6} = \$0.049$$

$$\Delta_{compress} = \$0.162 - \$0.049 = \$0.113 \text{ per query (70\% reduction)}$$

Delta drops from 4.49 to 1.35 — context compression doesn't just save money, it reduces price exposure by 70%.

### A.3 Forward Pricing

3-month horizon with θ = 0.031/month:

$$D(3) = e^{-0.031 \times 3} = e^{-0.093} = 0.911$$

$$\beta_{fwd}(3M) = 45.00 \times 0.911 = \$41.01\text{/M}$$

$$C_{fwd} = 0.162 \times 0.911 = \$0.148$$

Expected cost of the same task in 3 months: $0.148 vs $0.162 today.

### A.4 Cache Value Quantification

Same task, comparing 0% vs 60% cache hit:

$$S(\eta = 0) = 45 \times [800 + 30{,}000 \times 0.20] \times 10^{-6} = 45 \times 6{,}800 \times 10^{-6} = \$0.306$$

$$S(\eta = 0.60) = \$0.162$$

$$\Delta_{cache} = \$0.306 - \$0.162 = \$0.144 \text{ per query}$$

At 1M queries/month, caching saves $144,000/month on this single task profile.

---

## Appendix B: Notation Reference

| Symbol | Name | Type | Description |
|--------|------|------|-------------|
| β | Ticker price | Intrinsic | Output token price at origin ($/M) |
| β_B | Batch ticker | Intrinsic | Batch output token price ($/M) |
| r_in | Input ratio | Structural Greek | Input/output price ratio |
| r_cache | Cache ratio | Structural Greek | Cache discount as fraction of β |
| r_think | Think ratio | Structural Greek | Thinking token price ratio |
| r_batch | Batch ratio | Structural Greek | Batch/sync price ratio |
| W | Context window | Structural | Maximum tokens |
| τ_k | Tier boundary | Structural | Fraction of W where tier k begins |
| α_k | Tier multiplier | Structural | Rate multiplier for tier k |
| η | Cache hit ratio | User variable | Fraction of input tokens cached (0–1) |
| n_in | Input tokens | User variable | Context token count |
| n_out | Output tokens | User variable | Generation token count |
| n_think | Think tokens | User variable | Reasoning token count |
| r̄_in^eff | Effective input rate | Computed | Blended rate after tiers + cache |
| κ | Delta | Task Greek | Context cost multiplier / price sensitivity |
| ω | Omega | Task Greek | Depth convexity (∂²S/∂n_in²) |
| θ | Decay rate | Extrinsic | Monthly price decay (from price history) |
| σ | Volatility | Extrinsic | Realized monthly price volatility |
| S | Spot cost | Intrinsic | Current task cost |
| D | Decay factor | Extrinsic | e^(−θt) |
| C | Total cost | Combined | S × D |
| β_fwd | Forward price | Derived | β × D(t) |
| Δ_cache | Cache value | Derived | Cost savings from caching |
| Δ_compress | Compression value | Derived | Cost savings from context compression |
