/**
 * Base scraper interface and shared utilities
 */

import * as cheerio from 'cheerio';
import { getClientOrNull } from '@/db/client.js';

/**
 * Structured output from a provider scraper
 */
export interface ScrapedPricing {
  providerId: string;
  scrapedAt: Date;
  models: ScrapedModelPricing[];
  isFallback?: boolean;  // true when using cached/hardcoded fallback values
}

export interface ScrapedModelPricing {
  modelId: string;
  displayName: string;
  betaSync: number;
  betaBatch?: number;
  rIn: number;
  rCache?: number;
  rThink?: number;
  contextWindow: number;
}

/**
 * Scrape log entry
 */
export interface ScrapeLogEntry {
  providerId: string;
  targetUrl: string;
  status: 'success' | 'failure' | 'changed' | 'unchanged';
  contentHash?: string;
  prevHash?: string | null;
  responseCode?: number;
  errorMessage?: string;
  durationMs?: number;
  scrapedAt: Date;
}

/**
 * Fetch result
 */
export interface FetchResult {
  html: string;
  hash: string;
  responseCode: number;
}

/**
 * Base scraper class - to be extended by provider-specific scrapers
 */
export abstract class BaseScraper {
  abstract providerId: string;
  abstract targetUrl: string;

  /**
   * Fetch and parse pricing data from the provider
   */
  abstract scrape(): Promise<ScrapedPricing>;

  /**
   * Fetch page HTML and compute hash
   */
  protected async fetchPage(url: string): Promise<FetchResult> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Exostream/1.0 (Pricing Oracle)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const hash = await this.computeHash(html);

