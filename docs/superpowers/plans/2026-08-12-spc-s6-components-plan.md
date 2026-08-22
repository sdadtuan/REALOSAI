# SPC S6 — service_component + bundle + Admin Components tab

> **Status:** Implemented 2026-08-12

**Goal:** L0.5 dịch vụ con (`service_component`) với khung giá riêng; gói SKU map qua `service_bundle_item`; Admin CRUD + tab Components/Bundle trên family page.

**Exit criteria:** DV01 có ≥4 component; DV01-TC bundle ≥3 items; API + Admin tab PASS gate.

## Delivered

| Area | Detail |
|------|--------|
| DDL | `service_component`, `service_bundle_item`, `service_offer_line.component_code` |
| API admin | CRUD components, GET/PUT offer bundle |
| API read | `GET /api/spc/families/:dvCode/components` |
| Seed | `scripts/seed_spc_components.js` — DV01 pilot |
| Admin UI | Tab Dịch vụ con + Tab Bundle SKU on `/admin/services/families/:dvCode` |
| Gate | `scripts/spc_s6_gate.sh` |

## VPS deploy

```bash
cd /var/www/rnosai && git pull
node scripts/seed_spc_components.js
cd services/ptt-crm-api && npm ci && npm run build
NEXT_PUBLIC_OPS_DV=1 bash scripts/deploy_ops_web.sh
sudo systemctl restart ptt-crm-api ptt-ops-web
bash scripts/spc_s6_gate.sh
```

## Component code convention

`DVxx-Cnn` (e.g. `DV01-C02`) — distinct from tier suffix `CB/TC/CS`.
