/**
 * Exostream v3 - Pricing Stress Test Suite
 * Ported from docs/exostream_stress_test.py
 *
 * Tests the intrinsic pricing math for correctness, edge cases, and consistency.
 * All 37 tests must pass - the math is sacred.
 */

import { describe, it, expect } from 'vitest';
import {
  effectiveInputRate,
  kappa,
  spotCost,
  forwardPrice,
  decayFactor,
} from '../src/core/pricing.js';
import type { ContextTier } from '../src/core/types.js';

// ============================================================
// TEST PARAMETERS
// ============================================================

// Claude family
const CLAUDE = {
  beta: 45.0,       // Opus 4.5 sync $/M
  betaB: 22.5,      // Opus 4.5 batch
  rIn: 0.20,
  rCache: 0.022,
  rThink: 0.80,
  rBatch: 0.50,
  W: 200_000,
  tiers: [{ tauStart: 0, tauEnd: 1.0, alpha: 1.0 }] as ContextTier[],  // flat pricing
  theta: 0.031,
  sigma: 0.02,
};

// OpenAI family (GPT-4.1)
const OPENAI = {
  beta: 8.0,
  betaB: 2.0,
  rIn: 0.25,
  rCache: 0.0625,   // cached = $0.50/M vs $8/M output
  rThink: 0.0,      // not a reasoning model
  rBatch: 0.25,
  W: 1_000_000,
  tiers: [{ tauStart: 0, tauEnd: 1.0, alpha: 1.0 }] as ContextTier[],
  theta: 0.08,      // faster decay (older model line)
  sigma: 0.04,
};

// Google Gemini 2.5 Pro (hypothetical tiered pricing for testing)
const GEMINI_TIERED = {
  beta: 10.0,
  betaB: 2.5,
  rIn: 0.125,
  rCache: 0.015,
  rThink: 0.75,
  rBatch: 0.25,
  W: 1_000_000,
  tiers: [
    { tauStart: 0, tauEnd: 0.128, alpha: 1.0 },      // up to 128K
    { tauStart: 0.128, tauEnd: 1.0, alpha: 2.0 },    // 2x rate above 128K
  ] as ContextTier[],
  theta: 0.05,
  sigma: 0.03,
};

// ============================================================
// TEST 1: Validated example from spec (Opus 4.5 RAG)
// ============================================================
describe('TEST 1: Validated Example (Opus 4.5 RAG)', () => {
  const m = CLAUDE;
  const eta = 0.60;
  const nIn = 30_000;
  const nOut = 800;

  const rEff = effectiveInputRate(m.rIn, m.rCache, eta, nIn, m.W, m.tiers);
  const k = kappa(nIn, nOut, rEff);
  const S = spotCost(m.beta, nOut, nIn, rEff);

  it('r_in_eff should be 0.093', () => {
    expect(rEff).toBeCloseTo(0.093, 3);
  });

  it('kappa (delta) should be 4.49', () => {
    expect(k).toBeCloseTo(4.49, 1);
  });

  it('spot cost should be $0.162', () => {
    expect(S).toBeCloseTo(0.162, 3);
  });

  // Syngraph compression test
  const nInCompressed = 3_000;
  const rEffC = effectiveInputRate(m.rIn, m.rCache, eta, nInCompressed, m.W, m.tiers);
  const kC = kappa(nInCompressed, nOut, rEffC);
  const SC = spotCost(m.beta, nOut, nInCompressed, rEffC);
  const deltaCompress = S - SC;

  it('compressed kappa should be 1.35', () => {
    expect(kC).toBeCloseTo(1.35, 1);
  });

  it('compressed cost should be $0.049', () => {
    expect(SC).toBeCloseTo(0.049, 3);
  });

  it('compression savings should be $0.113', () => {
    expect(deltaCompress).toBeCloseTo(0.113, 3);
  });
});

// ============================================================
// TEST 2: Edge case - zero input (pure generation)
// ============================================================
describe('TEST 2: Zero Input (Pure Generation)', () => {
  const m = CLAUDE;

  const rEff0 = effectiveInputRate(m.rIn, m.rCache, 0, 0, m.W, m.tiers);
  const k0 = kappa(0, 1000, rEff0);
  const S0 = spotCost(m.beta, 1000, 0, rEff0);

  it('r_in_eff should be 0 with no input', () => {
    expect(rEff0).toBe(0.0);
  });

  it('kappa should be 1.0 with no input', () => {
    expect(k0).toBe(1.0);
  });

  it('spot cost should equal beta * n_out * 1e-6', () => {
    expect(S0).toBeCloseTo(45.0 * 1000 * 1e-6, 6);
  });
});

