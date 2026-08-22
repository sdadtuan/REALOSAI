#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mapPath = path.join(ROOT, 'docs/specs/ops-dv01-dv21-route-map.json');
const pilotSeedPath = path.join(ROOT, 'docs/specs/ops-dv-pilot-weekly-kpi-seed.json');
const tierPricingSeedPath = path.join(ROOT, 'docs/specs/ops-dv-tier-pricing-seed.json');
const databaseUrl = process.env.DATABASE_URL;

const pgModulePath = path.join(ROOT, 'services/ptt-crm-api/node_modules/pg');
const { Client } = require(pgModulePath);

if (!databaseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const pilotSeed = fs.existsSync(pilotSeedPath)
  ? JSON.parse(fs.readFileSync(pilotSeedPath, 'utf8'))
  : { pilot_dv: {} };
const tierSeed = fs.existsSync(tierPricingSeedPath)
  ? JSON.parse(fs.readFileSync(tierPricingSeedPath, 'utf8'))
  : { default_tier_pricing: {}, dv_overrides: {} };
if (!map.services || map.services.length !== 21) {
  console.error('Expected 21 services in route map');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  for (const entry of map.services) {
    const sortOrder = Number(String(entry.code).replace('DV', '')) || 0;
    const pilot = pilotSeed.pilot_dv?.[entry.code] ?? {};
    const weeklyTemplate = pilot.weekly_process_template ?? [];
    const kpiDefinitions = pilot.kpi_definitions ?? [];
    const tierPricing =
      tierSeed.dv_overrides?.[entry.code] ??
      tierSeed.default_tier_pricing ??
      {};
    await client.query(
      `INSERT INTO ops_service_profile
         (dv_code, service_slug, name, readiness, service_slugs_json, ops_web_json, nest_api_json,
          depends_on_dv, gaps, sort_order, weekly_process_template, kpi_definitions, tier_pricing)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (dv_code) DO UPDATE SET
         service_slug = EXCLUDED.service_slug,
         name = EXCLUDED.name,
         readiness = EXCLUDED.readiness,
         service_slugs_json = EXCLUDED.service_slugs_json,
         ops_web_json = EXCLUDED.ops_web_json,
         nest_api_json = EXCLUDED.nest_api_json,
         depends_on_dv = EXCLUDED.depends_on_dv,
         gaps = EXCLUDED.gaps,
         sort_order = EXCLUDED.sort_order,
         weekly_process_template = CASE
           WHEN EXCLUDED.weekly_process_template::text NOT IN ('[]', '{}', 'null')
           THEN EXCLUDED.weekly_process_template
           ELSE ops_service_profile.weekly_process_template
         END,
         kpi_definitions = CASE
           WHEN EXCLUDED.kpi_definitions::text NOT IN ('[]', '{}', 'null')
           THEN EXCLUDED.kpi_definitions
           ELSE ops_service_profile.kpi_definitions
         END,
         tier_pricing = CASE
           WHEN EXCLUDED.tier_pricing::text NOT IN ('[]', '{}', 'null')
           THEN EXCLUDED.tier_pricing
           ELSE ops_service_profile.tier_pricing
         END,
         updated_at = NOW()`,
      [
        entry.code,
        entry.service_slugs.primary,
        entry.name_vi,
        entry.readiness,
        JSON.stringify(entry.service_slugs),
        JSON.stringify(entry.ops_web ?? {}),
        JSON.stringify(entry.nest_api ?? {}),
        JSON.stringify(entry.depends_on_dv ?? []),
        JSON.stringify(entry.gaps ?? []),
        sortOrder,
        JSON.stringify(weeklyTemplate),
        JSON.stringify(kpiDefinitions),
        JSON.stringify(tierPricing),
      ],
    );

    await client.query(
      `INSERT INTO crm_catalog_services (slug, name, dv_code, sort_order, active)
       VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         dv_code = EXCLUDED.dv_code,
         name = EXCLUDED.name,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [entry.service_slugs.primary, entry.name_vi, entry.code, sortOrder],
    );
  }

  const count = await client.query('SELECT COUNT(*)::int AS c FROM ops_service_profile');
  console.log(`OK seeded ${count.rows[0].c} ops profiles`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
