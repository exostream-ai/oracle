/**
 * Exostream API - Cloudflare Workers Entry Point
 *
 * This is the Workers-compatible version of the API.
 * It bundles seed data and exports a fetch handler.
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';

// Environment bindings type
interface Env {
  API_KEYS: KVNamespace;
  ENVIRONMENT: string;
}

// API Key storage format
interface ApiKeyData {
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
  requestCount: number;
  tier: 'free' | 'developer' | 'enterprise';
  rateLimit: number; // requests per minute
}

// Generate a cryptographically secure API key
function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [];
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  let byteIdx = 0;
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 8; i++) {
      segment += chars[randomBytes[byteIdx++] % chars.length];
    }
    segments.push(segment);
  }
  return `exo_${segments.join('_')}`;
}

// Import seed data directly (bundled with worker)
import providers from '../../seed/providers.json';
import families from '../../seed/families.json';
import models from '../../seed/models.json';
import historicalPrices from '../../seed/historical_prices.json';

// Types
import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '../core/types.js';

// Core pricing functions — single source of truth for math
import { effectiveInputRate, kappa as computeKappa, spotCost as computeSpotCost, forwardPrice as computeForwardPrice, decayFactor as computeDecayFactor } from '../core/pricing.js';

// Seed data types
interface SeedModel {
  model_id: string;
  family_id: string;
  display_name: string;
  ticker_sync: string;
  ticker_batch: string | null;
  context_window: number;
  tiers: { tau_start: number; tau_end: number; alpha: number }[];
}

interface SeedFamily {
  family_id: string;
  provider_id: string;
  display_name: string;
  r_in: number;
  r_cache: number;
  r_think: number | null;
  r_batch: number | null;
  is_reasoning: boolean;
}

interface SeedProvider {
  provider_id: string;
  display_name: string;
}

interface SeedPrice {
  model_id: string;
  price_type: string;
  beta: number;
  observed_at: string;
  source: string;
}

// Family lineage and theta/sigma defaults from single source of truth
import { FAMILY_LINEAGE as familyLineage, computeThetaFromHistory } from '../core/constants.js';



// Build oracle state from seed data
function buildOracleState(): OracleState {
  const providerMap = new Map((providers as SeedProvider[]).map(p => [p.provider_id, p]));
  const familyMap = new Map((families as SeedFamily[]).map(f => [f.family_id, f]));
  const prices = historicalPrices as SeedPrice[];

  const latestPrices = new Map<string, { beta: number; date: Date }>();
  for (const price of prices) {
    const key = `${price.model_id}:${price.price_type}`;
    const priceDate = new Date(price.observed_at);
    const existing = latestPrices.get(key);
    if (!existing || priceDate > existing.date) {
      latestPrices.set(key, { beta: price.beta, date: priceDate });
    }
  }

  const modelsMap = new Map<string, GreekSheet>();
  const seedContextTiers = new Map<string, ContextTier[]>();

  for (const model of models as SeedModel[]) {
    const family = familyMap.get(model.family_id);
    if (!family) continue;

    const provider = providerMap.get(family.provider_id);
    const syncPrice = latestPrices.get(`${model.model_id}:sync`);
    const batchPrice = latestPrices.get(`${model.model_id}:batch`);
    const { theta, sigma } = computeThetaFromHistory(prices, model.family_id);

    if (model.tiers && model.tiers.length > 0) {
      seedContextTiers.set(model.model_id, model.tiers.map(t => ({
        tauStart: t.tau_start,
        tauEnd: t.tau_end,
        alpha: t.alpha,
      })));
    }

    // Expose tiers to module scope for pricing endpoints
    modelContextTiers = seedContextTiers;

    modelsMap.set(model.model_id, {
      modelId: model.model_id,
      displayName: model.display_name,
      tickerSync: model.ticker_sync,
      tickerBatch: model.ticker_batch ?? undefined,
      providerName: provider?.display_name ?? family.provider_id,
      contextWindow: model.context_window,
      rIn: family.r_in,
      rCache: family.r_cache,
      rThink: family.r_think ?? undefined,
      rBatch: family.r_batch ?? undefined,
      isReasoning: family.is_reasoning,
      betaSync: syncPrice?.beta,
      betaBatch: batchPrice?.beta,
      theta,
      sigma,
    });
  }

  // Build forward curves
  const forwardCurves = new Map<string, ForwardPrice[]>();
  const tenors = ['1M', '3M', '6M'] as const;
  const tenorMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };

  for (const [modelId, model] of modelsMap) {
    if (!model.betaSync || !model.theta) continue;

    const theta = model.theta;
    const forwards: ForwardPrice[] = [];

    for (const tenor of tenors) {
      const t = tenorMonths[tenor];
      const decayFactor = Math.exp(-theta * t);
      forwards.push({
        modelId,
        priceType: 'sync',
        tenor,
        betaSpot: model.betaSync,
        thetaUsed: theta,
        betaForward: model.betaSync * decayFactor,
        decayFactor,
        computedAt: new Date(),
      });
    }

    forwardCurves.set(`${modelId}:sync`, forwards);
  }

  return {
    models: modelsMap,
    forwardCurves,
    lastUpdate: new Date(),
    cacheAgeSeconds: 0,
  };
}

// Context tiers stored alongside oracle state (populated during build)
let modelContextTiers = new Map<string, ContextTier[]>();

// Reverse lookup: ticker (uppercase) → GreekSheet for O(1) ticker lookups
let tickerIndex = new Map<string, GreekSheet>();

// Initialize oracle state once at startup
const oracleState = buildOracleState();

// Build ticker index after oracle state is ready
for (const model of oracleState.models.values()) {
  tickerIndex.set(model.tickerSync.toUpperCase(), model);
}

// Create Hono app with environment bindings
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow exostream domains, pages.dev preview URLs, and localhost
    if (!origin) return 'https://exostream.ai';
    if (origin.endsWith('.exostream.pages.dev') ||
        origin === 'https://exostream.ai' ||
        origin === 'https://www.exostream.ai' ||
        origin.startsWith('http://localhost')) {
      return origin;
    }
    return 'https://exostream.ai';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400,
}));

// Rate limiting: 60 requests per minute per IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

app.use('/v1/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Remove timestamps outside the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    return c.json({ error: 'Rate limit exceeded', retry_after_seconds: 60 }, 429);
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);

  // Periodic cleanup: if map is large, prune stale entries
  if (rateLimitMap.size > 10_000) {
    for (const [key, ts] of rateLimitMap) {
      if (ts.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }

  await next();
});

// Optional API key tracking middleware (doesn't block, just tracks usage)
app.use('/v1/*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (apiKey && c.env?.API_KEYS) {
    try {
      const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
      if (keyData) {
        // Update usage stats (fire and forget)
        keyData.lastUsed = new Date().toISOString();
        keyData.requestCount = (keyData.requestCount || 0) + 1;
        c.executionCtx.waitUntil(
          c.env.API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData))
        );
      }
    } catch (e) {
      // Ignore errors - API key tracking is optional
    }
  }

  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    modelCount: oracleState.models.size,
    lastUpdate: oracleState.lastUpdate.toISOString(),
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Exostream API',
    description: 'The pricing oracle for LLM inference',
    version: '1.0.0',
    runtime: 'Cloudflare Workers',
    endpoints: {
      health: '/health',
      spots: '/v1/spots',
      greeks: '/v1/greeks',
      forwards: '/v1/forwards/:ticker',
      price: 'POST /v1/price',
      compare: 'POST /v1/compare',
      history: '/v1/history/:ticker',
      keys: {
        create: 'POST /v1/keys',
        usage: 'GET /v1/keys/usage',
        revoke: 'DELETE /v1/keys',
      },
    },
    documentation: 'https://exostream.ai/api-docs',
  });
});

// GET /v1/spots - List all spot prices
app.get('/v1/spots', (c) => {
  const data = Array.from(oracleState.models.values()).map(m => ({
    ticker: m.tickerSync,
    ticker_batch: m.tickerBatch,
    model_id: m.modelId,
    display_name: m.displayName,
    provider: m.providerName,
    beta_sync: m.betaSync,
    beta_batch: m.betaBatch,
    context_window: m.contextWindow,
  }));
  return c.json({
    data,
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// GET /v1/spots/:ticker - Get spot price for specific ticker
app.get('/v1/spots/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker) ||
    Array.from(oracleState.models.values()).find(m => m.tickerBatch?.toUpperCase() === ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }
  return c.json({
    ticker: model.tickerSync,
    modelId: model.modelId,
    displayName: model.displayName,
    provider: model.providerName,
    betaSync: model.betaSync,
    betaBatch: model.betaBatch,
    timestamp: oracleState.lastUpdate.toISOString(),
  });
});

// GET /v1/greeks - List all Greek sheets
app.get('/v1/greeks', (c) => {
  const data = Array.from(oracleState.models.values()).map(m => ({
    ticker: m.tickerSync,
    ticker_batch: m.tickerBatch,
    model_id: m.modelId,
    display_name: m.displayName,
    provider: m.providerName,
    beta_sync: m.betaSync,
    beta_batch: m.betaBatch,
    context_window: m.contextWindow,
    r_in: m.rIn,
    r_cache: m.rCache,
    r_think: m.rThink,
    r_batch: m.rBatch,
    is_reasoning: m.isReasoning,
    theta: m.theta,
    sigma: m.sigma,
  }));
  return c.json({
    data,
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// GET /v1/greeks/:ticker - Get Greek sheet for specific ticker
app.get('/v1/greeks/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker) ||
    Array.from(oracleState.models.values()).find(m => m.tickerBatch?.toUpperCase() === ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }
  return c.json(model);
});

// GET /v1/forwards/:ticker - Get forward curve for ticker
app.get('/v1/forwards/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker);
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }

  const forwardCurve = oracleState.forwardCurves.get(`${model.modelId}:sync`) || [];
  return c.json({
    data: {
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      spot: model.betaSync,
      theta: model.theta,
      forwards: forwardCurve.map(f => ({
        tenor: f.tenor,
        beta_forward: f.betaForward,
        decay_factor: f.decayFactor,
      })),
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// POST /v1/price - Calculate task price
app.post('/v1/price', async (c) => {
  const body = await c.req.json();
  const { model: modelParam, modelId, ticker, n_in, n_out, n_think, eta = 0, horizon_months } = body;
  // Support both camelCase and snake_case parameter names
  const nIn = n_in ?? body.nIn;
  const nOut = n_out ?? body.nOut;
  const nThink = n_think ?? body.nThink;
  const horizonMonths = horizon_months ?? body.horizonMonths;

  // Input validation
  const lookupKey = modelParam || ticker || modelId;
  if (!lookupKey) {
    return c.json({ error: 'Missing required field: model, ticker, or modelId' }, 400);
  }
  if (nIn !== undefined && (typeof nIn !== 'number' || nIn < 0)) {
    return c.json({ error: 'n_in must be a non-negative number' }, 400);
  }
  if (nOut !== undefined && (typeof nOut !== 'number' || nOut < 0)) {
    return c.json({ error: 'n_out must be a non-negative number' }, 400);
  }
  if (nThink !== undefined && (typeof nThink !== 'number' || nThink < 0)) {
    return c.json({ error: 'n_think must be a non-negative number' }, 400);
  }
  if (typeof eta !== 'number' || eta < 0 || eta > 1) {
    return c.json({ error: 'eta must be a number between 0 and 1' }, 400);
  }
  if (horizonMonths !== undefined && (typeof horizonMonths !== 'number' || horizonMonths <= 0)) {
    return c.json({ error: 'horizon_months must be a positive number' }, 400);
  }

  // Find model by ID, ticker, or model param (which is ticker from frontend)
  let model: GreekSheet | undefined;
  {
    // Try exact model ID match first
    model = oracleState.models.get(lookupKey);
    // Then try ticker match
    if (!model) {
      model = tickerIndex.get(lookupKey.toUpperCase());
    }
  }

  if (!model) {
    return c.json({ error: 'Model not found' }, 404);
  }

  if (!model.betaSync) {
    return c.json({ error: 'No spot price available for model' }, 400);
  }

  const beta = model.betaSync;
  const rIn = model.rIn;
  const rCache = model.rCache;
  const rThink = model.rThink ?? 0;
  const W = model.contextWindow;
  const tiers = modelContextTiers.get(model.modelId) ?? [{ tauStart: 0, tauEnd: 1, alpha: 1 }];

  // Use core pricing functions (same math as Node.js API)
  const rInEff = effectiveInputRate(rIn, rCache, eta, nIn || 0, W, tiers);
  const k = computeKappa(nIn || 0, nOut || 0, rInEff);
  const S = computeSpotCost(beta, nOut || 0, nIn || 0, rInEff, nThink || 0, rThink);

  // Calculate cost without cache for savings comparison
  const rInEffNoCache = effectiveInputRate(rIn, rCache, 0, nIn || 0, W, tiers);
  const SNoCache = computeSpotCost(beta, nOut || 0, nIn || 0, rInEffNoCache, nThink || 0, rThink);
  const cacheSavings = SNoCache - S;

  const result: any = {
    data: {
      model: model.tickerSync,
      display_name: model.displayName,
      spot_cost: S,
      kappa: k,
      r_in_eff: rInEff,
      beta_used: beta,
      task_profile: {
        n_in: nIn || 0,
        n_out: nOut || 0,
        n_think: nThink || 0,
        eta: eta,
      },
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  };

  // Calculate forward cost if horizon specified
  if (horizonMonths && model.theta) {
    const D = computeDecayFactor(model.theta, horizonMonths);
    const forwardCost = S * D;
    const betaForward = computeForwardPrice(beta, model.theta, horizonMonths);

    result.data.forward = {
      horizon_months: horizonMonths,
      cost: forwardCost,
      beta_forward: betaForward,
      theta_used: model.theta,
      decay_factor: D,
    };
  }

  // Add cache value if caching is being used
  if (eta > 0 && cacheSavings > 0) {
    result.data.cache_value = {
      cost_without_cache: SNoCache,
      savings: cacheSavings,
      savings_pct: (cacheSavings / SNoCache) * 100,
    };
  }

  return c.json(result);
});

// POST /v1/compare - Compare multiple models
app.post('/v1/compare', async (c) => {
  const body = await c.req.json();
  const { models: modelIds } = body;
  // Support both camelCase and snake_case parameter names
  const nIn = body.n_in ?? body.nIn ?? 0;
  const nOut = body.n_out ?? body.nOut ?? 0;
  const nThink = body.n_think ?? body.nThink ?? 0;
  const eta = body.eta ?? 0;

  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    return c.json({ error: 'models array is required' }, 400);
  }
  if (typeof nIn !== 'number' || nIn < 0) {
    return c.json({ error: 'n_in must be a non-negative number' }, 400);
  }
  if (typeof nOut !== 'number' || nOut < 0) {
    return c.json({ error: 'n_out must be a non-negative number' }, 400);
  }
  if (typeof eta !== 'number' || eta < 0 || eta > 1) {
    return c.json({ error: 'eta must be a number between 0 and 1' }, 400);
  }

  const results = [];
  for (const id of modelIds) {
    const model = oracleState.models.get(id) || tickerIndex.get(id.toUpperCase());

    if (!model || !model.betaSync) continue;

    const beta = model.betaSync;
    const W = model.contextWindow;
    const rIn = model.rIn;
    const rCache = model.rCache;
    const rThink = model.rThink ?? 0;
    const tiers = modelContextTiers.get(model.modelId) ?? [{ tauStart: 0, tauEnd: 1, alpha: 1 }];

    // Use core pricing functions (same math as Node.js API)
    const rInEff = effectiveInputRate(rIn, rCache, eta, nIn, W, tiers);
    const k = computeKappa(nIn, nOut, rInEff);
    const actualNThink = model.isReasoning ? nThink : 0;
    const S = computeSpotCost(beta, nOut, nIn, rInEff, actualNThink, rThink);

    results.push({
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      provider: model.providerName,
      spot_cost: S,
      kappa: k,
      beta,
      is_reasoning: model.isReasoning,
      theta: model.theta,
    });
  }

  results.sort((a, b) => a.spot_cost - b.spot_cost);

  return c.json({
    data: {
      task_profile: { n_in: nIn, n_out: nOut, n_think: nThink, eta },
      models: results,
      cheapest: results[0]?.ticker,
      most_expensive: results[results.length - 1]?.ticker,
      count: results.length,
    },
    oracle_timestamp: oracleState.lastUpdate.toISOString(),
    cache_age_seconds: 0,
  });
});

// GET /v1/history/:ticker - Get price history
app.get('/v1/history/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = tickerIndex.get(ticker);

  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }

  // Get family ID for this model to include lineage data
  const modelInfo = (models as SeedModel[]).find(m => m.model_id === model.modelId);
  const familyId = modelInfo?.family_id;
  const lineageModels = familyId ? (familyLineage[familyId] || [familyId]) : [model.modelId];

  // Filter prices for this model's lineage (same logic as theta computation)
  const prices = (historicalPrices as SeedPrice[])
    .filter(p => {
      if (p.price_type !== 'sync') return false;
      // Match model_id against lineage patterns
      return lineageModels.some(lm => {
        if (p.model_id === lm) return true;
        if (p.model_id.startsWith(lm + '-') && !p.model_id.includes('mini') && !p.model_id.includes('flash') && !p.model_id.includes('nano')) {
          return true;
        }
        return false;
      });
    })
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime())
    .map(p => ({
      beta: p.beta,
      timestamp: p.observed_at,
      source: p.source,
      provenance: p.source.includes('historical') ? 'reconstructed' : 'live',
    }));

  return c.json({
    data: {
      ticker: model.tickerSync,
      model_id: model.modelId,
      display_name: model.displayName,
      price_type: 'sync',
      prices,
      count: prices.length,
    },
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  });
});

// ============================================
// API Key Management Routes
// ============================================

// POST /v1/keys - Generate a new API key
app.post('/v1/keys', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  try {
    const body = await c.req.json().catch(() => ({})) as { name?: string };
    const name = body.name || 'Unnamed Key';

    const apiKey = generateApiKey();
    const keyData: ApiKeyData = {
      key: apiKey,
      name,
      createdAt: new Date().toISOString(),
      requestCount: 0,
      tier: 'free',
      rateLimit: 60, // 60 requests per minute for free tier
    };

    await c.env.API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData));

    return c.json({
      success: true,
      api_key: apiKey,
      name,
      tier: 'free',
      rate_limit: '60 requests/minute',
      message: 'Store this key securely - it cannot be retrieved later.',
    }, 201);
  } catch (error) {
    console.error('Error creating API key:', error);
    return c.json({ error: 'Failed to create API key' }, 500);
  }
});

// GET /v1/keys/usage - Get usage stats for an API key
app.get('/v1/keys/usage', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return c.json({ error: 'API key required. Include X-API-Key header.' }, 401);
  }

  try {
    const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
    if (!keyData) {
      return c.json({ error: 'Invalid API key' }, 404);
    }

    return c.json({
      name: keyData.name,
      created_at: keyData.createdAt,
      last_used: keyData.lastUsed,
      request_count: keyData.requestCount,
      tier: keyData.tier,
      rate_limit: `${keyData.rateLimit} requests/minute`,
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return c.json({ error: 'Failed to fetch usage' }, 500);
  }
});

// DELETE /v1/keys - Revoke an API key
app.delete('/v1/keys', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return c.json({ error: 'API key required. Include X-API-Key header.' }, 401);
  }

  try {
    const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
    if (!keyData) {
      return c.json({ error: 'Invalid API key' }, 404);
    }

    await c.env.API_KEYS.delete(`key:${apiKey}`);

    return c.json({
      success: true,
      message: 'API key revoked',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return c.json({ error: 'Failed to revoke API key' }, 500);
  }
});

// ============================================
// End API Key Management Routes
// ============================================

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Browser-like headers for scraping
const SCRAPER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// Scraper configurations
const SCRAPER_CONFIGS = [
  {
    provider: 'anthropic',
    url: 'https://www.anthropic.com/pricing',
    // Anthropic has clean HTML, prices are usually in text
  },
  {
    provider: 'google',
    url: 'https://ai.google.dev/pricing',
  },
  {
    provider: 'mistral',
    url: 'https://mistral.ai/products/la-plateforme#pricing',
  },
  {
    provider: 'deepseek',
    url: 'https://api-docs.deepseek.com/quick_start/pricing',
  },
  {
    provider: 'xai',
    url: 'https://docs.x.ai/docs/models#models-and-pricing',
  },
  {
    provider: 'openai',
    url: 'https://openai.com/api/pricing',
    // OpenAI often blocks scrapers, will likely get 403
  },
];

// Run all scrapers
async function runAllScrapers(): Promise<{ provider: string; status: string; error?: string }[]> {
  const results: { provider: string; status: string; error?: string }[] = [];

  for (const config of SCRAPER_CONFIGS) {
    try {
      const response = await fetch(config.url, {
        headers: SCRAPER_HEADERS,
      });

      if (!response.ok) {
        results.push({
          provider: config.provider,
          status: 'error',
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      const html = await response.text();
      const contentLength = html.length;

      // For now, just verify we can fetch the page
      // Full parsing would extract prices from HTML
      // This requires provider-specific regex patterns since we can't use Cheerio

      results.push({
        provider: config.provider,
        status: 'success',
        error: undefined,
      });

      console.log(`[Scraper] ${config.provider}: fetched ${contentLength} bytes`);

    } catch (error) {
      results.push({
        provider: config.provider,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

// Scheduled event handler for cron triggers
async function scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
  const startTime = Date.now();
  console.log(`[Cron] Scheduled scraper run triggered at ${new Date().toISOString()}`);

  try {
    const results = await runAllScrapers();

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    console.log(`[Cron] Scraper run complete: ${successful} succeeded, ${failed} failed`);

    for (const result of results) {
      if (result.status === 'error') {
        console.log(`[Cron] ${result.provider}: ${result.error}`);
      }
    }
  } catch (error) {
    console.error(`[Cron] Fatal error in scheduled run:`, error);
  }

  const duration = Date.now() - startTime;
  console.log(`[Cron] Total duration: ${duration}ms`);
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
};
