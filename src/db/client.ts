/**
 * PostgreSQL database client
 */

import postgres, { Sql } from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

let client: Sql | null = null;

/**
 * Get PostgreSQL client instance (lazy initialization)
 */
export function getClient(): Sql {
  if (!connectionString) {
    throw new Error('DATABASE_URL not set - database operations will fail');
  }

  if (!client) {
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return client;
}

/**
 * Get client or null if not configured
 */
export function getClientOrNull(): Sql | null {
  if (!connectionString) return null;
  return getClient();
}

/**
 * Check if database is connected
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const sql = getClient();
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Close database connection
 */
export async function closeClient(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

// Legacy export for backwards compatibility
export const sql = connectionString ? getClient() : null;
