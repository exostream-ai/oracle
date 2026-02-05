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

// Import seed data directly (bundled with worker)
import providers from '../../seed/providers.json';
import families from '../../seed/families.json';
import models from '../../seed/models.json';
import historicalPrices from '../../seed/historical_prices.json';

// Types
import type { GreekSheet, ForwardPrice, OracleState, ContextTier } from '../core/types.js';

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

// Family lineage for theta computation
const familyLineage: Record<string, string[]> = {
  'gpt-4.1': ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4.1'],
  'gpt-4o': ['gpt-4o'],
  'o-series': ['o-series'],
  'claude-4': ['claude-3-opus', 'opus-4.5'],
  'claude-3.5': ['claude-3.5', 'sonnet-3.5', 'sonnet-4'],
  'gemini-2.5-pro': ['gemini-2.5-pro'],
  'gemini-2.5-flash': ['gemini-2.5-flash'],
  'gemini-2.0': ['gemini-2.0'],
  'grok-3': ['grok-3'],
  'mistral-large': ['mistral-large'],
  'deepseek-v3': ['deepseek-v3'],
  'deepseek-r1': ['deepseek-r1'],
};

function getDefaultTheta(familyId: string): number {
  const defaults: Record<string, number> = {
    'gpt-4.1': 0.08,
    'gpt-4o': 0.07,
    'o-series': 0.04,
    'claude-4': 0.05,
    'claude-3.5': 0.02,
    'gemini-2.5-pro': 0.06,
    'gemini-2.5-flash': 0.06,
    'gemini-2.0': 0.05,
    'grok-3': 0.03,
    'mistral-large': 0.12,
    'deepseek-v3': 0.02,
    'deepseek-r1': 0.03,
  };
  return defaults[familyId] ?? 0.05;
}

function getDefaultSigma(familyId: string): number {
  const defaults: Record<string, number> = {
    'gpt-4.1': 0.12,
    'gpt-4o': 0.10,
    'o-series': 0.06,
    'claude-4': 0.08,
    'claude-3.5': 0.04,
    'gemini-2.5-pro': 0.08,
    'gemini-2.5-flash': 0.08,
    'gemini-2.0': 0.06,
    'grok-3': 0.05,
    'mistral-large': 0.15,
    'deepseek-v3': 0.03,
    'deepseek-r1': 0.04,
  };
  return defaults[familyId] ?? 0.06;
}

function computeThetaFromHistory(
  prices: SeedPrice[],
  familyId: string
): { theta: number; sigma: number } {
  // Get lineage models to include in history - match by model_id pattern, not family lookup
  const lineageModels = familyLineage[familyId] || [familyId];

  // Collect all sync prices for the lineage, sorted by date
  // Match model_id directly against lineage patterns (historical models like 'gpt-4' won't be in models.json)
  const relevantPrices = prices
    .filter(p => {
      if (p.price_type !== 'sync') return false;
      // Check if model_id matches any lineage pattern exactly or with version suffix
      return lineageModels.some(lm => {
        // Match exact model_id or versioned variants (e.g., gpt-4, gpt-4-turbo)
        // But NOT different model tiers (e.g., don't mix Pro and Flash)
        if (p.model_id === lm) return true;
        if (p.model_id.startsWith(lm + '-') && !p.model_id.includes('mini') && !p.model_id.includes('flash') && !p.model_id.includes('nano')) {
          return true;
        }
        return false;
      });
    })
    .sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());

  // Need at least 2 data points to compute theta
  if (relevantPrices.length < 2) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

  // Compute log returns between consecutive observations
  const logReturns: number[] = [];
  const timeDeltas: number[] = []; // in months

  for (let i = 1; i < relevantPrices.length; i++) {
    const prevPrice = relevantPrices[i - 1].beta;
    const currPrice = relevantPrices[i].beta;
    const prevDate = new Date(relevantPrices[i - 1].observed_at);
    const currDate = new Date(relevantPrices[i].observed_at);

    // Time difference in months
    const dtMonths = (currDate.getTime() - prevDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

    if (dtMonths > 0.5 && prevPrice > 0 && currPrice > 0) { // At least ~2 weeks between observations
      const logReturn = Math.log(currPrice / prevPrice);
      logReturns.push(logReturn);
      timeDeltas.push(dtMonths);
    }
  }

  if (logReturns.length === 0) {
    return { theta: getDefaultTheta(familyId), sigma: getDefaultSigma(familyId) };
  }

  // Compute theta: weighted average of -logReturn / dt (newer observations weighted more)
  const lambda = 0.85;
  let weightedTheta = 0;
  let totalWeight = 0;

  for (let i = 0; i < logReturns.length; i++) {
    const weight = Math.pow(lambda, logReturns.length - 1 - i);
    const thetaObs = -logReturns[i] / timeDeltas[i];
    weightedTheta += weight * thetaObs;
    totalWeight += weight;
  }

  let theta = weightedTheta / totalWeight;

  // Clamp theta to reasonable range (1% to 15% per month)
  theta = Math.max(0.01, Math.min(0.15, theta));

  // Compute sigma: standard deviation of monthly log returns
  const monthlyReturns = logReturns.map((lr, i) => lr / timeDeltas[i]); // normalize to monthly
  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / monthlyReturns.length;
  let sigma = Math.sqrt(variance);

  // Clamp sigma to reasonable range (2% to 25% per month)
  sigma = Math.max(0.02, Math.min(0.25, sigma));

  return { theta, sigma };
}

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

// Initialize oracle state once at startup
const oracleState = buildOracleState();

