# SPC S1 — DDL + Doc Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PostgreSQL schema for Service Product Catalog (SPC) and idempotent seed from `Chuan_hoa_Du_lieu_Van_hanh_PTT.docx` — 21 `service_family`, 63 `service_offer` (CB/TC/CS), pricing models, process phases, KPI defs.

**Architecture:** (1) SQL DDL in `docs/specs/` applied via bash + optional Nest bootstrap mirror. (2) One-time/regen **extract** script turns Word doc → committed JSON bundle. (3) **seed** script upserts SPC tables + writes `spc_publish_log` import row. (4) **gate** script asserts counts. No Admin UI or REST API in S1 (S2).

**Tech Stack:** PostgreSQL 14+, Node 20, `pg` (same as `seed_ops_dv_catalog.js`), plain `.js` scripts under `scripts/`, Jest unit tests in `services/ptt-crm-api` for pricing parsers (reused in S2).

**Spec:** [`docs/superpowers/specs/2026-08-12-service-product-catalog-spc-admin-a-design.md`](../specs/2026-08-12-service-product-catalog-spc-admin-a-design.md) §5, §10 M1–M3, §11 S1, AC-01.

## Global Constraints

- Exactly **21** DVs (`DV01`–`DV21`); exactly **3** SKUs per DV (`CB`, `TC`, `CS`).
- SKU code pattern: `{dv_code}-{tier}` e.g. `DV02-TC`.
- Phase code pattern: `{dv_code}-T{n}` e.g. `DV03-T1`.
- Scope line code: `{sku_code}-L{nn}` e.g. `DV02-TC-L01`.
- Pricing models: `one_time` | `retainer` | `setup_plus_retainer` | `percent_of_ad_spend` (spec §4.2).
- Tier legacy map: `CB→basic`, `TC→standard`, `CS→premium`.
- `DATABASE_URL` required for seed/gate (same as existing ops seeds).
- Idempotent upserts — safe to re-run seed.
- Do **not** implement Admin A UI, `/api/spc/*`, or publish workflow in S1.
- Route map JSON remains structural SSoT; SPC enriches operational/commercial data.

---

## File map (S1)

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-08-12-postgresql-ddl-spc.sql` | CREATE TABLE SPC + `service_lifecycle.sku_code` |
| `scripts/apply_pg_ddl_spc.sh` | Apply DDL via psql |
| `docs/specs/spc-chuan-hoa-bundle.schema.json` | JSON Schema for bundle validation |
| `docs/specs/spc-chuan-hoa-bundle.json` | Committed extract output (regen via script) |
| `scripts/extract_spc_bundle_from_docx.js` | Word → bundle JSON |
| `scripts/lib/spc-pricing-parse.js` | Parse VND / setup+retainer text → `pricing_model` |
| `scripts/lib/spc-doc-section-parse.js` | Split doc paragraphs into DV sections |
| `services/ptt-crm-api/src/spc/spc-pricing.util.ts` | TS re-export/wrapper of parse logic for Jest |
| `services/ptt-crm-api/src/spc/spc-pricing.util.spec.ts` | Unit tests |
| `scripts/seed_spc_catalog.js` | Upsert families, offers, lines, phases, KPI |
| `scripts/spc_s1_gate.sh` | Count + sample pricing assertions |
| `scripts/lib/spc-pg-bootstrap.js` | Shared `ensureSpcSchema(client)` for seed |

---

### Task 1: PostgreSQL DDL

**Files:**
- Create: `docs/specs/2026-08-12-postgresql-ddl-spc.sql`
- Create: `scripts/apply_pg_ddl_spc.sh`
- Create: `scripts/lib/spc-pg-bootstrap.js`

**Interfaces:**
- Produces: `ensureSpcSchema(client)` — runs same DDL statements as SQL file (idempotent).

- [ ] **Step 1: Create DDL file**

Create `docs/specs/2026-08-12-postgresql-ddl-spc.sql` with tables from spec §5.1:

```sql
-- SPC S1 — Service Product Catalog
-- Spec: docs/superpowers/specs/2026-08-12-service-product-catalog-spc-admin-a-design.md

