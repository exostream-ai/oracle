import { PriceResult } from '../../src/lib/api';

export const mockPriceResult: PriceResult = {
  model: 'OPUS-4.5',
  display_name: 'Claude Opus 4.5',
  spot_cost: 0.0735,
  kappa: 1.0,
  r_in_eff: 15.0,
  beta_used: 15.0,
  task_profile: {
    n_in: 2000,
    n_out: 1000,
    n_think: 0,
    eta: 0.0,
  },
  forward: {
    horizon_months: 3,
    cost: 0.08019,
    beta_forward: 16.38,
    theta_used: 0.03,
    decay_factor: 0.991,
  },
  cache_value: {
    cost_without_cache: 0.0885,
    savings: 0.015,
    savings_pct: 0.1695,
  },
};
