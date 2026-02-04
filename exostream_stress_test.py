"""
Exostream.ai v3 — Model Stress Test Suite
Tests the intrinsic pricing math for correctness, edge cases, and consistency.
"""

import math

# ============================================================
# CORE MODEL IMPLEMENTATION
# ============================================================

def effective_input_rate(r_in, r_cache, eta, n_in, W, tiers):
    """
    Compute r_in_eff: the blended input rate after tiers + cache.
    
    tiers: list of (tau_start, tau_end, alpha) tuples
           tau values are fractions of W (0 to 1)
    """
    if n_in == 0:
        return 0.0
    
    # Step 1: distribute tokens across tiers
    r_in_depth = 0.0
    for tau_start, tau_end, alpha in tiers:
        tokens_in_tier = max(0, min(n_in, tau_end * W) - min(n_in, tau_start * W))
        r_in_depth += tokens_in_tier * alpha * r_in
    r_in_depth /= n_in
    
    # Step 2: apply cache
    r_in_eff = r_in_depth * (1 - eta) + r_cache * eta
    
    return r_in_eff


def kappa(n_in, n_out, r_in_eff):
    """Context cost multiplier / task delta to beta."""
    if n_out == 0:
        return float('inf')  # degenerate case
    return 1 + (n_in / n_out) * r_in_eff


def spot_cost(beta, n_out, n_in, r_in_eff, n_think=0, r_think=0):
    """Spot cost in USD."""
    return beta * (n_out + n_in * r_in_eff + n_think * r_think) * 1e-6


def forward_price(beta, theta, t):
    """Forward ticker price."""
    return beta * math.exp(-theta * t)


def decay_factor(theta, t):
    """Decay factor D(t)."""
    return math.exp(-theta * t)


# ============================================================
# TEST PARAMETERS
# ============================================================

# Claude family
CLAUDE = {
    'beta': 45.0,       # Opus 4.5 sync $/M
    'beta_B': 22.5,     # Opus 4.5 batch
    'r_in': 0.20,
    'r_cache': 0.022,
    'r_think': 0.80,
    'r_batch': 0.50,
    'W': 200_000,
    'tiers': [(0, 1.0, 1.0)],  # flat pricing
    'theta': 0.031,
    'sigma': 0.02,
}

# OpenAI family (GPT-4.1)
OPENAI = {
    'beta': 8.0,
    'beta_B': 2.0,
    'r_in': 0.25,
    'r_cache': 0.0625,  # cached = $0.50/M vs $8/M output
    'r_think': 0.0,     # not a reasoning model
    'r_batch': 0.25,
    'W': 1_000_000,
    'tiers': [(0, 1.0, 1.0)],
    'theta': 0.08,      # faster decay (older model line)
    'sigma': 0.04,
}

# Google Gemini 2.5 Pro (hypothetical tiered pricing for testing)
GEMINI_TIERED = {
    'beta': 10.0,
    'beta_B': 2.5,
    'r_in': 0.125,
    'r_cache': 0.015,
    'r_think': 0.75,
    'r_batch': 0.25,
    'W': 1_000_000,
    'tiers': [(0, 0.128, 1.0), (0.128, 1.0, 2.0)],  # 2x rate above 128K
    'theta': 0.05,
    'sigma': 0.03,
}


def run_test(name, expected, actual, tolerance=0.001):
    """Compare expected vs actual with tolerance."""
    passed = abs(expected - actual) < tolerance if expected != 0 else abs(actual) < tolerance
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}: {name}")
    print(f"         Expected: {expected:.6f}  |  Actual: {actual:.6f}")
    if not passed:
        print(f"         DELTA: {abs(expected - actual):.6f}")
    return passed


# ============================================================
# TEST SUITE
# ============================================================

results = []

print("=" * 70)
print("EXOSTREAM v3 — STRESS TEST SUITE")
print("=" * 70)

# ----------------------------------------------------------
# TEST 1: Validated example from spec (Opus 4.5 RAG)
# ----------------------------------------------------------
print("\n--- TEST 1: Validated Example (Opus 4.5 RAG) ---")

m = CLAUDE
eta = 0.60
n_in, n_out = 30_000, 800

r_eff = effective_input_rate(m['r_in'], m['r_cache'], eta, n_in, m['W'], m['tiers'])
k = kappa(n_in, n_out, r_eff)
S = spot_cost(m['beta'], n_out, n_in, r_eff)

