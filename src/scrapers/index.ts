// Scrapers module - data collection from provider pricing pages
export * from './base.js';
export * from './anthropic.js';
export * from './openai.js';
export * from './google.js';
export * from './xai.js';
export * from './mistral.js';
export * from './deepseek.js';

import { anthropicScraper } from './anthropic.js';
import { openaiScraper } from './openai.js';
import { googleScraper } from './google.js';
import { xaiScraper } from './xai.js';
import { mistralScraper } from './mistral.js';
import { deepseekScraper } from './deepseek.js';
import type { BaseScraper, ScrapedPricing, ScrapeLogEntry } from './base.js';

/**
 * All registered scrapers
 */
export const scrapers: BaseScraper[] = [
  anthropicScraper,
  openaiScraper,
  googleScraper,
  xaiScraper,
  mistralScraper,
  deepseekScraper,
];

/**
 * Result from running all scrapers
 */
export interface ScraperRunResult {
  providerId: string;
  success: boolean;
  pricing?: ScrapedPricing;
  logEntry?: ScrapeLogEntry;
  error?: string;
}

/**
 * Run all scrapers, handling per-provider errors
 * One failure doesn't block others
 */
export async function runAllScrapers(): Promise<ScraperRunResult[]> {
  const results: ScraperRunResult[] = [];

  for (const scraper of scrapers) {
    try {
      console.log(`[${scraper.providerId}] Starting scrape...`);
      const { pricing, logEntry } = await scraper.run();
      console.log(`[${scraper.providerId}] Success: ${pricing.models.length} models, status=${logEntry.status}`);
      results.push({
        providerId: scraper.providerId,
        success: true,
        pricing,
        logEntry,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${scraper.providerId}] Failed: ${errorMsg}`);
      results.push({
        providerId: scraper.providerId,
        success: false,
        error: errorMsg,
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\nScrape complete: ${successful} succeeded, ${failed} failed`);

  return results;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllScrapers()
    .then(results => {
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