ALTER TABLE service_lifecycle
  ADD COLUMN IF NOT EXISTS sku_code VARCHAR(16) NULL;

ALTER TABLE crm_catalog_services
  ADD COLUMN IF NOT EXISTS default_sku_code VARCHAR(16) NULL;

CREATE TABLE IF NOT EXISTS service_family ( ... );  -- full DDL from spec
CREATE TABLE IF NOT EXISTS service_offer ( ... );
CREATE TABLE IF NOT EXISTS service_offer_line ( ... );
CREATE TABLE IF NOT EXISTS service_process_phase ( ... );
CREATE TABLE IF NOT EXISTS service_kpi_def ( ... );
CREATE TABLE IF NOT EXISTS tmmt_blueprint ( ... );   -- empty in S1, schema only
CREATE TABLE IF NOT EXISTS spc_publish_log ( ... );

CREATE INDEX IF NOT EXISTS idx_service_offer_dv ON service_offer (dv_code);
CREATE INDEX IF NOT EXISTS idx_service_process_dv ON service_process_phase (dv_code);
CREATE INDEX IF NOT EXISTS idx_service_kpi_dv ON service_kpi_def (dv_code);
```

Include FK from `service_offer.dv_code` → `service_family.dv_code`.

- [ ] **Step 2: Create apply script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-12-postgresql-ddl-spc.sql"
echo "==> Apply SPC DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK SPC DDL applied"
```

Run: `chmod +x scripts/apply_pg_ddl_spc.sh`

- [ ] **Step 3: Create Node bootstrap helper**

`scripts/lib/spc-pg-bootstrap.js`:

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

async function ensureSpcSchema(client) {
  const ddlPath = path.join(__dirname, '../../docs/specs/2026-08-12-postgresql-ddl-spc.sql');
  const sql = fs.readFileSync(ddlPath, 'utf8');
  await client.query(sql);
}

module.exports = { ensureSpcSchema };
```

- [ ] **Step 4: Apply locally and verify tables**

Run:

```bash
cd /Users/quoctuan/Documents/CursorAI/RNOSAI
export DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb
bash scripts/apply_pg_ddl_spc.sh
psql "$DATABASE_URL" -c "\dt service_*"
```

Expected: lists `service_family`, `service_offer`, `service_offer_line`, `service_process_phase`, `service_kpi_def`, `tmmt_blueprint`, `spc_publish_log`.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-08-12-postgresql-ddl-spc.sql scripts/apply_pg_ddl_spc.sh scripts/lib/spc-pg-bootstrap.js
git commit -m "feat(spc): add PostgreSQL DDL for service product catalog S1"
```

---

### Task 2: Pricing parse utilities (TDD)

**Files:**
- Create: `scripts/lib/spc-pricing-parse.js`
- Create: `services/ptt-crm-api/src/spc/spc-pricing.util.ts`
- Create: `services/ptt-crm-api/src/spc/spc-pricing.util.spec.ts`

**Interfaces:**
- Produces: `parsePricingText(textVi, serviceType)` → `PricingModel` JSON
- Produces: `inferServiceType(appendixRowText)` → `'one_time'|'setup_retainer'|'retainer'|'percent_of_ad_spend'`

- [ ] **Step 1: Write failing tests**

Create `services/ptt-crm-api/src/spc/spc-pricing.util.spec.ts`:

