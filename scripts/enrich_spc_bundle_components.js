#!/usr/bin/env node
'use strict';
/**
 * S6e — derive components[] + bundle_by_tier for all DV families in doc bundle.
 * Preserves hand-authored DV01 components. Rewrites spc-chuan-hoa-bundle.json.
 *
 * Usage: node scripts/enrich_spc_bundle_components.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { enrichFamilyComponents } = require('./lib/spc-component-bundle-generate');

const ROOT = path.join(__dirname, '..');
const bundlePath = process.env.SPC_BUNDLE || path.join(ROOT, 'docs/specs/spc-chuan-hoa-bundle.json');
const dryRun = process.argv.includes('--dry-run');

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const families = (bundle.families ?? []).map((family) =>
  enrichFamilyComponents(family, { preserveExisting: true }),
);

let missing = 0;
for (const family of families) {
  const count = (family.components ?? []).length;
  if (count < 2) {
    missing += 1;
    console.error(`WARN ${family.dv_code}: only ${count} components`);
  }
}

if (families.length !== 21) {
  console.error(`Expected 21 families, got ${families.length}`);
  process.exit(1);
}
if (missing) {
  console.error(`FAIL ${missing} families with < 2 components`);
  process.exit(1);
}

const next = {
  ...bundle,
  generated_at: new Date().toISOString().slice(0, 10),
  families,
};

if (dryRun) {
  console.log(
    'DRY RUN',
    families.map((f) => `${f.dv_code}:${(f.components ?? []).length}`).join(' '),
  );
  process.exit(0);
}

fs.writeFileSync(bundlePath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`OK enrich_spc_bundle_components → ${bundlePath}`);
for (const f of families) {
  console.log(`  ${f.dv_code} components=${(f.components ?? []).length}`);
}