// ============================================================
// TEST 3: Edge case - 100% cache hit
// ============================================================
describe('TEST 3: 100% Cache Hit', () => {
  const m = CLAUDE;

  const rEffFullCache = effectiveInputRate(m.rIn, m.rCache, 1.0, 30_000, m.W, m.tiers);

  it('r_in_eff should equal r_cache at eta=1', () => {
    expect(rEffFullCache).toBeCloseTo(m.rCache, 6);
  });
});

// ============================================================
// TEST 4: Edge case - 0% cache hit
// ============================================================
describe('TEST 4: 0% Cache Hit', () => {
  const m = CLAUDE;

  const rEffNoCache = effectiveInputRate(m.rIn, m.rCache, 0.0, 30_000, m.W, m.tiers);

  it('r_in_eff should equal r_in at eta=0 (flat pricing)', () => {
    expect(rEffNoCache).toBeCloseTo(m.rIn, 6);
  });
});

// ============================================================
// TEST 5: Edge case - max context window
// ============================================================
describe('TEST 5: Max Context Window', () => {
  const m = CLAUDE;
  const nInMax = m.W;  // 200K tokens

  const rEffMax = effectiveInputRate(m.rIn, m.rCache, 0.3, nInMax, m.W, m.tiers);
  const kMax = kappa(nInMax, 500, rEffMax);
  const SMax = spotCost(m.beta, 500, nInMax, rEffMax);

  it('kappa should be > 1 at max window', () => {
    expect(kMax).toBeGreaterThan(1);
  });

  it('kappa should scale with depth (> 50 for extreme ratio)', () => {
    expect(kMax).toBeGreaterThan(50);
  });
});

// ============================================================
// TEST 6: Tiered pricing (Gemini hypothetical)
// ============================================================
describe('TEST 6: Tiered Pricing', () => {
  const g = GEMINI_TIERED;

  // Case A: 100K tokens (entirely within tier 0, below 128K boundary)
  const nInA = 100_000;
  const rEffA = effectiveInputRate(g.rIn, g.rCache, 0, nInA, g.W, g.tiers);

  it('below tier boundary should equal r_in', () => {
    expect(rEffA).toBeCloseTo(g.rIn, 6);
  });

  // Case B: 500K tokens (spans both tiers)
  const nInB = 500_000;
  const rEffB = effectiveInputRate(g.rIn, g.rCache, 0, nInB, g.W, g.tiers);

  // Manual calc: 128K in tier 0 (alpha=1), 372K in tier 1 (alpha=2)
  // r_in_depth = (128000 * 1.0 * 0.125 + 372000 * 2.0 * 0.125) / 500000
  const expectedRDepthB = (128_000 * 1.0 * 0.125 + 372_000 * 2.0 * 0.125) / 500_000;

  it('tiered r_in_depth at 500K should be correct', () => {
    expect(rEffB).toBeCloseTo(expectedRDepthB, 3);
  });

  // Case C: 1M tokens (entire window, both tiers)
  const nInC = 1_000_000;
  const rEffC = effectiveInputRate(g.rIn, g.rCache, 0, nInC, g.W, g.tiers);

  // 128K in tier 0, 872K in tier 1
  const expectedRDepthC = (128_000 * 1.0 * 0.125 + 872_000 * 2.0 * 0.125) / 1_000_000;

  it('tiered r_in_depth at 1M should be correct', () => {
    expect(rEffC).toBeCloseTo(expectedRDepthC, 3);
  });

  it('deeper context should be more expensive', () => {
    expect(rEffC).toBeGreaterThan(rEffB);
    expect(rEffB).toBeGreaterThan(rEffA);
  });

  // Case D: tiered + cache interaction
  const rEffD = effectiveInputRate(g.rIn, g.rCache, 0.5, 500_000, g.W, g.tiers);
  const expectedD = expectedRDepthB * 0.5 + g.rCache * 0.5;

  it('tiered + cache should be correct', () => {
    expect(rEffD).toBeCloseTo(expectedD, 3);
  });
});

