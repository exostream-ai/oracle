/**
 * Worker Scrapers - Cheerio-based scraping for Cloudflare Workers
 *
 * Scrapers that work with static HTML using Cheerio.
 * OpenAI and Mistral require Playwright (Node.js runtime only) —
 * they return hardcoded fallback prices instead.
 */

import * as cheerio from 'cheerio';
import type { WorkerScrapeResult, ScrapedPrice } from './worker-types.js';

// Browser-like headers for scraping
const SCRAPER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

// Helper: Parse price strings
function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[$,]/g, '').trim();
  const match = cleaned.match(/[\d.]+/);
  if (!match) return 0;
  return parseFloat(match[0]);
}

// Anthropic model name → model_id mapping
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'opus 4.6': 'opus-4.6',
  'opus 4.5': 'opus-4.5',
  'sonnet 4': 'sonnet-4',
  'sonnet 3.5': 'sonnet-3.5',
  '3.5 sonnet': 'sonnet-3.5',
  'haiku 3.5': 'haiku-3.5',
  '3.5 haiku': 'haiku-3.5',
};

// Google model name → model_id mapping
const GOOGLE_MODEL_MAP: Record<string, string> = {
  'gemini 2.5 pro': 'gemini-2.5-pro',
  'gemini 2.5 flash': 'gemini-2.5-flash',
  'gemini 2.0 flash': 'gemini-2.0-flash',
  'gemini 3 pro': 'gemini-3-pro',
  'gemini 3 flash': 'gemini-3-flash',
  'gemini 1.5 pro': 'gemini-1.5-pro',
};

// DeepSeek model name → model_id mapping
const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  'deepseek-v3': 'deepseek-v3',
  'deepseek v3': 'deepseek-v3',
  'deepseek-r1': 'deepseek-r1',
  'deepseek r1': 'deepseek-r1',
};

// xAI model name → model_id mapping
const XAI_MODEL_MAP: Record<string, string> = {
  'grok 3': 'grok-3',
  'grok-3': 'grok-3',
  'grok 3 mini': 'grok-3-mini',
  'grok-3-mini': 'grok-3-mini',
  'grok 4': 'grok-4',
  'grok-4': 'grok-4',
  'grok 4 fast': 'grok-4-fast',
  'grok-4-fast': 'grok-4-fast',
  'grok 4.1 fast': 'grok-4.1-fast',
  'grok-4.1-fast': 'grok-4.1-fast',
};

/**
 * Match a text snippet against a model map, returning the model_id or null.
 */
function matchModelId(text: string, modelMap: Record<string, string>): string | null {
  const lower = text.toLowerCase().trim();
  // Try longest keys first for greedy matching (e.g. "grok 3 mini" before "grok 3")
  const keys = Object.keys(modelMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) {
      return modelMap[key];
    }
  }
  return null;
}

// Scraper configurations with inline parse functions
const WORKER_SCRAPER_CONFIGS = [
  {
    provider: 'anthropic',
    url: 'https://www.anthropic.com/pricing',
    parse: ($: cheerio.CheerioAPI): ScrapedPrice[] => {
      const prices: ScrapedPrice[] = [];
      const now = new Date().toISOString();
      const seen = new Set<string>();

      // Find model headings (Opus, Sonnet, Haiku)
      const modelHeadings = $('h1, h2, h3, h4, h5, h6').filter((_i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('opus') || text.includes('sonnet') || text.includes('haiku');
      });

      modelHeadings.each((_i, heading) => {
        const headingText = $(heading).text();
        const modelId = matchModelId(headingText, ANTHROPIC_MODEL_MAP);
        if (!modelId || seen.has(modelId)) return;

        const priceContainer = $(heading).parent();
        const priceText = priceContainer.text() + $(heading).nextAll().slice(0, 5).text();

        // Look for output price
        const outputMatch = priceText.match(/output[:\s]*\$?([\d.]+)/i) ||
                           priceText.match(/\$(\d+\.?\d*)/);

        if (outputMatch) {
          const price = parseFloat(outputMatch[1]);
          if (price > 0 && price < 200) {
            seen.add(modelId);
            prices.push({
              model_id: modelId,
              price_type: 'sync',
              beta: price,
              source: 'scraper:anthropic-pricing',
              observed_at: now,
            });
          }
        }
      });

      return prices;
    }
  },
  {
    provider: 'google',
    url: 'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    parse: ($: cheerio.CheerioAPI): ScrapedPrice[] => {
      const prices: ScrapedPrice[] = [];
      const now = new Date().toISOString();
      const seen = new Set<string>();

      const tables = $('table');
      tables.each((_tableIdx, table) => {
        const tableText = $(table).text().toLowerCase();
        if (!tableText.includes('gemini')) return;

        const rows = $(table).find('tr');
        rows.each((i, row) => {
          if (i === 0) return; // Skip header
          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const firstCell = cells.eq(0).text();
          const modelId = matchModelId(firstCell, GOOGLE_MODEL_MAP);
          if (!modelId || seen.has(modelId)) return;

          // Try to find output price — typically in the last or second-to-last cell
          let outputPrice = 0;
          for (let idx = cells.length - 1; idx >= 1; idx--) {
            const cellText = cells.eq(idx).text();
            const price = parsePrice(cellText);
            if (price > 0 && price < 100) {
              outputPrice = price;
              break;
            }
          }

          if (outputPrice > 0) {
            seen.add(modelId);
            prices.push({
              model_id: modelId,
              price_type: 'sync',
              beta: outputPrice,
              source: 'scraper:google-pricing',
              observed_at: now,
            });
          }
        });
      });

      return prices;
    }
  },
  {
    provider: 'deepseek',
    url: 'https://api-docs.deepseek.com/quick_start/pricing',
    parse: ($: cheerio.CheerioAPI): ScrapedPrice[] => {
      const prices: ScrapedPrice[] = [];
      const now = new Date().toISOString();
      const seen = new Set<string>();

      const tableRows = $('table tr');
      tableRows.each((i, row) => {
        if (i === 0) return; // Skip header
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        const firstCell = cells.eq(0).text();
        const modelId = matchModelId(firstCell, DEEPSEEK_MODEL_MAP);
        if (!modelId || seen.has(modelId)) return;

        // Find output price in remaining cells
        let outputPrice = 0;
        for (let j = 1; j < cells.length; j++) {
          const price = parsePrice(cells.eq(j).text());
          if (price > 0 && price < 100) {
            outputPrice = price;
            // Take last valid price (usually output column is after input)
          }
        }

        if (outputPrice > 0) {
          seen.add(modelId);
          prices.push({
            model_id: modelId,
            price_type: 'sync',
            beta: outputPrice,
            source: 'scraper:deepseek-pricing',
            observed_at: now,
          });
        }
      });

      return prices;
    }
  },
  {
    provider: 'xai',
    url: 'https://docs.x.ai/docs/models',
    parse: ($: cheerio.CheerioAPI): ScrapedPrice[] => {
      const prices: ScrapedPrice[] = [];
      const now = new Date().toISOString();
      const seen = new Set<string>();

      const tables = $('table');
      tables.each((_tableIdx, table) => {
        const rows = $(table).find('tr');
        rows.each((i, row) => {
          if (i === 0) return; // Skip header
          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const firstCell = cells.eq(0).text();
          const modelId = matchModelId(firstCell, XAI_MODEL_MAP);
          if (!modelId || seen.has(modelId)) return;

          // Find output price
          let outputPrice = 0;
          for (let idx = cells.length - 1; idx >= 1; idx--) {
            const price = parsePrice(cells.eq(idx).text());
            if (price > 0 && price < 100) {
              outputPrice = price;
              break;
            }
          }

          if (outputPrice > 0) {
            seen.add(modelId);
            prices.push({
              model_id: modelId,
              price_type: 'sync',
              beta: outputPrice,
              source: 'scraper:xai-pricing',
              observed_at: now,
            });
          }
        });
      });

      return prices;
    }
  },
];

