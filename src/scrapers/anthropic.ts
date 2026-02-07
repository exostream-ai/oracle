/**
 * Anthropic scraper - https://www.anthropic.com/pricing
 *
 * Extracts pricing for Claude models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';
import { logger } from '../core/logger.js';

export class AnthropicScraper extends BaseScraper {
  providerId = 'anthropic';
  targetUrl = 'https://www.anthropic.com/pricing';
  protected log = logger.child({ component: 'scraper:anthropic' });

  /**
   * Convert display name to model ID
   * "Claude Opus 4.6" -> "opus-4.6"
   * "Opus 4.5" -> "opus-4.5"
   * "3.5 Sonnet" -> "sonnet-3.5"
   */
  private toModelId(displayName: string): string {
    return displayName
      .toLowerCase()
      .replace(/claude\s+/i, '')
      .replace(/(\d+\.?\d*)\s+(opus|sonnet|haiku)/i, '$2-$1')
      .replace(/\s+/g, '-')
      .replace(/^(opus|sonnet|haiku)-(\d+)$/, '$1-$2');
  }

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Model configurations from seed data
    const modelConfigs: Record<string, { contextWindow: number }> = {
      'opus-4.6': { contextWindow: 1000000 },
      'opus-4.5': { contextWindow: 200000 },
      'sonnet-4': { contextWindow: 200000 },
      'sonnet-3.5': { contextWindow: 200000 },
      'haiku-3.5': { contextWindow: 200000 },
    };

    // Anthropic uses data-value attributes and section-based structure
    // Look for API pricing section first
    const apiSection =
      $('[data-toggle-group*="api"]').first() ||
      $('#api-pricing').first() ||
      $('section').filter((i, el) => {
        const heading = $(el).find('h1, h2, h3').first().text().toLowerCase();
        return heading.includes('api') || heading.includes('pricing');
      }).first();

    // If we found API section, search within it; otherwise search whole page
    const searchContext = apiSection && apiSection.length > 0 ? apiSection : $('body');

    // Find model pricing - Anthropic typically lists models with headings
    const modelHeadings = searchContext.find('h1, h2, h3, h4, h5, h6').filter((i, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('opus') || text.includes('sonnet') || text.includes('haiku');
    });

    const foundModels = new Set<string>();

    modelHeadings.each((i, heading) => {
      const headingText = $(heading).text().trim();

      // Extract model name
      const modelId = this.toModelId(headingText);

      // Validate this is a known model
      if (!modelConfigs[modelId] || foundModels.has(modelId)) {
        return;
      }

      // Find pricing information near this heading
      // Look in siblings, parent, or following elements
      const priceContainer = $(heading).parent();
      const priceText = priceContainer.text() + $(heading).nextAll().slice(0, 5).text();

      let inputPrice = 0;
      let outputPrice = 0;
      let batchPrice: number | undefined;
      let cachePrice: number | undefined;
      let thinkPrice: number | undefined;

      try {
        // Try data-value attributes first (most stable)
        const dataValues = priceContainer.find('[data-value]');
        if (dataValues.length >= 2) {
          outputPrice = parseFloat(dataValues.eq(0).attr('data-value') || '0');
          inputPrice = parseFloat(dataValues.eq(1).attr('data-value') || '0');
        }

        // Fallback: parse from text content
        if (!outputPrice || !inputPrice) {
          // Look for patterns like "Input: $5 / MTok" and "Output: $15 / MTok"
          const inputMatch = priceText.match(/input[:\s]*\$?([\d.]+)\s*\/?\s*m/i);
          const outputMatch = priceText.match(/output[:\s]*\$?([\d.]+)\s*\/?\s*m/i);

          if (inputMatch) inputPrice = parseFloat(inputMatch[1]);
          if (outputMatch) outputPrice = parseFloat(outputMatch[1]);
        }

        // Still no luck? Try generic price patterns
        if (!outputPrice) {
          const priceMatches = priceText.match(/\$(\d+\.?\d*)/g);
          if (priceMatches && priceMatches.length >= 2) {
            // First price is usually output, second is input
            outputPrice = parseFloat(priceMatches[0].replace('$', ''));
            inputPrice = parseFloat(priceMatches[1].replace('$', ''));
          }
        }

        // Look for batch pricing
        const batchMatch = priceText.match(/batch[:\s]*\$?([\d.]+)/i);
        if (batchMatch) {
          batchPrice = parseFloat(batchMatch[1]);
        }

        // Look for cache pricing
        const cacheMatch = priceText.match(/cache[:\s]*\$?([\d.]+)/i);
        if (cacheMatch) {
          cachePrice = parseFloat(cacheMatch[1]);
        }

        // Look for thinking token pricing
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

      // Validate
      if (!outputPrice || outputPrice <= 0 || outputPrice > 200) {
        this.log.warn('Invalid output price', { model: modelId, price: outputPrice });
        return;
      }

      const betaSync = outputPrice;
      const rIn = inputPrice > 0 ? inputPrice / betaSync : 0.20; // Default to 20% if not found

      const modelPricing: ScrapedModelPricing = {
        modelId,
        displayName: headingText,
        betaSync,
        rIn,
        contextWindow: modelConfigs[modelId].contextWindow,
      };

      if (batchPrice && batchPrice > 0) {
        modelPricing.betaBatch = batchPrice;
      }

      if (cachePrice && cachePrice > 0) {
        modelPricing.rCache = cachePrice / betaSync;
      }

      if (thinkPrice && thinkPrice > 0) {
        modelPricing.rThink = thinkPrice / betaSync;
      }

      models.push(modelPricing);
      foundModels.add(modelId);
    });

    // Validation: ensure we extracted at least some models
    if (models.length === 0) {
      throw new Error('No models extracted from Anthropic pricing page');
    }

    // Validation: ensure all betaSync values are reasonable
    for (const model of models) {
      if (model.betaSync <= 0 || model.betaSync > 200) {
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

export const anthropicScraper = new AnthropicScraper();
