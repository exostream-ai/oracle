/**
 * xAI scraper - https://docs.x.ai/docs/models#models-and-pricing
 *
 * Extracts pricing for Grok models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';
import { logger } from '../core/logger.js';

export class XAIScraper extends BaseScraper {
  providerId = 'xai';
  targetUrl = 'https://docs.x.ai/docs/models';
  protected log = logger.child({ component: 'scraper:xai' });

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Model configuration from seed data
    const modelConfigs: Record<string, { contextWindow: number }> = {
      'grok-3': { contextWindow: 131072 },
      'grok-3-mini': { contextWindow: 131072 },
      'grok-4': { contextWindow: 256000 },
      'grok-4-fast': { contextWindow: 256000 },
      'grok-4.1-fast': { contextWindow: 2000000 },
    };

    // xAI docs have pricing tables - try multiple selector strategies
    const tables = $('table').length > 0
      ? $('table')
      : $('.pricing-table, .model-table, [class*="price"]').filter('table');

    // Track found models to avoid duplicates
    const foundModels = new Set<string>();

    tables.each((tableIdx, table) => {
      const rows = $(table).find('tr');

      rows.each((i, row) => {
        // Skip header rows
        const rowText = $(row).text().toLowerCase();
        if (i === 0 || (rowText.includes('model') && rowText.includes('price'))) {
          return;
        }

        const cells = $(row).find('td');
        if (cells.length < 2) return;

        // Extract model name from first cell (or header)
        const cell0 = cells.eq(0).text().trim().toLowerCase();
        const cell1 = cells.eq(1).text().trim();

        // Identify model ID
        let modelId: string | null = null;
        let displayName = '';

        for (const knownModelId of Object.keys(modelConfigs)) {
          if (cell0.includes(knownModelId) || cell0.includes(knownModelId.replace('-', ' '))) {
            modelId = knownModelId;
            // Create display name: "grok-3" -> "Grok 3"
            displayName = knownModelId
              .split('-')
              .map((part, idx) => (idx === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
              .join(' ');
            break;
          }
        }

        // Also check if model name is in a heading above the table
        if (!modelId) {
          const prevHeading = $(table).prevAll('h1, h2, h3, h4').first().text().toLowerCase();
          for (const knownModelId of Object.keys(modelConfigs)) {
            if (prevHeading.includes(knownModelId) || prevHeading.includes(knownModelId.replace('-', ' '))) {
              modelId = knownModelId;
              displayName = knownModelId
                .split('-')
                .map((part, idx) => (idx === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
                .join(' ');
              break;
            }
          }
        }

        if (!modelId || foundModels.has(modelId)) {
          return;
        }

        // Extract pricing information
        let inputPrice = 0;
        let outputPrice = 0;
        let cachePrice: number | undefined;
        let thinkPrice: number | undefined;

        try {
          // xAI typically shows input and output pricing
          // Try to find price cells
          const priceText = $(row).text();

          // Look for explicit price labels
          const inputMatch = priceText.match(/input[:\s]*\$?([\d.]+)/i);
          const outputMatch = priceText.match(/output[:\s]*\$?([\d.]+)/i);

          if (inputMatch && outputMatch) {
            inputPrice = parseFloat(inputMatch[1]);
            outputPrice = parseFloat(outputMatch[1]);
          } else if (cells.length >= 3) {
            // Try positional: model, input, output
            inputPrice = this.parsePrice(cells.eq(1).text());
            outputPrice = this.parsePrice(cells.eq(2).text());
          } else if (cells.length === 2) {
            // Only one price - assume output
            outputPrice = this.parsePrice(cell1);
            inputPrice = outputPrice * 0.2; // Estimate 20% ratio
          }

          // Look for cache pricing
          const cacheMatch = priceText.match(/cache[:\s]*\$?([\d.]+)/i);
          if (cacheMatch) {
            cachePrice = parseFloat(cacheMatch[1]);
          }

          // Look for thinking/reasoning pricing (Grok models support extended thinking)
          const thinkMatch = priceText.match(/think(?:ing)?[:\s]*\$?([\d.]+)/i);
          if (thinkMatch) {
            thinkPrice = parseFloat(thinkMatch[1]);
          }
        } catch (error) {
          this.log.warn('Failed to parse prices', {
            model: modelId,
            error: error instanceof Error ? error.message : String(error)
          });
          return;
        }

        // Validate prices
        if (!outputPrice || outputPrice <= 0 || outputPrice > 100) {
          this.log.warn('Invalid output price', { model: modelId, price: outputPrice });
          return;
        }

        const betaSync = outputPrice;
        const rIn = inputPrice / betaSync;

        const modelPricing: ScrapedModelPricing = {
          modelId,
          displayName,
          betaSync,
          rIn,
          contextWindow: modelConfigs[modelId].contextWindow,
        };

        if (cachePrice && cachePrice > 0) {
          modelPricing.rCache = cachePrice / betaSync;
        }

        if (thinkPrice && thinkPrice > 0) {
          modelPricing.rThink = thinkPrice / betaSync;
        }

        models.push(modelPricing);
        foundModels.add(modelId);
      });
    });

    // Validation: ensure we extracted at least some models
    if (models.length === 0) {
      throw new Error('No models extracted from xAI pricing page');
    }

    // Validation: ensure all betaSync values are reasonable
    for (const model of models) {
      if (model.betaSync <= 0 || model.betaSync > 100) {
        throw new Error(`Invalid betaSync for ${model.modelId}: ${model.betaSync}`);
      }
    }

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const xaiScraper = new XAIScraper();
