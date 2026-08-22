# PTT Ops DV01–DV21 — Integration Spec

**Date:** 2026-08-10  
**Version:** 1.0.0-draft  
**Design:** `docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md`  
**Route map:** `docs/specs/ops-dv01-dv21-route-map.json`  
**DDL:** `docs/specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql`

---

## 1. Overview

Spec này định nghĩa contract FE/BE cho **Ops Service Hub** — lớp điều phối 21 DV trên ops-web và Nest API `ptt-crm-api`.

**Base URLs:**

- API: `{CRM_API}/api/ops`
- FE: `{OPS_WEB}/service-delivery/:lifecycleId/ops`

---

## 2. Environment variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PTT_OPS_DV_ENABLED` | `0` | Bật module ops DV |
| `PTT_OPS_WEEKLY_SPAWN` | `0` | Cron spawn checklist |
| `PTT_OPS_HUB_PILOT_DV` | `DV02,DV05,DV04,DV20` | DV hiển thị engine links đầy đủ |
| `PTT_OPS_ROUTE_MAP_PATH` | `docs/specs/ops-dv01-dv21-route-map.json` | Server load path (dev); prod: bundled JSON |

---

## 3. REST API

### 3.1 GET `/api/ops/catalog`

Danh sách 21 dịch vụ cho dropdown / admin.

**Auth:** Staff catalog view

**Response 200:**

```json
{
  "schema_version": "1.0.0",
  "services": [
    {
      "dv_code": "DV02",
      "name": "Tiếp thị nội dung",
      "service_slug": "tiep-thi-noi-dung",
      "readiness": "ready",
      "package_tiers": ["basic", "standard", "premium"],
      "ops_web": {
        "hub_route": "/service-delivery/:lifecycleId/ops",
        "engine_routes": [
          { "label": "Content OS", "path": "/content-os", "query": { "lifecycleId": ":lifecycleId" } }
        ]
      }
    }
  ]
}
```

### 3.2 GET `/api/ops/catalog/:dvCode`

Chi tiết profile — weekly template, KPI defs, tier pricing.

**Response 200:** `{ "profile": { ... } }`  
**Response 404:** `{ "error": "dv_not_found" }`

### 3.3 GET `/api/ops/lifecycle/:lifecycleId/hub`

Payload chính cho Ops Hub UI.

**Auth:** Staff (lifecycle access)

**Response 200:**

```json
{
  "lifecycle": {
    "id": 42,
    "slug": "tiep-thi-noi-dung",
    "client_name": "Acme",
    "status": "active",
    "package_tier": "standard"
  },
  "dv": {
    "dv_code": "DV02",
    "name": "Tiếp thị nội dung",
    "readiness": "ready"
  },
  "engines": [
    {
      "id": "content-os",
      "label": "Content OS",
      "href": "/content-os?lifecycleId=42",
      "status": "ready",
      "badge": null
    }
  ],
  "weekly": {
    "iso_week": "2026-W32",
    "spawned": true,
    "tasks_pending": 3,
    "tasks_done": 5
  },
  "kpi": {
    "period_key": "2026-08",
    "metrics": [
      { "key": "posts_published", "label": "Bài đăng", "actual": 8, "target": 12 }
    ]
  },
  "flags": {
    "ops_dv_enabled": true,
    "weekly_spawn_enabled": false,
    "pilot_dv": true
  }
}
```

**Response 404:** lifecycle không tồn tại  
**Response 422:** `{ "error": "unknown_service_slug", "slug": "..." }` — slug chưa map DV

### 3.4 POST `/api/ops/lifecycle/:lifecycleId/spawn-week`

Sinh checklist tuần hiện tại.

**Auth:** Staff configure hoặc internal key

**Body (optional):**

```json
{
  "iso_week": "2026-W32",
  "force": false
}
```

**Response 201:**

```json
{
  "spawned": true,
  "iso_week": "2026-W32",
  "tasks_created": 7,
  "skipped_duplicate": false
}
```

**Response 200 (idempotent):**

```json
{
  "spawned": false,
  "iso_week": "2026-W32",
  "tasks_created": 0,
  "skipped_duplicate": true
}
```

**Errors:**

| HTTP | Code | Khi |
|------|------|-----|
| 400 | `lifecycle_inactive` | status không cho spawn |
| 404 | `profile_missing` | DV chưa có weekly template |

### 3.5 GET `/api/ops/lifecycle/:lifecycleId/kpi`

**Query:** `period_type=week|month`, `period_key=2026-W32`

**Response 200:** `{ "records": [ ... ] }`

### 3.6 PUT `/api/ops/lifecycle/:lifecycleId/kpi`

Ghi KPI thủ công (partial DV / gap).

**Body:**

```json
{
  "period_type": "month",
  "period_key": "2026-08",
  "metrics": {
    "posts_published": 8,
    "engagement_rate": 0.042
  },
  "source": "manual"
}
```

**Response 200:** `{ "record": { ... } }`

### 3.7 PATCH `/api/crm/service-lifecycle/:id` (extend)

Thêm field optional:

```json
{
  "package_tier": "standard",
  "metadata": {
    "dv_code": "DV02"
  }
}
```

