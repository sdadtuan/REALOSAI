'use strict';

const { parsePricingText } = require('./spc-pricing-parse');

function resolveComponentPricing(component, serviceType) {
  if (component.pricing_model && typeof component.pricing_model === 'object') {
    return component.pricing_model;
  }
  return parsePricingText(component.price_text_vi || '', serviceType || 'one_time');
}

async function upsertComponent(client, dvCode, component, serviceType) {
  const code = String(component.component_code ?? '').trim().toUpperCase();
  if (!code) return null;
  const pricing = resolveComponentPricing(component, serviceType);
  await client.query(
    `INSERT INTO service_component
       (component_code, dv_code, name_vi, description_vi, deliverable_vi, pricing_model, sort_order, active, status, published_version)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,TRUE,'published',1)
     ON CONFLICT (component_code) DO UPDATE SET
       name_vi=EXCLUDED.name_vi,
       description_vi=EXCLUDED.description_vi,
       deliverable_vi=EXCLUDED.deliverable_vi,
       pricing_model=EXCLUDED.pricing_model,
       sort_order=EXCLUDED.sort_order,
       active=TRUE,
       status='published',
       published_version=GREATEST(service_component.published_version, 1),
       draft_pricing_model=NULL,
       draft_name_vi=NULL,
       draft_description_vi=NULL,
       draft_deliverable_vi=NULL,
       updated_at=NOW()`,
    [
      code,
      String(dvCode).trim().toUpperCase(),
      String(component.name_vi ?? '').trim(),
      String(component.description_vi ?? ''),
      String(component.deliverable_vi ?? ''),
      JSON.stringify(pricing),
      Number(component.sort_order ?? 0),
    ],
  );
  return code;
}

async function syncOfferLinesFromBundle(client, skuCode, componentCodes) {
  const sku = String(skuCode ?? '').trim().toUpperCase();
  const codes = (componentCodes ?? []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  await client.query(`DELETE FROM service_offer_line WHERE sku_code = $1`, [sku]);
  let lineCount = 0;
  let sortOrder = 0;
  for (const componentCode of codes) {
    const res = await client.query(
      `SELECT name_vi, description_vi, deliverable_vi
       FROM service_component WHERE component_code = $1 AND active = TRUE`,
      [componentCode],
    );
    const row = res.rows[0];
    if (!row) continue;
    sortOrder += 1;
    lineCount += 1;
    const lineCode = `${sku}-${componentCode}`;
    await client.query(
      `INSERT INTO service_offer_line
         (line_code, sku_code, label_vi, description_vi, component_code, sort_order, included_by_default, active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE)
       ON CONFLICT (line_code) DO UPDATE SET
         label_vi=EXCLUDED.label_vi,
         description_vi=EXCLUDED.description_vi,
         component_code=EXCLUDED.component_code,
         sort_order=EXCLUDED.sort_order,
         included_by_default=TRUE,
         active=TRUE`,
      [
        lineCode,
        sku,
        String(row.name_vi ?? componentCode),
        String(row.deliverable_vi || row.description_vi || ''),
        componentCode,
        sortOrder,
      ],
    );
  }
  return lineCount;
}

async function syncBundleForSku(client, skuCode, componentCodes) {
  const sku = String(skuCode ?? '').trim().toUpperCase();
  const codes = (componentCodes ?? []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  await client.query(`DELETE FROM service_bundle_item WHERE sku_code = $1`, [sku]);
  let i = 0;
  for (const code of codes) {
    i += 1;
    await client.query(
      `INSERT INTO service_bundle_item (sku_code, component_code, included, qty, sort_order)
       VALUES ($1,$2,TRUE,1,$3)
       ON CONFLICT (sku_code, component_code) DO UPDATE SET included=TRUE, qty=1, sort_order=EXCLUDED.sort_order`,
      [sku, code, i],
    );
  }
  await syncOfferLinesFromBundle(client, sku, codes);
  return codes.length;
}

/**
 * Import components[] + bundle_by_tier from a doc bundle family entry.
 * @returns {{ components: number, bundle_items: number, skus: string[] }}
 */
async function importFamilyComponentsFromDoc(client, family) {
  const dvCode = String(family.dv_code ?? '').trim().toUpperCase();
  const serviceType = String(family.service_type ?? 'one_time');
  const components = Array.isArray(family.components) ? family.components : [];
  const bundleByTier = family.bundle_by_tier && typeof family.bundle_by_tier === 'object'
    ? family.bundle_by_tier
    : {};

  let componentCount = 0;
  for (const row of components) {
    const code = await upsertComponent(client, dvCode, row, serviceType);
    if (code) componentCount += 1;
  }

  let bundleItems = 0;
  let offerLines = 0;
  const skus = [];
  for (const [tier, codes] of Object.entries(bundleByTier)) {
    const skuCode = `${dvCode}-${String(tier).trim().toUpperCase()}`;
    const offer = await client.query(`SELECT sku_code FROM service_offer WHERE sku_code = $1`, [skuCode]);
    if (!offer.rows.length) continue;
    bundleItems += await syncBundleForSku(client, skuCode, codes);
    offerLines += codes.length;
    skus.push(skuCode);
  }

  return { dv_code: dvCode, components: componentCount, bundle_items: bundleItems, offer_lines: offerLines, skus };
}

module.exports = {
  resolveComponentPricing,
  upsertComponent,
  syncBundleForSku,
  syncOfferLinesFromBundle,
  importFamilyComponentsFromDoc,
};