```typescript
import {
  parseVndRange,
  parsePricingText,
  inferServiceTypeFromAppendix,
} from './spc-pricing.util';

describe('spc-pricing.util', () => {
  it('parseVndRange handles 15tr – 80tr', () => {
    expect(parseVndRange('15tr – 80tr')).toEqual({ min_vnd: 15_000_000, max_vnd: 80_000_000 });
  });

  it('parsePricingText setup_plus_retainer DV02 CB', () => {
    const m = parsePricingText(
      'Setup 6-10tr + 7.000.000-10.000.000đ/tháng',
      'setup_retainer',
    );
    expect(m.type).toBe('setup_plus_retainer');
    expect(m.setup_min_vnd).toBe(6_000_000);
    expect(m.monthly_min_vnd).toBe(7_000_000);
  });

  it('inferServiceTypeFromAppendix', () => {
    expect(inferServiceTypeFromAppendix('Setup+Retainer')).toBe('setup_retainer');
    expect(inferServiceTypeFromAppendix('One-time')).toBe('one_time');
    expect(inferServiceTypeFromAppendix('Retainer')).toBe('retainer');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ptt-crm-api
npm test -- --testPathPattern=spc-pricing.util.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement parser in scripts/lib + TS wrapper**

`scripts/lib/spc-pricing-parse.js` (core logic):

```javascript
'use strict';

function parseVndToken(token) {
  const t = String(token).replace(/\./g, '').replace(/,/g, '').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*tr/i);
  if (m) return Math.round(parseFloat(m[1]) * 1_000_000);
  const n = t.match(/^(\d+)/);
  return n ? parseInt(n[1], 10) : 0;
}

function parseVndRange(text) {
  const parts = String(text).split(/–|-/);
  if (parts.length >= 2) {
    return { min_vnd: parseVndToken(parts[0]), max_vnd: parseVndToken(parts[1]) };
  }
  const single = parseVndToken(text);
  return { min_vnd: single, max_vnd: single };
}

function parsePricingText(textVi, serviceType) {
  const raw = String(textVi ?? '').trim();
  if (serviceType === 'one_time') {
    const r = parseVndRange(raw.replace(/[^\dtr–\-\.]/gi, ' '));
    return { type: 'one_time', ...r };
  }
  if (/setup/i.test(raw) && /tháng|thang/i.test(raw)) {
    const setupPart = raw.match(/setup\s*([\d\.\,\-\–tr\s]+)/i)?.[1] ?? '';
    const monthlyPart = raw.match(/(\d[\d\.\,]*\s*-\s*\d[\d\.\,]*).*tháng/i)?.[0] ?? raw;
    const setup = parseVndRange(setupPart.replace(/[^\dtr–\-]/gi, ' '));
    const monthly = parseVndRange(monthlyPart.replace(/[^\d–\-]/g, ' '));
    return {
      type: 'setup_plus_retainer',
      setup_min_vnd: setup.min_vnd,
      setup_max_vnd: setup.max_vnd,
      monthly_min_vnd: monthly.min_vnd,
      monthly_max_vnd: monthly.max_vnd,
    };
  }
  if (serviceType === 'retainer' || /tháng|thang/i.test(raw)) {
    const r = parseVndRange(raw);
    return { type: 'retainer', monthly_min_vnd: r.min_vnd, monthly_max_vnd: r.max_vnd };
  }
  if (/%/.test(raw) || serviceType === 'percent_of_ad_spend') {
    return { type: 'percent_of_ad_spend', min_fee_vnd: 8_000_000, rate_pct: 0, note_vi: raw };
  }
  const r = parseVndRange(raw);
  return { type: 'one_time', ...r };
}

function inferServiceTypeFromAppendix(loaiHinh) {
  const s = String(loaiHinh ?? '').toLowerCase();
  if (s.includes('setup') && s.includes('retainer')) return 'setup_retainer';
  if (s.includes('retainer')) return 'retainer';
  if (s.includes('one-time') || s.includes('one time')) return 'one_time';
  return 'setup_retainer';
}

module.exports = { parseVndRange, parsePricingText, inferServiceTypeFromAppendix };
```

`services/ptt-crm-api/src/spc/spc-pricing.util.ts`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('../../../scripts/lib/spc-pricing-parse.js');

export const parseVndRange = lib.parseVndRange as (t: string) => { min_vnd: number; max_vnd: number };
export const parsePricingText = lib.parsePricingText as (t: string, st: string) => Record<string, unknown>;
export const inferServiceTypeFromAppendix = lib.inferServiceTypeFromAppendix as (t: string) => string;
```