Backward compatible — không bắt buộc Phase 0.

---

## 4. Slug resolver

**Module:** `ops-slug-resolver.util.ts`

```
resolveDvProfile(lifecycleSlug: string): OpsServiceProfile | null
```

Logic:

1. Exact match `service_slugs.primary` trong route map
2. Match alias trong `service_slugs.aliases`
3. Legacy map (`seo-retainer` → DV05, `meta-lead-gen` → DV04)
4. null → hub hiển thị generic CRM view + admin warning

---

## 5. ops-web UI

### 5.1 Routes

| Path | Component | Mô tả |
|------|-----------|-------|
| `/service-delivery/:id/ops` | `OpsServiceHubPage` | Hub chính |
| `/admin/ops/catalog` | `OpsCatalogAdminPage` | Admin DV profiles (Phase 1) |

### 5.2 OpsServiceHubPage

**Sections:**

1. **Header** — Client, DV name, tier badge, lifecycle status
2. **Engine grid** — Cards deep-link; disabled state cho `gap`
3. **Tuần này** — Checklist progress; nút "Sinh checklist" (permission)
4. **KPI tháng** — Mini table actual/target; link KPI module
5. **Playbook** — Link SOP / external doc từ route map

**Data:** `useOpsHub(lifecycleId)` → `GET /api/ops/lifecycle/:id/hub`

### 5.3 Navigation integration

Trong `ServiceDeliveryDetail` — tab **"Ops Hub"** (ẩn nếu `PTT_OPS_DV_ENABLED=0`).

Sidebar ops-web (optional Phase 1): không thêm top-level — Hub gắn lifecycle context.

### 5.4 Component tree

```
OpsServiceHubPage
├── OpsHubHeader
├── OpsEngineGrid
│   └── OpsEngineCard (href builder)
├── OpsWeeklyPanel
│   └── OpsSpawnWeekButton
└── OpsKpiSummary
```

### 5.5 API client (`ops-dv-api.ts`)

```typescript
export async function getOpsHub(lifecycleId: number): Promise<OpsHubPayload>
export async function postOpsSpawnWeek(lifecycleId: number, body?: SpawnWeekBody): Promise<SpawnWeekResult>
export async function getOpsCatalog(): Promise<OpsCatalogResponse>
export async function putOpsKpi(lifecycleId: number, body: KpiWriteBody): Promise<OpsKpiRecord>
```

Pattern: giống `content-os-api.ts` — `CmktApiError` style `OpsApiError` với `details`.

---

## 6. Pilot acceptance (P0)

### DV02 — Tiếp thị nội dung

- [ ] Lifecycle slug `tiep-thi-noi-dung` tồn tại staging
- [ ] Hub → Content OS link mở đúng `lifecycleId`
- [ ] Weekly spawn tạo ≥5 tasks từ template
- [ ] KPI `posts_published` ghi/đọc được

### DV05 — SEO

- [ ] Hub → SEO OS route
- [ ] Lifecycle `seo-retainer` smoke pass

### DV04 — Quảng cáo

- [ ] Hub hiển thị 2 cards Meta + Google
- [ ] readiness `partial` — badge "Manual KPI"

### DV20 — Email/Zalo

- [ ] Hub → Email OS
- [ ] KPI manual entry

---

## 7. Seed & migration

### 7.1 Catalog seed

Script: `scripts/seed_ops_dv_catalog.ts` — đọc route map JSON → upsert `ops_service_profile` + `crm_catalog_services.dv_code`.

### 7.2 Staging lifecycle

```bash
# Tạo lifecycle pilot Content OS
LIFECYCLE_SLUG=tiep-thi-noi-dung CLIENT_ID=... npm run seed:ops-pilot-lifecycle
```

Document `LIFECYCLE_ID` trong `docs/specs/ops-staging-fixtures.md` (tạo khi seed).

---

## 8. Smoke tests

**Script:** `scripts/smoke_ops_dv_hub.sh`

```bash
LIFECYCLE_ID=${LIFECYCLE_ID:-1} \
CRM_API=https://rs.pttads.vn/api \
./scripts/smoke_ops_dv_hub.sh
```

Assertions:

1. `GET /api/ops/catalog` → 21 services
2. `GET /api/ops/lifecycle/$LIFECYCLE_ID/hub` → 200, `dv.dv_code` present
3. `POST spawn-week` → 201 or idempotent 200
4. Engine href contains lifecycleId

---

## 9. Error handling UX

| API error | UI |
|-----------|-----|
| `unknown_service_slug` | Banner + link admin map slug |
| `lifecycle_inactive` | Disable spawn; explain status |
| `profile_missing` | Empty weekly panel + seed instruction |
| Network | Retry + offline toast |

---

## 10. Testing matrix

| Layer | Tests |
|-------|-------|
| BE unit | slug resolver, spawn idempotency, KPI upsert |
| BE e2e | hub endpoint with mock lifecycle |
| FE unit | href builder, tier badge |
| Smoke | staging 4 pilot DV |

Target: ≥20 tests ops module Phase 0.

---

**Implementation plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-dv-phase0-implementation.md`
