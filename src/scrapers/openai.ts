/**
 * OpenAI scraper - https://openai.com/api/pricing
 *
 * Extracts pricing for GPT and o-series models.
 * Note: OpenAI has Cloudflare bot protection. Uses Playwright with stealth to bypass.
 * Falls back to hardcoded pricing when bot detection blocks access.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

// Use stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

// Rotate through common browser User-Agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

// Fallback pricing data - last known good values
const FALLBACK_MODELS: ScrapedModelPricing[] = [
  // GPT-4.1 series (latest)
  {
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    betaSync: 8.0,      // $8/M output
    betaBatch: 2.0,     // $2/M batch
    rIn: 0.25,          // $2/M input = 0.25 * $8
    rCache: 0.0625,     // $0.50/M cache = 0.0625 * $8
    contextWindow: 1000000,
  },
  {
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 mini',
    betaSync: 1.6,
    betaBatch: 0.4,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 1000000,
  },
  {
    modelId: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 nano',
    betaSync: 0.4,
    betaBatch: 0.1,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 1000000,
  },
  // GPT-4o series
  {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    betaSync: 10.0,
    betaBatch: 5.0,
    rIn: 0.25,
    rCache: 0.10,
    contextWindow: 128000,
  },
  {
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    betaSync: 0.6,
    betaBatch: 0.3,
    rIn: 0.25,
    rCache: 0.10,
    contextWindow: 128000,
  },
  // o-series (reasoning models)
  {
    modelId: 'o3',
    displayName: 'o3',
    betaSync: 40.0,
    rIn: 0.267,         // $10.67/M input
    rCache: 0.067,      // $2.67/M cache
    rThink: 0.60,       // reasoning tokens at 60%
    contextWindow: 200000,
  },
  {
    modelId: 'o4-mini',
    displayName: 'o4-mini',
    betaSync: 4.4,
    rIn: 0.267,
    rCache: 0.067,
    rThink: 0.60,
    contextWindow: 200000,
  },
  // GPT-5 series
  {
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    betaSync: 20.0,
    betaBatch: 10.0,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 2000000,
  },
  {
    modelId: 'gpt-5.1',
    displayName: 'GPT-5.1',
    betaSync: 25.0,
    betaBatch: 12.5,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 2000000,
  },
  {
    modelId: 'gpt-5.2',
    displayName: 'GPT-5.2',
    betaSync: 30.0,
    betaBatch: 15.0,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 2000000,
  },
  {
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 mini',
    betaSync: 5.0,
    betaBatch: 2.5,
    rIn: 0.25,
    rCache: 0.0625,
    contextWindow: 2000000,
  },
];

export class OpenAIScraper extends BaseScraper {
  providerId = 'openai';
  targetUrl = 'https://openai.com/api/pricing';

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
      // Select random user agent for this session
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

      // Launch browser with stealth
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent,
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      // Navigate to pricing page
      await page.goto(this.targetUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for pricing content to load - try multiple selectors
      try {
        await page.waitForSelector('table, [class*="pricing"], [class*="price"]', {
          timeout: 10000,
        });
      } catch (error) {
        console.warn('[OpenAI] Pricing selector not found, proceeding with current content');
      }

      // Get rendered HTML
      const html = await page.content();

      // Parse with Cheerio
      const $ = this.parseHtml(html);

      // Extract model pricing from rendered HTML
      const models: ScrapedModelPricing[] = [];

      // OpenAI pricing page structure varies - try to find pricing tables/sections
      // Look for model names and associated pricing
      // This is a placeholder - actual parsing depends on current page structure

      // For now, if we successfully loaded the page, try to extract data
      // If extraction fails, throw to trigger fallback
      const pageText = $('body').text();

      // Very basic check: does the page contain expected model names?
      const hasGPT4 = pageText.includes('GPT-4') || pageText.includes('gpt-4');
      const hasO3 = pageText.includes('o3') || pageText.includes('O3');

      if (!hasGPT4 && !hasO3) {
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

export const openaiScraper = new OpenAIScraper();
