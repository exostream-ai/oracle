/**
 * Shared types for Cloudflare Worker API
 * Extracted from worker.ts to enable modular route/middleware structure
 */

// Environment bindings type
export interface Env {
  API_KEYS: KVNamespace;
  ENVIRONMENT: string;
}

// API Key storage format
export interface ApiKeyData {
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
  requestCount: number;
  tier: 'free' | 'developer' | 'enterprise';
  rateLimit: number; // requests per minute
}

// Seed data types
export interface SeedModel {
  model_id: string;
  family_id: string;
  display_name: string;
  ticker_sync: string;
  ticker_batch: string | null;
  context_window: number;
  tiers: { tau_start: number; tau_end: number; alpha: number }[];
}

export interface SeedFamily {
  family_id: string;
  provider_id: string;
  display_name: string;
  r_in: number;
  r_cache: number;
  r_think: number | null;
  r_batch: number | null;
  is_reasoning: boolean;
}

export interface SeedProvider {
  provider_id: string;
  display_name: string;
}

export interface SeedPrice {
  model_id: string;
  price_type: string;
  beta: number;
  observed_at: string;
  source: string;
}

// Scraped price from a provider page or fallback
export interface ScrapedPrice {
  model_id: string;
  price_type: 'sync' | 'batch';
  beta: number;
  source: string;
  observed_at: string;
}

// Worker scrape result type
export interface WorkerScrapeResult {
  provider: string;
  status: 'success' | 'error' | 'skipped';
  modelsExtracted?: number;
  prices?: ScrapedPrice[];
  error?: string;
}
