/**
 * xAI scraper - https://docs.x.ai/docs/models#models-and-pricing
 *
 * Extracts pricing for Grok models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class XAIScraper extends BaseScraper {
  providerId = 'xai';
  targetUrl = 'https://docs.x.ai/docs/models';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Grok 3 - flagship reasoning model
    models.push({
      modelId: 'grok-3',
      displayName: 'Grok 3',
      betaSync: 10.0,
      rIn: 0.20,
      rCache: 0.025,
      rThink: 0.50,
      contextWindow: 131072,
    });

    // Grok 3 mini - faster variant
    models.push({
      modelId: 'grok-3-mini',
      displayName: 'Grok 3 mini',
      betaSync: 1.0,
      rIn: 0.20,
      rCache: 0.025,
      rThink: 0.50,
      contextWindow: 131072,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const xaiScraper = new XAIScraper();
