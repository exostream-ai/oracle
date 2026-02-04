// Exostream Core Types
// Based on the model specification v3.0

/**
 * Context pricing tier - defines a tier boundary and rate multiplier
 * tau values are fractions of W (0 to 1)
 */
export interface ContextTier {
  tauStart: number;   // fraction of W where tier begins (0.0-1.0)
  tauEnd: number;     // fraction of W where tier ends
  alpha: number;      // rate multiplier for this tier
}

/**
 * Provider information
 */
export interface Provider {
  providerId: string;        // e.g., 'anthropic', 'openai'
  displayName: string;       // e.g., 'Anthropic', 'OpenAI'
  pricingUrl?: string;       // primary pricing page URL
  docsUrl?: string;          // model documentation URL
  changelogUrl?: string;     // blog/changelog URL
}

/**
 * Model family with structural Greeks
 * Greeks are ratios and parameters set by the provider
 */
export interface ModelFamily {
  familyId: string;          // e.g., 'claude-4', 'gpt-4.1'
  providerId: string;
  displayName: string;       // e.g., 'Claude 4', 'GPT-4.1'
  rIn: number;               // input/output price ratio
  rCache: number;            // cache discount ratio
  rThink?: number;           // thinking token ratio (reasoning models)
  rBatch?: number;           // batch/sync price ratio
  isReasoning: boolean;
}

/**
 * Individual model - the tradable asset
 */
export interface Model {
  modelId: string;           // e.g., 'opus-4.5', 'gpt-4.1-mini'
  familyId: string;
  displayName: string;       // e.g., 'Claude Opus 4.5'
  tickerSync: string;        // e.g., 'OPUS-4.5'
  tickerBatch?: string;      // e.g., 'OPUS-4.5.B'
  contextWindow: number;     // W: max tokens
  launchDate?: Date;
  deprecationDate?: Date;
  status: 'active' | 'deprecated' | 'announced';
  // Family-level Greek overrides (undefined = use family default)
  rInOverride?: number;
  rCacheOverride?: number;
  rThinkOverride?: number;
  rBatchOverride?: number;
}

/**
 * Spot price observation
 */
export interface SpotPrice {
  modelId: string;
  priceType: 'sync' | 'batch';
  beta: number;              // $/M output tokens
  source: string;            // e.g., 'scraper:anthropic-pricing'
  sourceUrl?: string;
  observedAt: Date;
  effectiveFrom?: Date;
}

/**
 * Extrinsic parameters computed by the oracle
 */
export interface ExtrinsicParams {
  modelId: string;
  theta: number;             // monthly decay rate
  sigma: number;             // realized monthly volatility
  windowStart: Date;
  windowEnd: Date;
  nObservations: number;
  familyPriorWeight?: number; // gamma_t: 0 = pure prior, 1 = pure observed
  computedAt: Date;
}

/**
 * Forward price at a standard tenor
 */
export interface ForwardPrice {
  modelId: string;
  priceType: 'sync' | 'batch';
  tenor: '1M' | '3M' | '6M';
  betaSpot: number;          // spot price used
  thetaUsed: number;         // theta used for calculation
  betaForward: number;       // computed forward price
  decayFactor: number;       // D(t) = e^(-theta*t)
  computedAt: Date;
}

/**
 * Task profile - user input for pricing calculation
 */
export interface TaskProfile {
  modelId?: string;
  nIn: number;               // input tokens
  nOut: number;              // output tokens
  nThink?: number;           // thinking tokens (reasoning models)
  eta?: number;              // cache hit ratio (0-1)
  horizonMonths?: number;    // forward horizon
}

/**
 * Pricing result from the task pricer
 */
export interface PricingResult {
  spot: {
    costUsd: number;
    kappa: number;           // context cost multiplier / delta
    rInEff: number;          // effective input rate
    betaUsed: number;
  };
  forward?: {
    costUsd: number;
    betaForward: number;
    thetaUsed: number;
    decayFactor: number;
    horizonMonths: number;
  };
  deltas?: {
    cacheValue: number;      // savings from caching
    priceSensitivity: number; // kappa * nOut * 1e-6
  };
  oracleTimestamp: Date;
}

/**
 * Model parameters needed for pricing calculation
 */
export interface ModelPricingParams {
  beta: number;              // spot price $/M output
  betaBatch?: number;        // batch price
  rIn: number;               // input/output ratio
  rCache: number;            // cache discount ratio
  rThink?: number;           // thinking token ratio
  rBatch?: number;           // batch discount ratio
  W: number;                 // context window
  tiers: ContextTier[];      // context pricing tiers
  theta?: number;            // decay rate
  sigma?: number;            // volatility
}

/**
 * Full Greek sheet for a model
 */
export interface GreekSheet {
  modelId: string;
  displayName: string;
  tickerSync: string;
  tickerBatch?: string;
  providerName: string;
  contextWindow: number;
  // Structural Greeks
  rIn: number;
  rCache: number;
  rThink?: number;
  rBatch?: number;
  isReasoning: boolean;
  // Current spot
  betaSync?: number;
  betaBatch?: number;
  // Extrinsics
  theta?: number;
  sigma?: number;
  familyPriorWeight?: number;
}

/**
 * Oracle state - cached in memory for fast API responses
 */
export interface OracleState {
  models: Map<string, GreekSheet>;
  forwardCurves: Map<string, ForwardPrice[]>;
  lastUpdate: Date;
  cacheAgeSeconds: number;
}
