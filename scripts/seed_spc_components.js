#!/usr/bin/env node
'use strict';
/**
 * S6 — seed service_component + service_bundle_item from spc-chuan-hoa-bundle.json
 * Usage:
 *   node scripts/seed_spc_components.js          # all 21 DV (S6e)
 *   node scripts/seed_spc_components.js DV01     # single pilot DV
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('../services/ptt-crm-api/node_modules/pg');
const { ensureSpcSchema } = require('./lib/spc-pg-bootstrap');
const { importFamilyComponentsFromDoc } = require('./lib/spc-component-import');
const { loadRepoEnv } = require('./lib/load-repo-env');

const ROOT = path.join(__dirname, '..');
loadRepoEnv(ROOT);
const bundlePath = process.env.SPC_BUNDLE || path.join(ROOT, 'docs/specs/spc-chuan-hoa-bundle.json');
const databaseUrl = process.env.DATABASE_URL;
const filterDv = process.argv[2] ? String(process.argv[2]).trim().toUpperCase() : null;

if (!databaseUrl) {
  console.error('DATABASE_URL required — set in .env or environment');
  process.exit(1);
}

async function main() {
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const families = (bundle.families ?? []).filter(
    (f) => Array.isArray(f.components) && f.components.length && (!filterDv || f.dv_code === filterDv),
  );
  if (!families.length) {
    console.error('No families with components in bundle', filterDv || '');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await ensureSpcSchema(client);

  const results = [];
  for (const family of families) {
    results.push(await importFamilyComponentsFromDoc(client, family));
  }

  console.log('OK seed_spc_components', {
    source_doc: bundle.source_doc,
    families: results,
  });
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
