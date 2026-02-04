-- ============================================================
-- EXOSTREAM.AI — ORACLE DATABASE SCHEMA
-- ============================================================
-- Designed for: PostgreSQL (TimescaleDB extension recommended
-- for time-series tables)
--
-- Naming: snake_case throughout. Prefixes group tables by domain.
-- ============================================================


-- ============================================================
-- REFERENCE DATA (slowly changing dimensions)
-- ============================================================

-- Providers: Anthropic, OpenAI, Google, xAI, Meta, Mistral, DeepSeek
CREATE TABLE providers (
    provider_id     TEXT PRIMARY KEY,          -- e.g., 'anthropic', 'openai'
    display_name    TEXT NOT NULL,             -- e.g., 'Anthropic', 'OpenAI'
    pricing_url     TEXT,                      -- primary pricing page URL
    docs_url        TEXT,                      -- model documentation URL
    changelog_url   TEXT,                      -- blog/changelog URL
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Model families: Claude 4.x, GPT-4.x, Gemini 2.x, etc.
-- Structural Greeks are set at family level.
CREATE TABLE model_families (
    family_id       TEXT PRIMARY KEY,          -- e.g., 'claude-4', 'gpt-4.1'
    provider_id     TEXT NOT NULL REFERENCES providers(provider_id),
    display_name    TEXT NOT NULL,             -- e.g., 'Claude 4', 'GPT-4.1'
    r_in            NUMERIC(8,6) NOT NULL,     -- input/output price ratio
    r_cache         NUMERIC(8,6) NOT NULL,     -- cache discount ratio
    r_think         NUMERIC(8,6),              -- thinking token ratio (NULL if not reasoning family)
    r_batch         NUMERIC(8,6),              -- batch/sync price ratio (NULL if no batch)
    is_reasoning    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual models: the tradable assets
CREATE TABLE models (
    model_id        TEXT PRIMARY KEY,          -- e.g., 'opus-4.5', 'gpt-4.1-mini'
    family_id       TEXT NOT NULL REFERENCES model_families(family_id),
    display_name    TEXT NOT NULL,             -- e.g., 'Claude Opus 4.5'
    ticker_sync     TEXT NOT NULL UNIQUE,      -- e.g., 'OPUS-4.5'
    ticker_batch    TEXT UNIQUE,               -- e.g., 'OPUS-4.5.B' (NULL if no batch)
    context_window  INTEGER NOT NULL,          -- W: max tokens
    launch_date     DATE,                      -- when the model became available
    deprecation_date DATE,                     -- when deprecated (NULL if active)
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'deprecated', 'announced')),
    -- Family-level Greek overrides (NULL = use family default)
    r_in_override   NUMERIC(8,6),
    r_cache_override NUMERIC(8,6),
    r_think_override NUMERIC(8,6),
    r_batch_override NUMERIC(8,6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Context pricing tiers per model
-- Most models have 1 row (flat pricing). Tiered models have multiple.
CREATE TABLE context_tiers (
    tier_id         SERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL REFERENCES models(model_id),
    tier_index      INTEGER NOT NULL,          -- 0-based ordering
    tau_start       NUMERIC(8,6) NOT NULL,     -- fraction of W where tier begins (0.0-1.0)
    tau_end         NUMERIC(8,6) NOT NULL,     -- fraction of W where tier ends
    alpha           NUMERIC(8,4) NOT NULL,     -- rate multiplier for this tier
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to    TIMESTAMPTZ,               -- NULL = currently active
    UNIQUE (model_id, tier_index, effective_from),
    CHECK (tau_start >= 0 AND tau_end <= 1 AND tau_start < tau_end),
    CHECK (alpha > 0)
);


-- ============================================================
-- PRICE DATA (time-series — core of the oracle)
-- ============================================================

-- Spot ticker prices: the canonical record
-- Each row = one observed price for one model at one point in time
CREATE TABLE spot_prices (
    price_id        BIGSERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL REFERENCES models(model_id),
    price_type      TEXT NOT NULL CHECK (price_type IN ('sync', 'batch')),
    beta            NUMERIC(12,4) NOT NULL,    -- $/M output tokens
    source          TEXT NOT NULL,             -- e.g., 'scraper:anthropic-pricing', 'manual'
    source_url      TEXT,                      -- URL of the pricing page snapshot
    observed_at     TIMESTAMPTZ NOT NULL,      -- when the price was observed
    effective_from  TIMESTAMPTZ,               -- when the price took effect (if known)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spot_prices_model_time ON spot_prices (model_id, observed_at DESC);
CREATE INDEX idx_spot_prices_type ON spot_prices (price_type, observed_at DESC);

-- Price change events: detected transitions in β
-- Materialized from spot_prices when a change is detected
CREATE TABLE price_events (
    event_id        BIGSERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL REFERENCES models(model_id),
    price_type      TEXT NOT NULL CHECK (price_type IN ('sync', 'batch')),
    beta_before     NUMERIC(12,4) NOT NULL,
    beta_after      NUMERIC(12,4) NOT NULL,
    pct_change      NUMERIC(8,6) NOT NULL,     -- (after - before) / before
    detected_at     TIMESTAMPTZ NOT NULL,
    effective_at    TIMESTAMPTZ,               -- when provider said it took effect
    source_event    TEXT,                      -- e.g., 'model-release', 'price-cut', 'repricing'
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_events_model ON price_events (model_id, detected_at DESC);


-- ============================================================
-- COMPUTED PARAMETERS (oracle outputs — recomputed periodically)
-- ============================================================

-- Extrinsic parameters: θ and σ per model, versioned over time
CREATE TABLE extrinsic_params (
    param_id        BIGSERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL REFERENCES models(model_id),
    theta           NUMERIC(10,6) NOT NULL,    -- monthly decay rate
    sigma           NUMERIC(10,6) NOT NULL,    -- realized monthly volatility
    -- Estimation metadata
    window_start    TIMESTAMPTZ NOT NULL,      -- start of estimation window
    window_end      TIMESTAMPTZ NOT NULL,      -- end of estimation window
    n_observations  INTEGER NOT NULL,          -- price observations in window
    family_prior_weight NUMERIC(4,3),          -- γ_t: 0 = pure prior, 1 = pure observed
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extrinsic_model_time ON extrinsic_params (model_id, computed_at DESC);

-- Forward prices: published at standard tenors
CREATE TABLE forward_prices (
    forward_id      BIGSERIAL PRIMARY KEY,
    model_id        TEXT NOT NULL REFERENCES models(model_id),
    price_type      TEXT NOT NULL CHECK (price_type IN ('sync', 'batch')),
    tenor           TEXT NOT NULL CHECK (tenor IN ('1M', '3M', '6M')),
    beta_spot       NUMERIC(12,4) NOT NULL,    -- spot price used
    theta_used      NUMERIC(10,6) NOT NULL,    -- θ used for calculation
    beta_forward    NUMERIC(12,4) NOT NULL,    -- computed forward price
    decay_factor    NUMERIC(10,6) NOT NULL,    -- D(t) = e^(-θt)
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forward_model_tenor ON forward_prices (model_id, tenor, computed_at DESC);


-- ============================================================
-- SCRAPING & INGESTION INFRASTRUCTURE
-- ============================================================

-- Scrape log: every scrape attempt recorded
CREATE TABLE scrape_log (
    scrape_id       BIGSERIAL PRIMARY KEY,
    provider_id     TEXT NOT NULL REFERENCES providers(provider_id),
    target_url      TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success', 'failure', 'changed', 'unchanged')),
    content_hash    TEXT,                      -- hash of scraped content for change detection
    prev_hash       TEXT,                      -- previous hash for comparison
    response_code   INTEGER,
    error_message   TEXT,
    duration_ms     INTEGER,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scrape_provider ON scrape_log (provider_id, scraped_at DESC);

-- Raw page snapshots: stored for audit trail and debugging
CREATE TABLE page_snapshots (
    snapshot_id     BIGSERIAL PRIMARY KEY,
    scrape_id       BIGINT REFERENCES scrape_log(scrape_id),
    provider_id     TEXT NOT NULL,
    url             TEXT NOT NULL,
    content_html    TEXT,                      -- raw HTML (compressed in production)
    content_hash    TEXT NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- FAMILY PRIOR HISTORY (for Bayesian θ initialization)
-- ============================================================

-- Tracks family-level θ estimates over time for prior computation
CREATE TABLE family_theta_history (
    history_id      BIGSERIAL PRIMARY KEY,
    family_id       TEXT NOT NULL REFERENCES model_families(family_id),
    theta_family    NUMERIC(10,6) NOT NULL,    -- family-level θ estimate
    models_in_estimate INTEGER NOT NULL,       -- how many models contributed
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- VIEWS — CONVENIENT ACCESS PATTERNS
-- ============================================================

-- Current spot prices (latest observation per model)
CREATE VIEW v_current_spots AS
SELECT DISTINCT ON (model_id, price_type)
    sp.model_id,
    m.ticker_sync,
    m.ticker_batch,
    m.display_name,
    sp.price_type,
    sp.beta,
    sp.observed_at,
    sp.source
FROM spot_prices sp
JOIN models m ON sp.model_id = m.model_id
WHERE m.status = 'active'
ORDER BY model_id, price_type, observed_at DESC;

-- Current extrinsic parameters (latest per model)
CREATE VIEW v_current_extrinsics AS
SELECT DISTINCT ON (model_id)
    ep.model_id,
    m.display_name,
    ep.theta,
    ep.sigma,
    ep.family_prior_weight,
    ep.n_observations,
    ep.computed_at
FROM extrinsic_params ep
JOIN models m ON ep.model_id = m.model_id
WHERE m.status = 'active'
ORDER BY model_id, computed_at DESC;

-- Latest forward curve per model
CREATE VIEW v_current_forwards AS
SELECT DISTINCT ON (model_id, price_type, tenor)
    fp.model_id,
    m.display_name,
    fp.price_type,
    fp.tenor,
    fp.beta_spot,
    fp.beta_forward,
    fp.theta_used,
    fp.decay_factor,
    fp.computed_at
FROM forward_prices fp
JOIN models m ON fp.model_id = m.model_id
WHERE m.status = 'active'
ORDER BY model_id, price_type, tenor, computed_at DESC;

-- Full Greek sheet: one row per active model with all parameters
CREATE VIEW v_greek_sheet AS
SELECT
    m.model_id,
    m.display_name,
    m.ticker_sync,
    m.ticker_batch,
    m.context_window,
    -- Structural Greeks (model override or family default)
    COALESCE(m.r_in_override, mf.r_in) AS r_in,
    COALESCE(m.r_cache_override, mf.r_cache) AS r_cache,
    COALESCE(m.r_think_override, mf.r_think) AS r_think,
    COALESCE(m.r_batch_override, mf.r_batch) AS r_batch,
    mf.is_reasoning,
    -- Current spot
    cs_sync.beta AS beta_sync,
    cs_batch.beta AS beta_batch,
    -- Current extrinsics
    ce.theta,
    ce.sigma,
    ce.family_prior_weight,
    -- Provider info
    p.display_name AS provider_name
FROM models m
JOIN model_families mf ON m.family_id = mf.family_id
JOIN providers p ON mf.provider_id = p.provider_id
LEFT JOIN v_current_spots cs_sync
    ON m.model_id = cs_sync.model_id AND cs_sync.price_type = 'sync'
LEFT JOIN v_current_spots cs_batch
    ON m.model_id = cs_batch.model_id AND cs_batch.price_type = 'batch'
LEFT JOIN v_current_extrinsics ce
    ON m.model_id = ce.model_id
WHERE m.status = 'active';

-- Context tier structure per model
CREATE VIEW v_active_tiers AS
SELECT
    ct.model_id,
    m.display_name,
    m.context_window,
    ct.tier_index,
    ct.tau_start,
    ct.tau_end,
    ct.alpha,
    -- Absolute token boundaries
    ROUND(ct.tau_start * m.context_window) AS tokens_start,
    ROUND(ct.tau_end * m.context_window) AS tokens_end
FROM context_tiers ct
JOIN models m ON ct.model_id = m.model_id
WHERE ct.effective_to IS NULL
  AND m.status = 'active'
ORDER BY ct.model_id, ct.tier_index;


-- ============================================================
-- INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================

-- "Give me the full price history for a model"
CREATE INDEX idx_spot_model_chrono ON spot_prices (model_id, observed_at ASC);

-- "What changed in the last 24 hours?"
CREATE INDEX idx_price_events_recent ON price_events (detected_at DESC);

-- "All active models for a provider"
CREATE INDEX idx_models_family ON models (family_id) WHERE status = 'active';
