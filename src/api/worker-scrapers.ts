/**
 * Worker Scrapers - Cheerio-based scraping for Cloudflare Workers
 *
 * Scrapers that work with static HTML using Cheerio.
 * OpenAI and Mistral require Playwright (Node.js runtime only).
 */

import * as cheerio from 'cheerio';
import type { WorkerScrapeResult } from './worker-types.js';

// Browser-like headers for scraping
const SCRAPER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// Helper: Parse price strings (replicate from base.ts)
function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[$,]/g, '').trim();
  const match = cleaned.match(/[\d.]+/);
  if (!match) return 0;
  return parseFloat(match[0]);
}

// Scraper configurations with inline parse functions
const WORKER_SCRAPER_CONFIGS = [
  {
    provider: 'anthropic',
    url: 'https://www.anthropic.com/pricing',
    parse: ($: cheerio.CheerioAPI): number => {
      // Find model headings (Opus, Sonnet, Haiku)
      const modelHeadings = $('h1, h2, h3, h4, h5, h6').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('opus') || text.includes('sonnet') || text.includes('haiku');
      });

      let count = 0;
      modelHeadings.each((i, heading) => {
        const headingText = $(heading).text().trim();
        const priceContainer = $(heading).parent();
        const priceText = priceContainer.text() + $(heading).nextAll().slice(0, 5).text();

        // Look for output price (most important)
        const outputMatch = priceText.match(/output[:\s]*\$?([\d.]+)/i) ||
                           priceText.match(/\$(\d+\.?\d*)/);

        if (outputMatch) {
          const price = parseFloat(outputMatch[1]);
          if (price > 0 && price < 200) {
            count++;
          }
        }
      });

      return count;
    }
  },
  {
    provider: 'google',
    url: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    parse: ($: cheerio.CheerioAPI): number => {
      // Find Gemini pricing tables
      const tables = $('table');
      let count = 0;

      tables.each((tableIdx, table) => {
        const tableText = $(table).text().toLowerCase();
        if (!tableText.includes('gemini')) return;

        const rows = $(table).find('tr');
        rows.each((i, row) => {
          if (i === 0) return; // Skip header
          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const firstCell = cells.eq(0).text().toLowerCase();
          if (firstCell.includes('gemini')) {
            // Extract any price from the row
            let foundPrice = false;
            cells.each((idx, cell) => {
              if (idx === 0) return;
              const price = parsePrice($(cell).text());
              if (price > 0 && price < 100) {
                foundPrice = true;
              }
            });
            if (foundPrice) count++;
          }
        });
      });

      return count;
    }
  },
  {
    provider: 'deepseek',
    url: 'https://api-docs.deepseek.com/quick_start/pricing',
    parse: ($: cheerio.CheerioAPI): number => {
      // DeepSeek has table with model rows
      const tableRows = $('table tr');
      let count = 0;

      tableRows.each((i, row) => {
        if (i === 0) return; // Skip header
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        const modelNameRaw = cells.eq(0).text().toLowerCase();
        if (modelNameRaw.includes('deepseek')) {
          // Check for prices in remaining cells
          let foundPrice = false;
          for (let j = 1; j < cells.length; j++) {
            const price = parsePrice(cells.eq(j).text());
            if (price > 0 && price < 100) {
              foundPrice = true;
              break;
            }
          }
          if (foundPrice) count++;
        }
      });

      return count;
    }
  },
  {
    provider: 'xai',
    url: 'https://docs.x.ai/docs/models',
    parse: ($: cheerio.CheerioAPI): number => {
      // xAI has pricing tables for Grok models
      const tables = $('table');
      let count = 0;

      tables.each((tableIdx, table) => {
        const rows = $(table).find('tr');
        rows.each((i, row) => {
          if (i === 0) return; // Skip header
          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const cell0 = cells.eq(0).text().toLowerCase();
          if (cell0.includes('grok')) {
            // Check for prices
            let foundPrice = false;
            cells.each((idx, cell) => {
              if (idx === 0) return;
              const price = parsePrice($(cell).text());
              if (price > 0 && price < 100) {
                foundPrice = true;
              }
            });
            if (foundPrice) count++;
          }
        });
      });

      return count;
    }
  },
];

// Run all scrapers with real Cheerio parsing
export async function runAllScrapers(): Promise<WorkerScrapeResult[]> {
  const results: WorkerScrapeResult[] = [];

  // Add skipped entries for Playwright-only providers
  results.push({
    provider: 'openai',
    status: 'skipped',
    error: 'Requires Playwright (Node.js runtime only)',
  });
  results.push({
    provider: 'mistral',
    status: 'skipped',
    error: 'Requires Playwright (Node.js runtime only)',
  });

  // Process static HTML providers with Cheerio
  for (const config of WORKER_SCRAPER_CONFIGS) {
    try {
      const response = await fetch(config.url, {
        headers: SCRAPER_HEADERS,
      });

      if (!response.ok) {
        results.push({
          provider: config.provider,
          status: 'error',
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse and extract model count
      const modelsExtracted = config.parse($);

      if (modelsExtracted === 0) {
        results.push({
          provider: config.provider,
          status: 'error',
          error: 'No models extracted',
        });
      } else {
        results.push({
          provider: config.provider,
          status: 'success',
          modelsExtracted,
        });
      }

    } catch (error) {
      results.push({
        provider: config.provider,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
