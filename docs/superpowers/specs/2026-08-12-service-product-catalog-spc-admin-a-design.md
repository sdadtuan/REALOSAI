# Service Product Catalog (SPC) + Admin Control Plane A — Design Spec

> **Document ID:** SPC-ADMIN-A-20260812  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-12  
> **Trạng thái:** Design — chờ PO / Data Owner / IT sign-off  
> **Quyết định:** **SPC + Admin A** — Product Catalog Hub `/admin/services/*` + mô hình 5 tầng DV→SKU→Scope→Process→TMMT blueprint  
> **Supersedes:** [`2026-08-12-admin-service-catalog-approach-b-design.md`](./2026-08-12-admin-service-catalog-approach-b-design.md) (Hướng B — không triển khai)  
> **Nguồn nghiệp vụ:** `Chuan_hoa_Du_lieu_Van_hanh_PTT.docx` (Phần 2–3, Phụ lục A/B)  
> **Parent:** [`2026-08-11-admin-control-plane-ia.md`](../../specs/2026-08-11-admin-control-plane-ia.md) · [`2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) · [`ops-dv01-dv21-route-map.json`](../../specs/ops-dv01-dv21-route-map.json)

---

## Mục lục

1. [Executive summary](#1-executive-summary)
2. [Vấn đề & mục tiêu cạnh tranh](#2-vấn-đề--mục-tiêu-cạnh-tranh)
3. [Mô hình SPC — 5 tầng](#3-mô-hình-spc--5-tầng)
4. [Quy ước mã hoá (từ doc PTT)](#4-quy-ước-mã-hoá-từ-doc-ptt)
5. [Mô hình dữ liệu PostgreSQL](#5-mô-hình-dữ-liệu-postgresql)
6. [API — Service Catalog](#6-api--service-catalog)
7. [Admin Control Plane A — IA & UX](#7-admin-control-plane-a--ia--ux)
8. [Tích hợp runtime](#8-tích-hợp-runtime)
9. [RBAC & governance](#9-rbac--governance)
10. [Migration từ as-is](#10-migration-từ-as-is)
11. [Lộ trình S1–S5](#11-lộ-trình-s1s5)
12. [Acceptance criteria](#12-acceptance-criteria)
13. [Rủi ro & giảm thiểu](#13-rủi-ro--giảm-thiểu)
14. [Sign-off](#14-sign-off)
15. [Next step](#15-next-step)

---

## 1. Executive summary

Tài liệu **Chuẩn hoá Dữ liệu Vận hành PTT** định nghĩa **21 dịch vụ (DV01–DV21)**, mỗi DV có **3 gói thương mại** (`-CB`/`-TC`/`-CS`), **quy trình theo tuần** (`DVxx-Tn`), **KPI**, và **bảng giá** (one-time / setup+retainer / retainer). RNOSAI hiện chỉ có catalog **phẳng** (`ops_service_profile.tier_pricing` 3 key) và Admin **chưa có** workspace dịch vụ.

**SPC (Service Product Catalog)** là lớp dữ liệu mới: **Portfolio → Commercial SKU → Scope lines → Process phases → TMMT blueprint**, nạp từ doc PTT và quản lý qua **Admin A** (`/admin/services/*`).

**Luồng thắng đối thủ:**

```
Catalog SKU → Quote → Lifecycle (sku_code) → TMMT prefill/Apply → Ops spawn (DVxx-Tn) → KPI
```

> *Getfly/HubSpot có product catalog hoặc quote — RNOSAI khép kín **TMMT + Ops spawn + KPI agency** từ cùng một SPC.*

---

## 2. Vấn đề & mục tiêu cạnh tranh

### 2.1. As-is RNOSAI

| Thành phần | Hiện trạng | Thiếu so với doc PTT |
|------------|------------|----------------------|
| `ops-dv01-dv21-route-map.json` | 21 DV, slug, route | Không có SKU `-CB/-TC/-CS` |
| `ops_service_profile` | 1 row/DV, `tier_pricing` JSON | Giá phẳng; không setup+retainer |
| `/crm/ops/catalog` | Read-only AM | Không tree SKU |
| `/crm/catalog` | CRM slug CRUD | Không gắn SKU/DV đầy đủ |
| TMMT (L2) | AI Planner per lifecycle | Không blueprint theo SKU |
| Quote Builder | `getCatalogForQuote()` | Không line item từ scope |
| Admin `/admin` | Org, RBAC, Data… | **Không workspace Dịch vụ** |

### 2.2. Target capabilities

| # | Capability | Đối thủ thường thiếu |
|---|------------|----------------------|
| C1 | Tree **DV → 3 SKU/gói** với pricing model đa dạng | HubSpot có product; không gắn Ops DV21 |
| C2 | **Scope lines** trong gói → quote tự động | Getfly quote thủ công |
| C3 | **Process `DVxx-Tn`** spawn theo SKU đã chọn | Không có |
| C4 | **TMMT blueprint** inherit DV + override SKU | Không có |
| C5 | **Admin publish** + data owner quý (doc §Phụ lục C) | Git-only |
| C6 | Combo **Phụ lục B** trong catalog + quote | Rời rạc |

---

## 3. Mô hình SPC — 5 tầng

```
L0  service_family     DV01…DV21          Portfolio / family
L1  service_offer      DV02-TC            Commercial SKU (gói)
L2  service_offer_line DV02-TC-L03        Hạng mục phạm vi (quote line)
L3  service_process    DV02-T2            Giai đoạn tuần → spawn tasks
L4  tmmt_blueprint     @DV02 / @DV02-TC   Template TMMT (prefill L2)
```

### 3.1. L0 — `service_family` (DV)

Map 1:1 với entry trong `ops-dv01-dv21-route-map.json` + field doc Phần 3:

- `dv_code`, `name_vi`, `department`, `role_vi`, `depends_on_dv[]`
- `description_vi`, `risks_vi[]`, `readiness`, `service_type` (`one_time` | `setup_retainer` | `retainer`)
- Structural: `service_slugs`, `ops_web`, `nest_api` — **read-only từ route map** (git SSoT)

### 3.2. L1 — `service_offer` (SKU)

Mỗi DV **đúng 3 SKU** (doc §2.1):

| Tier code | Doc label | SKU example |
|-----------|-----------|-------------|
| `CB` | Cơ bản | `DV02-CB` |
| `TC` | Tiêu chuẩn | `DV02-TC` |
| `CS` | Chuyên sâu | `DV02-CS` |

Fields:

- `sku_code` PK (`DV02-TC`)
- `dv_code` FK
- `tier` enum `CB|TC|CS`
- `label_vi`, `scope_summary_vi`
- `pricing_model` JSON (xem §4.2)
- `duration_hint_vi` (vd *Setup 2–4 tuần, retainer liên tục*)
- `status` `draft|published|archived`
- `published_version` int

### 3.3. L2 — `service_offer_line` (scope lines)

Bullet **Phạm vi công việc** trong bảng giá doc → dòng có thể add vào Quote:

- `line_code` (`DV02-TC-L01`)
- `sku_code` FK
- `label_vi`, `description_vi`
- `included_by_default` boolean
- `sort_order`
- Optional: `unit` (`month` | `once` | `campaign`)

### 3.4. L3 — `service_process_phase`

Quy trình **Quy trình triển khai theo tuần** (doc):

- `phase_code` (`DV02-T1`) — unique
- `dv_code`, optional `sku_code` (null = áp dụng mọi gói; non-null = override gói CS thêm tuần)
- `week_label_vi` (vd *Tuần 1–2*, *Tháng 2+ retainer*)
- `ptt_work_vi`, `deliverable_vi`, `client_action_vi`
- `tasks_json` — checklist cho `spawn-week`
- `sort_order`

### 3.5. L4 — `tmmt_blueprint`

Template **L2 TMMT** (không thay instance lifecycle):

- `blueprint_id`, `dv_code`, `sku_code` (nullable = default DV)
- `version`, `status` `draft|published`
- `brief_json`, `strategy_json`, `campaign_json`, `kpi_tree_json` (subset TMMT wizard)
- `quality_rubric` — ngưỡng prefill/apply (align `TMMT_PREFILL_TARGET_SCORE=80`, apply ≥60)

**Quy tắc:**

- Instance TMMT trên lifecycle = **copy-on-apply** từ blueprint; sửa instance không sửa catalog.
- Prefill: `resolveBlueprint(dv_code, sku_code)` → merge L1 R5 nếu có (`l1-consult-bridge`).

### 3.6. TMMT 3 lớp (RNOSAI — không trộn)

| Lớp | Tên | Catalog SPC | Runtime |
|-----|-----|-------------|---------|
| L1 | R5 / KH MKT sơ bộ | Không | `presales marketing-plan` |
| L2 | TMMT chính thức | **L4 blueprint** | AI Planner Apply |
| L3 | Ops execution | **L3 process** | spawn-week, KPI |

---

## 4. Quy ước mã hoá (từ doc PTT)

### 4.1. Mã (doc §2.1)

| Loại | Pattern | Ví dụ |
|------|---------|-------|
| Dịch vụ | `DV01`–`DV21` | `DV05` |
| Gói | `<DV>-CB\|TC\|CS` | `DV08-TC` |
| Giai đoạn | `<DV>-T<n>` | `DV03-T1` |
| Scope line | `<SKU>-L<nn>` | `DV02-TC-L02` |

### 4.2. Pricing models

Doc §2.4: giá **tham khảo**, chưa VAT, chưa media spend — Quote AM điều chỉnh scope.

```typescript
type PricingModel =
  | {
      type: 'one_time';
      min_vnd: number;
      max_vnd: number;
      typical_vnd?: number;
      duration_weeks?: string; // "3-4"
    }
  | {
      type: 'retainer';
      monthly_min_vnd: number;
      monthly_max_vnd: number;
      note_vi?: string;
    }
  | {
      type: 'setup_plus_retainer';
      setup_min_vnd: number;
      setup_max_vnd: number;
      monthly_min_vnd: number;
      monthly_max_vnd: number;
    }
  | {
      type: 'percent_of_ad_spend';
      min_fee_vnd: number;
      rate_pct: number;
      note_vi?: string;
    };
```

**Mapping tier legacy:** `CB→basic`, `TC→standard`, `CS→premium` (backward compat `ops_service_profile.tier_pricing`).

### 4.3. KPI ngưỡng (doc §2.3)

Global defaults (đã có trong route map `kpi_thresholds_default`):

| Nhãn | Điều kiện | Hành động |
|------|-----------|-----------|
| Đạt | ≥100% target | Ghi nhận |
| Cần chú ý | 70–99% | Alert Team Lead |
| Không đạt | <70% | Alert AM + TL, KHắc phục 48h |

`service_kpi_def` có thể override ngưỡng per KPI; mặc định inherit global.

---

## 5. Mô hình dữ liệu PostgreSQL

File DDL mới: `docs/specs/2026-08-12-postgresql-ddl-spc.sql` (implement phase S1).

### 5.1. Bảng mới

```sql
-- L0: extend metadata (or join ops_service_profile)
CREATE TABLE service_family (
  dv_code VARCHAR(8) PRIMARY KEY,
  name_vi VARCHAR(200) NOT NULL,
  department VARCHAR(80) NOT NULL DEFAULT '',
  role_vi TEXT NOT NULL DEFAULT '',
  service_type VARCHAR(20) NOT NULL DEFAULT 'setup_retainer'
    CHECK (service_type IN ('one_time','setup_retainer','retainer','hybrid')),
  description_vi TEXT NOT NULL DEFAULT '',
  risks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  depends_on_dv JSONB NOT NULL DEFAULT '[]'::jsonb,
  readiness VARCHAR(20) NOT NULL DEFAULT 'partial',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- L1
CREATE TABLE service_offer (
  sku_code VARCHAR(16) PRIMARY KEY,  -- DV02-TC
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  tier VARCHAR(2) NOT NULL CHECK (tier IN ('CB','TC','CS')),
  label_vi VARCHAR(200) NOT NULL,
  scope_summary_vi TEXT NOT NULL DEFAULT '',
  pricing_model JSONB NOT NULL,
  duration_hint_vi VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  published_version INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dv_code, tier)
);

-- L2
CREATE TABLE service_offer_line (
  line_code VARCHAR(24) PRIMARY KEY,
  sku_code VARCHAR(16) NOT NULL REFERENCES service_offer(sku_code),
  label_vi VARCHAR(200) NOT NULL,
  description_vi TEXT NOT NULL DEFAULT '',
  unit VARCHAR(20) NOT NULL DEFAULT 'once',
  included_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- L3
CREATE TABLE service_process_phase (
  phase_code VARCHAR(16) PRIMARY KEY,  -- DV02-T1
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  week_label_vi VARCHAR(80) NOT NULL,
  ptt_work_vi TEXT NOT NULL DEFAULT '',
  deliverable_vi TEXT NOT NULL DEFAULT '',
  client_action_vi TEXT NOT NULL DEFAULT '',
  tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- KPI defs (DV-level + optional SKU override)
CREATE TABLE service_kpi_def (
  id SERIAL PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  kpi_code VARCHAR(40) NOT NULL,
  label_vi VARCHAR(200) NOT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT '',
  target_hint_vi VARCHAR(120) NOT NULL DEFAULT '',
  thresholds_json JSONB NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (dv_code, sku_code, kpi_code)
);

-- L4 TMMT blueprint
CREATE TABLE tmmt_blueprint (
  id SERIAL PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  strategy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  campaign_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  kpi_tree_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NULL,
  published_by VARCHAR(80) NULL,
  UNIQUE (dv_code, sku_code, version)
);

-- Publish audit
CREATE TABLE spc_publish_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_key VARCHAR(40) NOT NULL,
  action VARCHAR(20) NOT NULL,
  from_version INT NULL,
  to_version INT NULL,
  actor_email VARCHAR(80) NOT NULL,
  diff_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2. Mở rộng bảng hiện có

```sql
ALTER TABLE service_lifecycle
  ADD COLUMN IF NOT EXISTS sku_code VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS package_tier VARCHAR(20) NULL;  -- basic|standard|premium legacy

ALTER TABLE crm_catalog_services
  ADD COLUMN IF NOT EXISTS default_sku_code VARCHAR(16) NULL;

-- ops_service_profile: retained as runtime cache; sync from service_family on publish
```

### 5.3. Quan hệ với route map

| Dữ liệu | SSoT | SPC Admin sửa |
|---------|------|---------------|
| slug, nest_api, ops_web | `ops-dv01-dv21-route-map.json` | ❌ Read-only UI |
| Giá, scope, process, TMMT template | PostgreSQL SPC | ✅ Publish workflow |
| Pilot flags | `deploy/runtime.env` | IT `/admin/environments` |

---

## 6. API — Service Catalog

Module Nest: `service-product-catalog/` (hoặc mở rộng `ops/`).

Base path: **`/api/v1/admin/spc`** (admin) + **`/api/spc`** (read published).

### 6.1. Read (published)

| Method | Path | Cap | Response |
|--------|------|-----|----------|
| GET | `/api/spc/portfolio` | `spc.view` | 21 DV summary |
| GET | `/api/spc/families/:dvCode` | `spc.view` | L0 + offers + phases summary |
| GET | `/api/spc/offers/:skuCode` | `spc.view` | L1 + lines + pricing |
| GET | `/api/spc/offers/:skuCode/process` | `spc.view` | L3 phases |
| GET | `/api/spc/offers/:skuCode/tmmt-blueprint` | `spc.view` | L4 published |
| GET | `/api/spc/quote-catalog` | `crm_proposals.view` | Quote Builder tree (replaces/enhances proposals catalog) |

### 6.2. Admin write

| Method | Path | Cap | Mô tả |
|--------|------|-----|-------|
| GET | `/api/v1/admin/spc/families` | `spc.view` | Include drafts |
| PATCH | `/api/v1/admin/spc/offers/:skuCode` | `spc.edit` | Draft edit |
| PUT | `/api/v1/admin/spc/offers/:skuCode/lines` | `spc.edit` | Replace lines |
| PUT | `/api/v1/admin/spc/process/:phaseCode` | `spc.edit` | Phase editor |
| PUT | `/api/v1/admin/spc/tmmt-blueprints/:id` | `spc.edit` | Blueprint draft |
| POST | `/api/v1/admin/spc/publish` | `spc.publish` | `{ entity, key }` → bump version + sync `ops_service_profile` |
| POST | `/api/v1/admin/spc/import/doc-bundle` | `spc.publish` | Import từ JSON extracted doc PTT |
| GET | `/api/v1/admin/spc/publish-log` | `spc.view` | Audit |

### 6.3. Backward compatibility

- `GET /api/ops/catalog` — **delegate** to SPC portfolio + merge route map (existing clients unchanged)
- `tier_pricing` in `ops_service_profile` — **generated** from `service_offer.pricing_model` on publish (legacy quote util)

---

## 7. Admin Control Plane A — IA & UX

### 7.1. Workspace mới trong `admin-nav.ts`

```text
Group: "Dịch vụ & Catalog" (id: services)
  /admin/services                    → Hub overview
  /admin/services/portfolio          → 21 DV grid
  /admin/services/offers             → Tree DV → SKU
  /admin/services/process            → Phase library
  /admin/services/tmmt-blueprints    → L4 templates
  /admin/services/slug-map           → CRM slug ↔ DV ↔ default SKU
  /admin/services/publish            → Publish queue + log
  /admin/services/import             → Nạp doc PTT / JSON
```

Entry cũ:

- `/crm/ops/catalog` — **read-only** (banner → Admin)
- `/crm/catalog` — tab CRM Lead only; link *"Quản lý DV/SKU → Admin"*

### 7.2. Màn hình chính

#### `/admin/services` — Hub

- Cards: 21 DV, % published SKU, pilot DV02/04/05/20
- Quick actions: Import doc, Publish pending, View ops catalog

#### `/admin/services/portfolio` — L0

- Table: Mã, Tên, Bộ phận, Loại hình, Readiness, 3 SKU status
- Row → `/admin/services/families/DV02`

#### `/admin/services/families/[dvCode]` — DV detail

Tabs:

| Tab | Nội dung | Edit |
|-----|----------|------|
| Tổng quan | Mô tả, vai trò, rủi ro, phụ thuộc (Phụ lục B graph) | `spc.edit` metadata |
| Gói (SKU) | 3 cards CB/TC/CS + pricing model form | `spc.edit` |
| Phạm vi | Scope lines per SKU | `spc.edit` |
| Quy trình | Phase list `DVxx-Tn` | `spc.edit` |
| KPI | KPI defs + ngưỡng | `spc.edit` |
| TMMT | Blueprint versions + diff | `spc.edit` |
| Kỹ thuật | Route map slugs, API (read-only) | — |

#### `/admin/services/publish`

- Draft changes summary
- **Publish** (IT `spc.publish`) / **Request review** (PO → IT queue — optional S2)

### 7.3. UX patterns

- `AdminPageShell` + left rail group **Dịch vụ & Catalog**
- Pricing form theo `pricing_model.type` (dynamic fields)
- Phase editor: table rows matching doc columns (Thời gian / PTT / Deliverable / KH)
- TMMT blueprint: JSON editor + preview wizard steps
- Fail-closed caps — no Save without `spc.edit`

---

## 8. Tích hợp runtime

### 8.1. Quote Builder

1. AM chọn **SKU** (`DV02-TC`) + optional lines
2. `ProposalsService` resolve `pricing_model` → line amounts (setup + monthly)
3. Combo warning từ `depends_on_dv` (Phụ lục B)
4. On quote → lifecycle: set `sku_code`, `package_tier`, `dv_code`

### 8.2. TMMT (L2)

1. `resolveBlueprint(lifecycle.dv_code, lifecycle.sku_code)`
2. `marketing-ai-tmmt-prefill.util` merge L1 R5 + blueprint brief
3. Apply TMMT unchanged (quality gate ≥60, audit `ai_agent_runs`)

### 8.3. Ops spawn (L3)

1. `resolveProcessPhases(dv_code, sku_code)` — SKU-specific phases override DV-default
2. `POST spawn-week` uses `tasks_json` from matching phase
3. KPI board loads `service_kpi_def` filtered by sku

### 8.4. CRM intake slug

- `crm_catalog_services.default_sku_code` — khi tạo presales từ slug, gợi ý SKU default (TC)

### 8.5. Pilot

- `PTT_OPS_HUB_PILOT_DV`, `PTT_MKT_AI_PILOT_ONLY` unchanged
- SPC publishes **full 21 DV**; runtime gates pilot DV only

---

## 9. RBAC & governance

### 9.1. Caps mới

| Cap | Persona | Quyền |
|-----|---------|-------|
| `spc.view` | AM, SP, PO, IT | Xem published + admin read |
| `spc.edit` | **Data owner** (PO/Ops) | Draft SKU, process, KPI, blueprint |
| `spc.publish` | **IT Admin** | Publish + import + sync ops profile |
| `crm_leads.configure` | Sales admin | CRM slug tab only |

Seed: Data owner position → `spc.edit`; IT → `spc.publish`.

### 9.2. Publish workflow (S2+)

```text
draft (PO edit) → pending_review → published (IT) → ops_service_profile sync
```

Mỗi publish → `spc_publish_log` + optional export JSON to git (backup).

### 9.3. Data owner (doc Phụ lục C)

- Rà soát **mỗi quý** — reminder trong Admin hub
- Import từ doc Word → `scripts/import_spc_from_chuan_hoa_doc.js` (S1)

---

## 10. Migration từ as-is

| Step | Action |
|------|--------|
| M1 | Apply DDL SPC tables |
| M2 | Import 21 DV from route map → `service_family` |
| M3 | Generate 63 SKU skeleton (CB/TC/CS) + pricing from doc extract |
| M4 | Map `ops_service_profile.tier_pricing` → `service_offer.pricing_model` |
| M5 | Pilot weekly/KPI seed → `service_process_phase` + `service_kpi_def` for DV02/04/05/20 |
| M6 | `GET /api/ops/catalog` delegate; deprecate flat tier seed over time |
| M7 | Ship Admin A UI S2 |

**Không breaking:** lifecycles without `sku_code` fall back to `package_tier` + DV resolver.

---

## 11. Lộ trình S1–S5

| Phase | Scope | Exit |
|-------|-------|------|
| **S1** | DDL + import script doc → 21 family + 63 SKU + pricing models | `npm run seed:spc` PASS |
| **S2** | Admin A: portfolio + offer editor + publish API | IT edit DV02-TC price in UI |
| **S3** | Quote catalog `/api/spc/quote-catalog` + lifecycle `sku_code` | Quote line from scope |
| **S4** | Process phases + spawn by SKU | spawn-week uses DV02-T1 tasks |
| **S5** | TMMT blueprint + prefill by SKU | Prefill score ≥80 from blueprint |

Parallel: `/crm/ops/catalog` read tree SKU (S2).

---

## 12. Acceptance criteria

| ID | Given | When | Then |
|----|-------|------|------|
| AC-01 | Doc DV02 bảng giá 3 gói | Import S1 | 3 SKU with `setup_plus_retainer` |
| AC-02 | IT publishes DV02-TC | AM opens Quote | Default lines + price range |
| AC-03 | Lifecycle sku=DV02-TC | Prefill TMMT | Blueprint merged; quality score logged |
| AC-04 | Lifecycle deliver + spawn | Ops hub | Tasks from DV02-T1 phase |
| AC-05 | PO without spc.publish | Save SKU | Draft only; AM sees last published |
| AC-06 | GET /api/ops/catalog | Legacy smoke | Still 21 services PASS |
| AC-07 | Pilot DV04 only | Non-pilot SKU | Hub/MKT-AI gate unchanged |

---

## 13. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|------------|
| 63 SKU + doc dài → import sai | Validation script + diff review before publish |
| Dual catalog confusion | Admin A single write; ops catalog read-only |
| TMMT blueprint vs instance | Copy-on-apply; blueprint version pinned on lifecycle |
| Route map vs SPC drift | Technical tab read-only; publish syncs ops profile only |
| Scope creep Admin B | B spec superseded — không implement |

---

## 14. Sign-off

| Role | Name | Date | OK |
|------|------|------|-----|
| PO / Product | | | ☐ |
| Data owner (PTT) | | | ☐ |
| IT Admin | | | ☐ |
| Engineering lead | | | ☐ |

---

## 15. Next step

1. PO / Data owner review spec này  
2. Invoke **writing-plans** → `docs/superpowers/plans/2026-08-12-spc-admin-a-implementation-plan.md`  
3. S1: DDL + `scripts/import_spc_from_chuan_hoa_doc.js` (extract từ Word/JSON)

**Related files (implement):**

- `docs/specs/2026-08-12-postgresql-ddl-spc.sql`
- `services/ptt-crm-api/src/service-product-catalog/*`
- `services/ops-web/src/app/admin/services/**`
- `services/ops-web/src/lib/admin/admin-nav.ts` — group `services`
