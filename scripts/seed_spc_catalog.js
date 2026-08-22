#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('../services/ptt-crm-api/node_modules/pg');
const { ensureSpcSchema } = require('./lib/spc-pg-bootstrap');
const { parsePricingText } = require('./lib/spc-pricing-parse');

const ROOT = path.join(__dirname, '..');
const bundlePath = process.env.SPC_BUNDLE || path.join(ROOT, 'docs/specs/spc-chuan-hoa-bundle.json');
const mapPath = path.join(ROOT, 'docs/specs/ops-dv01-dv21-route-map.json');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const routeMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const routeByCode = Object.fromEntries(routeMap.services.map((s) => [s.code, s]));

const TIER_TO_LEGACY = { CB: 'basic', TC: 'standard', CS: 'premium' };

function pricingModelToLegacyTier(pricing) {
  if (!pricing || typeof pricing !== 'object') return null;
  switch (pricing.type) {
    case 'one_time': {
      const min = Number(pricing.min_vnd) || 0;
      const max = Number(pricing.max_vnd) || min;
      const price = min || Math.round((min + max) / 2);
      return { price_vnd: price, min_vnd: min, max_vnd: max };
    }
    case 'retainer':
    case 'setup_plus_retainer': {
      const min = Number(pricing.monthly_min_vnd) || 0;
      const max = Number(pricing.monthly_max_vnd) || min;
      const price = min || Math.round((min + max) / 2);
      return { price_vnd: price, min_vnd: min, max_vnd: max };
    }
    case 'percent_of_ad_spend': {
      const min = Number(pricing.min_fee_vnd) || 0;
      return { price_vnd: min, min_vnd: min, max_vnd: min };
    }
    default:
      return null;
  }
}

async function upsertFamily(client, f, route) {
  await client.query(
    `INSERT INTO service_family (dv_code, name_vi, department, role_vi, service_type, description_vi, risks_json, depends_on_dv, readiness, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (dv_code) DO UPDATE SET
       name_vi=EXCLUDED.name_vi, department=EXCLUDED.department, role_vi=EXCLUDED.role_vi,
       service_type=EXCLUDED.service_type, description_vi=EXCLUDED.description_vi,
       risks_json=EXCLUDED.risks_json, depends_on_dv=EXCLUDED.depends_on_dv,
       readiness=EXCLUDED.readiness, updated_at=NOW()`,
    [
      f.dv_code,
      f.name_vi,
      f.department,
      f.role_vi,
      f.service_type,
      f.description_vi,
      JSON.stringify(f.risks_vi || []),
      JSON.stringify(f.depends_on_dv || route?.depends_on_dv || []),
      route?.readiness || 'partial',
      parseInt(String(f.dv_code).replace('DV', ''), 10) || 0,
    ],
  );
}

async function upsertOffer(client, f, offer) {
  const sku = `${f.dv_code}-${offer.tier}`;
  const pricing = parsePricingText(offer.price_text_vi || offer.pricing_text_vi, f.service_type);
  await client.query(
    `INSERT INTO service_offer (sku_code, dv_code, tier, label_vi, scope_summary_vi, pricing_model, duration_hint_vi, status, published_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'published',1)
     ON CONFLICT (sku_code) DO UPDATE SET
       scope_summary_vi=EXCLUDED.scope_summary_vi, pricing_model=EXCLUDED.pricing_model,
       duration_hint_vi=EXCLUDED.duration_hint_vi, updated_at=NOW()`,
    [
      sku,
      f.dv_code,
      offer.tier,
      offer.label_vi || offer.tier,
      offer.scope_summary_vi || '',
      JSON.stringify(pricing),
      f.duration_hint_vi || '',
    ],
  );
  await client.query(
    `INSERT INTO service_offer_line (line_code, sku_code, label_vi, description_vi, sort_order)
     VALUES ($1,$2,$3,$4,1)
     ON CONFLICT (line_code) DO UPDATE SET label_vi=EXCLUDED.label_vi, description_vi=EXCLUDED.description_vi`,
    [`${sku}-L01`, sku, offer.scope_summary_vi || offer.label_vi, offer.scope_summary_vi || ''],
  );
  return pricing;
}

