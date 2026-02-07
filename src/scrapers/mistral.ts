/**
 * Mistral scraper - https://mistral.ai/pricing
 *
 * Extracts pricing for Mistral models.
 * Uses Playwright to render JavaScript SPA.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';
import { logger } from '../core/logger.js';

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
  {
    modelId: 'mistral-medium',
    displayName: 'Mistral Medium',
    betaSync: 8.10,    // $8.10/M output
    rIn: 0.333,        // $2.70/M input = 0.333 * $8.10
    contextWindow: 128000,
  },
];

export class MistralScraper extends BaseScraper {
  providerId = 'mistral';
  targetUrl = 'https://mistral.ai/pricing';
  protected log = logger.child({ component: 'scraper:mistral' });

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
        this.log.warn('Pricing selector not found, proceeding with current content');
      }

      // Get rendered HTML
      const html = await page.content();

      // Parse with Cheerio
      const $ = this.parseHtml(html);

      // Extract model pricing from rendered HTML
      const models: ScrapedModelPricing[] = [];

      // Mistral pricing page has model sections
      // Two parsing patterns needed:
      // 1. Table-based pricing (Mistral Large)
      // 2. Text-based pricing (Mistral Medium)

      $('section.model-section').each((i, section) => {
        const $section = $(section);

        // Skip coming-soon models
        if ($section.hasClass('coming-soon') || $section.text().toLowerCase().includes('coming soon')) {
          return;
        }

        // Get model name from h2
        const modelName = $section.find('h2').first().text().trim();
        if (!modelName) return;

        // Convert model name to ID (lowercase, replace spaces with hyphens)
        const modelId = modelName.toLowerCase().replace(/\s+/g, '-');

        let inputPrice = 0;
        let outputPrice = 0;
        let cachePrice: number | undefined;

        // Pattern 1: Table-based pricing
        const $priceTable = $section.find('table.price-table');
        if ($priceTable.length > 0) {
          $priceTable.find('tbody tr').each((j, row) => {
            const $row = $(row);
            const label = $row.find('td').eq(0).text().toLowerCase();
            const priceText = $row.find('td').eq(1).text();
            const price = this.parsePrice(priceText);

            if (label.includes('input')) {
              inputPrice = price;
            } else if (label.includes('output')) {
              outputPrice = price;
            } else if (label.includes('cache')) {
              cachePrice = price;
            }
          });
        } else {
          // Pattern 2: Text-based pricing
          const $priceInfo = $section.find('.price-info');
          if ($priceInfo.length > 0) {
            const priceText = $priceInfo.text();

            // Parse with regex: "Input: $2.70 / M tokens"
            const inputMatch = priceText.match(/(Input|input):\s*\$?([\d.]+)/);
            const outputMatch = priceText.match(/(Output|output):\s*\$?([\d.]+)/);
            const cacheMatch = priceText.match(/(Cache|cache):\s*\$?([\d.]+)/);

            if (inputMatch) {
              inputPrice = parseFloat(inputMatch[2]);
            }
            if (outputMatch) {
              outputPrice = parseFloat(outputMatch[2]);
            }
            if (cacheMatch) {
              cachePrice = parseFloat(cacheMatch[2]);
            }
          }
        }

        // Validate extracted prices
        if (!outputPrice || outputPrice <= 0 || outputPrice > 100) {
          this.log.warn('Invalid output price', { model: modelName, price: outputPrice });
          return;
        }

        if (!inputPrice || inputPrice <= 0) {
          this.log.warn('Invalid input price', { model: modelName, price: inputPrice });
          return;
        }

        const betaSync = outputPrice;
        const rIn = inputPrice / betaSync;

        const modelPricing: ScrapedModelPricing = {
          modelId,
          displayName: modelName,
          betaSync,
          rIn,
          contextWindow: 128000,
        };

        if (cachePrice && cachePrice > 0) {
          modelPricing.rCache = cachePrice / betaSync;
        }

        models.push(modelPricing);
      });

      // Validate: throw if no models extracted
      if (models.length === 0) {
        throw new Error('No models extracted from pricing page');
      }

      return {
        providerId: this.providerId,
        scrapedAt: new Date(),
        models,
      };
    } finally {
      // CRITICAL: Always close browser to prevent process leaks
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const mistralScraper = new MistralScraper();
