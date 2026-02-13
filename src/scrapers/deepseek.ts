/**
 * DeepSeek scraper stub - calls hosted API
 *
 * The production scraper runs on the hosted service at api.exostream.ai.
 * This stub fetches pricing data from the hosted API rather than
 * scraping provider pages directly.
 *
 * To run with the hosted scraper service:
 *   Set SCRAPER_API_URL=https://api.exostream.ai (default)
 *   Set SCRAPER_API_KEY=your_key_here (optional, for authenticated access)
 */

import { BaseScraper, type ScrapedPricing } from './base.js';
import { logger } from '../core/logger.js';

const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'https://api.exostream.ai';

export class DeepseekScraper extends BaseScraper {
  providerId = 'deepseek';
  targetUrl = 'https://api-docs.deepseek.com/quick_start/pricing';
  protected log = logger.child({ component: 'scraper:deepseek' });

  async scrape(): Promise<ScrapedPricing> {
    const response = await fetch(
      `${SCRAPER_API_URL}/internal/scrape/${this.providerId}`,
      {
        headers: {
          'X-Scraper-Key': process.env.SCRAPER_API_KEY || '',
          'User-Agent': 'Exostream-Oracle/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Scraper API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json() as ScrapedPricing;
    return {
      ...data,
      scrapedAt: new Date(data.scrapedAt),
    };
  }
}

export const deepseekScraper = new DeepseekScraper();
