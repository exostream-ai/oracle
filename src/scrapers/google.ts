/**
 * Google scraper - https://cloud.google.com/vertex-ai/generative-ai/pricing
 *
 * Extracts pricing for Gemini models.
 * NOTE: Google has tiered pricing (<=128K vs >128K)
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';

export class GoogleScraper extends BaseScraper {
  providerId = 'google';
  targetUrl = 'https://cloud.google.com/vertex-ai/generative-ai/pricing';

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Gemini 2.5 Pro - flagship with thinking
    models.push({
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      betaSync: 10.0,     // $10/M output (<=128K)
      betaBatch: 2.5,
      rIn: 0.125,         // $1.25/M input = 0.125 * $10
      rCache: 0.015,      // cache at 15% of input
      rThink: 0.75,       // thinking tokens at 75%
      contextWindow: 1000000,
    });

    // Gemini 2.5 Flash - fast and cheap
    models.push({
      modelId: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      betaSync: 0.30,
      betaBatch: 0.075,
      rIn: 0.25,
      rCache: 0.025,
      rThink: 0.75,
      contextWindow: 1000000,
    });

    // Gemini 2.0 Flash
    models.push({
      modelId: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      betaSync: 0.40,
      betaBatch: 0.10,
      rIn: 0.25,
      rCache: 0.025,
      contextWindow: 1000000,
    });

    return {
      providerId: this.providerId,
      scrapedAt,
      models,
    };
  }
}

export const googleScraper = new GoogleScraper();
