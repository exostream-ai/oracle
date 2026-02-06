/**
 * Script to capture internal API endpoints used by pricing pages
 * Run with: npx tsx scripts/capture-pricing-apis.ts
 */

import { chromium } from 'playwright';

interface CapturedRequest {
  url: string;
  method: string;
  resourceType: string;
  responseStatus?: number;
  responseSize?: number;
  hasJsonResponse?: boolean;
  jsonPreview?: string;
}

async function capturePricingApis(url: string, name: string): Promise<CapturedRequest[]> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Capturing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const capturedRequests: CapturedRequest[] = [];

  // Capture all network requests
  page.on('response', async (response) => {
    const request = response.request();
    const url = request.url();
    const resourceType = request.resourceType();

    // Skip static assets
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      return;
    }

    // Focus on XHR/fetch requests and document requests
    if (['xhr', 'fetch', 'document', 'script'].includes(resourceType)) {
      const captured: CapturedRequest = {
        url,
        method: request.method(),
        resourceType,
        responseStatus: response.status(),
      };

      try {
        const contentType = response.headers()['content-type'] || '';

        // Check if it's JSON
        if (contentType.includes('application/json') || url.includes('.json')) {
          captured.hasJsonResponse = true;

          try {
            const body = await response.text();
            captured.responseSize = body.length;

            // Preview first 500 chars
            const preview = body.slice(0, 500);
            captured.jsonPreview = preview;

            // Check if it contains pricing-related keywords
            const lowerBody = body.toLowerCase();
            if (
              lowerBody.includes('price') ||
              lowerBody.includes('cost') ||
              lowerBody.includes('token') ||
              lowerBody.includes('model') ||
              lowerBody.includes('gpt') ||
              lowerBody.includes('claude') ||
              lowerBody.includes('gemini')
            ) {
              console.log(`\n[POTENTIAL PRICING API] ${url}`);
              console.log(`  Status: ${response.status()}`);
              console.log(`  Size: ${body.length} bytes`);
              console.log(`  Preview: ${preview.slice(0, 200)}...`);
            }
          } catch (e) {
            // Response body not available
          }
        }
      } catch (e) {
        // Ignore errors
      }

      capturedRequests.push(captured);
    }
  });

  try {
    // Navigate and wait for network to settle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(3000);

    // Scroll down to trigger any lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

  } catch (e) {
    console.log(`Error loading page: ${e}`);
  }

  await browser.close();

  // Filter and return interesting requests
  const interestingRequests = capturedRequests.filter(r =>
    r.hasJsonResponse ||
    r.url.includes('api') ||
    r.url.includes('pricing') ||
    r.url.includes('models')
  );

  console.log(`\nTotal requests captured: ${capturedRequests.length}`);
  console.log(`Interesting requests: ${interestingRequests.length}`);

  return interestingRequests;
}

async function main() {
  const results: Record<string, CapturedRequest[]> = {};

  // OpenAI
  results['openai'] = await capturePricingApis(
    'https://openai.com/api/pricing',
    'OpenAI API Pricing'
  );

  // Anthropic
  results['anthropic'] = await capturePricingApis(
    'https://www.anthropic.com/pricing',
    'Anthropic Pricing'
  );

  // Google Vertex AI
  results['google'] = await capturePricingApis(
    'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    'Google Vertex AI Pricing'
  );

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY - Potential Internal API Endpoints');
  console.log('='.repeat(60));

  for (const [provider, requests] of Object.entries(results)) {
    console.log(`\n## ${provider.toUpperCase()}`);
    const jsonRequests = requests.filter(r => r.hasJsonResponse);

    if (jsonRequests.length === 0) {
      console.log('  No JSON API endpoints detected (pricing may be embedded in HTML/JS)');
    } else {
      for (const req of jsonRequests) {
        console.log(`  - ${req.url}`);
        if (req.jsonPreview) {
          const preview = req.jsonPreview.slice(0, 100).replace(/\n/g, ' ');
          console.log(`    Preview: ${preview}...`);
        }
      }
    }
  }
}

main().catch(console.error);
