/**
 * Google scraper - https://cloud.google.com/vertex-ai/generative-ai/pricing
 *
 * Extracts pricing for Gemini models.
 * NOTE: Google has tiered pricing (<=128K vs >128K)
 */

import { BaseScraper, type ScrapedPricing, type ScrapedModelPricing } from './base.js';
import { logger } from '../core/logger.js';

export class GoogleScraper extends BaseScraper {
  providerId = 'google';
  targetUrl = 'https://cloud.google.com/vertex-ai/generative-ai/pricing';
  protected log = logger.child({ component: 'scraper:google' });

  async scrape(): Promise<ScrapedPricing> {
    const { html } = await this.fetchPage(this.targetUrl);
    const $ = this.parseHtml(html);
    const models: ScrapedModelPricing[] = [];
    const scrapedAt = new Date();

    // Model configurations from seed data
    const modelConfigs: Record<string, { contextWindow: number; hasBatch: boolean }> = {
      'gemini-2.5-pro': { contextWindow: 1000000, hasBatch: true },
      'gemini-2.5-flash': { contextWindow: 1000000, hasBatch: true },
      'gemini-2.0-flash': { contextWindow: 1000000, hasBatch: true },
      'gemini-3-pro': { contextWindow: 1000000, hasBatch: true },
      'gemini-3-flash': { contextWindow: 1000000, hasBatch: true },
    };

    // Google has tiered pricing (<=128K vs >128K context)
    // Find pricing tables - Google typically has multiple tables for different products
    const tables = $('table').length > 0 ? $('table') : $('.pricing-table, [class*="price"]').filter('table');

    const foundModels = new Set<string>();

    tables.each((tableIdx, table) => {
      // Check if this table is for Gemini/generative AI pricing
      const tableContext = $(table).parent().prevAll('h1, h2, h3, h4').first().text().toLowerCase();
      const isGeminiTable = tableContext.includes('gemini') ||
                           tableContext.includes('generative') ||
                           tableContext.includes('ai');

      // Also check the table itself or following content
      const tableText = $(table).text().toLowerCase();
      if (!isGeminiTable && !tableText.includes('gemini')) {
        return; // Skip non-Gemini tables
      }

      const rows = $(table).find('tr');

      rows.each((i, row) => {
        const cells = $(row).find('td, th');
        if (cells.length < 2) return;

        const rowText = $(row).text().toLowerCase();

        // Skip obvious header rows
        if (i === 0 || (rowText.includes('model') && rowText.includes('price'))) {
          return;
        }

        // Extract model name
        const firstCell = cells.eq(0).text().trim().toLowerCase();

        let modelId: string | null = null;
        let displayName = '';

        // Match against known Gemini models
        for (const [knownId, config] of Object.entries(modelConfigs)) {
          const searchName = knownId.replace('gemini-', '').replace('-', ' ');
          if (firstCell.includes(searchName) || firstCell.includes(knownId)) {
            modelId = knownId;
            displayName = config ? modelConfigs[knownId] ?
              knownId.split('-').map((p, idx) =>
                idx === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p
              ).join(' ').replace('Gemini', 'Gemini') : '' : '';
            // Proper display name
            if (modelId === 'gemini-2.5-pro') displayName = 'Gemini 2.5 Pro';
            else if (modelId === 'gemini-2.5-flash') displayName = 'Gemini 2.5 Flash';
            else if (modelId === 'gemini-2.0-flash') displayName = 'Gemini 2.0 Flash';
            else if (modelId === 'gemini-3-pro') displayName = 'Gemini 3 Pro';
            else if (modelId === 'gemini-3-flash') displayName = 'Gemini 3 Flash';
            break;
          }
        }

        if (!modelId || foundModels.has(modelId)) {
          return;
        }

        // Extract pricing - Google has tiered pricing
        // Typically: <=128K tokens in one row/column, >128K in another
        // We extract the base tier (<=128K) as primary pricing
        let inputPrice = 0;
        let outputPrice = 0;
        let batchPrice: number | undefined;
        let cachePrice: number | undefined;
        let thinkPrice: number | undefined;

        try {
          // Look for price patterns in cells
          // Google format often has: model | input price | output price
          // Or: model | price | (with tiering info in other columns)

          const allPrices: number[] = [];
          cells.each((idx, cell) => {
            if (idx === 0) return; // Skip model name cell
            const cellText = $(cell).text();
            try {
              const price = this.parsePrice(cellText);
              if (price > 0) {
                allPrices.push(price);
              }
            } catch {
              // Not a price cell
            }
          });

          // Determine input/output from collected prices
          if (allPrices.length >= 2) {
            // Typically: input (lower), output (higher)
            allPrices.sort((a, b) => a - b);
            inputPrice = allPrices[0];
            outputPrice = allPrices[1];

            // Check if there's batch pricing (usually ~50% of sync or listed separately)
            if (allPrices.length >= 3) {
              // Third price might be batch
              const potentialBatch = allPrices[2];
              if (potentialBatch < outputPrice * 0.6) {
                batchPrice = potentialBatch;
              }
            }
          } else if (allPrices.length === 1) {
            // Only one price - assume it's output, estimate input
            outputPrice = allPrices[0];
            inputPrice = outputPrice * 0.125; // Google typically has ~12.5% input ratio
          }

          // Look for explicit pricing labels in row text
          const inputMatch = rowText.match(/input[:\s]*\$?([\d.]+)/i);
          const outputMatch = rowText.match(/output[:\s]*\$?([\d.]+)/i);
          const batchMatch = rowText.match(/batch[:\s]*\$?([\d.]+)/i);
          const cacheMatch = rowText.match(/cache[:\s]*\$?([\d.]+)/i);
          const thinkMatch = rowText.match(/think(?:ing)?[:\s]*\$?([\d.]+)/i);

          if (inputMatch) inputPrice = parseFloat(inputMatch[1]);
          if (outputMatch) outputPrice = parseFloat(outputMatch[1]);
          if (batchMatch) batchPrice = parseFloat(batchMatch[1]);
          if (cacheMatch) cachePrice = parseFloat(cacheMatch[1]);
          if (thinkMatch) thinkPrice = parseFloat(thinkMatch[1]);

        } catch (error) {
          this.log.warn('Failed to parse prices', {
            model: modelId,
            error: error instanceof Error ? error.message : String(error)
          });
          return;
        }

        // Validate
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
    });

    // Validation: ensure we extracted at least some models
    if (models.length === 0) {
      throw new Error('No models extracted from Google pricing page');
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

export const googleScraper = new GoogleScraper();
