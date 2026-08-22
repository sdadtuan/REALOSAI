# PTT Ops DV01–DV21 — Phase 0 Implementation Plan

**Date:** 2026-08-10  
**Design:** `docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md`  
**Integration:** `docs/specs/2026-08-10-ptt-ops-dv-integration-spec.md`  
**Status tracking:** `docs/superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md`

---

## Summary

Triển khai **Ops Layer MVP** trong 4 milestone (Ops-M0 → Ops-M3), pilot 4 DV (DV02, DV04, DV05, DV20). Mỗi milestone có deliverable deployable + smoke.

**Effort estimate:** ~5–8 dev-days (1 dev), assuming RNOSAI familiarity.

---

## Milestone Ops-M0 — Foundation (catalog + hub read-only)

> **Coding execution (task-by-task):** [`2026-08-10-ptt-ops-dv-ops-m0-milestone.md`](./2026-08-10-ptt-ops-dv-ops-m0-milestone.md) — WS-OPS-00…06.

**Goal:** API catalog + hub payload; FE hub page read-only; seed 21 DV.

### Backend

| Task | Files | Notes |
|------|-------|-------|
| Ops module scaffold | `src/ops/ops.module.ts`, `ops.controller.ts`, `ops.service.ts` | Register in `app.module.ts` |
| Route map loader | `ops-route-map.loader.ts` | Load JSON at startup; validate 21 entries |
| Slug resolver | `ops-slug-resolver.util.ts` | primary + alias + legacy |
| Profile repository | `ops-profile-pg.repository.ts` | Bootstrap DDL from integration DDL |
| GET catalog | `GET /api/ops/catalog`, `GET /api/ops/catalog/:dvCode` | |
| GET hub | `GET /api/ops/lifecycle/:id/hub` | Join lifecycle + profile + flags |
| Extend VALID_SLUGS | `service-lifecycle.types.ts` | Add pilot slugs: `tiep-thi-noi-dung`, `email-marketing`, … |
| Seed script | `scripts/seed_ops_dv_catalog.ts` | Idempotent upsert |

### Frontend

| Task | Files |
|------|-------|
| API client | `ops-web/src/lib/ops-dv-api.ts` |
| Hub page | `ops-web/src/pages/service-delivery/OpsServiceHubPage.tsx` |
| Components | `components/ops/OpsHubHeader.tsx`, `OpsEngineGrid.tsx` |
| Tab link | `ServiceDeliveryDetail` — tab Ops Hub |
| Feature flag | Hide when `ops_dv_enabled` false from API |

### Verification

- [ ] Unit: slug resolver (≥8 cases)
- [ ] Unit: route map validation
- [ ] `npm run build` ops-web + ptt-crm-api
- [ ] Manual: hub loads for `seo-retainer` lifecycle staging

**Deploy:** `PTT_OPS_DV_ENABLED=1` staging only.

---

## Milestone Ops-M1 — Weekly spawn + checklist UI

**Goal:** Idempotent weekly task spawn; UI progress + manual trigger.

### Backend

| Task | Notes |
|------|-------|
| `ops_weekly_spawn_log` table | DDL |
| `POST /api/ops/lifecycle/:id/spawn-week` | Map template → SOP tasks or checklist |
| Template schema | Validate `weekly_process_template` JSON |
| Cron job | `@Cron('0 6 * * 1')` gated by `PTT_OPS_WEEKLY_SPAWN` |

**Decision OD-1:** Phase 0 implement lifecycle `metadata.weekly_checklist[]` if SOP binding not ready; refactor to SOP in M2.

### Frontend

| Task | Notes |
|------|-------|
| `OpsWeeklyPanel` | List tasks, progress bar |
| `OpsSpawnWeekButton` | POST spawn; toast result |
| Permissions | Disable button without configure role |

### Verification

- [ ] Unit: idempotency same iso_week
- [ ] Unit: inactive lifecycle → 400
- [ ] Smoke: spawn twice → second skip

---

## Milestone Ops-M2 — KPI records + dashboard widgets

