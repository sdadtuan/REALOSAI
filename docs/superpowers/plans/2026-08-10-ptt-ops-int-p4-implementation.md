# INT-P4 — Portal khách hàng (Ops lifecycle KPI)

> **Goal:** Client portal read-only view of service delivery progress — weekly checklist % and KPI labels — scoped by portal JWT.

**Spec:** [`docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) §10 G4

---

## Scope

| WS | Deliverable | Exit |
|----|-------------|------|
| **WS-P4-01** | `portal-ops` Nest module | Build PASS |
| **WS-P4-02** | Portal JWT lifecycle guard + pilot DV filter | 403 on mismatch |
| **WS-P4-03** | `OpsDvSummaryCard` on portal dashboard | FE build PASS |
| **WS-P4-04** | `/service-delivery` portal page | KPI table |
| **WS-P4-05** | Smoke + deploy flags | smoke PASS |

---

## API (prefix `api/v1/portal/ops`)

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/linked` | portal JWT | Primary lifecycle mapped to pilot DV |
| GET | `/lifecycle/:id/summary` | portal JWT | Weekly % + KPI labels (no alerts/staff data) |

---

## Client-safe payload

- DV code/name, stage, package tier
- Weekly: spawned, done/total, progress %
- KPI: overall label + per-metric label + progress %
- **Không** expose: alert log, task titles nội bộ, AM notes

---

## Env flags

```
PTT_OPS_DV_ENABLED=1
PTT_OPS_PORTAL_SUMMARY=1
NEXT_PUBLIC_OPS_PORTAL_SUMMARY=1
PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20
```

---

## FE routes (portal-web)

| Route | Mô tả |
|-------|-------|
| `/dashboard` | `OpsDvSummaryCard` |
| `/service-delivery` | Chi tiết KPI + tiến độ tuần |

---

## Smoke

```bash
PORTAL_TOKEN=... LIFECYCLE_ID=... bash scripts/smoke_ops_portal_summary.sh
```

Portal client phải map `agency_client_id` với lifecycle slug thuộc pilot DV.

---

## Out of scope

- Client approve/reject ops tasks
- Branded PDF export
- L3 RAG chat
