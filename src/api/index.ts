// API module - Hono REST API
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = parseInt(process.env.PORT || '8080', 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running on port ${port}`);

export default app;
