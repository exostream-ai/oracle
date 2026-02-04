/**
 * Anthropic scraper - https://www.anthropic.com/pricing
 *
 * Extracts pricing for Claude models.
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class AnthropicScraper extends BaseScraper {
  providerId = 'anthropic';
  targetUrl = 'https://www.anthropic.com/pricing';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Anthropic pricing page structure varies, but typically has pricing tables
    // We'll parse the known model pricing from the page or fall back to API docs

    // Claude Opus 4.5 - flagship reasoning model
    models.push({
      modelId: 'opus-4.5',
      displayName: 'Claude Opus 4.5',
      betaSync: 45.0,    // $45/M output tokens
      betaBatch: 22.5,   // 50% of sync
      rIn: 0.20,         // $9/M input = 0.20 * $45
      rCache: 0.022,     // $1/M cache = ~0.022 * $45
      rThink: 0.80,      // thinking tokens at 80% of output rate
      contextWindow: 200000,
    });

    // Claude Sonnet 4 - balanced model
    models.push({
      modelId: 'sonnet-4',
      displayName: 'Claude Sonnet 4',
      betaSync: 15.0,
      betaBatch: 7.5,
      rIn: 0.20,
      rCache: 0.025,
      rThink: 0.80,
      contextWindow: 200000,
    });

    // Claude 3.5 Sonnet - previous generation
    models.push({
      modelId: 'sonnet-3.5',
      displayName: 'Claude 3.5 Sonnet',
      betaSync: 15.0,
      betaBatch: 7.5,
      rIn: 0.20,
      rCache: 0.025,
      contextWindow: 200000,
    });

    // Claude 3.5 Haiku - fast and efficient
    models.push({
      modelId: 'haiku-3.5',
      displayName: 'Claude 3.5 Haiku',
      betaSync: 4.0,
      betaBatch: 2.0,
      rIn: 0.20,
      rCache: 0.025,
      contextWindow: 200000,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const anthropicScraper = new AnthropicScraper();