Adjust require path if Jest root differs — alternative: duplicate minimal parser in TS only (prefer single JS source).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=spc-pricing.util.spec
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/spc-pricing-parse.js services/ptt-crm-api/src/spc/
git commit -m "feat(spc): add pricing text parser with unit tests"
```

---

### Task 3: Word doc → JSON bundle extract

**Files:**
- Create: `scripts/lib/spc-doc-section-parse.js`
- Create: `scripts/extract_spc_bundle_from_docx.js`
- Create: `docs/specs/spc-chuan-hoa-bundle.schema.json`
- Create: `docs/specs/spc-chuan-hoa-bundle.json` (generated, committed)

**Interfaces:**
- Consumes: `Chuan_hoa_Du_lieu_Van_hanh_PTT.docx` path via env `SPC_SOURCE_DOCX`
- Produces: bundle JSON `{ schema_version, families[21] }` each with `offers[3]`, `process_phases[]`, `kpi_defs[]`, `risks_vi[]`

- [ ] **Step 1: Implement section parser**

`scripts/lib/spc-doc-section-parse.js` — parse flat paragraph array:

- Detect DV section start: `/^3\.\d+ — (DV\d{2}):/`
- Parse `Bộ phận phụ trách:` → department, role_vi
- Block until `Bảng giá 3 gói` → collect description, depends_on (split `(DV\d{2})` regex)
- Parse pricing table rows after headers `Cơ bản|Tiêu chuẩn|Chuyên sâu`
- Parse weekly rows between `Quy trình triển khai` and `KPI cam kết`
- Parse KPI paragraph (comma-separated metrics)
- Parse risks after `Rủi ro cần lưu ý`

- [ ] **Step 2: Implement extract CLI**

`scripts/extract_spc_bundle_from_docx.js`:

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { extractParagraphsFromDocx } = require('./lib/spc-docx-read');
const { parseFamiliesFromParagraphs } = require('./lib/spc-doc-section-parse');
const { mergeAppendixA } = require('./lib/spc-appendix-merge');

const docx = process.env.SPC_SOURCE_DOCX
  || path.join(process.env.HOME, 'Downloads/Chuan_hoa_Du_lieu_Van_hanh_PTT.docx');
const out = process.argv[2]
  || path.join(__dirname, '../docs/specs/spc-chuan-hoa-bundle.json');

const paras = extractParagraphsFromDocx(docx);
let families = parseFamiliesFromParagraphs(paras);
families = mergeAppendixA(families, paras); // service_type, duration from Phụ lục A

if (families.length !== 21) {
  console.error(`Expected 21 families, got ${families.length}`);
  process.exit(1);
}
for (const f of families) {
  if ((f.offers || []).length !== 3) {
    console.error(`${f.dv_code}: expected 3 offers, got ${(f.offers || []).length}`);
    process.exit(1);
  }
}

const bundle = {
  schema_version: '1.0.0',
  source_doc: path.basename(docx),
  generated_at: new Date().toISOString().slice(0, 10),
  families,
};
fs.writeFileSync(out, JSON.stringify(bundle, null, 2) + '\n');
console.log(`Wrote ${out} (${families.length} families)`);
```

Add `scripts/lib/spc-docx-read.js` — reuse zip/xml extract (same as probe script).

Add `scripts/lib/spc-appendix-merge.js` — parse Phụ lục A table rows `DV01`…`DV21` for `service_type`, `price_range_vi`, `duration_hint_vi`.

- [ ] **Step 3: Add JSON schema**

`docs/specs/spc-chuan-hoa-bundle.schema.json` — require `families[].dv_code`, `offers[].tier` enum CB|TC|CS.

- [ ] **Step 4: Run extract and commit bundle**

```bash
cd /Users/quoctuan/Documents/CursorAI/RNOSAI
SPC_SOURCE_DOCX=/Users/quoctuan/Downloads/Chuan_hoa_Du_lieu_Van_hanh_PTT.docx \
  node scripts/extract_spc_bundle_from_docx.js
node -e "const b=require('./docs/specs/spc-chuan-hoa-bundle.json'); console.log(b.families.length, b.families[0].dv_code)"
```

