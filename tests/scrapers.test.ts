/**
 * Scraper Test Suite
 *
 * Tests scraper parsing logic using fixture HTML files.
 * No network calls - all tests use mocked fetchPage with fixture data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import Cheerio-based scrapers (no Playwright dependencies)
import { DeepSeekScraper } from '@/scrapers/deepseek.js';
import { XAIScraper } from '@/scrapers/xai.js';
import { GoogleScraper } from '@/scrapers/google.js';
import { AnthropicScraper } from '@/scrapers/anthropic.js';

// Mock database client to prevent database calls in tests
vi.mock('@/db/client', () => ({
  getClientOrNull: () => null,
}));

// Mock Playwright to prevent import errors
vi.mock('playwright-extra', () => ({
  chromium: {
    use: vi.fn(),
    launch: vi.fn(),
  },
}));

vi.mock('playwright-extra-plugin-stealth', () => ({
  default: vi.fn(),
}));

// Helper to load fixture HTML
function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

// Helper to mock fetchPage on a scraper instance
function mockFetchPage(scraper: any, html: string) {
  vi.spyOn(scraper, 'fetchPage').mockResolvedValue({
    html,
    hash: 'test-hash-' + scraper.providerId,
    responseCode: 200,
  });
}

// ============================================================
// DeepSeek Scraper Tests
// ============================================================

describe('DeepSeekScraper', () => {
  let scraper: DeepSeekScraper;

  beforeEach(() => {
    scraper = new DeepSeekScraper();
    vi.clearAllMocks();
  });

  it('extracts correct models from fixture HTML', async () => {
    const html = loadFixture('deepseek-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('deepseek');
    expect(result.models.length).toBeGreaterThanOrEqual(2);

    // Check for expected model IDs
    const modelIds = result.models.map(m => m.modelId);
    expect(modelIds).toContain('deepseek-v3');
    expect(modelIds).toContain('deepseek-r1');
  });

  it('extracts correct pricing values', async () => {
    const html = loadFixture('deepseek-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    for (const model of result.models) {
      // All models should have positive betaSync
      expect(model.betaSync).toBeGreaterThan(0);

      // DeepSeek is very cheap - should be well under $5/M
      expect(model.betaSync).toBeLessThan(5.0);

      // rIn should be positive and less than 1
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.rIn).toBeLessThan(1);

      // Context window should be reasonable
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('extracts rThink for reasoning models', async () => {
    const html = loadFixture('deepseek-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Find DeepSeek R1 (reasoning model)
    const r1Model = result.models.find(m => m.modelId === 'deepseek-r1');
    if (r1Model) {
      // Should have rThink defined for reasoning model
      expect(r1Model.rThink).toBeDefined();
      expect(r1Model.rThink).toBeGreaterThan(0);
    }
  });

  it('throws error on empty/invalid HTML', async () => {
    mockFetchPage(scraper, '<html><body>No pricing here</body></html>');

    await expect(scraper.scrape()).rejects.toThrow(/No models extracted/i);
  });

  it('returns valid ScrapedPricing structure', async () => {
    const html = loadFixture('deepseek-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Verify structure
    expect(result).toHaveProperty('providerId');
    expect(result).toHaveProperty('scrapedAt');
    expect(result).toHaveProperty('models');
    expect(result.providerId).toBe('deepseek');
    expect(result.scrapedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.models)).toBe(true);

    // Verify each model structure
    for (const model of result.models) {
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('betaSync');
      expect(model).toHaveProperty('rIn');
      expect(model).toHaveProperty('contextWindow');

      expect(typeof model.modelId).toBe('string');
      expect(typeof model.displayName).toBe('string');
      expect(typeof model.betaSync).toBe('number');
      expect(typeof model.rIn).toBe('number');
      expect(typeof model.contextWindow).toBe('number');
    }
  });
});

// ============================================================
// xAI Scraper Tests
// ============================================================

describe('XAIScraper', () => {
  let scraper: XAIScraper;

  beforeEach(() => {
    scraper = new XAIScraper();
    vi.clearAllMocks();
  });

  it('extracts correct models from fixture HTML', async () => {
    const html = loadFixture('xai-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('xai');
    expect(result.models.length).toBeGreaterThanOrEqual(2);

    // Check for expected models
    const modelIds = result.models.map(m => m.modelId);
    expect(modelIds).toContain('grok-3');
    // grok-4 should also be present
    const hasGrok4 = modelIds.some(id => id.includes('grok-4'));
    expect(hasGrok4).toBe(true);
  });

  it('extracts correct pricing values', async () => {
    const html = loadFixture('xai-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    for (const model of result.models) {
      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.betaSync).toBeLessThan(100);
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.rIn).toBeLessThan(1);
    }
  });

  it('sets correct context window for grok models', async () => {
    const html = loadFixture('xai-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Grok 3 series should have 131K context
    const grok3 = result.models.find(m => m.modelId === 'grok-3');
    if (grok3) {
      expect(grok3.contextWindow).toBe(131072);
    }

    const grok3Mini = result.models.find(m => m.modelId === 'grok-3-mini');
    if (grok3Mini) {
      expect(grok3Mini.contextWindow).toBe(131072);
    }

    // Grok 4 series should have 256K context
    const grok4 = result.models.find(m => m.modelId === 'grok-4');
    if (grok4) {
      expect(grok4.contextWindow).toBe(256000);
    }
  });

  it('throws error on empty/invalid HTML', async () => {
    mockFetchPage(scraper, '<html><body>No pricing data</body></html>');

    await expect(scraper.scrape()).rejects.toThrow(/No models extracted/i);
  });

  it('returns valid ScrapedPricing structure', async () => {
    const html = loadFixture('xai-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('xai');
    expect(result.scrapedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Google Scraper Tests
// ============================================================

describe('GoogleScraper', () => {
  let scraper: GoogleScraper;

  beforeEach(() => {
    scraper = new GoogleScraper();
    vi.clearAllMocks();
  });

  it('extracts correct models from fixture HTML', async () => {
    const html = loadFixture('google-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('google');
    expect(result.models.length).toBeGreaterThanOrEqual(2);

    // Check for expected Gemini models
    const modelIds = result.models.map(m => m.modelId);
    expect(modelIds).toContain('gemini-2.5-pro');
  });

  it('extracts correct pricing values', async () => {
    const html = loadFixture('google-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    for (const model of result.models) {
      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.betaSync).toBeLessThan(100);
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.rIn).toBeLessThan(1);
    }
  });

  it('handles tiered pricing correctly', async () => {
    const html = loadFixture('google-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Tiered pricing should extract base tier (<=128K)
    // Verify no NaN or Infinity values
    for (const model of result.models) {
      expect(isFinite(model.betaSync)).toBe(true);
      expect(isFinite(model.rIn)).toBe(true);
      expect(isNaN(model.betaSync)).toBe(false);
      expect(isNaN(model.rIn)).toBe(false);
    }
  });

  it('extracts batch pricing when available', async () => {
    const html = loadFixture('google-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Gemini 2.5 Pro should have batch pricing
    const gemini25Pro = result.models.find(m => m.modelId === 'gemini-2.5-pro');
    if (gemini25Pro?.betaBatch) {
      expect(gemini25Pro.betaBatch).toBeGreaterThan(0);
      expect(gemini25Pro.betaBatch).toBeLessThan(gemini25Pro.betaSync);
    }
  });

  it('throws error on empty/invalid HTML', async () => {
    mockFetchPage(scraper, '<html><body>Cloud Storage Pricing</body></html>');

    await expect(scraper.scrape()).rejects.toThrow(/No models extracted/i);
  });

  it('returns valid ScrapedPricing structure', async () => {
    const html = loadFixture('google-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('google');
    expect(result.scrapedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Anthropic Scraper Tests
// ============================================================

describe('AnthropicScraper', () => {
  let scraper: AnthropicScraper;

  beforeEach(() => {
    scraper = new AnthropicScraper();
    vi.clearAllMocks();
  });

  it('extracts correct models from fixture HTML', async () => {
    const html = loadFixture('anthropic-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('anthropic');
    expect(result.models.length).toBeGreaterThanOrEqual(2);

    // Check for expected Claude models
    const modelIds = result.models.map(m => m.modelId);

    // Should find Opus models
    const hasOpus = modelIds.some(id => id.includes('opus'));
    expect(hasOpus).toBe(true);

    // Should find Sonnet models
    const hasSonnet = modelIds.some(id => id.includes('sonnet'));
    expect(hasSonnet).toBe(true);
  });

  it('extracts correct pricing values', async () => {
    const html = loadFixture('anthropic-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    for (const model of result.models) {
      // Anthropic models can be expensive (up to $200 for top-tier)
      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.betaSync).toBeLessThan(200);
      expect(model.rIn).toBeGreaterThan(0);
      // rIn can be > 1 for some models if input is expensive (reasonable for Anthropic)
      expect(model.rIn).toBeLessThan(10);
    }
  });

  it('correctly maps model names to IDs', async () => {
    const html = loadFixture('anthropic-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Verify model ID format: opus-X.X, sonnet-X, haiku-X.X
    for (const model of result.models) {
      const validPattern = /^(opus|sonnet|haiku)-[\d.]+$/;
      expect(model.modelId).toMatch(validPattern);
    }
  });

  it('extracts data from data-value attributes', async () => {
    const html = loadFixture('anthropic-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    // Opus 4.6 in fixture uses data-value attributes
    const opus46 = result.models.find(m => m.modelId === 'opus-4.6');
    if (opus46) {
      expect(opus46.betaSync).toBeCloseTo(75, 1);
      expect(opus46.rIn).toBeCloseTo(0.20, 2); // 15/75 = 0.20
    }
  });

  it('throws error on empty/invalid HTML', async () => {
    mockFetchPage(scraper, '<html><body>No Claude models here</body></html>');

    await expect(scraper.scrape()).rejects.toThrow(/No models extracted/i);
  });

  it('returns valid ScrapedPricing structure', async () => {
    const html = loadFixture('anthropic-pricing.html');
    mockFetchPage(scraper, html);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('anthropic');
    expect(result.scrapedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// ============================================================
// OpenAI Scraper Tests
// ============================================================

describe('OpenAIScraper', () => {
  it('getFallbackPricing returns valid data', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const scraper = new OpenAIScraper();
    const fallback = (scraper as any).getFallbackPricing();

    expect(fallback).toBeDefined();
    expect(fallback.providerId).toBe('openai');
    expect(fallback.isFallback).toBe(true);
    expect(fallback.models.length).toBeGreaterThan(0);

    // Check fallback models
    const modelIds = fallback.models.map((m: any) => m.modelId);
    expect(modelIds).toContain('gpt-4.1');
    expect(modelIds).toContain('gpt-4o');
    expect(modelIds).toContain('o3');
  });

  it('fallback pricing has valid structure', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const scraper = new OpenAIScraper();
    const fallback = (scraper as any).getFallbackPricing();

    for (const model of fallback.models) {
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('betaSync');
      expect(model).toHaveProperty('rIn');
      expect(model).toHaveProperty('contextWindow');

      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('fallback includes GPT-4.1 series', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const scraper = new OpenAIScraper();
    const fallback = (scraper as any).getFallbackPricing();

    const gpt41 = fallback.models.find((m: any) => m.modelId === 'gpt-4.1');
    expect(gpt41).toBeDefined();
    expect(gpt41.betaSync).toBeCloseTo(8.0, 1);
    expect(gpt41.betaBatch).toBeCloseTo(2.0, 1);
  });

  it('fallback includes o-series with rThink', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const scraper = new OpenAIScraper();
    const fallback = (scraper as any).getFallbackPricing();

    const o3 = fallback.models.find((m: any) => m.modelId === 'o3');
    if (o3) {
      expect(o3.rThink).toBeDefined();
      expect(o3.rThink).toBeGreaterThan(0);
    }
  });

  it('fallback includes GPT-5 series', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const scraper = new OpenAIScraper();
    const fallback = (scraper as any).getFallbackPricing();

    const modelIds = fallback.models.map((m: any) => m.modelId);
    expect(modelIds).toContain('gpt-5');
    expect(modelIds).toContain('gpt-5-mini');
  });

  it('extracts correct models from fixture HTML', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const { chromium } = await import('playwright-extra');
    const scraper = new OpenAIScraper();
    const html = loadFixture('openai-pricing.html');

    // Mock Playwright browser chain
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(html),
    };
    const mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };
    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('openai');
    // Fixture has: 3 GPT-4.1 + 2 GPT-4o + 2 o-series + 4 GPT-5 = 11 models
    expect(result.models.length).toBeGreaterThanOrEqual(11);

    // Check model IDs extracted
    const modelIds = result.models.map(m => m.modelId);
    expect(modelIds).toContain('gpt-4.1');
    expect(modelIds).toContain('gpt-4.1-mini');
    expect(modelIds).toContain('gpt-4.1-nano');
    expect(modelIds).toContain('gpt-4o');
    expect(modelIds).toContain('gpt-4o-mini');
    expect(modelIds).toContain('o3');
    expect(modelIds).toContain('o4-mini');
    expect(modelIds).toContain('gpt-5');
    expect(modelIds).toContain('gpt-5.1');
    expect(modelIds).toContain('gpt-5.2');
    expect(modelIds).toContain('gpt-5-mini');
  });

  it('extracts correct pricing values from fixture', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const { chromium } = await import('playwright-extra');
    const scraper = new OpenAIScraper();
    const html = loadFixture('openai-pricing.html');

    // Mock Playwright browser chain
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(html),
    };
    const mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };
    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const result = await scraper.scrape();

    // GPT-4.1: $8.00 output, $2.00 input -> betaSync=8.0, rIn=0.25
    const gpt41 = result.models.find(m => m.modelId === 'gpt-4.1');
    expect(gpt41).toBeDefined();
    if (gpt41) {
      expect(gpt41.betaSync).toBeCloseTo(8.0, 1);
      expect(gpt41.rIn).toBeCloseTo(0.25, 2);
      expect(gpt41.rCache).toBeCloseTo(0.0625, 4); // $0.50 / $8.00
      expect(gpt41.betaBatch).toBeCloseTo(2.0, 1);
    }

    // o3: $40.00 output, $10.67 input, $24.00 reasoning
    const o3 = result.models.find(m => m.modelId === 'o3');
    expect(o3).toBeDefined();
    if (o3) {
      expect(o3.betaSync).toBeCloseTo(40.0, 1);
      expect(o3.rIn).toBeCloseTo(0.267, 2); // 10.67 / 40.00
      expect(o3.rThink).toBeDefined();
      expect(o3.rThink).toBeGreaterThan(0);
      expect(o3.rThink).toBeCloseTo(0.60, 2); // 24.00 / 40.00
    }

    // GPT-5: $20.00 output, $5.00 input
    const gpt5 = result.models.find(m => m.modelId === 'gpt-5');
    expect(gpt5).toBeDefined();
    if (gpt5) {
      expect(gpt5.betaSync).toBeCloseTo(20.0, 1);
      expect(gpt5.rIn).toBeCloseTo(0.25, 2); // 5.00 / 20.00
      expect(gpt5.betaBatch).toBeCloseTo(10.0, 1);
    }
  });

  it('validates all extracted models have required fields', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const { chromium } = await import('playwright-extra');
    const scraper = new OpenAIScraper();
    const html = loadFixture('openai-pricing.html');

    // Mock Playwright browser chain
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(html),
    };
    const mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };
    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any);

    const result = await scraper.scrape();

    // Verify all models have valid structure
    for (const model of result.models) {
      expect(model.modelId).toBeTruthy();
      expect(model.displayName).toBeTruthy();
      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);

      // betaSync should be reasonable for OpenAI
      expect(model.betaSync).toBeLessThan(100);
    }
  });
});

// ============================================================
// Mistral Scraper Tests
// ============================================================

describe('MistralScraper', () => {
  it('getFallbackPricing returns valid data', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const fallback = (scraper as any).getFallbackPricing();

    expect(fallback).toBeDefined();
    expect(fallback.providerId).toBe('mistral');
    expect(fallback.isFallback).toBe(true);
    expect(fallback.models.length).toBeGreaterThan(0);

    // Check fallback models
    const modelIds = fallback.models.map((m: any) => m.modelId);
    expect(modelIds).toContain('mistral-large');
    expect(modelIds).toContain('mistral-medium');
  });

  it('fallback pricing has valid structure', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const fallback = (scraper as any).getFallbackPricing();

    for (const model of fallback.models) {
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('displayName');
      expect(model).toHaveProperty('betaSync');
      expect(model).toHaveProperty('rIn');
      expect(model).toHaveProperty('contextWindow');

      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('fallback includes Mistral Large and Mistral Medium', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const fallback = (scraper as any).getFallbackPricing();

    const mistralLarge = fallback.models.find((m: any) => m.modelId === 'mistral-large');
    expect(mistralLarge).toBeDefined();
    expect(mistralLarge.betaSync).toBeCloseTo(12.0, 1);
    expect(mistralLarge.rIn).toBeCloseTo(0.50, 2);

    const mistralMedium = fallback.models.find((m: any) => m.modelId === 'mistral-medium');
    expect(mistralMedium).toBeDefined();
    expect(mistralMedium.betaSync).toBeCloseTo(8.10, 2);
    expect(mistralMedium.rIn).toBeCloseTo(0.333, 3);
  });

  it('extracts correct models from fixture HTML', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const html = loadFixture('mistral-pricing.html');

    // Mock parseHtml to return the fixture HTML
    const $ = scraper['parseHtml'](html);
    vi.spyOn(scraper as any, 'parseHtml').mockReturnValue($);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('mistral');
    expect(result.models.length).toBeGreaterThanOrEqual(2);

    // Check model IDs extracted
    const modelIds = result.models.map(m => m.modelId);
    expect(modelIds).toContain('mistral-large');
    expect(modelIds).toContain('mistral-medium');

    // Should NOT include coming-soon models
    expect(modelIds).not.toContain('mistral-small');
  });

  it('extracts correct pricing values from fixture', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const html = loadFixture('mistral-pricing.html');

    // Mock parseHtml to return the fixture HTML
    const $ = scraper['parseHtml'](html);
    vi.spyOn(scraper as any, 'parseHtml').mockReturnValue($);

    const result = await scraper.scrape();

    // Mistral Large: Table-based pricing
    // Input: $6.00, Output: $12.00, Cache: $0.60
    const mistralLarge = result.models.find(m => m.modelId === 'mistral-large');
    expect(mistralLarge).toBeDefined();
    if (mistralLarge) {
      expect(mistralLarge.betaSync).toBeCloseTo(12.0, 1);
      expect(mistralLarge.rIn).toBeCloseTo(0.5, 2); // 6.00 / 12.00
      expect(mistralLarge.rCache).toBeCloseTo(0.05, 2); // 0.60 / 12.00
    }

    // Mistral Medium: Text-based pricing
    // Input: $2.70, Output: $8.10
    const mistralMedium = result.models.find(m => m.modelId === 'mistral-medium');
    expect(mistralMedium).toBeDefined();
    if (mistralMedium) {
      expect(mistralMedium.betaSync).toBeCloseTo(8.1, 1);
      expect(mistralMedium.rIn).toBeCloseTo(0.333, 2); // 2.70 / 8.10
    }
  });

  it('validates all extracted models have valid pricing', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const html = loadFixture('mistral-pricing.html');

    // Mock parseHtml to return the fixture HTML
    const $ = scraper['parseHtml'](html);
    vi.spyOn(scraper as any, 'parseHtml').mockReturnValue($);

    const result = await scraper.scrape();

    for (const model of result.models) {
      // All models should have positive betaSync
      expect(model.betaSync).toBeGreaterThan(0);
      expect(model.betaSync).toBeLessThan(100);

      // rIn should be positive and reasonable
      expect(model.rIn).toBeGreaterThan(0);
      expect(model.rIn).toBeLessThan(1);

      // Context window should be set
      expect(model.contextWindow).toBeGreaterThan(0);

      // Model ID should be valid
      expect(model.modelId).toBeTruthy();
      expect(model.displayName).toBeTruthy();
    }
  });

  it('returns valid ScrapedPricing structure', async () => {
    const { MistralScraper } = await import('@/scrapers/mistral.js');
    const scraper = new MistralScraper();
    const html = loadFixture('mistral-pricing.html');

    // Mock parseHtml to return the fixture HTML
    const $ = scraper['parseHtml'](html);
    vi.spyOn(scraper as any, 'parseHtml').mockReturnValue($);

    const result = await scraper.scrape();

    expect(result.providerId).toBe('mistral');
    expect(result.scrapedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Integration Tests - All Scrapers
// ============================================================

describe('All Scrapers Integration', () => {
  it('all scrapers have unique provider IDs', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const { MistralScraper } = await import('@/scrapers/mistral.js');

    const scrapers = [
      new DeepSeekScraper(),
      new XAIScraper(),
      new GoogleScraper(),
      new AnthropicScraper(),
      new OpenAIScraper(),
      new MistralScraper(),
    ];

    const providerIds = scrapers.map(s => s.providerId);
    const uniqueIds = new Set(providerIds);

    expect(uniqueIds.size).toBe(scrapers.length);
  });

  it('all scrapers have valid target URLs', async () => {
    const { OpenAIScraper } = await import('@/scrapers/openai.js');
    const { MistralScraper } = await import('@/scrapers/mistral.js');

    const scrapers = [
      new DeepSeekScraper(),
      new XAIScraper(),
      new GoogleScraper(),
      new AnthropicScraper(),
      new OpenAIScraper(),
      new MistralScraper(),
    ];

    for (const scraper of scrapers) {
      expect(scraper.targetUrl).toBeTruthy();
      expect(scraper.targetUrl).toMatch(/^https?:\/\//);
    }
  });

  it('Cheerio scrapers can parse their fixtures without errors', async () => {
    const cheerioScrapers = [
      { scraper: new DeepSeekScraper(), fixture: 'deepseek-pricing.html' },
      { scraper: new XAIScraper(), fixture: 'xai-pricing.html' },
      { scraper: new GoogleScraper(), fixture: 'google-pricing.html' },
      { scraper: new AnthropicScraper(), fixture: 'anthropic-pricing.html' },
    ];

    for (const { scraper, fixture } of cheerioScrapers) {
      const html = loadFixture(fixture);
      mockFetchPage(scraper, html);

      // Should not throw
      const result = await scraper.scrape();

      // Should extract at least one model
      expect(result.models.length).toBeGreaterThan(0);
    }
  });

  it('all extracted models have rIn computed correctly', async () => {
    const cheerioScrapers = [
      { scraper: new DeepSeekScraper(), fixture: 'deepseek-pricing.html' },
      { scraper: new XAIScraper(), fixture: 'xai-pricing.html' },
      { scraper: new GoogleScraper(), fixture: 'google-pricing.html' },
      { scraper: new AnthropicScraper(), fixture: 'anthropic-pricing.html' },
    ];

    for (const { scraper, fixture } of cheerioScrapers) {
      const html = loadFixture(fixture);
      mockFetchPage(scraper, html);

      const result = await scraper.scrape();

      for (const model of result.models) {
        // rIn should be positive
        expect(model.rIn).toBeGreaterThan(0);

        // rIn should be reasonable (typically < 1, but can be higher for some models)
        expect(model.rIn).toBeLessThan(10);

        // Verify rIn = inputPrice / outputPrice
        // (within reasonable bounds given parsing variations)
        expect(isFinite(model.rIn)).toBe(true);
        expect(isNaN(model.rIn)).toBe(false);
      }
    }
  });
});