**Goal:** Manual KPI write; hub summary; optional KPI dashboard slice.

### Backend

| Task | Notes |
|------|-------|
| `ops_kpi_record` table | DDL |
| GET/PUT KPI endpoints | Per integration spec |
| Target resolution | From profile tier + `kpi_definitions` |

### Frontend

| Task | Notes |
|------|-------|
| `OpsKpiSummary` | Table actual/target |
| KPI edit modal | Manual entry for partial DV |
| Dashboard widget (optional) | Ops KPI rollup card on main dashboard |

### Verification

- [ ] Unit: KPI upsert merge metrics
- [ ] Hub KPI section populated after PUT

---

## Milestone Ops-M3 — Tier + quotes hook (stretch)

**Goal:** `package_tier` on lifecycle; quote line suggests tier pricing from profile.

### Backend

- PATCH lifecycle `package_tier`
- `GET /api/ops/catalog/:dvCode/pricing?tier=standard`
- Optional: CRM quote module reads tier for line items

### Frontend

- Tier selector on lifecycle create/edit
- Hub tier badge + tooltip deliverables

**Can defer** if quote module not ready — document in status.

---

## Pilot staging checklist

Before P0 sign-off:

1. [ ] Run `seed_ops_dv_catalog.ts` on staging DB
2. [ ] Create lifecycle `tiep-thi-noi-dung` (fix M16 smoke gap)
3. [ ] Set `PTT_OPS_DV_ENABLED=1`
4. [ ] Run `smoke_ops_dv_hub.sh` with documented `LIFECYCLE_ID`
5. [ ] Restart `ptt-crm-api` + ops-web on VPS

---

## File inventory (new)

```
services/ptt-crm-api/src/ops/
  ops.module.ts
  ops.controller.ts
  ops.service.ts
  ops-profile-pg.repository.ts
  ops-route-map.loader.ts
  ops-slug-resolver.util.ts
  ops.types.ts
  ops-weekly-spawn.service.ts
  ops-kpi.service.ts
  __tests__/ops-slug-resolver.spec.ts
  __tests__/ops-spawn.spec.ts

services/ops-web/src/
  lib/ops-dv-api.ts
  pages/service-delivery/OpsServiceHubPage.tsx
  components/ops/OpsHubHeader.tsx
  components/ops/OpsEngineGrid.tsx
  components/ops/OpsWeeklyPanel.tsx
  components/ops/OpsKpiSummary.tsx

scripts/
  seed_ops_dv_catalog.ts
  smoke_ops_dv_hub.sh

docs/specs/
  ops-dv01-dv21-route-map.json (existing)
  2026-08-10-postgresql-ddl-ptt-ops-dv.sql
  ops-staging-fixtures.md (after seed)
```

---

## Dependencies

| Depends on | Blocker? |
|------------|----------|
| `service_lifecycle` API | No — exists |
| Content OS context | No — DV02 |
| SOP module lifecycle binding | Soft — M1 fallback checklist |
| Route map JSON | No — exists |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Slug drift vs VALID_SLUGS | Single route map + seed script |
| Staging no `tiep-thi-noi-dung` | Pilot seed script |
| Weekly spawn duplicates | `ops_weekly_spawn_log` UNIQUE |
| Scope creep 21 DV engines | Hub `readiness` gates; stub gap DVs |

---

## Execution order (recommended)

```
Week 1: Ops-M0 (BE catalog/hub + FE hub read-only + seed)
Week 2: Ops-M1 (spawn + weekly UI)
Week 3: Ops-M2 (KPI) + smokes + staging pilot
Week 4: Ops-M3 optional + expand beyond P0 DV
```

---

## Done definition (Phase 0 complete)

- [ ] 4 pilot DV pass acceptance (integration spec §6)
- [ ] ≥20 automated tests ops module
- [ ] Smoke green on staging
- [ ] Implementation status doc ≥ Ops-M2 complete
- [ ] No regressions Content OS M16 smokes (after lifecycle seed)