// ============================================================
// TEST 7: Omega (depth convexity) - verify numerically
// ============================================================
describe('TEST 7: Omega (Depth Convexity)', () => {
  const m = CLAUDE;
  const g = GEMINI_TIERED;
  const epsilon = 100;

  // Flat pricing: omega should be ~0
  const nBase = 50_000;
  const SMinus = spotCost(m.beta, 800, nBase - epsilon,
    effectiveInputRate(m.rIn, m.rCache, 0, nBase - epsilon, m.W, m.tiers));
  const SCenter = spotCost(m.beta, 800, nBase,
    effectiveInputRate(m.rIn, m.rCache, 0, nBase, m.W, m.tiers));
  const SPlus = spotCost(m.beta, 800, nBase + epsilon,
    effectiveInputRate(m.rIn, m.rCache, 0, nBase + epsilon, m.W, m.tiers));

  const omegaFlat = (SPlus - 2 * SCenter + SMinus) / (epsilon ** 2);

  it('omega should be ~0 under flat pricing', () => {
    expect(Math.abs(omegaFlat)).toBeLessThan(1e-10);
  });

  // Tiered pricing: omega should be > 0 at tier boundary
  const nBoundary = 128_000;
  const SMinusT = spotCost(g.beta, 800, nBoundary - epsilon,
    effectiveInputRate(g.rIn, g.rCache, 0, nBoundary - epsilon, g.W, g.tiers));
  const SCenterT = spotCost(g.beta, 800, nBoundary,
    effectiveInputRate(g.rIn, g.rCache, 0, nBoundary, g.W, g.tiers));
  const SPlusT = spotCost(g.beta, 800, nBoundary + epsilon,
    effectiveInputRate(g.rIn, g.rCache, 0, nBoundary + epsilon, g.W, g.tiers));

  const omegaTiered = (SPlusT - 2 * SCenterT + SMinusT) / (epsilon ** 2);

  it('omega should be > 0 at tier boundary', () => {
    expect(omegaTiered).toBeGreaterThan(0);
  });

  // Within a single tier (well below boundary): omega should be ~0
  const nLow = 50_000;
  const SMinusLow = spotCost(g.beta, 800, nLow - epsilon,
    effectiveInputRate(g.rIn, g.rCache, 0, nLow - epsilon, g.W, g.tiers));
  const SCenterLow = spotCost(g.beta, 800, nLow,
    effectiveInputRate(g.rIn, g.rCache, 0, nLow, g.W, g.tiers));
  const SPlusLow = spotCost(g.beta, 800, nLow + epsilon,
    effectiveInputRate(g.rIn, g.rCache, 0, nLow + epsilon, g.W, g.tiers));

  const omegaWithin = (SPlusLow - 2 * SCenterLow + SMinusLow) / (epsilon ** 2);

  it('omega should be ~0 within single tier', () => {
    expect(Math.abs(omegaWithin)).toBeLessThan(1e-10);
  });
});

// ============================================================
// TEST 8: Forward pricing / decay
// ============================================================
describe('TEST 8: Forward Pricing', () => {
  // 3-month forward from spec
  const betaFwd3m = forwardPrice(45.0, 0.031, 3);

  it('3M forward price should match spec', () => {
    expect(betaFwd3m).toBeCloseTo(45.0 * Math.exp(-0.093), 6);
  });

  it('D(0) should equal 1', () => {
    expect(decayFactor(0.031, 0)).toBe(1.0);
  });

  // D strictly decreasing for positive theta
  const D1 = decayFactor(0.031, 1);
  const D3 = decayFactor(0.031, 3);
  const D6 = decayFactor(0.031, 6);

  it('D should be monotonically decreasing', () => {
    expect(D1).toBeGreaterThan(D3);
    expect(D3).toBeGreaterThan(D6);
  });

  // Negative theta -> appreciation
  const DNeg = decayFactor(-0.05, 3);

  it('negative theta should give D > 1', () => {
    expect(DNeg).toBeGreaterThan(1.0);
  });
});

// ============================================================
// TEST 9: Cross-model consistency
// ============================================================
describe('TEST 9: Cross-Model Consistency', () => {
  const taskNIn = 10_000;
  const taskNOut = 500;

  // Verify batch relationship
  const rEffClaude = effectiveInputRate(CLAUDE.rIn, CLAUDE.rCache, 0.4, taskNIn, CLAUDE.W, CLAUDE.tiers);
  const SSync = spotCost(CLAUDE.beta, taskNOut, taskNIn, rEffClaude);
  const SBatch = spotCost(CLAUDE.betaB, taskNOut, taskNIn, rEffClaude);

  it('batch should equal sync * r_batch', () => {
    expect(SBatch).toBeCloseTo(SSync * CLAUDE.rBatch, 6);
  });
});

