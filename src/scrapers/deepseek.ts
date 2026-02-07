/**
 * DeepSeek scraper - https://api-docs.deepseek.com/quick_start/pricing
 *
 * Extracts pricing for DeepSeek models.
 * NOTE: DeepSeek has notably aggressive pricing - lowest cost frontier.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';
import { logger } from '../core/logger.js';

export class DeepSeekScraper extends BaseScraper {
  providerId = 'deepseek';
  targetUrl = 'https://api-docs.deepseek.com/quick_start/pricing';
  protected log = logger.child({ component: 'scraper:deepseek' });

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // DeepSeek pricing page has a simple table structure
    // Try multiple selectors: table rows, then specific class patterns
    const tableRows = $('table tr').length > 0
      ? $('table tr')
      : $('.pricing-table tr, .model-pricing tr, [class*="price"] tr');

    // Model name mapping: API names to our internal IDs
    const modelMapping: Record<string, { modelId: string; displayName: string; contextWindow: number }> = {
      'deepseek-chat': { modelId: 'deepseek-v3', displayName: 'DeepSeek V3', contextWindow: 64000 },
      'deepseek-reasoner': { modelId: 'deepseek-r1', displayName: 'DeepSeek R1', contextWindow: 64000 },
      'deepseek-v3': { modelId: 'deepseek-v3', displayName: 'DeepSeek V3', contextWindow: 64000 },
      'deepseek-r1': { modelId: 'deepseek-r1', displayName: 'DeepSeek R1', contextWindow: 64000 },
    };

    tableRows.each((i, row) => {
      // Skip header rows
      const rowText = $(row).text().toLowerCase();
      if (i === 0 || rowText.includes('model') && rowText.includes('price')) {
        return;
      }

      const cells = $(row).find('td');
      if (cells.length < 2) return;

      // Extract model name from first cell
      const modelNameRaw = cells.eq(0).text().trim().toLowerCase();

      // Try to find a matching model
      let modelConfig = modelMapping[modelNameRaw];
      if (!modelConfig) {
        // Try partial match
        for (const [key, value] of Object.entries(modelMapping)) {
          if (modelNameRaw.includes(key) || key.includes(modelNameRaw)) {
            modelConfig = value;
            break;
          }
        }
      }

      if (!modelConfig) {
        this.log.warn('Unknown model name', { name: modelNameRaw });
        return;
      }

      // Extract prices - DeepSeek typically shows input and output prices
      // Pattern: input price, cache price, output price (or variations)
      let inputPrice = 0;
      let outputPrice = 0;
      let cachePrice: number | undefined;
      let thinkPrice: number | undefined;

      try {
        // Try to parse prices from cells
        // Common patterns: cell 1 = input, cell 2 = output
        // or multiple cells with labeled prices
        if (cells.length >= 3) {
          // Try: input, cache, output pattern
          const price1Str = cells.eq(1).text();
          const price2Str = cells.eq(2).text();

          const price1 = this.parsePrice(price1Str);
          const price2 = this.parsePrice(price2Str);

          // Determine which is input vs output (output is typically higher)
          if (price2 > price1) {
            inputPrice = price1;
            outputPrice = price2;
          } else {
            inputPrice = price2;
            outputPrice = price1;
          }

          // Check for cache/thinking prices in additional columns
          if (cells.length >= 4) {
            const price3Str = cells.eq(3).text();
            const price3 = this.parsePrice(price3Str);
            if (price3 > 0 && price3 < inputPrice) {
              cachePrice = price3;
            }
          }
        } else if (cells.length === 2) {
          // Only one price cell - assume it's output price
          outputPrice = this.parsePrice(cells.eq(1).text());
          inputPrice = outputPrice * 0.1; // Estimate input as 10% of output
        }

        // For reasoning models (R1), check if thinking price is mentioned
        if (modelConfig.modelId === 'deepseek-r1') {
          // Look for thinking/reasoning token pricing in the row
          const fullRowText = $(row).text();
          const thinkMatch = fullRowText.match(/think(?:ing)?[:\s]*\$?([\d.]+)/i);
          if (thinkMatch) {
            thinkPrice = parseFloat(thinkMatch[1]);
          }
        }
      } catch (error) {
        this.log.warn('Failed to parse prices', {
          model: modelConfig.displayName,
          error: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      // Validate extracted prices
      if (!outputPrice || outputPrice <= 0 || outputPrice > 100) {
        this.log.warn('Invalid output price', { model: modelConfig.displayName, price: outputPrice });
        return;
      }

      const betaSync = outputPrice;
      const rIn = inputPrice / betaSync;

      const modelPricing: ScrapedModelPricing = {
        modelId: modelConfig.modelId,
        displayName: modelConfig.displayName,
        betaSync,
        rIn,
        contextWindow: modelConfig.contextWindow,
      };

      if (cachePrice && cachePrice > 0) {
        modelPricing.rCache = cachePrice / betaSync;
      }

      if (thinkPrice && thinkPrice > 0) {
        modelPricing.rThink = thinkPrice / betaSync;
      }

      models.push(modelPricing);
    });

    // Validation: ensure we extracted at least some models
    if (models.length === 0) {
      throw new Error('No models extracted from DeepSeek pricing page');
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

export const deepseekScraper = new DeepSeekScraper();