results.append(run_test("r_in_eff", 0.093, r_eff, 0.001))
results.append(run_test("kappa (delta)", 4.49, k, 0.02))
results.append(run_test("spot cost", 0.162, S, 0.001))

# Syngraph compression
n_in_compressed = 3_000
r_eff_c = effective_input_rate(m['r_in'], m['r_cache'], eta, n_in_compressed, m['W'], m['tiers'])
k_c = kappa(n_in_compressed, n_out, r_eff_c)
S_c = spot_cost(m['beta'], n_out, n_in_compressed, r_eff_c)
delta_compress = S - S_c

results.append(run_test("compressed kappa", 1.35, k_c, 0.02))
results.append(run_test("compressed cost", 0.049, S_c, 0.001))
results.append(run_test("compression savings", 0.113, delta_compress, 0.001))

# ----------------------------------------------------------
# TEST 2: Edge case — zero input (pure generation)
# ----------------------------------------------------------
print("\n--- TEST 2: Zero Input (Pure Generation) ---")

r_eff_0 = effective_input_rate(m['r_in'], m['r_cache'], 0, 0, m['W'], m['tiers'])
k_0 = kappa(0, 1000, r_eff_0)
S_0 = spot_cost(m['beta'], 1000, 0, r_eff_0)

results.append(run_test("r_in_eff (no input)", 0.0, r_eff_0))
results.append(run_test("kappa (no input)", 1.0, k_0))
results.append(run_test("spot = beta * n_out * 1e-6", 45.0 * 1000 * 1e-6, S_0))

# ----------------------------------------------------------
# TEST 3: Edge case — 100% cache hit
# ----------------------------------------------------------
print("\n--- TEST 3: 100% Cache Hit ---")

r_eff_full_cache = effective_input_rate(m['r_in'], m['r_cache'], 1.0, 30_000, m['W'], m['tiers'])
S_full_cache = spot_cost(m['beta'], 800, 30_000, r_eff_full_cache)

# At 100% cache, r_in_eff should equal r_cache
results.append(run_test("r_in_eff = r_cache at η=1", m['r_cache'], r_eff_full_cache))

# ----------------------------------------------------------
# TEST 4: Edge case — 0% cache hit
# ----------------------------------------------------------
print("\n--- TEST 4: 0% Cache Hit ---")

r_eff_no_cache = effective_input_rate(m['r_in'], m['r_cache'], 0.0, 30_000, m['W'], m['tiers'])

# At 0% cache, r_in_eff should equal r_in (flat pricing)
results.append(run_test("r_in_eff = r_in at η=0", m['r_in'], r_eff_no_cache))

# ----------------------------------------------------------
# TEST 5: Edge case — max context window
# ----------------------------------------------------------
print("\n--- TEST 5: Max Context Window ---")

n_in_max = m['W']  # 200K tokens
r_eff_max = effective_input_rate(m['r_in'], m['r_cache'], 0.3, n_in_max, m['W'], m['tiers'])
k_max = kappa(n_in_max, 500, r_eff_max)
S_max = spot_cost(m['beta'], 500, n_in_max, r_eff_max)

print(f"  INFO: At max window (200K in, 500 out): κ = {k_max:.2f}, S = ${S_max:.4f}")
results.append(run_test("kappa > 1 at max window", True, k_max > 1))

# Verify: extreme context ratio should produce high kappa
results.append(run_test("kappa scales with depth", True, k_max > 50))

# ----------------------------------------------------------
# TEST 6: Tiered pricing (Gemini hypothetical)
# ----------------------------------------------------------
print("\n--- TEST 6: Tiered Pricing ---")

g = GEMINI_TIERED

# Case A: 100K tokens (entirely within tier 0, below 128K boundary)
n_in_a = 100_000
r_eff_a = effective_input_rate(g['r_in'], g['r_cache'], 0, n_in_a, g['W'], g['tiers'])
# Should be just r_in since all tokens in tier 0 (alpha=1)
results.append(run_test("below tier boundary = r_in", g['r_in'], r_eff_a))

# Case B: 500K tokens (spans both tiers)
n_in_b = 500_000
r_eff_b = effective_input_rate(g['r_in'], g['r_cache'], 0, n_in_b, g['W'], g['tiers'])

