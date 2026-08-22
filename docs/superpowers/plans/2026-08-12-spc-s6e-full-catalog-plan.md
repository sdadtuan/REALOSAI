# SPC S6e — Rollout components for all 21 DV

**Date:** 2026-08-12  
**Depends on:** S6d (component publish + bundle audit)

## Goal

Every DV in `spc-chuan-hoa-bundle.json` has `components[]` + `bundle_by_tier`; PG + quote-catalog expose full L0.5 catalog.

## Approach

| Item | Detail |
|------|--------|
| Generator | `scripts/lib/spc-component-bundle-generate.js` — derive from `process_phases` |
| Enrich | `scripts/enrich_spc_bundle_components.js` — preserve hand-authored DV01 |
| Seed | `node scripts/seed_spc_components.js` (no arg = all 21 DV) |
| Import API | `POST /api/v1/admin/spc/import/doc-bundle` (no `dv_code`) |
| Gate | `scripts/spc_s6e_gate.sh` |

## Bundle tier rules (generated)

- **Retainer tail phase:** CB = setup subset, TC = all setup, CS = setup + retainer
- **One-time (3+ phases):** CB skips discovery (C01), TC/CS = all — mirrors DV01 pilot
- **2 phases:** CB = first only

## Exit

`bash scripts/spc_s6e_gate.sh` PASS — 21 doc families, ≥60 components in PG + quote-catalog.

## VPS deploy

```bash
cd /var/www/rnosai && git pull
node scripts/enrich_spc_bundle_components.js   # if bundle not yet enriched on branch
node scripts/seed_spc_components.js
cd services/ptt-crm-api && npm ci && npm run build
NEXT_PUBLIC_OPS_DV=1 bash scripts/deploy_ops_web.sh
kill -TERM $(systemctl show ptt-crm-api -p MainPID --value)
bash scripts/spc_s6e_gate.sh
```