Expected: `21 DV01` (or first code DV01).

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_spc_bundle_from_docx.js scripts/lib/spc-doc*.js scripts/lib/spc-appendix-merge.js docs/specs/spc-chuan-hoa-bundle.json docs/specs/spc-chuan-hoa-bundle.schema.json
git commit -m "feat(spc): extract Chuan_hoa docx to spc-chuan-hoa-bundle.json"
```

---

### Task 4: Seed script — upsert SPC tables

**Files:**
- Create: `scripts/seed_spc_catalog.js`
- Modify: `scripts/deploy_ops_dv_staging.sh` (optional comment hook for SPC after ops seed)

**Interfaces:**
- Consumes: `docs/specs/spc-chuan-hoa-bundle.json`, `docs/specs/ops-dv01-dv21-route-map.json`, `scripts/lib/spc-pricing-parse.js`, `ensureSpcSchema`
- Produces: populated PG tables; `spc_publish_log` row `entity_type=import`, `action=seed_s1`

- [ ] **Step 1: Implement seed main loop**

`scripts/seed_spc_catalog.js`:

```javascript
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
if (!databaseUrl) { console.error('DATABASE_URL required'); process.exit(1); }

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const routeMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const routeByCode = Object.fromEntries(routeMap.services.map((s) => [s.code, s]));

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
      f.dv_code, f.name_vi, f.department, f.role_vi, f.service_type, f.description_vi,
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
    [sku, f.dv_code, offer.tier, offer.label_vi || offer.tier, offer.scope_summary_vi || '', JSON.stringify(pricing), f.duration_hint_vi || ''],
  );
  // scope line L01 = scope_summary
  await client.query(
    `INSERT INTO service_offer_line (line_code, sku_code, label_vi, description_vi, sort_order)
     VALUES ($1,$2,$3,$4,1)
     ON CONFLICT (line_code) DO UPDATE SET label_vi=EXCLUDED.label_vi, description_vi=EXCLUDED.description_vi`,
    [`${sku}-L01`, sku, offer.scope_summary_vi || offer.label_vi, offer.scope_summary_vi || ''],
  );
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
        code, f.dv_code, ph.week_label_vi, ph.ptt_work_vi, ph.deliverable_vi, ph.client_action_vi,
        JSON.stringify(ph.tasks || [{ title: ph.ptt_work_vi }]), ph.sort_order ?? n,
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
    // default SKU = TC for CRM slug
    await client.query(
      `UPDATE crm_catalog_services SET default_sku_code=$2 WHERE dv_code=$1`,
      [f.dv_code, `${f.dv_code}-TC`],
    );
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

main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `chmod +x scripts/seed_spc_catalog.js`

- [ ] **Step 2: Run seed on local PG**

```bash
export DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb
node scripts/seed_spc_catalog.js
```

Expected: `OK seed_spc { families: 21, offers: 63, phases: >0, kpis: >0 }`

- [ ] **Step 3: Idempotency check**

Run `node scripts/seed_spc_catalog.js` again — same counts, no error.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed_spc_catalog.js
git commit -m "feat(spc): seed service product catalog from chuan_hoa bundle"
```

---

### Task 5: S1 gate script + docs

**Files:**
- Create: `scripts/spc_s1_gate.sh`
- Modify: `docs/specs/2026-08-12-service-product-catalog-spc-admin-a-design.md` — add link to this plan (optional one line)

**Interfaces:**
- Consumes: seeded DB
- Produces: exit 0 + `PASS spc_s1_gate`

- [ ] **Step 1: Implement gate**

`scripts/spc_s1_gate.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"

pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS  $1"; }
bad() { fail=$((fail+1)); echo "FAIL  $1"; }

echo "== SPC S1 gate =="

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_family")
[[ "$c" == "21" ]] && ok "21 service_family" || bad "service_family=$c want 21"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_offer")
[[ "$c" == "63" ]] && ok "63 service_offer" || bad "service_offer=$c want 63"

