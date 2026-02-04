// Database migration script
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getClient, closeClient } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('Running database migration...');

  const sql = getClient();
  const schemaPath = join(__dirname, '../../exostream_schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  try {
    await sql.unsafe(schema);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await closeClient();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
