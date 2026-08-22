# B2B Project OS — flag-on runbook (W0)

Master flag: `PTT_B2B_PROJECT_OS`. **Default is off (`0`)**. Do not enable the prod flag in this wave until staging soak is green.

## Order (do not skip)

1. **Backfill LEGACY** — assign existing B2B leads (no `b2b_project_id`) to `PTT-LEGACY`.
2. **Map channels** — Facebook form / Zalo OA / web / API keys onto live projects (unmapped ingress stays unmatched, no lead).
3. **Staging flag 48h** — set `PTT_B2B_PROJECT_OS=1` on staging only; run UAT; soak 48 hours.
4. **Prod** — enable prod only after staging is green. Leave this step pending until W0 gate passes.

## 1. Backfill LEGACY

```bash
# Review first
psql "$DATABASE_URL" -c "SELECT count(*) FROM crm_leads WHERE agency_client_id IS NULL AND b2b_project_id IS NULL;"

BACKFILL=1 APPLY=1 ./scripts/deploy_b2b_lead_project_os_p1_vps.sh
# or locally:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/backfill_b2b_leads_ptt_legacy.sql
```

Confirm `crm_b2b_projects` has code `PTT-LEGACY` (paused) owned by PTT.

## 2. Map channels

In ops-web CRM B2B projects, attach:

- Meta `page_id` + `form_id`
- Zalo OA / webform slug / API key

Unmapped form/OA → HTTP 200, `crm_b2b_unmatched_ingress`, **no** lead. Drain unmatched before flipping the flag.

## 3. Staging flag 48h

On **staging** `deploy/runtime.env` for `ptt-crm-api` only:

```bash
PTT_B2B_PROJECT_OS=1
```

Restart `ptt-crm-api`. Run:

```bash
export API_URL=https://staging-host
export STAFF_TOKEN=…
export OUTSIDER_TOKEN=…
export DENIED_LEAD_ID=…
export OWNED_LEAD_ID=…   # optional — B2B-04 owner GET
bash scripts/uat_b2b_project_os.sh
```

**W0 automated gate:** B2B-01 + B2B-02 + optional B2B-04. B2B-03 and B2B-05…18 remain SKIP until later waves. Missing env = SKIP with a reason, not a silent fail.

`crm_staff.active = false` now hides B2B leads **including own**. If B2B-04 404s for a known owner, check that staff row first.

If B2B-01 fails (not 400), the POST may have created a junk lead `full_name=X` / `phone=0900000000`. Delete or void that row before retrying.

Soak **48 hours**. Watch create-lead 400s, GET 404s without customer name leak, unmatched ingress.

## 4. Prod

**Do not enable prod in W0.** Flag stays `PTT_B2B_PROJECT_OS=0` on prod until the W0 automated gate (B2B-01 + B2B-02 + optional B2B-04) is green and 48h soak is clean.

When ready (later wave): set `PTT_B2B_PROJECT_OS=1` on prod `ptt-crm-api` only after a rollback plan (`=0` + restart) is in place.

## Rollback

```bash
# staging or prod
PTT_B2B_PROJECT_OS=0
# restart ptt-crm-api
```

Flag off restores pre-gate ingest/list (project not required).
