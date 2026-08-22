# PTT Ops DV01–DV21 — Design Spec

**Date:** 2026-08-10  
**Status:** Draft for implementation  
**Scope:** Chuẩn hóa 21 dịch vụ marketing (DV01–DV21) trên RNOSAI — không greenfield app  
**Source of truth (route map):** `docs/specs/ops-dv01-dv21-route-map.json`  
**Related:** SRS PTT Ops System v1.0, Thiết kế hệ thống v1.0, Chuẩn hóa dữ liệu v1.0

---

## 1. Executive summary

PTT Ops System trong tài liệu nghiệp vụ mô tả 5 module (Client/Service, Task/KPI, Finance/Quote, AI Ops, Dashboard) và 21 dịch vụ DV01–DV21. RNOSAI **đã có ~70–80% nền tảng** qua `service_lifecycle`, Content OS, SEO OS, Email OS, Ads, KPI, SOP, CRM catalog.

**Quyết định kiến trúc:** Mở rộng RNOSAI thành **Ops Layer** — một lớp orchestration + catalog + KPI chung, deep-link vào execution engine hiện có thay vì xây app riêng.

| Module SRS | RNOSAI mapping |
|------------|----------------|
| Client/Service | `crm_clients`, `service_lifecycle`, `crm_catalog_*` |
| Task/KPI | `service_lifecycle` stages, SOP tasks, `kpi` module, **mới:** `ops_kpi_record` |
| Finance/Quote | CRM quotes (partial), **gap:** tier pricing DV |
| AI Ops | Content OS, MKT-AI, SEO OS, Email OS, Ads engines |
| Dashboard | ops-web dashboards + **mới:** Ops Service Hub |

---

## 2. Goals & non-goals

### 2.1 Goals (MVP Ops Layer)

1. **Catalog DV01–DV21** — mỗi DV có `dv_code`, slug lifecycle, tier pricing, weekly process template, KPI definitions.
2. **Service Instance** — `service_lifecycle` = hợp đồng/dự án DV; gắn `package_tier` (basic/standard/premium).
3. **Deep-link router** — từ Service Delivery / lifecycle → đúng ops-web route theo slug (Content OS, SEO, Ads…).
4. **Weekly SOP spawn** — tuần mới tự sinh checklist từ `weekly_process_template` của DV (idempotent).
5. **KPI rollup** — ghi `ops_kpi_record` theo lifecycle + tuần/tháng; dashboard tổng hợp.
6. **Pilot P0** — DV02, DV04, DV05, DV20 (đủ engine + route map sẵn).

### 2.2 Non-goals (Phase 0–2)

- Billing/invoicing đầy đủ theo SRS Finance module.
- Portal khách hàng self-service.
- Thay thế CRM lead pipeline hiện có.
- Implement engine mới cho DV gap (DV06 CTV, DV14 KOL…) — chỉ stub + manual workflow.

---

## 3. Domain model

### 3.1 Entity relationship (logical)

```
crm_catalog_services (extended)
    └── ops_service_profile (1:1 by service_slug / dv_code)
            ├── weekly_process_template (JSONB)
            ├── kpi_definitions (JSONB)
            └── tier_pricing (JSONB)

service_lifecycle (extended)
    ├── package_tier: basic | standard | premium
    ├── ops_profile_slug → ops_service_profile
    └── deep_link_base → ops-web path

ops_kpi_record
    ├── lifecycle_id, dv_code, period_key
    └── metrics JSONB

ops_weekly_spawn_log (idempotency)
    └── lifecycle_id + iso_week
```

### 3.2 Mapping DV → lifecycle slug

Canonical mapping nằm trong `ops-dv01-dv21-route-map.json` → `service_slugs.primary`. Ví dụ:

| DV | Tên | Primary slug | Readiness |
|----|-----|--------------|-----------|
| DV02 | Tiếp thị nội dung | `tiep-thi-noi-dung` | ready |
| DV04 | Quảng cáo Meta/Google | `meta-lead-gen`, `google-ads` | partial |
| DV05 | SEO | `seo-retainer` | ready |
| DV20 | Email/Zalo | `email-marketing` | partial |

**VALID_SLUGS** hiện tại (`service-lifecycle.types.ts`) thiếu nhiều slug DV — Phase 0 bổ sung slug pilot + alias resolver.

### 3.3 Package tier

Theo SRS: **Basic / Standard / Premium** — ảnh hưởng:

- Số lượng deliverable/tuần (từ tier trong `ops_service_profile.tier_pricing`)
- KPI target multiplier (optional Phase 2)
- Feature flags trên execution engine (vd Content OS: số bài/tuần)

Lưu trên lifecycle: `metadata.package_tier` hoặc cột `package_tier VARCHAR(20)`.

---

## 4. Module design

### 4.1 Ops Service Catalog (`ops` module — Nest)

**Responsibility:** CRUD profile DV, public read cho ops-web, seed 21 DV từ route map.

**Tables:** `ops_service_profile` (mới), extend `crm_catalog_services` với `dv_code`.

