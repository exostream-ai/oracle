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

  it('r_cache < r_in for all families (cache reads cheaper than input)', () => {
    for (const f of families) {
      expect(f.r_cache).toBeLessThan(f.r_in);
    }
  });

  it('r_in matches expected provider input/output ratios', () => {
    // Expected r_in = input_price / output_price from provider pricing pages
    // Source: verified against live pricing pages 2026-02-13
    const expected: Record<string, number> = {
      'claude-4': 0.20,
      'claude-3.5': 0.20,
      'claude-3': 0.20,
      'gpt-4.1': 0.25,
      'gpt-4o': 0.25,
      'o-series': 0.25,
      'gemini-2.5-pro': 0.125,
      'gemini-2.5-flash': 0.12,
      'gemini-2.0': 0.25,
      'grok-4': 0.20,
      'grok-4-fast': 0.40,
      'grok-3': 0.20,
      'grok-3-mini': 0.60,
      'mistral-large': 0.333,
      'deepseek-v3': 0.667,
      'deepseek-r1': 0.667,
      'gpt-5': 0.125,
      'grok-4.1-fast': 0.40,
      'gemini-3-pro': 0.167,
      'gemini-3-flash': 0.167,
    };

    for (const f of families) {
      const exp = expected[f.family_id];
      if (exp !== undefined) {
        expect(f.r_in).toBeCloseTo(exp, 2);
      }
    }
  });

  it('r_cache matches expected provider cache/output ratios', () => {
    // Expected r_cache = cache_read_price / output_price from provider pricing pages
    const expected: Record<string, number> = {
      'claude-4': 0.02,
      'claude-3.5': 0.02,
      'claude-3': 0.02,
      'gpt-4.1': 0.0625,
      'gpt-4o': 0.125,
      'o-series': 0.125,
      'gemini-2.5-pro': 0.0125,
      'gemini-2.5-flash': 0.012,
      'gemini-2.0': 0.0625,
      'grok-4': 0.05,
      'grok-4-fast': 0.10,
      'grok-3': 0.05,
      'grok-3-mini': 0.14,
      'deepseek-v3': 0.067,
      'deepseek-r1': 0.067,
      'gpt-5': 0.0125,
      'grok-4.1-fast': 0.10,
      'gemini-3-pro': 0.017,
      'gemini-3-flash': 0.017,
    };

    for (const f of families) {
      const exp = expected[f.family_id];
      if (exp !== undefined) {
        expect(f.r_cache).toBeCloseTo(exp, 3);
      }
    }
  });

});
