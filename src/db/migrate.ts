// Database migration script using postgres-migrations
import { migrate } from 'postgres-migrations';
import { Client } from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your .env file or environment');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Database connection established');

    const migrationsDirectory = join(__dirname, 'migrations');
    console.log(`Running migrations from: ${migrationsDirectory}`);

    const applied = await migrate({ client }, migrationsDirectory);

    if (applied.length === 0) {
      console.log('No new migrations to apply - database is up to date');
    } else {
      console.log(`Successfully applied ${applied.length} migration(s):`);
      applied.forEach((migration) => {
        console.log(`  ✓ ${migration.name}`);
      });
    }

    console.log('\nMigration completed successfully');
  } catch (error) {
    console.error('\nMigration failed:');
    console.error(error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