# Manual calc: 128K in tier 0 (alpha=1), 372K in tier 1 (alpha=2)
# r_in_depth = (128000 * 1.0 * 0.125 + 372000 * 2.0 * 0.125) / 500000
# = (16000 + 93000) / 500000 = 109000 / 500000 = 0.218
expected_r_depth_b = (128_000 * 1.0 * 0.125 + 372_000 * 2.0 * 0.125) / 500_000
results.append(run_test("tiered r_in_depth (500K)", expected_r_depth_b, r_eff_b, 0.001))

# Case C: 1M tokens (entire window, both tiers)
n_in_c = 1_000_000
r_eff_c = effective_input_rate(g['r_in'], g['r_cache'], 0, n_in_c, g['W'], g['tiers'])

# 128K in tier 0, 872K in tier 1
expected_r_depth_c = (128_000 * 1.0 * 0.125 + 872_000 * 2.0 * 0.125) / 1_000_000
results.append(run_test("tiered r_in_depth (1M)", expected_r_depth_c, r_eff_c, 0.001))

# Verify: deeper context = higher effective rate (convexity)
results.append(run_test("tiered: deeper = more expensive", True, r_eff_c > r_eff_b > r_eff_a))

# Case D: tiered + cache interaction
r_eff_d = effective_input_rate(g['r_in'], g['r_cache'], 0.5, 500_000, g['W'], g['tiers'])
expected_d = expected_r_depth_b * 0.5 + g['r_cache'] * 0.5
results.append(run_test("tiered + cache", expected_d, r_eff_d, 0.001))

# ----------------------------------------------------------
# TEST 7: Omega (depth convexity) — verify numerically
# ----------------------------------------------------------
print("\n--- TEST 7: Omega (Depth Convexity) ---")

# Flat pricing: omega should be ~0
epsilon = 100
n_base = 50_000
S_minus = spot_cost(m['beta'], 800, n_base - epsilon, 
                     effective_input_rate(m['r_in'], m['r_cache'], 0, n_base - epsilon, m['W'], m['tiers']))
S_center = spot_cost(m['beta'], 800, n_base,
                      effective_input_rate(m['r_in'], m['r_cache'], 0, n_base, m['W'], m['tiers']))
S_plus = spot_cost(m['beta'], 800, n_base + epsilon,
                    effective_input_rate(m['r_in'], m['r_cache'], 0, n_base + epsilon, m['W'], m['tiers']))

omega_flat = (S_plus - 2 * S_center + S_minus) / (epsilon ** 2)
results.append(run_test("omega ≈ 0 under flat pricing", 0.0, omega_flat, 1e-10))

# Tiered pricing: omega should be > 0 at tier boundary
# Test near the 128K boundary of Gemini tiered model
n_boundary = 128_000
S_minus_t = spot_cost(g['beta'], 800, n_boundary - epsilon,
                       effective_input_rate(g['r_in'], g['r_cache'], 0, n_boundary - epsilon, g['W'], g['tiers']))
S_center_t = spot_cost(g['beta'], 800, n_boundary,
                        effective_input_rate(g['r_in'], g['r_cache'], 0, n_boundary, g['W'], g['tiers']))
S_plus_t = spot_cost(g['beta'], 800, n_boundary + epsilon,
                      effective_input_rate(g['r_in'], g['r_cache'], 0, n_boundary + epsilon, g['W'], g['tiers']))

omega_tiered = (S_plus_t - 2 * S_center_t + S_minus_t) / (epsilon ** 2)
print(f"  INFO: omega at tier boundary = {omega_tiered:.2e}")
results.append(run_test("omega > 0 at tier boundary", True, omega_tiered > 0))

# Within a single tier (well below boundary): omega should be ~0
n_low = 50_000
S_minus_low = spot_cost(g['beta'], 800, n_low - epsilon,
                         effective_input_rate(g['r_in'], g['r_cache'], 0, n_low - epsilon, g['W'], g['tiers']))
S_center_low = spot_cost(g['beta'], 800, n_low,
                          effective_input_rate(g['r_in'], g['r_cache'], 0, n_low, g['W'], g['tiers']))
S_plus_low = spot_cost(g['beta'], 800, n_low + epsilon,
                        effective_input_rate(g['r_in'], g['r_cache'], 0, n_low + epsilon, g['W'], g['tiers']))

