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
      const scrapedAt = new Date();

      // Helper to normalize model names to IDs
      const toModelId = (name: string): string => {
        return name.toLowerCase()
          .replace(/\s+mini$/i, '-mini')
          .replace(/\s+nano$/i, '-nano');
      };

      // Parse each model family section
      $('section.model-family').each((_, section) => {
        const sectionEl = $(section);
        const familyName = sectionEl.find('h2').first().text().trim();

        if (familyName.includes('GPT-4.1')) {
          // GPT-4.1 Series: Standard table with 5 columns (Model, Input, Cached, Output, Batch)
          const rows = sectionEl.find('table.pricing-table tbody tr');
          rows.each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 5) return;

            const modelName = cells.eq(0).text().trim();
            const inputPrice = this.parsePrice(cells.eq(1).text());
            const cachePrice = this.parsePrice(cells.eq(2).text());
            const outputPrice = this.parsePrice(cells.eq(3).text());
            const batchPrice = this.parsePrice(cells.eq(4).text());

            if (outputPrice > 0) {
              models.push({
                modelId: toModelId(modelName),
                displayName: modelName,
                betaSync: outputPrice,
                betaBatch: batchPrice > 0 ? batchPrice : undefined,
                rIn: inputPrice / outputPrice,
                rCache: cachePrice > 0 ? cachePrice / outputPrice : undefined,
                contextWindow: 1000000,
              });
            }
          });
        } else if (familyName.includes('GPT-4o')) {
          // GPT-4o: Table rows with pipe-delimited pricing in second cell
          const rows = sectionEl.find('table tr').slice(1); // Skip header
          rows.each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 2) return;

            const modelName = cells.eq(0).text().trim();
            const pricingText = cells.eq(1).text();

            // Parse pipe-delimited: "Input: $X | Cache: $Y | Output: $Z | Batch: $W"
            const inputMatch = pricingText.match(/Input:\s*\$?([\d.]+)/i);
            const cacheMatch = pricingText.match(/Cache:\s*\$?([\d.]+)/i);
            const outputMatch = pricingText.match(/Output:\s*\$?([\d.]+)/i);
            const batchMatch = pricingText.match(/Batch:\s*\$?([\d.]+)/i);

            if (outputMatch) {
              const outputPrice = parseFloat(outputMatch[1]);
              const inputPrice = inputMatch ? parseFloat(inputMatch[1]) : 0;
              const cachePrice = cacheMatch ? parseFloat(cacheMatch[1]) : 0;
              const batchPrice = batchMatch ? parseFloat(batchMatch[1]) : 0;

              models.push({
                modelId: toModelId(modelName),
                displayName: modelName,
                betaSync: outputPrice,
                betaBatch: batchPrice > 0 ? batchPrice : undefined,
                rIn: inputPrice / outputPrice,
                rCache: cachePrice > 0 ? cachePrice / outputPrice : undefined,
                contextWindow: 128000,
              });
            }
          });
        } else if (familyName.includes('o-series') || familyName.includes('Reasoning')) {
          // o-series: Model cards with different structures
          sectionEl.find('div.model-card').each((_, card) => {
            const cardEl = $(card);
            const modelName = cardEl.find('h3').first().text().trim();

            // Check if this card uses div.price-item structure
            const priceItems = cardEl.find('div.price-item');
            if (priceItems.length > 0) {
              // o3 structure: div.price-item with text like "Output tokens: $40.00 / 1M"
              let inputPrice = 0;
              let cachePrice = 0;
              let outputPrice = 0;
              let reasoningPrice = 0;

              priceItems.each((_, item) => {
                const text = $(item).text();
                if (text.includes('Input')) {
                  inputPrice = this.parsePrice(text);
                } else if (text.includes('Cache')) {
                  cachePrice = this.parsePrice(text);
                } else if (text.includes('Output')) {
                  outputPrice = this.parsePrice(text);
                } else if (text.includes('Reasoning')) {
                  reasoningPrice = this.parsePrice(text);
                }
              });

              if (outputPrice > 0) {
                models.push({
                  modelId: toModelId(modelName),
                  displayName: modelName,
                  betaSync: outputPrice,
                  rIn: inputPrice / outputPrice,
                  rCache: cachePrice > 0 ? cachePrice / outputPrice : undefined,
                  rThink: reasoningPrice > 0 ? reasoningPrice / outputPrice : undefined,
                  contextWindow: 200000,
                });
              }
            } else {
              // o4-mini structure: table with rows
              const table = cardEl.find('table');
              if (table.length > 0) {
                let inputPrice = 0;
                let cachePrice = 0;
                let outputPrice = 0;
                let reasoningPrice = 0;

                table.find('tr').each((_, row) => {
                  const cells = $(row).find('td');
                  if (cells.length >= 2) {
                    const label = cells.eq(0).text().trim().toLowerCase();
                    const priceStr = cells.eq(1).text();

                    if (label.includes('input')) {
                      inputPrice = this.parsePrice(priceStr);
                    } else if (label.includes('cache')) {
                      cachePrice = this.parsePrice(priceStr);
                    } else if (label.includes('output')) {
                      outputPrice = this.parsePrice(priceStr);
                    } else if (label.includes('reasoning')) {
                      reasoningPrice = this.parsePrice(priceStr);
                    }
                  }
                });

                if (outputPrice > 0) {
                  models.push({
                    modelId: toModelId(modelName),
                    displayName: modelName,
                    betaSync: outputPrice,
                    rIn: inputPrice / outputPrice,
                    rCache: cachePrice > 0 ? cachePrice / outputPrice : undefined,
                    rThink: reasoningPrice > 0 ? reasoningPrice / outputPrice : undefined,
                    contextWindow: 200000,
                  });
                }
              }
            }
          });
        } else if (familyName.includes('GPT-5')) {
          // GPT-5 Series: Table with slash-delimited pricing "$X / $Y / $Z"
          const rows = sectionEl.find('table.pricing-table tbody tr');
          rows.each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 2) return;

            const modelName = cells.eq(0).text().trim();
            const pricingText = cells.eq(1).text();

            // Parse slash-delimited: "$5.00 / $20.00 / $10.00"
            const prices = pricingText.split('/').map(p => {
              try {
                return this.parsePrice(p.trim());
              } catch {
                return 0;
              }
            });

            if (prices.length >= 2 && prices[1] > 0) {
              const inputPrice = prices[0];
              const outputPrice = prices[1];
              const batchPrice = prices.length >= 3 ? prices[2] : 0;

              models.push({
                modelId: toModelId(modelName),
                displayName: modelName,
                betaSync: outputPrice,
                betaBatch: batchPrice > 0 ? batchPrice : undefined,
                rIn: inputPrice / outputPrice,
                contextWindow: 2000000,
              });
            }
          });
        }
      });

      // Validate: throw if no models extracted
      if (models.length === 0) {
        throw new Error('No models extracted from pricing page');
      }

      return {
        providerId: this.providerId,
        scrapedAt,
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

export const openaiScraper = new OpenAIScraper();
