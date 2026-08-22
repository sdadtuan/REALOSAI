# INT-P2 — Quote Builder Implementation Plan

> **Goal:** Quote Builder 3 gói (basic/standard/premium), export PDF/DOCX, chốt → lifecycle + spawn tuần (optional).

**Spec:** [`docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) §5.3–5.4

---

## Scope

| WS | Deliverable |
|----|-------------|
| **WS-P2-01** | `crm_quote_line_item` SQLite + proposal status columns |
| **WS-P2-02** | Quote pricing util + tier seed JSON |
| **WS-P2-03** | API: create/lines/status/export/quote-catalog |
| **WS-P2-04** | Accept → lifecycle (onboard/active) + optional spawn-week |
| **WS-P2-05** | FE QuoteBuilderWizard 4 bước |
| **WS-P2-06** | Smoke `scripts/smoke_ops_quote.sh` |

---

## API

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/crm/proposals/quote-catalog` | 21 DV + tiers |
| POST | `/api/crm/proposals` | `{ customer_id, lines: [{ dv_code, package_tier }] }` |
| PUT | `/api/crm/proposals/:id/lines` | Upsert lines + audit reason |
| PATCH | `/api/crm/proposals/:id/status` | draft→sent→accepted; accept spawns lifecycle |
| POST | `/api/crm/proposals/:id/export?format=pdf\|docx` | Download quote |

---

## Accept flow (INT-M3-02)

1. `status=accepted`
2. Per line: `service_lifecycle` với `service_slug` từ DV primary
3. Activate `status=active`, `stage=onboard`
4. Optional `spawn_week: true` → INT-P1 spawn-week
5. Link `lifecycle_id` on line item

---

## Seed

- [`docs/specs/ops-dv-tier-pricing-seed.json`](../../specs/ops-dv-tier-pricing-seed.json)
- Re-run: `node scripts/seed_ops_dv_catalog.js`

---

## Smoke

```bash
STAFF_TOKEN=... CUSTOMER_ID=... bash scripts/smoke_ops_quote.sh
ACCEPT=1 STAFF_TOKEN=... CUSTOMER_ID=... bash scripts/smoke_ops_quote.sh
```

---

## Out of scope (INT-P2b)

- AI suggest-quote (`POST /api/ops/ai/suggest-quote`)
- Branded PDF template
- Invoice link (INT-M3-04)
