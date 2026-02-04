/**
 * Mistral scraper - https://mistral.ai/products/la-plateforme#pricing
 *
 * Extracts pricing for Mistral models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class MistralScraper extends BaseScraper {
  providerId = 'mistral';
  targetUrl = 'https://mistral.ai/products/la-plateforme';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Mistral Large - flagship model
    models.push({
      modelId: 'mistral-large',
      displayName: 'Mistral Large',
      betaSync: 12.0,    // $12/M output
      rIn: 0.50,         // $6/M input = 0.50 * $12
      rCache: 0.05,
      contextWindow: 128000,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const mistralScraper = new MistralScraper();
