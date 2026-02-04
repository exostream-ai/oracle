/**
 * CORS middleware for Hono
 */

import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: '*', // Allow all origins for public API
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Key'],
  maxAge: 86400, // 24 hours
});
