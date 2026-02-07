import type { Context, Next } from 'hono';
import type { Env, ApiKeyData } from '../worker-types.js';

export const apiKeyMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (apiKey && c.env?.API_KEYS) {
    try {
      const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
      if (keyData) {
        keyData.lastUsed = new Date().toISOString();
        keyData.requestCount = (keyData.requestCount || 0) + 1;
        c.executionCtx.waitUntil(
          c.env.API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData))
        );
      }
    } catch (e) {
      // Ignore errors - API key tracking is optional
    }
  }

  await next();
};
