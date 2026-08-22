# SPC S6d — Component publish workflow + bundle price audit

**Date:** 2026-08-12  
**Depends on:** S6c (quote-catalog components + linked offer lines)

## Goal

1. Mirror offer draft/publish for `service_component` (pricing + text overlays).
2. Expose bundle price audit: compare SKU `pricing_model` vs sum of included component prices.
3. Gate: `scripts/spc_s6d_gate.sh`

## DDL

Append to `docs/specs/2026-08-12-postgresql-ddl-spc.sql`:

- `service_component.status`, `published_version`
- `draft_pricing_model`, `draft_name_vi`, `draft_description_vi`, `draft_deliverable_vi`
- Backfill existing rows with pricing → `published` v1

## API

| Method | Path | Notes |
|--------|------|-------|
| PATCH | `/api/v1/admin/spc/components/:code` | Draft overlay when published |
| POST | `/api/v1/admin/spc/publish` | `{ entity: 'component', key }` |
| GET | `/api/v1/admin/spc/offers/:sku/bundle-audit` | Price band audit |

Public `quote-catalog` / `families/:dv/components` use **published** components only.

## Admin UI

- **Components tab:** draft badge, save draft, publish (like SKU editor)
- **Bundle tab:** audit panel (offer vs sum, delta, status)

## Exit

`bash scripts/spc_s6d_gate.sh` PASS on VPS after deploy + API restart.
