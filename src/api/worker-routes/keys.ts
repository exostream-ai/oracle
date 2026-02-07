import { Hono } from 'hono';
import type { Env, ApiKeyData } from '../worker-types.js';
import { generateApiKey } from '../worker-state.js';

const keys = new Hono<{ Bindings: Env }>();

// POST /v1/keys - Generate a new API key (worker.ts lines 660-693)
keys.post('/', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  try {
    const body = await c.req.json().catch(() => ({})) as { name?: string };
    const name = body.name || 'Unnamed Key';

    const apiKey = generateApiKey();
    const keyData: ApiKeyData = {
      key: apiKey,
      name,
      createdAt: new Date().toISOString(),
      requestCount: 0,
      tier: 'free',
      rateLimit: 60, // 60 requests per minute for free tier
    };

    await c.env.API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData));

    return c.json({
      success: true,
      api_key: apiKey,
      name,
      tier: 'free',
      rate_limit: '60 requests/minute',
      message: 'Store this key securely - it cannot be retrieved later.',
    }, 201);
  } catch (error) {
    console.error('Error creating API key:', error);
    return c.json({ error: 'Failed to create API key' }, 500);
  }
});

// GET /v1/keys/usage - Get usage stats for an API key (worker.ts lines 696-724)
keys.get('/usage', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return c.json({ error: 'API key required. Include X-API-Key header.' }, 401);
  }

  try {
    const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
    if (!keyData) {
      return c.json({ error: 'Invalid API key' }, 404);
    }

    return c.json({
      name: keyData.name,
      created_at: keyData.createdAt,
      last_used: keyData.lastUsed,
      request_count: keyData.requestCount,
      tier: keyData.tier,
      rate_limit: `${keyData.rateLimit} requests/minute`,
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return c.json({ error: 'Failed to fetch usage' }, 500);
  }
});

// DELETE /v1/keys - Revoke an API key (worker.ts lines 727-753)
keys.delete('/', async (c) => {
  if (!c.env?.API_KEYS) {
    return c.json({ error: 'API key service not available' }, 503);
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return c.json({ error: 'API key required. Include X-API-Key header.' }, 401);
  }

  try {
    const keyData = await c.env.API_KEYS.get(`key:${apiKey}`, 'json') as ApiKeyData | null;
    if (!keyData) {
      return c.json({ error: 'Invalid API key' }, 404);
    }

    await c.env.API_KEYS.delete(`key:${apiKey}`);

    return c.json({
      success: true,
      message: 'API key revoked',
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return c.json({ error: 'Failed to revoke API key' }, 500);
  }
});

export default keys;
