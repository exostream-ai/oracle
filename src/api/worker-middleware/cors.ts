import { cors } from 'hono/cors';

export const workerCors = cors({
  origin: (origin) => {
    if (!origin) return 'https://exostream.ai';
    if (origin.endsWith('.exostream.pages.dev') ||
        origin === 'https://exostream.ai' ||
        origin === 'https://www.exostream.ai' ||
        origin.startsWith('http://localhost')) {
      return origin;
    }
    return 'https://exostream.ai';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400,
});
