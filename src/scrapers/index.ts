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
import { logger } from '../core/logger.js';

const scraperLogger = logger.child({ component: 'scraper-runner' });

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
      scraperLogger.info('Starting scrape', { provider: scraper.providerId });
      const { pricing, logEntry } = await scraper.run();
      scraperLogger.info('Scrape success', {
        provider: scraper.providerId,
        models: pricing.models.length,
        status: logEntry.status
      });
      results.push({
        providerId: scraper.providerId,
        success: true,
        pricing,
        logEntry,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      scraperLogger.error('Scrape failed', { provider: scraper.providerId, error: errorMsg });
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
  scraperLogger.info('All scrapes complete', { successful, failed });

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
      scraperLogger.error('Fatal error', {
        error: err instanceof Error ? err.message : String(err)
      });
      process.exit(1);
    });
}