**API prefix:** `/api/ops/services`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/catalog` | List 21 DV + readiness + routes |
| GET | `/catalog/:dvCode` | Chi tiết profile |
| GET | `/lifecycle/:id/hub` | Hub payload: stages, KPI, deep links, pending tasks |
| POST | `/lifecycle/:id/spawn-week` | Spawn SOP tuần hiện tại (internal/cron) |

### 4.2 Deep-link router (ops-web)

**Route:** `/service-delivery/:lifecycleId/ops` hoặc tab trong lifecycle detail.

**Behavior:**

1. `GET /api/ops/lifecycle/:id/hub` → `primary_slug`, `ops_web.routes[]`, `readiness`.
2. Render card grid: Content OS, SEO OS, KPI, SOP, Quotes…
3. `readiness: gap` → badge + link manual playbook (Notion/SOP doc).

**Config:** `ops-dv01-dv21-route-map.json` loaded server-side; không hardcode FE.

### 4.3 Weekly process spawn

**Input:** `ops_service_profile.weekly_process_template` — array `{ day, task, owner_role, kpi_key? }`.

**Output:** SOP tasks hoặc lifecycle checklist items (reuse SOP module nếu có `lifecycle_id` binding).

**Idempotency:** `ops_weekly_spawn_log (lifecycle_id, iso_week)` UNIQUE — skip nếu đã spawn.

**Trigger:** Cron Monday 06:00 VN + manual button "Sinh checklist tuần".

### 4.4 KPI records

**Input:** Manual entry ops-web, auto từ engine webhooks (Phase 2), import CSV.

**Schema:** `ops_kpi_record (lifecycle_id, dv_code, period_type, period_key, metrics_json, source)`.

**Dashboard:** Aggregate theo client, DV, staff; so sánh actual vs target từ profile.

### 4.5 Integration với execution engines

| Engine | Lifecycle binding | Context API |
|--------|-------------------|-------------|
| Content OS | `GET /content-marketing/context?lifecycleId=` | Đã có |
| SEO OS | `/seo-os/context` | Partial |
| Email OS | `/email-os/context` | Partial |
| Ads | Meta/Google modules | Partial |

**Contract:** Mọi engine nhận `lifecycleId`; Ops Hub không duplicate business logic — chỉ link + KPI tags.

---

## 5. Business rules

| ID | Rule |
|----|------|
| BR-OPS-01 | Mỗi `dv_code` map đúng một `primary_slug`; alias slug chỉ dùng cho legacy lifecycle. |
| BR-OPS-02 | Không spawn weekly tasks nếu lifecycle `status` ∉ `{active, in_progress}`. |
| BR-OPS-03 | Spawn tuần idempotent — không duplicate task cùng `template_task_id` trong cùng iso_week. |
| BR-OPS-04 | Hub deep-link chỉ enable route khi `readiness ∈ {ready, partial}`; `gap` → documentation link. |
| BR-OPS-05 | `package_tier` default `standard` khi tạo lifecycle nếu không specified. |
| BR-OPS-06 | KPI target lấy từ profile tier; missing target → dashboard hiển thị "—" không fail. |
| BR-OPS-07 | Staff scope (`crm_staff_assign_scope`) filter catalog/hub theo `service_slug`. |

---

## 6. Readiness & phasing

### 6.1 Readiness classes (from route map)

- **ready (7):** Engine + route + API context tồn tại — Hub link trực tiếp.
- **partial (9):** Một phần — Hub link + manual SOP/KPI.
- **gap (5):** Stub catalog entry; checklist manual; không auto engine.

### 6.2 Pilot P0 (implementation first)

1. **DV02** — Content OS (`tiep-thi-noi-dung`) — cần seed lifecycle staging.
2. **DV05** — SEO (`seo-retainer`) — đã có trên staging.
3. **DV04** — Ads slugs — hub aggregate Meta + Google routes.
4. **DV20** — Email/Zalo — hub + KPI manual.

### 6.3 Phase roadmap

| Phase | Scope |
|-------|--------|
| **Ops-M0** | DDL, seed catalog, VALID_SLUGS, hub read-only |
| **Ops-M1** | Weekly spawn + ops-web hub UI |
| **Ops-M2** | KPI records + dashboard widgets |
| **Ops-M3** | Tier pricing on quotes + engine quotas |
| **Ops-M4** | Remaining DV partial/gap playbooks |

---

## 7. Security & RBAC

- Reuse `StaffOrInternalKeyGuard` + staff scopes.
- `/api/ops/*` — view: all staff with catalog view; configure: admin/catalog configure guard.
- Spawn cron: internal API key `X-Internal-Key`.
- Hub payload không expose PII client beyond existing CRM permissions.

---

## 8. Observability

- Log: `ops.spawn.week`, `ops.hub.load`, `ops.kpi.write`
- Metrics: spawn success/fail, hub latency, KPI records/week
- Smoke: `scripts/smoke_ops_dv_hub.sh` — lifecycle known slug → hub 200 + deep links

---

## 9. Open decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| OD-1 | SOP vs lifecycle checklist for weekly tasks | Reuse SOP module if lifecycle binding exists; else checklist JSON on lifecycle |
| OD-2 | Single table vs extend catalog | `ops_service_profile` separate + FK `service_slug` |
| OD-3 | `tiep-thi-noi-dung` staging seed | Seed script + doc `LIFECYCLE_ID` for smokes |
| OD-4 | DV04 dual slug | Hub shows 2 cards (Meta, Google) under one DV04 profile |

---

## 10. Acceptance criteria (design)

- [ ] Route map JSON validated against 21 DV entries.
- [ ] DDL reviewed against existing `crm_catalog_services` bootstrap.
- [ ] Pilot 4 DV có acceptance trong integration spec.
- [ ] No duplicate execution logic in Ops module.

---

**Next:** `docs/specs/2026-08-10-ptt-ops-dv-integration-spec.md`, `docs/superpowers/plans/2026-08-10-ptt-ops-dv-phase0-implementation.md`
