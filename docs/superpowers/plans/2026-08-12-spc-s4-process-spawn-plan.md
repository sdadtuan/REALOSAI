# SPC S4 — Process phases + spawn by SKU

> **Status:** Implemented 2026-08-12

**Goal:** `POST spawn-week` resolves tasks from `service_process_phase` filtered by lifecycle `sku_code`; expose L3 via `GET /api/spc/offers/:sku/process`.

**Exit criteria:** Lifecycle `sku_code=DV02-TC` → spawn-week → `phase_code=DV02-T1`, tasks from SPC `tasks_json`.

## Delivered

| Area | Detail |
|------|--------|
| Util | `spc-process.util.ts` — merge DV + SKU phases, flatten `tasks_json` |
| API read | `GET /api/spc/offers/:skuCode/process` |
| API admin | `GET /api/v1/admin/spc/process`, `PUT process/:phaseCode` |
| Ops | `spawnWeek` prefers SPC phases; fallback `weekly_process_template` |
| Lifecycle | `sku_code` on `ServiceLifecycleRow` → package tier + spawn SKU |
| Seed | `tasks_json` with `{ id: DVxx-Tn-1, title: ptt_work_vi }` |
| FE | `/admin/services/process` — phase library read |
| Gate | `scripts/spc_s4_gate.sh` |

## VPS deploy

```bash
cd /var/www/rnosai && git pull
node scripts/seed_spc_catalog.js   # refresh tasks_json if needed
cd services/ptt-crm-api && npm ci && npm run build
NEXT_PUBLIC_OPS_DV=1 bash scripts/deploy_ops_web.sh
sudo systemctl restart ptt-crm-api ptt-ops-web
bash scripts/spc_s4_gate.sh
```

## Phase selection

- `resolveProcessPhases(dv, sku)` merges base (`sku_code IS NULL`) + SKU overrides by `sort_order`.
- Spawn index = `COUNT(ops_weekly_spawn_log)` capped to last phase (first spawn → T1).

## Next (S5)

TMMT blueprint + prefill by SKU.
