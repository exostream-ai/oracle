/**
 * Base scraper interface and shared utilities
 */

import type { SpotPrice } from '@/core/types.js';

/**
 * Structured output from a provider scraper
 */
export interface ScrapedPricing {
  providerId: string;
  scrapedAt: Date;
  models: ScrapedModelPricing[];
}

export interface ScrapedModelPricing {
  modelId: string;
  betaSync: number;
  betaBatch?: number;
  rIn: number;
  rCache?: number;
  rThink?: number;
  contextWindow: number;
}

/**
 * Scrape log entry
 */
export interface ScrapeLogEntry {
  providerId: string;
  targetUrl: string;
  status: 'success' | 'failure' | 'changed' | 'unchanged';
  contentHash?: string;
  prevHash?: string;
  responseCode?: number;
  errorMessage?: string;
  durationMs?: number;
  scrapedAt: Date;
}

/**
 * Base scraper class - to be extended by provider-specific scrapers
 */
export abstract class BaseScraper {
  abstract providerId: string;
  abstract targetUrl: string;

  /**
   * Fetch and parse pricing data from the provider
   */
  abstract scrape(): Promise<ScrapedPricing>;

  /**
   * Compute SHA-256 hash of content for change detection
   */
  protected async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
