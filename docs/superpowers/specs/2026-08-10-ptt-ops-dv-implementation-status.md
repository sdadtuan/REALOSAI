# PTT Ops DV01–DV21 — Implementation Status

**Last updated:** 2026-08-10  
**Overall:** ~85% — INT-P1/P2/P3 staging; INT-P4 Portal implemented locally  
**Plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-int-p4-implementation.md`

---

## Milestone summary

| Milestone | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **Spec** | Design + integration + DDL + route map | ✅ Done | |
| **Ops-M0** | Catalog + hub read-only | ✅ Done | Staging |
| **INT-P1** | Weekly spawn + KPI | ✅ Done | Staging |
| **INT-P2** | Quote Builder | ✅ Done | Staging |
| **INT-P3** | Ops Agent + dashboards | ✅ Done | Staging @ 0181782 |
| **INT-P4** | Portal lifecycle KPI | ✅ Done | local — chưa deploy |
| **INT-P2b** | AI suggest-quote | ⬜ Deferred | |
| **INT-P5** | L3 RAG chat | ⬜ Deferred | |

---

## Backend (ptt-crm-api)

| Component | Status |
|-----------|--------|
| Ops module (catalog, hub, spawn, KPI, alerts, dashboards) | ✅ |
| `portal-ops` module | ✅ |
| GET `/api/v1/portal/ops/linked` | ✅ |
| GET `/api/v1/portal/ops/lifecycle/:id/summary` | ✅ |
| Portal JWT + client lifecycle guard | ✅ |

---

## Frontend

| App | Component | Status |
|-----|-----------|--------|
| ops-web | Ops Hub, dashboards, alerts | ✅ staging |
| portal-web | `OpsDvSummaryCard` | ✅ |
| portal-web | `/service-delivery` | ✅ |
| portal-web | Dashboard card + nav | ✅ |

---

## Env (staging target)

| Flag | Value |
|------|-------|
| `PTT_OPS_DV_ENABLED` | `1` |
| `PTT_OPS_PORTAL_SUMMARY` | `1` (INT-P4) |
| `NEXT_PUBLIC_OPS_PORTAL_SUMMARY` | `1` |

Deploy: `APPLY=1 ./scripts/deploy_ops_dv_staging.sh`

Smoke: `PORTAL_TOKEN=... bash scripts/smoke_ops_portal_summary.sh`

---

## Next

- Deploy INT-P4 staging + portal smoke
- INT-P2b / INT-P5 AI layers
