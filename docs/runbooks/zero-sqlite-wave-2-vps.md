# Zero SQLite Wave 2 — VPS (P4 verify + deploy)

Prerequisite: Wave 0 + Wave 1 deployed (`PTT_SQLITE_DISABLED=1`, all `PTT_CRM_*_PG=1`, `PTT_BDS_PG=1`).

Wave 2 removes runtime `DatabaseSync` from AI context, deal-room consumers, BDS hub/buyers, and lead SLA/funnel helpers. No new greenfield DDL — reuse existing PG tables.

## W2 commit milestones

| Sub-wave | Scope | Commit message prefix |
|----------|-------|------------------------|
| P1 | deal-room, LMP, NBA PG consumers | `feat: zero-sqlite W2 P1` |
| P2 | AI context repos full PG | `feat: zero-sqlite W2 P2` |
| P3 | BDS hub/buyers + lead SLA/funnel | `feat: zero-sqlite W2 P3` |
| P4 | verify + catalog orphan cleanup | `feat: zero-sqlite W2 P4` |

## DDL (only if fresh env)

Wave 2 does **not** require new DDL. If applying W1 P3 on a fresh database, use the zero-sqlite-safe RNOS-25 variant (no `lead_id → crm_leads(id)` FK):

```bash
cd /var/www/realosai
set -a && source .env && set +a
./scripts/apply_pg_ddl_zero_sqlite_w1_p3.sh
```

Verify W0 asset:

```bash
psql "$DATABASE_URL" -c "SELECT to_regclass('public.crm_lifecycle_finance_confirm');"
```

## Flags (`deploy/runtime.env`)

Already required from W0/W1/B5 — no new flags for W2:

```bash
PTT_SQLITE_DISABLED=1
PTT_CRM_*_PG=1          # all Wave 1 modules
PTT_BDS_PG=1
PTT_BDS_PACK=1
```

When `PTT_SQLITE_DISABLED=1`, `AppConfigService` forces PG flags even if omitted.

## Deploy code

```bash
# local
cd services/ptt-crm-api && npm run build
rsync -avz --delete services/ptt-crm-api/dist/ \
  deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/dist/
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

Wait ~5s after restart before smoke (brief 502 during startup is normal).

## Local verification (pre-deploy)

### Jest W2 suite

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/ai-intelligence/deal-score-context.repository.spec.ts \
  src/deal-room/ \
  src/ai-intelligence/ai-forecast.service.spec.ts \
  src/leads/lead-sla-care.service.spec.ts \
  src/bds/ \
  --runInBand
```

### Grep gate — no stray DatabaseSync in production paths

```bash
cd services/ptt-crm-api
rg "new DatabaseSync|assertSqliteAllowed" src --glob '*.ts' \
  | rg -v 'sqlite.repository|\.spec\.ts|sqlite-guard|sqlite-leads' \
  | sort -u
```

**Expected after W2 P1–P3** (only Wave 3/4 stragglers remain):

```
src/re-projects/re-projects-accounting.repository.ts
src/seo-admin/seo-admin.repository.ts
src/service-lifecycle/lifecycle-finance-confirm.repository.ts
src/service-lifecycle/lifecycle-tasks.repository.ts
```

**Expected after W2 P4:** same as above; `catalog-sqlite.repository.ts` deleted.

### AI intelligence — zero sqlite

```bash
rg "DatabaseSync" services/ptt-crm-api/src/ai-intelligence/
# Expect: 0 matches
```

## Smoke matrix W2

| Route | Expect |
|-------|--------|
| `GET /health` | 200, `sqlite_disabled: true`, `postgres: true` |
| `GET /api/crm/deal-room/:leadId/snapshot` | 401/200 (not 503) |
| `GET /api/crm/ai/forecast/current` | 401/200 |
| `POST /api/crm/ai/deal-score` | 401/200 |
| `GET /api/crm/ai/churn-health` | 401/200 |
| `POST /api/crm/ai/nl-query` | 401/200 |
| `GET /api/v1/leads/:id/status-options` | 401/200 |
| BDS hub KPI route | 401/200 |

```bash
BASE=https://real.gomira.vn

curl -sS "$BASE/health" | jq '{ok, sqlite_disabled, postgres, leads_read_source}'

for path in \
  "/api/crm/deal-room/1/snapshot" \
  "/api/crm/ai/forecast/current" \
  "/api/crm/ai/churn-health" \
  "/api/v1/leads/1/status-options"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path → $code"
done
```

401 = auth required (good). 503 `sqlite_disabled` = W2 regression (bad).

## Optional acceptance — sqlite file absent

After backup, rename `ptt.db` on VPS and confirm API stays healthy:

```bash
ssh deploy@real.gomira.vn 'sudo mv /var/www/realosai/ptt.db /var/www/realosai/ptt.db.bak.$(date +%Y%m%d)'
curl -sS https://real.gomira.vn/health
# Expect: 200, sqlite_disabled: true
```

Restore if needed:

```bash
ssh deploy@real.gomira.vn 'sudo mv /var/www/realosai/ptt.db.bak.* /var/www/realosai/ptt.db'
```

## Rollback

1. Revert W2 commit(s) locally, rebuild, rsync dist, restart API.
2. PG data unchanged — W2 is read-path migration only.
3. Do **not** disable `PTT_SQLITE_DISABLED` on VPS; rollback code, not flag matrix.

## Out of scope (Wave 3/4)

Still contain `DatabaseSync` behind `assertSqliteAllowed` (503 when disabled):

- `*-sqlite.repository.ts` dual-write repos (Wave 4 delete)
- `seo-admin.repository.ts`, `re-projects-accounting.repository.ts`
- `lifecycle-finance-confirm.repository.ts`, `lifecycle-tasks.repository.ts`
- Flask/scripts, `sqlite-leads.repository` read-only dev path

## Notes

- `crm_leads` PG bridge: `sqlite_lead_id` — do **not** FK `lead_id → crm_leads(id)`.
- `/api/crm/tickets` = CSKH board (`crm_tickets`), not `/api/v1/staff-tickets`.
- Catalog module is PG-only; `catalog-sqlite.repository.ts` removed in W2 P4.
