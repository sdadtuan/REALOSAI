# SPC S2 — Admin A UI + Publish API Implementation Plan

> **Status:** Implemented 2026-08-12

**Goal:** Ship Admin A workspace `/admin/services/*`, Nest `/api/spc/*` read + `/api/v1/admin/spc/*` write/publish, draft overlay so AM sees last published while PO edits.

**Architecture:** Nest `SpcModule` (PG repository + guards). Draft stored in `service_offer.draft_*` columns; publish merges to live + syncs `ops_service_profile.tier_pricing`. ops-web Admin group "Dịch vụ & Catalog".

**Exit criteria:** IT edits DV02-TC price in Admin UI → draft → publish → ops profile synced.

## Delivered

| Area | Files |
|------|-------|
| API read | `GET /api/spc/portfolio`, `families/:dv`, `offers/:sku` |
| API admin | `GET/PATCH /api/v1/admin/spc/*`, `POST publish`, `publish-log` |
| DDL | `draft_pricing_model`, `draft_scope_summary_vi` on `service_offer` |
| RBAC | `spc.view|edit|publish` + fallback `crm_data_config` |
| Admin UI | `/admin/services`, `portfolio`, `families/[dvCode]`, `publish` |
| Ops catalog | `GET /api/ops/catalog` enriched with `skus[]`; banner in ops-web |
| Gate | `scripts/spc_s2_gate.sh` |

## VPS deploy steps

```bash
cd /var/www/rnosai && git pull
bash scripts/apply_pg_ddl_spc.sh   # adds draft columns
# rebuild Nest + ops-web, restart systemd
bash scripts/spc_s2_gate.sh
```

## Out of scope (S3+)

- Quote catalog `/api/spc/quote-catalog`
- Process phase editor, TMMT blueprint UI
- Import doc bundle API