async function upsertPhases(client, f) {
  let n = 0;
  for (const ph of f.process_phases || []) {
    n += 1;
    const code = ph.phase_code || `${f.dv_code}-T${n}`;
    await client.query(
      `INSERT INTO service_process_phase (phase_code, dv_code, week_label_vi, ptt_work_vi, deliverable_vi, client_action_vi, tasks_json, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (phase_code) DO UPDATE SET
         week_label_vi=EXCLUDED.week_label_vi, ptt_work_vi=EXCLUDED.ptt_work_vi,
         deliverable_vi=EXCLUDED.deliverable_vi, client_action_vi=EXCLUDED.client_action_vi,
         tasks_json=EXCLUDED.tasks_json, sort_order=EXCLUDED.sort_order`,
      [
        code,
        f.dv_code,
        ph.week_label_vi,
        ph.ptt_work_vi,
        ph.deliverable_vi,
        ph.client_action_vi,
        JSON.stringify(
          ph.tasks || [
            {
              id: `${code}-1`,
              title: ph.ptt_work_vi,
              owner_role: 'TeamLead',
              deliverable: ph.deliverable_vi,
              client_action: ph.client_action_vi,
            },
          ],
        ),
        ph.sort_order ?? n,
      ],
    );
  }
}

async function upsertKpis(client, f) {
  let i = 0;
  for (const label of f.kpi_defs || []) {
    i += 1;
    const kpiCode = `kpi-${i}`;
    await client.query(
      `INSERT INTO service_kpi_def (dv_code, sku_code, kpi_code, label_vi, sort_order)
       VALUES ($1,NULL,$2,$3,$4)
       ON CONFLICT (dv_code, sku_code, kpi_code) DO UPDATE SET label_vi=EXCLUDED.label_vi`,
      [f.dv_code, kpiCode, typeof label === 'string' ? label : label.label_vi, i],
    );
  }
}

async function syncOpsProfileTierPricing(client, dvCode, offers, serviceType) {
  const legacy = {};
  for (const offer of offers) {
    const key = TIER_TO_LEGACY[offer.tier];
    if (!key) continue;
    const pricing = parsePricingText(offer.price_text_vi || offer.pricing_text_vi, serviceType);
    const mapped = pricingModelToLegacyTier(pricing);
    if (mapped) legacy[key] = mapped;
  }
  if (Object.keys(legacy).length === 0) return;

  const res = await client.query(
    `UPDATE ops_service_profile SET tier_pricing=$2::jsonb, updated_at=NOW() WHERE dv_code=$1`,
    [dvCode, JSON.stringify(legacy)],
  );
  if (res.rowCount === 0) {
    console.warn(`WARN no ops_service_profile row for ${dvCode}, skip tier_pricing sync`);
  }
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await ensureSpcSchema(client);

  for (const f of bundle.families) {
    const route = routeByCode[f.dv_code];
    if (!route) throw new Error(`Missing route map entry ${f.dv_code}`);
    f.depends_on_dv = f.depends_on_dv?.length ? f.depends_on_dv : route.depends_on_dv || [];
    await upsertFamily(client, f, route);
    for (const offer of f.offers) await upsertOffer(client, f, offer);
    await upsertPhases(client, f);
    await upsertKpis(client, f);
    await syncOpsProfileTierPricing(client, f.dv_code, f.offers, f.service_type);
    await client.query(`UPDATE crm_catalog_services SET default_sku_code=$2 WHERE dv_code=$1`, [
      f.dv_code,
      `${f.dv_code}-TC`,
    ]);
  }

  await client.query(
    `INSERT INTO spc_publish_log (entity_type, entity_key, action, actor_email, diff_json)
     VALUES ('bundle','spc-chuan-hoa','seed_s1','system@import', $1)`,
    [JSON.stringify({ families: bundle.families.length })],
  );

  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM service_family) AS families,
      (SELECT COUNT(*)::int FROM service_offer) AS offers,
      (SELECT COUNT(*)::int FROM service_process_phase) AS phases,
      (SELECT COUNT(*)::int FROM service_kpi_def) AS kpis
  `);
  console.log('OK seed_spc', counts.rows[0]);
  await client.end();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  pricingModelToLegacyTier,
  syncOpsProfileTierPricing,
  upsertFamily,
  upsertOffer,
  upsertPhases,
  upsertKpis,
};