omega_within = (S_plus_low - 2 * S_center_low + S_minus_low) / (epsilon_low ** 2) if 'epsilon_low' in dir() else \
               (S_plus_low - 2 * S_center_low + S_minus_low) / (epsilon ** 2)
results.append(run_test("omega ≈ 0 within single tier", 0.0, omega_within, 1e-10))

# ----------------------------------------------------------
# TEST 8: Forward pricing / decay
# ----------------------------------------------------------
print("\n--- TEST 8: Forward Pricing ---")

# 3-month forward from spec
beta_fwd_3m = forward_price(45.0, 0.031, 3)
results.append(run_test("3M forward (Opus)", 45.0 * math.exp(-0.093), beta_fwd_3m))

# D(0) = 1
results.append(run_test("D(0) = 1", 1.0, decay_factor(0.031, 0)))

# D strictly decreasing for positive theta
D_1 = decay_factor(0.031, 1)
D_3 = decay_factor(0.031, 3)
D_6 = decay_factor(0.031, 6)
results.append(run_test("D monotonically decreasing", True, D_1 > D_3 > D_6))

# Negative theta → appreciation
D_neg = decay_factor(-0.05, 3)
results.append(run_test("negative theta → D > 1", True, D_neg > 1.0))

# ----------------------------------------------------------
# TEST 9: Cross-model consistency
# ----------------------------------------------------------
print("\n--- TEST 9: Cross-Model Consistency ---")

# Same task profile on different models should scale with beta
task_n_in, task_n_out = 10_000, 500

for name, model in [("Claude", CLAUDE), ("OpenAI", OPENAI)]:
    r_eff = effective_input_rate(model['r_in'], model['r_cache'], 0.4, task_n_in, model['W'], model['tiers'])
    S = spot_cost(model['beta'], task_n_out, task_n_in, r_eff)
    k = kappa(task_n_in, task_n_out, r_eff)
    print(f"  INFO: {name:8s}: β=${model['beta']:6.2f}  r_in_eff={r_eff:.4f}  κ={k:.3f}  S=${S:.6f}")

# Verify batch relationship
S_sync = spot_cost(CLAUDE['beta'], 500, 10_000,
                    effective_input_rate(CLAUDE['r_in'], CLAUDE['r_cache'], 0.4, 10_000, CLAUDE['W'], CLAUDE['tiers']))
S_batch = spot_cost(CLAUDE['beta_B'], 500, 10_000,
                     effective_input_rate(CLAUDE['r_in'], CLAUDE['r_cache'], 0.4, 10_000, CLAUDE['W'], CLAUDE['tiers']))
results.append(run_test("batch = sync × r_batch", S_sync * CLAUDE['r_batch'], S_batch))

# ----------------------------------------------------------
# TEST 10: Monotonicity properties
# ----------------------------------------------------------
print("\n--- TEST 10: Monotonicity Properties ---")

# S increases with n_in (more context = more cost)
costs_by_depth = []
for n in [0, 1000, 5000, 20000, 50000, 100000]:
    r = effective_input_rate(m['r_in'], m['r_cache'], 0.3, n, m['W'], m['tiers'])
    s = spot_cost(m['beta'], 800, n, r)
    costs_by_depth.append(s)
monotonic_in = all(costs_by_depth[i] <= costs_by_depth[i+1] for i in range(len(costs_by_depth)-1))
results.append(run_test("S monotonically increases with n_in", True, monotonic_in))

# S decreases with eta (more cache = less cost)
costs_by_cache = []
for eta_val in [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]:
    r = effective_input_rate(m['r_in'], m['r_cache'], eta_val, 30_000, m['W'], m['tiers'])
    s = spot_cost(m['beta'], 800, 30_000, r)
    costs_by_cache.append(s)
monotonic_cache = all(costs_by_cache[i] >= costs_by_cache[i+1] for i in range(len(costs_by_cache)-1))
results.append(run_test("S monotonically decreases with η", True, monotonic_cache))

# kappa >= 1 always
kappas = []
for n in [0, 100, 10000, 200000]:
    r = effective_input_rate(m['r_in'], m['r_cache'], 0, n, m['W'], m['tiers'])
    kappas.append(kappa(n, 800, r))
all_ge_1 = all(k >= 1.0 for k in kappas)
results.append(run_test("κ ≥ 1 always", True, all_ge_1))

# Forward price < spot for positive theta
results.append(run_test("forward < spot for θ > 0", True, 
                         forward_price(45, 0.031, 6) < 45.0))

