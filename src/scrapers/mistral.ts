/**
 * Mistral scraper - https://mistral.ai/pricing
 *
 * Extracts pricing for Mistral models.
 * Uses Playwright to render JavaScript SPA.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

// Use stealth plugin for consistency
chromium.use(StealthPlugin());

// Fallback pricing data - last known good values
const FALLBACK_MODELS: ScrapedModelPricing[] = [
  {
    modelId: 'mistral-large',
    displayName: 'Mistral Large',
    betaSync: 12.0,    // $12/M output
    rIn: 0.50,         // $6/M input = 0.50 * $12
    rCache: 0.05,
    contextWindow: 128000,
  },
];

export class MistralScraper extends BaseScraper {
  providerId = 'mistral';
  targetUrl = 'https://mistral.ai/pricing';

  /**
   * Provide fallback pricing when scraping fails
   */
  protected getFallbackPricing(): ScrapedPricing {
    return {
      providerId: this.providerId,
      scrapedAt: new Date(),
      models: FALLBACK_MODELS,
      isFallback: true,
    };
  }

  async scrape(): Promise<ScrapedPricing> {
    let browser;
    try {
      // Launch browser
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      // Navigate to pricing page
      await page.goto(this.targetUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for pricing table to render
      try {
        await page.waitForSelector('table, [class*="pricing"], [class*="price"]', {
          timeout: 10000,
        });
      } catch (error) {
        console.warn('[Mistral] Pricing selector not found, proceeding with current content');
      }

      // Get rendered HTML
      const html = await page.content();

      // Parse with Cheerio
      const $ = this.parseHtml(html);

      // Extract model pricing from rendered HTML
      const models: ScrapedModelPricing[] = [];

      // Mistral pricing page structure - try to find pricing tables/sections
      // Look for model names and associated pricing
      // This is a placeholder - actual parsing depends on current page structure

      // For now, if we successfully loaded the page, try to extract data
      // If extraction fails, throw to trigger fallback
      const pageText = $('body').text();

      // Very basic check: does the page contain expected model names?
      const hasMistral = pageText.includes('Mistral') || pageText.includes('mistral');

      if (!hasMistral) {
        throw new Error('Pricing page does not contain expected model information');
      }

      // TODO: Implement actual HTML parsing based on current page structure
      // For now, throw to use fallback (the page structure needs inspection)
      throw new Error('HTML parsing not yet implemented - using fallback');

      // Validate: throw if no models extracted
      // if (models.length === 0) {
      //   throw new Error('No models extracted from pricing page');
      // }

      // return {
      //   providerId: this.providerId,
      //   scrapedAt: new Date(),
      //   models,
      // };
    } finally {
      // CRITICAL: Always close browser to prevent process leaks
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const mistralScraper = new MistralScraper();