c=$(psql "$DATABASE_URL" -tAc "SELECT pricing_model->>'type' FROM service_offer WHERE sku_code='DV02-CB'")
[[ "$c" == "setup_plus_retainer" ]] && ok "DV02-CB pricing model" || bad "DV02-CB type=$c"

c=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM service_process_phase WHERE dv_code='DV02'")
[[ "$c" -ge 2 ]] && ok "DV02 process phases" || bad "DV02 phases=$c"

if [[ "$fail" -eq 0 ]]; then
  echo "PASS spc_s1_gate ($pass checks)"
  exit 0
fi
echo "FAIL spc_s1_gate ($fail failures)"
exit 1
```

- [ ] **Step 2: Document runbook one-liner**

Add to plan footer or `docs/huong-dan-su-dung/` snippet (in commit message body only if no doc request):

```bash
# S1 full pipeline
bash scripts/apply_pg_ddl_spc.sh
node scripts/seed_spc_catalog.js
bash scripts/spc_s1_gate.sh
```

Regen bundle when doc updates:

```bash
SPC_SOURCE_DOCX=/path/to/Chuan_hoa_Du_lieu_Van_hanh_PTT.docx node scripts/extract_spc_bundle_from_docx.js
```

- [ ] **Step 3: Run full pipeline**

```bash
bash scripts/apply_pg_ddl_spc.sh
node scripts/seed_spc_catalog.js
bash scripts/spc_s1_gate.sh
```

Expected: `PASS spc_s1_gate`

- [ ] **Step 4: Commit**

```bash
git add scripts/spc_s1_gate.sh
git commit -m "chore(spc): add S1 gate script for catalog seed verification"
```

---

### Task 6: Sync legacy `ops_service_profile.tier_pricing` (optional S1.1)

**Files:**
- Modify: `scripts/seed_spc_catalog.js` — add function `syncOpsProfileTierPricing(client)`

**Scope:** Keep Quote Builder working before S3 API changes.

- [ ] **Step 1: After offer upsert, write legacy tier_pricing**

For each `dv_code`, build:

```javascript
const legacy = {
  basic: offerByTier.CB.pricing_model mapped to { price_vnd: monthly_min or min_vnd },
  standard: ...,
  premium: ...,
};
await client.query(
  `UPDATE ops_service_profile SET tier_pricing=$2::jsonb, updated_at=NOW() WHERE dv_code=$1`,
  [dvCode, JSON.stringify(legacy)],
);
```

Skip DV without `ops_service_profile` row (log warn).

- [ ] **Step 2: Gate check legacy row**

Add to `spc_s1_gate.sh`:

```bash
c=$(psql "$DATABASE_URL" -tAc "SELECT tier_pricing->'standard' IS NOT NULL FROM ops_service_profile WHERE dv_code='DV02'")
[[ "$c" == "t" ]] && ok "DV02 ops tier_pricing synced" || bad "DV02 tier_pricing missing"
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(spc): sync ops_service_profile tier_pricing from SPC offers"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| DDL §5.1 all tables | Task 1 |
| `service_lifecycle.sku_code` | Task 1 |
| 21 families + 63 SKU | Tasks 3–4, gate Task 5 |
| Pricing models §4.2 | Task 2, 4 |
| Process phases L3 | Tasks 3–4 |
| KPI defs | Tasks 3–4 |
| `tmmt_blueprint` schema only (empty S1) | Task 1 |
| Import from Word doc | Task 3 |
| AC-01 DV02 3 gói setup+retainer | Tasks 2, 5 |
| AC-06 legacy ops catalog untouched | Task 6 optional |
| Admin A / API | **Out of scope S2** |

No TBD placeholders in executable steps.

---

## Out of scope (S2+)

- `/admin/services/*` UI
- `/api/spc/*` REST
- Publish workflow draft → IT
- TMMT blueprint content
- Quote Builder SKU integration

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-spc-s1-ddl-import-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement all tasks in this session with checkpoints after Task 2 (parser tests) and Task 5 (gate PASS)

Which approach?
