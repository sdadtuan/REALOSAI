# SPC S3 — Quote Catalog + lifecycle sku_code

> **Status:** Implemented 2026-08-12

**Goal:** Quote Builder reads `/api/spc/quote-catalog`, resolves line pricing from published SKU `pricing_model`, and sets `crm_service_lifecycle.sku_code` on quote accept.

**Exit criteria:** AM selects `DV02-TC` → quote line priced from SPC → accept → lifecycle has `sku_code=DV02-TC`.

## Delivered

| Area | Detail |
|------|--------|
| API | `GET /api/spc/quote-catalog?service_slug=` — families + offers + scope lines + combo_warnings |
| Pricing | `SpcService.resolveQuoteLineFromSku()` + `spc-quote-pricing.util` |
| Proposals | `sku_code` on quote lines; `resolveLinePricing` prefers SPC; legacy `tier_pricing` fallback |
| Lifecycle | `setCommercialSku()` on accept (PG + SQLite) |
| Legacy | `GET /api/crm/proposals/quote-catalog` delegates to SPC when PG available |
| FE | `QuoteBuilderWizard` — SKU-aware tier selection, SPC catalog source |
| Gate | `scripts/spc_s3_gate.sh` |

## VPS deploy

```bash
cd /var/www/rnosai && git pull
cd services/ptt-crm-api && npm ci && npm run build
NEXT_PUBLIC_OPS_DV=1 bash scripts/deploy_ops_web.sh
sudo systemctl restart ptt-crm-api ptt-ops-web
bash scripts/spc_s3_gate.sh
```
