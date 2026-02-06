/**
 * API Endpoint Tests
 *
 * Tests the Hono API routes against the oracle state built from seed data.
 * Uses the app directly (no HTTP server needed).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/api/index.js';
import { refreshOracleState } from '../src/api/oracle.js';

// Initialize oracle state before all tests
beforeAll(async () => {
  await refreshOracleState();
});

// Helper to make requests against the app
async function request(path: string, options?: RequestInit) {
  const res = await app.request(path, options);
  return {
    status: res.status,
    json: await res.json() as any,
  };
}

// ============================================================
// HEALTH
// ============================================================

describe('GET /health', () => {
  it('returns health status', async () => {
    const { status, json } = await request('/health');
    expect(status).toBe(200);
    expect(['ok', 'degraded']).toContain(json.status);
    expect(json.models_tracked).toBeGreaterThan(0);
    expect(json).toHaveProperty('oracle_timestamp');
  });
});

// ============================================================
// SPOTS
// ============================================================

describe('GET /v1/spots', () => {
  it('returns all spot prices', async () => {
    const { status, json } = await request('/v1/spots');
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty('ticker');
    expect(json.data[0]).toHaveProperty('beta_sync');
  });
});

describe('GET /v1/spots/:ticker', () => {
  it('returns spot price for valid ticker', async () => {
    const { status, json } = await request('/v1/spots/OPUS-4.6');
    expect(status).toBe(200);
    expect(json.data.ticker).toBe('OPUS-4.6');
    expect(json.data).toHaveProperty('beta_sync');
    expect(json.data.beta_sync).toBeGreaterThan(0);
  });

  it('returns 404 for invalid ticker', async () => {
    const { status, json } = await request('/v1/spots/NONEXISTENT');
    expect(status).toBe(404);
    expect(json).toHaveProperty('error');
  });
});

// ============================================================
// GREEKS
// ============================================================

describe('GET /v1/greeks', () => {
  it('returns all greek sheets', async () => {
    const { status, json } = await request('/v1/greeks');
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);

    const sheet = json.data[0];
    expect(sheet).toHaveProperty('ticker');
    expect(sheet).toHaveProperty('beta_sync');
    expect(sheet).toHaveProperty('r_in');
    expect(sheet).toHaveProperty('r_cache');
    expect(sheet).toHaveProperty('theta');
    expect(sheet).toHaveProperty('sigma');
  });
});

describe('GET /v1/greeks/:ticker', () => {
  it('returns greek sheet for valid ticker', async () => {
    const { status, json } = await request('/v1/greeks/GPT-4.1');
    expect(status).toBe(200);
    expect(json.data.ticker).toBe('GPT-4.1');
    expect(json.data).toHaveProperty('r_in');
    expect(json.data).toHaveProperty('theta');
  });

  it('returns 404 for invalid ticker', async () => {
    const { status, json } = await request('/v1/greeks/NONEXISTENT');
    expect(status).toBe(404);
    expect(json).toHaveProperty('error');
  });
});

// ============================================================
// FORWARDS
// ============================================================

describe('GET /v1/forwards/:ticker', () => {
  it('returns forward curve for valid ticker', async () => {
    const { status, json } = await request('/v1/forwards/OPUS-4.6');
    expect(status).toBe(200);
    expect(json.data).toHaveProperty('ticker');
    expect(json.data).toHaveProperty('forwards');
    expect(Array.isArray(json.data.forwards)).toBe(true);
    expect(json.data.forwards.length).toBeGreaterThan(0);
    expect(json.data.forwards[0]).toHaveProperty('tenor');
    expect(json.data.forwards[0]).toHaveProperty('beta_forward');
    expect(json.data.forwards[0]).toHaveProperty('decay_factor');
  });

  it('returns 404 for invalid ticker', async () => {
    const { status, json } = await request('/v1/forwards/NONEXISTENT');
    expect(status).toBe(404);
    expect(json).toHaveProperty('error');
  });
});

// ============================================================
// PRICE
// ============================================================

describe('POST /v1/price', () => {
  it('computes price for valid request', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'opus-4.6',
        n_in: 10000,
        n_out: 2000,
        eta: 0.3,
      }),
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('spot_cost');
    expect(json.data.spot_cost).toBeGreaterThan(0);
    expect(json.data).toHaveProperty('kappa');
    expect(json.data).toHaveProperty('model');
  });

  it('supports ticker lookup via model field', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'GPT-4.1',
        n_in: 5000,
        n_out: 1000,
      }),
    });
    expect(status).toBe(200);
    expect(json.data).toHaveProperty('spot_cost');
  });

  it('rejects missing required fields', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_in: 1000,
        n_out: 500,
      }),
    });
    expect(status).toBe(400);
    expect(json).toHaveProperty('error');
  });

  it('returns 404 for unknown model', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nonexistent-model',
        n_in: 1000,
        n_out: 500,
      }),
    });
    expect(status).toBe(404);
  });

  it('includes forward cost when horizon_months specified', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'opus-4.6',
        n_in: 10000,
        n_out: 2000,
        horizon_months: 3,
      }),
    });
    expect(status).toBe(200);
    expect(json.data).toHaveProperty('forward');
    expect(json.data.forward).toHaveProperty('cost');
    expect(json.data.forward.cost).toBeLessThan(json.data.spot_cost);
  });

  it('includes cache value when eta > 0', async () => {
    const { status, json } = await request('/v1/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'opus-4.6',
        n_in: 10000,
        n_out: 2000,
        eta: 0.5,
      }),
    });
    expect(status).toBe(200);
    expect(json.data).toHaveProperty('cache_value');
    expect(json.data.cache_value.savings).toBeGreaterThan(0);
  });
});

// ============================================================
// COMPARE
// ============================================================

describe('POST /v1/compare', () => {
  it('compares all models for given task', async () => {
    const { status, json } = await request('/v1/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_in: 10000,
        n_out: 2000,
      }),
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('models');
    expect(Array.isArray(json.data.models)).toBe(true);
    expect(json.data.models.length).toBeGreaterThan(0);
    expect(json.data).toHaveProperty('cheapest');
    expect(json.data).toHaveProperty('most_expensive');
  });

  it('results are sorted by cost ascending', async () => {
    const { status, json } = await request('/v1/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_in: 5000,
        n_out: 1000,
      }),
    });
    expect(status).toBe(200);
    const costs = json.data.models.map((m: any) => m.spot_cost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
    }
  });

  it('rejects missing required fields', async () => {
    const { status, json } = await request('/v1/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_in: 5000,
      }),
    });
    expect(status).toBe(400);
    expect(json).toHaveProperty('error');
  });
});

// ============================================================
// HISTORY
// ============================================================

describe('GET /v1/history/:ticker', () => {
  it('returns history for valid ticker', async () => {
    const { status, json } = await request('/v1/history/GPT-4.1');
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('ticker');
    expect(json.data).toHaveProperty('prices');
    expect(Array.isArray(json.data.prices)).toBe(true);
    expect(json.data.prices.length).toBeGreaterThan(0);
  });

  it('returns 404 for invalid ticker', async () => {
    const { status, json } = await request('/v1/history/NONEXISTENT');
    expect(status).toBe(404);
    expect(json).toHaveProperty('error');
  });
});

// ============================================================
// EVENTS
// ============================================================

describe('GET /v1/events', () => {
  it('returns events structure (empty without DB)', async () => {
    const { status, json } = await request('/v1/events');
    expect(status).toBe(200);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('events');
    expect(Array.isArray(json.data.events)).toBe(true);
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================

describe('Error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const { status, json } = await request('/v1/nonexistent');
    expect(status).toBe(404);
    expect(json).toHaveProperty('error');
  });

  it('root endpoint returns API info', async () => {
    const { status, json } = await request('/');
    expect(status).toBe(200);
    expect(json).toHaveProperty('name');
    expect(json.name).toBe('Exostream API');
    expect(json).toHaveProperty('endpoints');
  });

  it('error responses do not leak stack traces', async () => {
    // Trigger a 404 and verify no stack trace
    const { json } = await request('/v1/spots/NONEXISTENT');
    expect(json).not.toHaveProperty('stack');
    expect(json).not.toHaveProperty('message');
  });
});
