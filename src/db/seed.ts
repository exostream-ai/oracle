// Database seed script
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getClient, closeClient } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  console.log('Seeding database...');

  const sql = getClient();
  const seedDir = join(__dirname, '../../seed');

  try {
    // Load seed data
    const providers = JSON.parse(readFileSync(join(seedDir, 'providers.json'), 'utf-8'));
    const families = JSON.parse(readFileSync(join(seedDir, 'families.json'), 'utf-8'));
    const models = JSON.parse(readFileSync(join(seedDir, 'models.json'), 'utf-8'));
    const historicalPrices = JSON.parse(readFileSync(join(seedDir, 'historical_prices.json'), 'utf-8'));

    // Insert providers
    for (const p of providers) {
      await sql`
        INSERT INTO providers (provider_id, display_name, pricing_url, docs_url, changelog_url)
        VALUES (${p.provider_id}, ${p.display_name}, ${p.pricing_url}, ${p.docs_url}, ${p.changelog_url})
        ON CONFLICT (provider_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          pricing_url = EXCLUDED.pricing_url,
          docs_url = EXCLUDED.docs_url,
          changelog_url = EXCLUDED.changelog_url,
          updated_at = now()
      `;
    }
    console.log(`Seeded ${providers.length} providers`);

    // Insert families
    for (const f of families) {
      await sql`
        INSERT INTO model_families (family_id, provider_id, display_name, r_in, r_cache, r_think, r_batch, is_reasoning)
        VALUES (${f.family_id}, ${f.provider_id}, ${f.display_name}, ${f.r_in}, ${f.r_cache}, ${f.r_think}, ${f.r_batch}, ${f.is_reasoning})
        ON CONFLICT (family_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          r_in = EXCLUDED.r_in,
          r_cache = EXCLUDED.r_cache,
          r_think = EXCLUDED.r_think,
          r_batch = EXCLUDED.r_batch,
          is_reasoning = EXCLUDED.is_reasoning,
          updated_at = now()
      `;
    }
    console.log(`Seeded ${families.length} model families`);

    // Insert models
    for (const m of models) {
      await sql`
        INSERT INTO models (model_id, family_id, display_name, ticker_sync, ticker_batch, context_window, launch_date, status)
        VALUES (${m.model_id}, ${m.family_id}, ${m.display_name}, ${m.ticker_sync}, ${m.ticker_batch}, ${m.context_window}, ${m.launch_date}, ${m.status})
        ON CONFLICT (model_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          ticker_sync = EXCLUDED.ticker_sync,
          ticker_batch = EXCLUDED.ticker_batch,
          context_window = EXCLUDED.context_window,
          launch_date = EXCLUDED.launch_date,
          status = EXCLUDED.status,
          updated_at = now()
      `;

      // Insert context tiers
      if (m.tiers) {
        for (let i = 0; i < m.tiers.length; i++) {
          const tier = m.tiers[i];
          await sql`
            INSERT INTO context_tiers (model_id, tier_index, tau_start, tau_end, alpha)
            VALUES (${m.model_id}, ${i}, ${tier.tau_start}, ${tier.tau_end}, ${tier.alpha})
            ON CONFLICT (model_id, tier_index, effective_from) DO NOTHING
          `;
        }
      }
    }
    console.log(`Seeded ${models.length} models`);

    // Insert historical prices
    for (const p of historicalPrices) {
      await sql`
        INSERT INTO spot_prices (model_id, price_type, beta, source, observed_at, effective_from)
        VALUES (${p.model_id}, ${p.price_type}, ${p.beta}, ${p.source}, ${p.observed_at}, ${p.effective_from})
      `;
    }
    console.log(`Seeded ${historicalPrices.length} historical price points`);

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await closeClient();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
