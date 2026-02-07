import { http, HttpResponse } from 'msw';
import { mockGreeks } from '../fixtures/greeks';
import { mockForwards } from '../fixtures/forwards';
import { mockHistory } from '../fixtures/history';
import { mockPriceResult } from '../fixtures/price-result';

const API_BASE = 'https://api.exostream.ai';

function wrapResponse<T>(data: T) {
  return {
    data,
    oracle_timestamp: new Date().toISOString(),
    cache_age_seconds: 0,
  };
}

export const handlers = [
  // GET /v1/greeks - all models
  http.get(`${API_BASE}/v1/greeks`, () => {
    return HttpResponse.json(wrapResponse(mockGreeks));
  }),

  // GET /v1/greeks/:ticker - single model (by ticker)
  http.get(`${API_BASE}/v1/greeks/:ticker`, ({ params }) => {
    const { ticker } = params;
    // Check if it's a ticker or model_id
    const model = mockGreeks.find((m) => m.ticker === ticker || m.model_id === ticker);
    if (!model) {
      return HttpResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    // For EmbedTicker direct fetch, return model without wrapper
    // For api.ts client fetch, it expects wrapped response
    // We'll return unwrapped for simplicity (EmbedTicker use case)
    return HttpResponse.json(model);
  }),

  // GET /v1/forwards/:ticker
  http.get(`${API_BASE}/v1/forwards/:ticker`, ({ params }) => {
    const { ticker } = params;
    // Return forwards with the requested ticker
    const forwards = { ...mockForwards, ticker: ticker as string };
    return HttpResponse.json(wrapResponse(forwards));
  }),

  // GET /v1/history/:ticker
  http.get(`${API_BASE}/v1/history/:ticker`, ({ params }) => {
    const { ticker } = params;
    // Return history with the requested ticker
    const history = { ...mockHistory, ticker: ticker as string };
    return HttpResponse.json(wrapResponse(history));
  }),

  // POST /v1/price
  http.post(`${API_BASE}/v1/price`, async ({ request }) => {
    const body = await request.json();
    // Return price result with model from request
    const result = { ...mockPriceResult, model: (body as any).model || 'OPUS-4.5' };
    return HttpResponse.json(wrapResponse(result));
  }),

  // GET /v1/spots - subset of greeks
  http.get(`${API_BASE}/v1/spots`, () => {
    // Return first 3 models as spots
    const spots = mockGreeks.slice(0, 3);
    return HttpResponse.json(wrapResponse(spots));
  }),
];
