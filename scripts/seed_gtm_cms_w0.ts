#!/usr/bin/env ts-node
/**
 * Seed W0 GTM CMS articles + draft event.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node scripts/seed_gtm_cms_w0.ts
 */
import { Pool } from 'pg';
import { seedGtmCmsW0 } from '../services/ptt-crm-api/src/gtm-cms/cms-seed';

async function main(): Promise<void> {
  const databaseUrl = (
    process.env.DATABASE_URL ??
    process.env.PTT_DATABASE_URL ??
    'postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb'
  ).trim();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await seedGtmCmsW0(pool, {
      demoHtmlDir: process.env.PTT_DEMO_HTML_DIR,
    });
    console.log(`Seeded ${result.articles} articles and ${result.events} event (demo-ngay-nganh draft).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