    return {
      html,
      hash,
      responseCode: response.status,
    };
  }

  /**
   * Parse HTML with Cheerio
   */
  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Compute SHA-256 hash of content for change detection
   */
  protected async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if content has changed since last scrape
   */
  protected async detectChange(newHash: string): Promise<{ changed: boolean; prevHash: string | null }> {
    const sql = getClientOrNull();
    if (!sql) {
      return { changed: true, prevHash: null };
    }

    const result = await sql`
      SELECT content_hash
      FROM scrape_log
      WHERE provider_id = ${this.providerId}
        AND status IN ('success', 'changed', 'unchanged')
      ORDER BY scraped_at DESC
      LIMIT 1
    `;

    const prevHash = result.length > 0 ? result[0].content_hash : null;
    return {
      changed: prevHash !== newHash,
      prevHash,
    };
  }

  /**
   * Log a scrape attempt to the database
   */
  protected async logScrape(entry: ScrapeLogEntry): Promise<number | null> {
    const sql = getClientOrNull();
    if (!sql) {
      console.log(`[${this.providerId}] Scrape: ${entry.status}`);
      return null;
    }

    const result = await sql`
      INSERT INTO scrape_log (
        provider_id, target_url, status, content_hash, prev_hash,
        response_code, error_message, duration_ms, scraped_at
      ) VALUES (
        ${entry.providerId}, ${entry.targetUrl}, ${entry.status},
        ${entry.contentHash ?? null}, ${entry.prevHash ?? null},
        ${entry.responseCode ?? null}, ${entry.errorMessage ?? null},
        ${entry.durationMs ?? null}, ${entry.scrapedAt}
      )
      RETURNING scrape_id
    `;

    return result[0]?.scrape_id ? Number(result[0].scrape_id) : null;
  }

  /**
   * Save a page snapshot for audit trail
   */
  protected async saveSnapshot(
    scrapeId: number | null,
    html: string,
    hash: string
  ): Promise<void> {
    const sql = getClientOrNull();
    if (!sql || !scrapeId) return;

    await sql`
      INSERT INTO page_snapshots (scrape_id, provider_id, url, content_html, content_hash)
      VALUES (${scrapeId}, ${this.providerId}, ${this.targetUrl}, ${html}, ${hash})
    `;
  }

  /**
   * Save spot prices to the database
   */
  protected async savePrices(pricing: ScrapedPricing): Promise<void> {
    const sql = getClientOrNull();
    if (!sql) return;

    for (const model of pricing.models) {
      // Save sync price
      await sql`
        INSERT INTO spot_prices (model_id, price_type, beta, source, observed_at)
        VALUES (${model.modelId}, 'sync', ${model.betaSync}, ${'scraper:' + this.providerId}, ${pricing.scrapedAt})
      `;

      // Save batch price if available
      if (model.betaBatch !== undefined) {
        await sql`
          INSERT INTO spot_prices (model_id, price_type, beta, source, observed_at)
          VALUES (${model.modelId}, 'batch', ${model.betaBatch}, ${'scraper:' + this.providerId}, ${pricing.scrapedAt})
        `;
      }
    }
  }

  /**
   * Parse a price string to number (handles $, /M, etc.)
   */
  protected parsePrice(priceStr: string): number {
    // Remove $ and any text, extract number
    const cleaned = priceStr.replace(/[$,]/g, '').trim();
    const match = cleaned.match(/[\d.]+/);
    if (!match) {
      throw new Error(`Cannot parse price: ${priceStr}`);
    }
    return parseFloat(match[0]);
  }

  /**
   * Parse a context window string to number (handles K, M suffixes)
   */
  protected parseContextWindow(windowStr: string): number {
    const cleaned = windowStr.toLowerCase().replace(/,/g, '').trim();
    const match = cleaned.match(/([\d.]+)\s*(k|m|tokens)?/);
    if (!match) {
      throw new Error(`Cannot parse context window: ${windowStr}`);
    }
    const num = parseFloat(match[1]);
    const suffix = match[2];
    if (suffix === 'k') return Math.round(num * 1000);
    if (suffix === 'm') return Math.round(num * 1000000);
    return Math.round(num);
  }

  /**
   * Get fallback pricing data when scraping fails
   * Subclasses override this to provide cached/hardcoded values
   */
  protected getFallbackPricing(): ScrapedPricing | null {
    return null;  // Subclasses override to provide fallback values
  }

  /**
   * Run the full scrape pipeline
   */
  async run(): Promise<{ pricing: ScrapedPricing; logEntry: ScrapeLogEntry }> {
    const startTime = Date.now();
    const scrapedAt = new Date();

    try {
      // Fetch page
      const { html, hash, responseCode } = await this.fetchPage(this.targetUrl);

      // Check for changes
      const { changed, prevHash } = await this.detectChange(hash);

      // Parse pricing data
      const pricing = await this.scrape();

      // Determine status
      const status = changed ? 'changed' : 'unchanged';

      // Log the scrape
      const logEntry: ScrapeLogEntry = {
        providerId: this.providerId,
        targetUrl: this.targetUrl,
        status,
        contentHash: hash,
        prevHash,
        responseCode,
        durationMs: Date.now() - startTime,
        scrapedAt,
      };

      const scrapeId = await this.logScrape(logEntry);

      // Save snapshot if changed
      if (changed) {
        await this.saveSnapshot(scrapeId, html, hash);
        await this.savePrices(pricing);
      }

      return { pricing, logEntry };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Try fallback before giving up
      const fallback = this.getFallbackPricing();
      if (fallback) {
        console.warn(`[${this.providerId}] Scrape failed (${errorMsg}), using fallback pricing`);

        const logEntry: ScrapeLogEntry = {
          providerId: this.providerId,
          targetUrl: this.targetUrl,
          status: 'failure',
          errorMessage: `Fallback used: ${errorMsg}`,
          durationMs: Date.now() - startTime,
          scrapedAt,
        };
        await this.logScrape(logEntry);

        return { pricing: fallback, logEntry };
      }

      // No fallback available, re-throw
      const logEntry: ScrapeLogEntry = {
        providerId: this.providerId,
        targetUrl: this.targetUrl,
        status: 'failure',
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
        scrapedAt,
      };

      await this.logScrape(logEntry);
      throw error;
    }
  }
}
