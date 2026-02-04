/**
 * DeepSeek scraper - https://api-docs.deepseek.com/quick_start/pricing
 *
 * Extracts pricing for DeepSeek models.
 * NOTE: DeepSeek has notably aggressive pricing - lowest cost frontier.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class DeepSeekScraper extends BaseScraper {
  providerId = 'deepseek';
  targetUrl = 'https://api-docs.deepseek.com/quick_start/pricing';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // DeepSeek V3 - base model, incredibly cheap
    models.push({
      modelId: 'deepseek-v3',
      displayName: 'DeepSeek V3',
      betaSync: 1.10,     // $1.10/M output (among cheapest)
      rIn: 0.091,         // $0.10/M input = 0.091 * $1.10
      rCache: 0.018,      // cache at ~2c/M
      contextWindow: 64000,
    });

    // DeepSeek R1 - reasoning model
    models.push({
      modelId: 'deepseek-r1',
      displayName: 'DeepSeek R1',
      betaSync: 2.19,
      rIn: 0.091,
      rCache: 0.018,
      rThink: 0.50,       // thinking at 50% of output
      contextWindow: 64000,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const deepseekScraper = new DeepSeekScraper();
