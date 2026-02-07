// Database migration script using postgres-migrations
import { migrate } from 'postgres-migrations';
import { Client } from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../core/logger.js';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrateLogger = logger.child({ component: 'migrations' });

/**
 * Run database migrations. Exported for use by the API server on startup.
 * Requires DATABASE_URL environment variable to be set.
 */
export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  migrateLogger.info('Connecting to database');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    migrateLogger.info('Database connection established');

    const migrationsDirectory = join(__dirname, 'migrations');
    const applied = await migrate({ client }, migrationsDirectory);

    if (applied.length === 0) {
      migrateLogger.info('No new migrations to apply — database is up to date');
    } else {
      migrateLogger.info(`Applied ${applied.length} migration(s)`, {
        migrations: applied.map((m) => m.name),
      });
    }
  } catch (error: any) {
    migrateLogger.error('Migration failed', { error: error.message });
    throw error;
  } finally {
    await client.end();
    migrateLogger.debug('Database connection closed');
  }
}

// CLI entrypoint: auto-run when executed directly (tsx src/db/migrate.ts)
const isDirectRun = process.argv[1]?.includes('migrate');
if (isDirectRun) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