// ============================================================
// TEST 10: Monotonicity properties
// ============================================================
describe('TEST 10: Monotonicity Properties', () => {
  const m = CLAUDE;

  // S increases with n_in (more context = more cost)
  const costsByDepth: number[] = [];
  for (const n of [0, 1000, 5000, 20000, 50000, 100000]) {
    const r = effectiveInputRate(m.rIn, m.rCache, 0.3, n, m.W, m.tiers);
    const s = spotCost(m.beta, 800, n, r);
    costsByDepth.push(s);
  }

  it('S should monotonically increase with n_in', () => {
    for (let i = 0; i < costsByDepth.length - 1; i++) {
      expect(costsByDepth[i]).toBeLessThanOrEqual(costsByDepth[i + 1]);
    }
  });

  // S decreases with eta (more cache = less cost)
  const costsByCache: number[] = [];
  for (const etaVal of [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
    const r = effectiveInputRate(m.rIn, m.rCache, etaVal, 30_000, m.W, m.tiers);
    const s = spotCost(m.beta, 800, 30_000, r);
    costsByCache.push(s);
  }

  it('S should monotonically decrease with eta', () => {
    for (let i = 0; i < costsByCache.length - 1; i++) {
      expect(costsByCache[i]).toBeGreaterThanOrEqual(costsByCache[i + 1]);
    }
  });

  // kappa >= 1 always
  const kappas: number[] = [];
  for (const n of [0, 100, 10000, 200000]) {
    const r = effectiveInputRate(m.rIn, m.rCache, 0, n, m.W, m.tiers);
    kappas.push(kappa(n, 800, r));
  }

  it('kappa should always be >= 1', () => {
    for (const k of kappas) {
      expect(k).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('forward price < spot for positive theta', () => {
    expect(forwardPrice(45, 0.031, 6)).toBeLessThan(45.0);
  });
});

// ============================================================
// TEST 11: Boundary & adversarial inputs
// ============================================================
describe('TEST 11: Boundary & Adversarial Inputs', () => {
  // Single token output
  const SSingle = spotCost(45.0, 1, 100_000,
    effectiveInputRate(0.20, 0.022, 0, 100_000, 200_000, [{ tauStart: 0, tauEnd: 1, alpha: 1 }]));

  it('single output token should be computable and positive', () => {
    expect(SSingle).toBeGreaterThan(0);
    expect(Number.isFinite(SSingle)).toBe(true);
  });

  // Massive context ratio (200K in, 1 out)
  const rHuge = effectiveInputRate(0.20, 0.022, 0, 200_000, 200_000, [{ tauStart: 0, tauEnd: 1, alpha: 1 }]);
  const kHuge = kappa(200_000, 1, rHuge);

  it('extreme kappa should be finite', () => {
    expect(Number.isFinite(kHuge)).toBe(true);
  });

  // Zero theta (no decay)
  it('D should equal 1 when theta=0 at any t', () => {
    expect(decayFactor(0, 100)).toBe(1.0);
  });

  // Very large theta
  const DFast = decayFactor(0.5, 12);

  it('fast decay should stay positive', () => {
    expect(DFast).toBeGreaterThan(0);
  });

  // Thinking tokens
  const SThink = spotCost(45.0, 500, 5000,
    effectiveInputRate(0.20, 0.022, 0, 5000, 200_000, [{ tauStart: 0, tauEnd: 1, alpha: 1 }]),
    10000, 0.80);
  const SNoThink = spotCost(45.0, 500, 5000,
    effectiveInputRate(0.20, 0.022, 0, 5000, 200_000, [{ tauStart: 0, tauEnd: 1, alpha: 1 }]),
    0, 0);

  it('thinking tokens should add cost', () => {
    expect(SThink).toBeGreaterThan(SNoThink);
  });
});

// ============================================================
// TEST 12: kappa as Delta (Price Sensitivity)
// ============================================================
describe('TEST 12: kappa as Delta (Price Sensitivity)', () => {
  const m = CLAUDE;

  // If beta moves by $1/M, cost should move by kappa * n_out * 1e-6
  const betaBase = 45.0;
  const betaBumped = 46.0;  // +$1/M
  const nInT = 30_000;
  const nOutT = 800;
  const etaT = 0.6;

  const rEffBase = effectiveInputRate(m.rIn, m.rCache, etaT, nInT, m.W, m.tiers);
  const SBase = spotCost(betaBase, nOutT, nInT, rEffBase);
  const SBumped = spotCost(betaBumped, nOutT, nInT, rEffBase);

  const kDelta = kappa(nInT, nOutT, rEffBase);
  const predictedMove = kDelta * nOutT * 1e-6;
  const actualMove = SBumped - SBase;

  it('delta should predict price move', () => {
    expect(predictedMove).toBeCloseTo(actualMove, 4);
  });

  // Also verify for a different task profile
  const nInT2 = 1000;
  const nOutT2 = 5000;
  const rEff2 = effectiveInputRate(m.rIn, m.rCache, 0, nInT2, m.W, m.tiers);
  const SBase2 = spotCost(betaBase, nOutT2, nInT2, rEff2);
  const SBumped2 = spotCost(betaBumped, nOutT2, nInT2, rEff2);
  const kDelta2 = kappa(nInT2, nOutT2, rEff2);
  const predicted2 = kDelta2 * nOutT2 * 1e-6;
  const actual2 = SBumped2 - SBase2;

  it('delta should work for low-context task', () => {
    expect(predicted2).toBeCloseTo(actual2, 4);
  });
});
