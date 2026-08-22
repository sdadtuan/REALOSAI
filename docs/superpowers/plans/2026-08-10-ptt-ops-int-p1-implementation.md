# INT-P1 — Ops-M1 + M2 Implementation Plan

> **Goal:** Spawn checklist tuần idempotent + KPI record với nhãn Đạt/Cần chú ý/Không đạt (BR-OPS-KPI-01) trên pilot DV02/DV04/DV05/DV20.

**Spec:** [`docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) §3.2.3, §4.3–4.4

---

## Scope

| WS | Deliverable | Exit |
|----|-------------|------|
| **WS-P1-01** | KPI label util + weekly template flatten | Unit tests PASS |
| **WS-P1-02** | `ops_weekly_*` + `ops_kpi_record` repositories | DDL bootstrap idempotent |
| **WS-P1-03** | API spawn-week, weekly PATCH, KPI GET/PUT/compute | Nest build PASS |
| **WS-P1-04** | Hub enrichment (weekly items + KPI metrics) | Hub JSON populated |
| **WS-P1-05** | Pilot seed JSON (4 DV templates + KPI defs) | Seed upserts templates |
| **WS-P1-06** | FE OpsWeeklyPanel + OpsKpiPanel | Tab ops-hub interactive |
| **WS-P1-07** | Smoke + deploy flag `PTT_OPS_WEEKLY_SPAWN=1` | smoke PASS |

---

## API (prefix `api/ops`)

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/lifecycle/:id/spawn-week` | write | Sinh checklist tuần hiện tại (idempotent) |
| GET | `/lifecycle/:id/weekly?iso_week=` | view | List checklist items |
| PATCH | `/lifecycle/:id/weekly/:itemId` | write | Cập nhật status pending/done/skipped |
| GET | `/lifecycle/:id/kpi?period_type=&period_key=` | view | Metrics + nhãn |
| PUT | `/lifecycle/:id/kpi` | write | Upsert actual → auto label |
| POST | `/lifecycle/:id/kpi/compute-labels` | write | Recompute nhãn |

---

## Business rules

- **BR-OPS-02:** Spawn chỉ khi `status ∈ {active, in_progress}` và `stage ∈ {onboard, deliver, handover, retain}`.
- **BR-OPS-03:** Idempotent qua `ops_weekly_spawn_log (lifecycle_id, iso_week)`.
- **BR-OPS-KPI-01:** Đạt ≥100%, Cần chú ý 70–99%, Không đạt <70%.

---

## Env flags

```
PTT_OPS_DV_ENABLED=1
PTT_OPS_WEEKLY_SPAWN=1
PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20
NEXT_PUBLIC_OPS_DV=1
```

---

## Pilot seed

File: [`docs/specs/ops-dv-pilot-weekly-kpi-seed.json`](../../specs/ops-dv-pilot-weekly-kpi-seed.json)

Re-seed staging: `node scripts/seed_ops_dv_catalog.js`

---

## Smoke

```bash
STAFF_TOKEN=... LIFECYCLE_ID=... SPAWN=1 bash scripts/smoke_ops_dv_hub.sh
```

Lifecycle phải: slug map DV pilot, `status=active`, `stage=deliver|onboard`.

---

## Out of scope (INT-P2+)

- Kanban task board (`/crm/ops/tasks`)
- Auto-spawn on lifecycle stage transition
- Engine metric import (Content OS → KPI)
- Cron Monday 06:00 VN
