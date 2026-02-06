/**
 * Seed Data Integrity Tests
 *
 * Validates JSON schema, referential integrity, and domain constraints
 * for all seed data files.
 */

import { describe, it, expect } from 'vitest';
import providers from '../seed/providers.json';
import families from '../seed/families.json';
import models from '../seed/models.json';
import historicalPrices from '../seed/historical_prices.json';
import { FAMILY_LINEAGE } from '../src/core/constants.js';

// ============================================================
// SCHEMA VALIDATION
// ============================================================

describe('Schema: providers.json', () => {
  it('has at least 1 provider', () => {
    expect(providers.length).toBeGreaterThan(0);
  });

  it('every provider has required fields', () => {
    for (const p of providers) {
      expect(p).toHaveProperty('provider_id');
      expect(p).toHaveProperty('display_name');
      expect(p).toHaveProperty('pricing_url');
      expect(typeof p.provider_id).toBe('string');
      expect(typeof p.display_name).toBe('string');
      expect(typeof p.pricing_url).toBe('string');
      expect(p.provider_id.length).toBeGreaterThan(0);
    }
  });

  it('provider IDs are unique', () => {
    const ids = providers.map(p => p.provider_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Schema: families.json', () => {
  it('has at least 1 family', () => {
    expect(families.length).toBeGreaterThan(0);
  });

  it('every family has required fields', () => {
    for (const f of families) {
      expect(f).toHaveProperty('family_id');
      expect(f).toHaveProperty('provider_id');
      expect(f).toHaveProperty('display_name');
      expect(f).toHaveProperty('r_in');
      expect(f).toHaveProperty('r_cache');
      expect(f).toHaveProperty('is_reasoning');
      expect(typeof f.family_id).toBe('string');
      expect(typeof f.r_in).toBe('number');
      expect(typeof f.r_cache).toBe('number');
      expect(typeof f.is_reasoning).toBe('boolean');
    }
  });

  it('family IDs are unique', () => {
    const ids = families.map(f => f.family_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reasoning families have r_think, non-reasoning do not', () => {
    for (const f of families) {
      if (f.is_reasoning) {
        expect(f.r_think).not.toBeNull();
        expect(typeof f.r_think).toBe('number');
      }
    }
  });
});

describe('Schema: models.json', () => {
  it('has at least 1 model', () => {
    expect(models.length).toBeGreaterThan(0);
  });

  it('every model has required fields', () => {
    for (const m of models) {
      expect(m).toHaveProperty('model_id');
      expect(m).toHaveProperty('family_id');
      expect(m).toHaveProperty('display_name');
      expect(m).toHaveProperty('ticker_sync');
      expect(m).toHaveProperty('context_window');
      expect(m).toHaveProperty('launch_date');
      expect(m).toHaveProperty('status');
      expect(m).toHaveProperty('tiers');
      expect(typeof m.model_id).toBe('string');
      expect(typeof m.context_window).toBe('number');
      expect(m.context_window).toBeGreaterThan(0);
      expect(Array.isArray(m.tiers)).toBe(true);
      expect(m.tiers.length).toBeGreaterThan(0);
    }
  });

  it('model IDs are unique', () => {
    const ids = models.map(m => m.model_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ticker_sync values are unique', () => {
    const tickers = models.map(m => m.ticker_sync);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it('every tier has valid tau_start < tau_end and alpha > 0', () => {
    for (const m of models) {
      for (const tier of m.tiers) {
        expect(tier.tau_start).toBeLessThan(tier.tau_end);
        expect(tier.alpha).toBeGreaterThan(0);
      }
    }
  });
});

describe('Schema: historical_prices.json', () => {
  it('has at least 1 price entry', () => {
    expect(historicalPrices.length).toBeGreaterThan(0);
  });

  it('every price has required fields', () => {
    for (const p of historicalPrices) {
      expect(p).toHaveProperty('model_id');
      expect(p).toHaveProperty('price_type');
      expect(p).toHaveProperty('beta');
      expect(p).toHaveProperty('source');
      expect(p).toHaveProperty('observed_at');
      expect(typeof p.model_id).toBe('string');
      expect(['sync', 'batch']).toContain(p.price_type);
      expect(typeof p.beta).toBe('number');
      expect(p.beta).toBeGreaterThan(0);
    }
  });

  it('observed_at dates are valid ISO 8601', () => {
    for (const p of historicalPrices) {
      const date = new Date(p.observed_at);
      expect(date.getTime()).not.toBeNaN();
    }
  });
});

// ============================================================
// REFERENTIAL INTEGRITY
// ============================================================

describe('Referential integrity', () => {
  const providerIds = new Set(providers.map(p => p.provider_id));
  const familyIds = new Set(families.map(f => f.family_id));
  const modelIds = new Set(models.map(m => m.model_id));

  it('every family references a valid provider', () => {
    for (const f of families) {
      expect(providerIds.has(f.provider_id)).toBe(true);
    }
  });

  it('every model references a valid family', () => {
    for (const m of models) {
      expect(familyIds.has(m.family_id)).toBe(true);
    }
  });

  it('historical price model_ids are either active models or in FAMILY_LINEAGE', () => {
    const lineageModelIds = new Set<string>();
    for (const chain of Object.values(FAMILY_LINEAGE)) {
      for (const id of chain) {
        lineageModelIds.add(id);
      }
    }

    for (const p of historicalPrices) {
      const inModels = modelIds.has(p.model_id);
      const inLineage = lineageModelIds.has(p.model_id);
      expect(inModels || inLineage).toBe(true);
    }
  });

  it('every family in FAMILY_LINEAGE exists in families.json', () => {
    for (const familyId of Object.keys(FAMILY_LINEAGE)) {
      expect(familyIds.has(familyId)).toBe(true);
    }
  });
});

// ============================================================
// DOMAIN CONSTRAINTS
// ============================================================

describe('Domain constraints', () => {
  it('no duplicate (model_id, price_type, observed_at) tuples', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const p of historicalPrices) {
      const key = `${p.model_id}:${p.price_type}:${p.observed_at}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('rate ratios are between 0 and 1', () => {
    for (const f of families) {
      expect(f.r_in).toBeGreaterThan(0);
      expect(f.r_in).toBeLessThanOrEqual(1);
      expect(f.r_cache).toBeGreaterThanOrEqual(0);
      expect(f.r_cache).toBeLessThanOrEqual(1);
      if (f.r_think !== null) {
        expect(f.r_think).toBeGreaterThan(0);
        expect(f.r_think).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every active model has at least one historical price', () => {
    const priceModelIds = new Set(historicalPrices.map(p => p.model_id));
    const activeModels = models.filter(m => m.status === 'active');
    const missing: string[] = [];
    for (const m of activeModels) {
      if (!priceModelIds.has(m.model_id)) {
        missing.push(m.model_id);
      }
    }
    expect(missing).toEqual([]);
  });
});