// Create Hono app
const app = new Hono();

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
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}));

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
  const model = Array.from(oracleState.models.values()).find(
    m => m.tickerSync.toUpperCase() === ticker || m.tickerBatch?.toUpperCase() === ticker
  );
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
  const model = Array.from(oracleState.models.values()).find(
    m => m.tickerSync.toUpperCase() === ticker || m.tickerBatch?.toUpperCase() === ticker
  );
  if (!model) {
    return c.json({ error: 'Ticker not found', ticker }, 404);
  }
  return c.json(model);
});

// GET /v1/forwards/:ticker - Get forward curve for ticker
app.get('/v1/forwards/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = Array.from(oracleState.models.values()).find(
    m => m.tickerSync.toUpperCase() === ticker
  );
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

  // Find model by ID, ticker, or model param (which is ticker from frontend)
  let model: GreekSheet | undefined;
  const lookupKey = modelParam || ticker || modelId;
  if (lookupKey) {
    // Try exact model ID match first
    model = oracleState.models.get(lookupKey);
    // Then try ticker match
    if (!model) {
      model = Array.from(oracleState.models.values()).find(
        m => m.tickerSync.toUpperCase() === lookupKey.toUpperCase()
      );
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
  const rThink = model.rThink ?? 1;

  // Calculate effective input rate with caching
  const rInEff = rIn * (1 - eta * (1 - rCache));

  // Calculate kappa (context cost multiplier)
  const W = model.contextWindow;
  const tau = (nIn || 0) / W;
  const kappa = tau <= 1 ? 1 : 1 + (tau - 1); // Simplified kappa calculation

  // Calculate spot cost
  const inputCost = (nIn || 0) * rInEff * beta / 1_000_000;
  const outputCost = (nOut || 0) * beta / 1_000_000;
  const thinkCost = (nThink || 0) * rThink * beta / 1_000_000;
  const spotCost = inputCost + outputCost + thinkCost;

  // Calculate cost without cache for savings comparison
  const rInNoCacheEff = model.rIn;
  const inputCostNoCache = (nIn || 0) * rInNoCacheEff * beta / 1_000_000;
  const spotCostNoCache = inputCostNoCache + outputCost + thinkCost;
  const cacheSavings = spotCostNoCache - spotCost;

  const result: any = {
    data: {
      model: model.tickerSync,
      display_name: model.displayName,
      spot_cost: spotCost,
      kappa,
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
    const decayFactor = Math.exp(-model.theta * horizonMonths);
    const betaForward = beta * decayFactor;
    const forwardInputCost = (nIn || 0) * rInEff * betaForward / 1_000_000;
    const forwardOutputCost = (nOut || 0) * betaForward / 1_000_000;
    const forwardThinkCost = (nThink || 0) * rThink * betaForward / 1_000_000;

    result.data.forward = {
      horizon_months: horizonMonths,
      cost: forwardInputCost + forwardOutputCost + forwardThinkCost,
      beta_forward: betaForward,
      theta_used: model.theta,
      decay_factor: decayFactor,
    };
  }

  // Add cache value if caching is being used
  if (eta > 0 && cacheSavings > 0) {
    result.data.cache_value = {
      cost_without_cache: spotCostNoCache,
      savings: cacheSavings,
      savings_pct: (cacheSavings / spotCostNoCache) * 100,
    };
  }

  return c.json(result);
});

// POST /v1/compare - Compare multiple models
app.post('/v1/compare', async (c) => {
  const body = await c.req.json();
  const { models: modelIds, nIn, nOut, nThink, eta = 0 } = body;

  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    return c.json({ error: 'models array is required' }, 400);
  }

  const results = [];
  for (const id of modelIds) {
    const model = oracleState.models.get(id) ||
      Array.from(oracleState.models.values()).find(
        m => m.tickerSync.toUpperCase() === id.toUpperCase()
      );

    if (!model || !model.betaSync) continue;

    const beta = model.betaSync;
    const rInEff = model.rIn * (1 - eta * (1 - model.rCache));
    const rThink = model.rThink ?? 1;

    const inputCost = (nIn || 0) * rInEff * beta / 1_000_000;
    const outputCost = (nOut || 0) * beta / 1_000_000;
    const thinkCost = (nThink || 0) * rThink * beta / 1_000_000;

    results.push({
      modelId: model.modelId,
      ticker: model.tickerSync,
      displayName: model.displayName,
      provider: model.providerName,
      costUsd: inputCost + outputCost + thinkCost,
      beta,
    });
  }

  results.sort((a, b) => a.costUsd - b.costUsd);

  return c.json({
    comparison: results,
    taskProfile: { nIn, nOut, nThink, eta },
    timestamp: oracleState.lastUpdate.toISOString(),
  });
});

// GET /v1/history/:ticker - Get price history
app.get('/v1/history/:ticker', (c) => {
  const ticker = c.req.param('ticker').toUpperCase();
  const model = Array.from(oracleState.models.values()).find(
    m => m.tickerSync.toUpperCase() === ticker
  );

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

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

// Scheduled event handler for cron triggers
async function scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
  console.log(`[Cron] Scheduled scraper run triggered at ${new Date().toISOString()}`);

  // List of providers to scrape
  const providers = ['anthropic', 'openai', 'google', 'xai', 'mistral', 'deepseek'];

  for (const provider of providers) {
    try {
      // For now, log the intended scrape
      // Full scraper implementation requires either:
      // 1. Workers-compatible HTML parsing (no Cheerio)
      // 2. Calling an external scraper service
      console.log(`[Cron] Would scrape ${provider} pricing page`);
    } catch (error) {
      console.error(`[Cron] Error scraping ${provider}:`, error);
    }
  }

  console.log(`[Cron] Scheduled run complete`);
}

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
};
