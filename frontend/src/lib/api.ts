/**
 * Exostream API client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exostream.ai';

export interface SpotData {
  ticker: string;
  ticker_batch?: string;
  model_id: string;
  display_name: string;
  provider: string;
  beta_sync?: number;
  beta_batch?: number;
  context_window: number;
}

export interface GreekData extends SpotData {
  r_in: number;
  r_cache: number;
  r_think?: number;
  r_batch?: number;
  is_reasoning: boolean;
  theta?: number;
  sigma?: number;
  family_prior_weight?: number;
}

export interface ForwardData {
  tenor: string;
  beta_forward: number;
  decay_factor: number;
}

export interface PriceResult {
  model: string;
  display_name: string;
  spot_cost: number;
  kappa: number;
  r_in_eff: number;
  beta_used: number;
  task_profile: {
    n_in: number;
    n_out: number;
    n_think: number;
    eta: number;
  };
  forward?: {
    horizon_months: number;
    cost: number;
    beta_forward: number;
    theta_used: number;
    decay_factor: number;
  };
  cache_value?: {
    cost_without_cache: number;
    savings: number;
    savings_pct: number;
  };
}

export interface CompareResult {
  ticker: string;
  model_id: string;
  display_name: string;
  provider: string;
  spot_cost: number;
  kappa: number;
  beta: number;
  is_reasoning: boolean;
  theta?: number;
}

export interface ApiResponse<T> {
  data: T;
  oracle_timestamp: string;
  cache_age_seconds: number;
}

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Data fetching functions
export async function getSpots(): Promise<ApiResponse<SpotData[]>> {
  return fetcher('/v1/spots');
}

export async function getSpot(ticker: string): Promise<ApiResponse<{ data: SpotData }>> {
  return fetcher(`/v1/spots/${ticker}`);
}

export async function getGreeks(): Promise<ApiResponse<GreekData[]>> {
  return fetcher('/v1/greeks');
}

export async function getGreek(ticker: string): Promise<ApiResponse<{ data: GreekData }>> {
  return fetcher(`/v1/greeks/${ticker}`);
}

export async function getForwards(ticker: string): Promise<ApiResponse<{
  ticker: string;
  model_id: string;
  display_name: string;
  spot: number;
  theta: number;
  forwards: ForwardData[];
}>> {
  return fetcher(`/v1/forwards/${ticker}`);
}

export async function getHistory(ticker: string): Promise<ApiResponse<{
  ticker: string;
  model_id: string;
  display_name: string;
  price_type: string;
  prices: Array<{
    beta: number;
    timestamp: string;
    source: string;
    provenance: string;
  }>;
  count: number;
}>> {
  return fetcher(`/v1/history/${ticker}`);
}

export async function priceTask(params: {
  model: string;
  n_in: number;
  n_out: number;
  n_think?: number;
  eta?: number;
  horizon_months?: number;
}): Promise<ApiResponse<PriceResult>> {
  return fetcher('/v1/price', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function compareModels(params: {
  n_in: number;
  n_out: number;
  n_think?: number;
  eta?: number;
}): Promise<ApiResponse<{
  task_profile: {
    n_in: number;
    n_out: number;
    n_think: number;
    eta: number;
  };
  models: CompareResult[];
  cheapest: string;
  most_expensive: string;
  count: number;
}>> {
  return fetcher('/v1/compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Format utilities
export function formatPrice(price?: number, decimals = 2): string {
  if (price === undefined) return '-';
  return `$${price.toFixed(decimals)}`;
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}m`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export function formatTheta(theta?: number): string {
  if (theta === undefined) return '-';
  const pct = theta * 100;
  const sign = theta >= 0 ? '-' : '+';
  return `${sign}${Math.abs(pct).toFixed(1)}%/mo`;
}