# ----------------------------------------------------------
# TEST 11: Boundary / adversarial inputs
# ----------------------------------------------------------
print("\n--- TEST 11: Boundary & Adversarial Inputs ---")

# Single token output
S_single = spot_cost(45.0, 1, 100_000, 
                      effective_input_rate(0.20, 0.022, 0, 100_000, 200_000, [(0, 1, 1)]))
results.append(run_test("single output token computable", True, S_single > 0 and math.isfinite(S_single)))

# Massive context ratio (200K in, 1 out)
r_huge = effective_input_rate(0.20, 0.022, 0, 200_000, 200_000, [(0, 1, 1)])
k_huge = kappa(200_000, 1, r_huge)
print(f"  INFO: Extreme context ratio (200K:1): κ = {k_huge:,.1f}")
results.append(run_test("extreme kappa is finite", True, math.isfinite(k_huge)))

# Zero theta (no decay)
results.append(run_test("D = 1 when θ = 0 at any t", 1.0, decay_factor(0, 100)))

# Very large theta
D_fast = decay_factor(0.5, 12)
results.append(run_test("fast decay stays positive", True, D_fast > 0))
print(f"  INFO: θ=0.5/mo over 12 months: D = {D_fast:.6f}, β_fwd = ${45 * D_fast:.4f}")

# Thinking tokens
S_think = spot_cost(45.0, 500, 5000,
                     effective_input_rate(0.20, 0.022, 0, 5000, 200_000, [(0, 1, 1)]),
                     n_think=10000, r_think=0.80)
S_no_think = spot_cost(45.0, 500, 5000,
                        effective_input_rate(0.20, 0.022, 0, 5000, 200_000, [(0, 1, 1)]),
                        n_think=0, r_think=0)
results.append(run_test("thinking tokens add cost", True, S_think > S_no_think))
print(f"  INFO: With 10K think tokens: ${S_think:.4f} vs ${S_no_think:.4f} without")

# ----------------------------------------------------------
# TEST 12: κ-as-delta verification
# ----------------------------------------------------------
print("\n--- TEST 12: κ as Delta (Price Sensitivity) ---")

# If beta moves by $1/M, cost should move by kappa * n_out * 1e-6
beta_base = 45.0
beta_bumped = 46.0  # +$1/M
n_in_t, n_out_t, eta_t = 30_000, 800, 0.6

r_eff_base = effective_input_rate(m['r_in'], m['r_cache'], eta_t, n_in_t, m['W'], m['tiers'])
S_base = spot_cost(beta_base, n_out_t, n_in_t, r_eff_base)
S_bumped = spot_cost(beta_bumped, n_out_t, n_in_t, r_eff_base)

k_delta = kappa(n_in_t, n_out_t, r_eff_base)
predicted_move = k_delta * n_out_t * 1e-6  # predicted by delta
actual_move = S_bumped - S_base

results.append(run_test("delta predicts price move", predicted_move, actual_move, 0.0001))
print(f"  INFO: β +$1/M → cost +${actual_move:.6f}, delta predicted +${predicted_move:.6f}")

# Also verify for a different task profile
n_in_t2, n_out_t2 = 1000, 5000
r_eff_2 = effective_input_rate(m['r_in'], m['r_cache'], 0, n_in_t2, m['W'], m['tiers'])
S_base_2 = spot_cost(beta_base, n_out_t2, n_in_t2, r_eff_2)
S_bumped_2 = spot_cost(beta_bumped, n_out_t2, n_in_t2, r_eff_2)
k_delta_2 = kappa(n_in_t2, n_out_t2, r_eff_2)
predicted_2 = k_delta_2 * n_out_t2 * 1e-6
actual_2 = S_bumped_2 - S_base_2

results.append(run_test("delta works for low-context task", predicted_2, actual_2, 0.0001))
print(f"  INFO: Low-context (κ={k_delta_2:.3f}): predicted=${predicted_2:.6f}, actual=${actual_2:.6f}")

# ----------------------------------------------------------
# SUMMARY
# ----------------------------------------------------------
print("\n" + "=" * 70)
passed = sum(results)
total = len(results)
failed = total - passed
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
if failed == 0:
    print("ALL TESTS PASSED ✓")
else:
    print(f"WARNING: {failed} TESTS FAILED")
print("=" * 70)
