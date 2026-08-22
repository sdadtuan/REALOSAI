# M2 Portal PWA — Prod cutover checklist (RNOS-M2)

> Domain: `https://portal.pttads.vn` · Nest `/api/v1/portal/push/*` · Gate: `scripts/rnos_m2_portal_pwa_gate.sh`

## Staging cutover (VPS pilot)

Xem chi tiết: [`m2-portal-pwa-staging-cutover-checklist.md`](./m2-portal-pwa-staging-cutover-checklist.md)

```bash
cd /var/www/ptt
APPLY=0 ./scripts/m2_portal_pwa_staging_cutover.sh
APPLY=1 ./scripts/m2_portal_pwa_staging_cutover.sh
```

---

## Pre-flight (VPS)

- [ ] Backup: `./scripts/backup_ptt_data.sh`
- [ ] Apply DDL: `./scripts/apply_pg_ddl_portal_push_m2.sh`
- [ ] Generate icons: `python3 scripts/generate_portal_pwa_icons.py`
- [ ] Set VAPID keys in `.env`:
  - `PTT_PORTAL_PUSH_ENABLED=1`
  - `PTT_PORTAL_VAPID_PUBLIC_KEY=...`
  - `PTT_PORTAL_VAPID_PRIVATE_KEY=...`
  - `PTT_PORTAL_VAPID_SUBJECT=mailto:portal-push@pttads.vn`
- [ ] portal-web build: `NEXT_PUBLIC_PWA_ENABLED=1`
- [ ] Nginx serves `/sw.js` + `/manifest.webmanifest` (`deploy/nginx-portal-pwa.snippet.conf`)

## Dry-run gate (local or staging)

```bash
set -a && source deploy/env.staging-m2-portal-pwa.example && set +a
bash scripts/staging_m2_portal_pwa_kickoff.sh
```

Expect `.local-dev/rnos-m2-portal-pwa-gate-report.json` with **0 fail**.

## Cutover steps

1. Rebuild portal-web with PWA flag
2. Restart `ptt-crm-api` (push endpoints)
3. Reload nginx
4. Smoke:
   - `curl -sf https://portal.pttads.vn/manifest.webmanifest | head`
   - `curl -sf https://portal.pttads.vn/sw.js | grep ptt-portal-pwa-v1`
   - Mobile viewport: bottom nav on `/dashboard`
   - Settings → Bật thông báo đẩy (approver pilot)

## Rollback

1. Rebuild portal-web with `NEXT_PUBLIC_PWA_ENABLED=0`
2. Set `PTT_PORTAL_PUSH_ENABLED=0`
3. Reload services

## Pilot cohort

Start with 3–5 approver accounts; monitor `portal_push_subscriptions` row count and notification click-through.

## Related

- [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md)
- [`m1-pwa-prod-cutover-checklist.md`](./m1-pwa-prod-cutover-checklist.md)