/**
 * Hardcoded fallback prices for providers that require Playwright.
 * These match the seed data and serve as a baseline until GCP pipeline is built.
 */
function getOpenAIFallbackPrices(): ScrapedPrice[] {
  const now = new Date().toISOString();
  return [
    { model_id: 'gpt-4.1', price_type: 'sync', beta: 8, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4.1', price_type: 'batch', beta: 2, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4.1-mini', price_type: 'sync', beta: 1.60, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4.1-mini', price_type: 'batch', beta: 0.40, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4.1-nano', price_type: 'sync', beta: 0.40, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4.1-nano', price_type: 'batch', beta: 0.10, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4o', price_type: 'sync', beta: 10, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4o', price_type: 'batch', beta: 5, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4o-mini', price_type: 'sync', beta: 0.60, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-4o-mini', price_type: 'batch', beta: 0.30, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'o3', price_type: 'sync', beta: 8, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'o4-mini', price_type: 'sync', beta: 4.40, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5', price_type: 'sync', beta: 10, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5', price_type: 'batch', beta: 5, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5.1', price_type: 'sync', beta: 10, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5.1', price_type: 'batch', beta: 5, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5.2', price_type: 'sync', beta: 14, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5.2', price_type: 'batch', beta: 7, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5-mini', price_type: 'sync', beta: 2, source: 'fallback:hardcoded', observed_at: now },
    { model_id: 'gpt-5-mini', price_type: 'batch', beta: 1, source: 'fallback:hardcoded', observed_at: now },
  ];
}

function getMistralFallbackPrices(): ScrapedPrice[] {
  const now = new Date().toISOString();
  return [
    { model_id: 'mistral-large', price_type: 'sync', beta: 1.50, source: 'fallback:hardcoded', observed_at: now },
  ];
}

// Run all scrapers with real Cheerio parsing
export async function runAllScrapers(): Promise<WorkerScrapeResult[]> {
  const results: WorkerScrapeResult[] = [];

  // Add fallback entries for Playwright-only providers
  const openAIPrices = getOpenAIFallbackPrices();
  results.push({
    provider: 'openai',
    status: 'skipped',
    modelsExtracted: openAIPrices.length,
    prices: openAIPrices,
    error: 'Requires Playwright — using hardcoded fallback prices',
  });

  const mistralPrices = getMistralFallbackPrices();
  results.push({
    provider: 'mistral',
    status: 'skipped',
    modelsExtracted: mistralPrices.length,
    prices: mistralPrices,
    error: 'Requires Playwright — using hardcoded fallback prices',
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

      // Parse and extract prices
      const prices = config.parse($);

      if (prices.length === 0) {
        results.push({
          provider: config.provider,
          status: 'error',
          error: 'No models extracted',
        });
      } else {
        results.push({
          provider: config.provider,
          status: 'success',
          modelsExtracted: prices.length,
          prices,
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
