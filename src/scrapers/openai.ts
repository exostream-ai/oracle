/**
 * OpenAI scraper - https://openai.com/api/pricing
 *
 * Extracts pricing for GPT and o-series models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class OpenAIScraper extends BaseScraper {
  providerId = 'openai';
  targetUrl = 'https://openai.com/api/pricing';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // OpenAI pricing - extracted from current pricing page

    // GPT-4.1 series (latest)
    models.push({
      modelId: 'gpt-4.1',
      displayName: 'GPT-4.1',
      betaSync: 8.0,      // $8/M output
      betaBatch: 2.0,     // $2/M batch
      rIn: 0.25,          // $2/M input = 0.25 * $8
      rCache: 0.0625,     // $0.50/M cache = 0.0625 * $8
      contextWindow: 1000000,
    });

    models.push({
      modelId: 'gpt-4.1-mini',
      displayName: 'GPT-4.1 mini',
      betaSync: 1.6,
      betaBatch: 0.4,
      rIn: 0.25,
      rCache: 0.0625,
      contextWindow: 1000000,
    });

    models.push({
      modelId: 'gpt-4.1-nano',
      displayName: 'GPT-4.1 nano',
      betaSync: 0.4,
      betaBatch: 0.1,
      rIn: 0.25,
      rCache: 0.0625,
      contextWindow: 1000000,
    });

    // GPT-4o series
    models.push({
      modelId: 'gpt-4o',
      displayName: 'GPT-4o',
      betaSync: 10.0,
      betaBatch: 5.0,
      rIn: 0.25,
      rCache: 0.10,
      contextWindow: 128000,
    });

    models.push({
      modelId: 'gpt-4o-mini',
      displayName: 'GPT-4o mini',
      betaSync: 0.6,
      betaBatch: 0.3,
      rIn: 0.25,
      rCache: 0.10,
      contextWindow: 128000,
    });

    // o-series (reasoning models)
    models.push({
      modelId: 'o3',
      displayName: 'o3',
      betaSync: 40.0,
      rIn: 0.267,         // $10.67/M input
      rCache: 0.067,      // $2.67/M cache
      rThink: 0.60,       // reasoning tokens at 60%
      contextWindow: 200000,
    });

    models.push({
      modelId: 'o4-mini',
      displayName: 'o4-mini',
      betaSync: 4.4,
      rIn: 0.267,
      rCache: 0.067,
      rThink: 0.60,
      contextWindow: 200000,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const openaiScraper = new OpenAIScraper();
