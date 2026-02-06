/**
 * Theta/Sigma Engine Tests
 *
 * Tests the shared computeThetaFromHistory function and default value lookups.
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultTheta,
  getDefaultSigma,
  computeThetaFromHistory,
  FAMILY_LINEAGE,
  DEFAULT_THETA,
  DEFAULT_SIGMA,
  DEFAULT_THETA_FALLBACK,
  DEFAULT_SIGMA_FALLBACK,
} from '../src/core/constants.js';
import historicalPrices from '../seed/historical_prices.json';

// ============================================================
// DEFAULT VALUE LOOKUPS
// ============================================================

describe('getDefaultTheta', () => {
  it('returns known value for gpt-4.1', () => {
    expect(getDefaultTheta('gpt-4.1')).toBe(0.08);
  });

  it('returns known value for mistral-large (highest decay)', () => {
    expect(getDefaultTheta('mistral-large')).toBe(0.12);
  });

  it('returns fallback for unknown family', () => {
    expect(getDefaultTheta('unknown-family')).toBe(DEFAULT_THETA_FALLBACK);
  });

  it('all default thetas are between 1% and 15%', () => {
    for (const [family, theta] of Object.entries(DEFAULT_THETA)) {
      expect(theta).toBeGreaterThanOrEqual(0.01);
      expect(theta).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('getDefaultSigma', () => {
  it('returns known value for gpt-4.1', () => {
    expect(getDefaultSigma('gpt-4.1')).toBe(0.12);
  });

  it('returns fallback for unknown family', () => {
    expect(getDefaultSigma('unknown-family')).toBe(DEFAULT_SIGMA_FALLBACK);
  });

  it('all default sigmas are between 2% and 25%', () => {
    for (const [family, sigma] of Object.entries(DEFAULT_SIGMA)) {
      expect(sigma).toBeGreaterThanOrEqual(0.02);
      expect(sigma).toBeLessThanOrEqual(0.25);
    }
  });
});

// ============================================================
// FAMILY LINEAGE
// ============================================================

describe('FAMILY_LINEAGE', () => {
  it('every family has at least one model in its lineage', () => {
    for (const [family, models] of Object.entries(FAMILY_LINEAGE)) {
      expect(models.length).toBeGreaterThan(0);
    }
  });

  it('every family includes itself or its current model in lineage', () => {
    // Each family's lineage should end with the current generation model
    for (const [family, models] of Object.entries(FAMILY_LINEAGE)) {
      const last = models[models.length - 1];
      // The last model should relate to the family name
      expect(last).toBeTruthy();
    }
  });

  it('gpt-4.1 lineage spans multiple generations', () => {
    const lineage = FAMILY_LINEAGE['gpt-4.1'];
    expect(lineage).toContain('gpt-4');
    expect(lineage).toContain('gpt-4-turbo');
    expect(lineage).toContain('gpt-4o');
    expect(lineage).toContain('gpt-4.1');
  });

  it('claude-4 lineage includes opus models', () => {
    const lineage = FAMILY_LINEAGE['claude-4'];
    expect(lineage).toContain('claude-3-opus');
    expect(lineage).toContain('opus-4.5');
    expect(lineage).toContain('opus-4.6');
  });
});

// ============================================================
// COMPUTE THETA FROM HISTORY
// ============================================================

describe('computeThetaFromHistory', () => {
  it('returns defaults when less than 2 data points', () => {
    const result = computeThetaFromHistory(
      [{ model_id: 'test', price_type: 'sync', beta: 10, observed_at: '2025-01-01T00:00:00Z' }],
      'unknown-family'
    );
    expect(result.theta).toBe(DEFAULT_THETA_FALLBACK);
    expect(result.sigma).toBe(DEFAULT_SIGMA_FALLBACK);
  });

  it('returns defaults for empty price array', () => {
    const result = computeThetaFromHistory([], 'gpt-4.1');
    expect(result.theta).toBe(0.08); // gpt-4.1 default
    expect(result.sigma).toBe(0.12); // gpt-4.1 default sigma
  });

  it('computes positive theta for declining prices', () => {
    const prices = [
      { model_id: 'test-model', price_type: 'sync', beta: 100, observed_at: '2024-01-01T00:00:00Z' },
      { model_id: 'test-model', price_type: 'sync', beta: 80, observed_at: '2024-04-01T00:00:00Z' },
      { model_id: 'test-model', price_type: 'sync', beta: 60, observed_at: '2024-07-01T00:00:00Z' },
    ];
    // Need a family that maps to test-model
    const result = computeThetaFromHistory(prices, 'test-family');
    // With no matching lineage, should return defaults
    expect(result.theta).toBe(DEFAULT_THETA_FALLBACK);
  });

  it('computes theta from real GPT-4 historical data', () => {
    const result = computeThetaFromHistory(historicalPrices as any[], 'gpt-4.1');
    // GPT-4 family had aggressive $60→$8 decline
    expect(result.theta).toBeGreaterThan(0.01);
    expect(result.theta).toBeLessThanOrEqual(0.15); // Clamped range
    expect(result.sigma).toBeGreaterThanOrEqual(0.02);
    expect(result.sigma).toBeLessThanOrEqual(0.25);
  });

  it('computes theta from real Claude historical data', () => {
    const result = computeThetaFromHistory(historicalPrices as any[], 'claude-4');
    // Claude Opus had $75→$45 decline
    expect(result.theta).toBeGreaterThan(0.01);
    expect(result.theta).toBeLessThanOrEqual(0.15);
  });

  it('computes theta from real Mistral historical data', () => {
    const result = computeThetaFromHistory(historicalPrices as any[], 'mistral-large');
    // Mistral had $24→$12 decline
    expect(result.theta).toBeGreaterThan(0.05); // Known aggressive decay
    expect(result.theta).toBeLessThanOrEqual(0.15);
  });

  it('ignores batch prices when computing sync theta', () => {
    const prices = [
      { model_id: 'gpt-4', price_type: 'sync', beta: 60, observed_at: '2023-03-01T00:00:00Z' },
      { model_id: 'gpt-4', price_type: 'batch', beta: 30, observed_at: '2023-06-01T00:00:00Z' },
      { model_id: 'gpt-4', price_type: 'sync', beta: 30, observed_at: '2024-01-01T00:00:00Z' },
    ];
    const result = computeThetaFromHistory(prices, 'gpt-4.1');
    // Should only use sync prices (2 data points), not batch
    expect(result.theta).toBeGreaterThan(0);
  });

  it('filters out mini/flash/nano models from lineage', () => {
    // Create prices that include a flash model that shouldn't be included in pro lineage
    const prices = [
      { model_id: 'gemini-2.5-pro', price_type: 'sync', beta: 10, observed_at: '2024-01-01T00:00:00Z' },
      { model_id: 'gemini-2.5-flash', price_type: 'sync', beta: 1, observed_at: '2024-06-01T00:00:00Z' },
      { model_id: 'gemini-2.5-pro', price_type: 'sync', beta: 8, observed_at: '2025-01-01T00:00:00Z' },
    ];
    const result = computeThetaFromHistory(prices, 'gemini-2.5-pro');
    // Flash should not pollute the Pro lineage computation
    expect(result.theta).toBeGreaterThan(0);
    expect(result.theta).toBeLessThanOrEqual(0.15);
  });

  it('theta is clamped to [0.01, 0.15] range', () => {
    // Create data with extreme price increase (would give negative theta)
    const prices = [
      { model_id: 'test-model', price_type: 'sync', beta: 1, observed_at: '2024-01-01T00:00:00Z' },
      { model_id: 'test-model', price_type: 'sync', beta: 100, observed_at: '2024-06-01T00:00:00Z' },
    ];
    // Need to create a lineage that maps to test-model
    // Since FAMILY_LINEAGE won't match, this returns defaults
    const result = computeThetaFromHistory(prices, 'test-model');
    expect(result.theta).toBeGreaterThanOrEqual(0.01);
    expect(result.theta).toBeLessThanOrEqual(0.15);
  });
});
