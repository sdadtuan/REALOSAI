# Ops DV — Staging fixtures

**Date:** 2026-08-10

## Env (staging VPS)

```bash
PTT_OPS_DV_ENABLED=1
NEXT_PUBLIC_OPS_DV=1
# optional:
PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20
```

## Deploy steps

```bash
./scripts/apply_pg_ddl_ops_dv.sh
DATABASE_URL=... node scripts/seed_ops_dv_catalog.js
sudo systemctl restart ptt-crm-api
# restart ops-web
```

## Smoke

```bash
STAFF_TOKEN=... LIFECYCLE_ID=... CRM_API=https://rs.pttads.vn/api ./scripts/smoke_ops_dv_hub.sh
```

## Known lifecycles

| Slug | Notes |
|------|-------|
| `dich-vu-seo-tong-the` | DV05 — usually exists on staging |
| `tiep-thi-noi-dung` | DV02 — create if missing for Content OS / Ops smoke |
| `workshop-buoi1` | Lead `#900000910` — `./scripts/seed_workshop_buoi1_sandbox_lead.sh` |

Document `LIFECYCLE_ID` after verifying on staging DB.
