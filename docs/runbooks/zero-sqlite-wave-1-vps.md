# Zero SQLite Wave 1 — VPS (P1 milestone)

Prerequisite: Wave 0 deployed (`PTT_SQLITE_DISABLED=1` in `deploy/runtime.env`).

## DDL (once per environment)

```bash
cd /var/www/realosai
set -a && source .env && set +a
./scripts/apply_pg_ddl_zero_sqlite_w1_p1.sh
```

Verify tables:

```bash
psql "$DATABASE_URL" -c "SELECT to_regclass('public.crm_tickets') AS tickets;"
```

## Backfill (maintenance window — order matters)

```bash
cd /var/www/realosai
set -a && source .env && set +a
export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-/var/www/realosai/ptt.db}"

python3 scripts/backfill_zero_sqlite_w1_customers.py
python3 scripts/backfill_zero_sqlite_w1_cases.py
python3 scripts/backfill_zero_sqlite_w1_tickets.py
```

Spot-check counts:

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM crm_customers WHERE sqlite_customer_id IS NOT NULL;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM crm_cases WHERE sqlite_case_id IS NOT NULL;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM crm_tickets WHERE sqlite_ticket_id IS NOT NULL;"
```

## Flags (append to `deploy/runtime.env` after P1)

```bash
PTT_CRM_PROPOSALS_PG=1
PTT_CRM_MARKETING_PLANS_PG=1
PTT_CRM_CONFIG_PG=1
```

## DDL P2 (once)

```bash
cd /var/www/realosai
set -a && source .env && set +a
./scripts/apply_pg_ddl_zero_sqlite_w1_p2.sh
```

## Backfill P2

```bash
python3 scripts/backfill_zero_sqlite_w1_proposals.py
# marketing-plans + crm-config backfill: optional when sqlite tables exist locally
```

## Smoke matrix (P2)

| Route | Expect |
|-------|--------|
| `GET /api/crm/proposals` | 401/200 (not 503) |
| `GET /api/crm/marketing-plans` | 401/200 |
| `GET /api/crm/config/pipeline/sales/stages` | 401/200 |

## DDL P3 (once)

```bash
cd /var/www/realosai
set -a && source .env && set +a
./scripts/apply_pg_ddl_zero_sqlite_w1_p3.sh
```

Verify tables:

```bash
psql "$DATABASE_URL" -c "SELECT to_regclass('public.crm_sales_plans') AS sales;"
psql "$DATABASE_URL" -c "SELECT to_regclass('public.crm_owner_cash_snapshots') AS owner_cash;"
```

## Backfill P3

```bash
python3 scripts/backfill_zero_sqlite_w1_orders.py
python3 scripts/backfill_zero_sqlite_w1_invoices.py
# sales / owner-weekly: optional when sqlite tables exist locally
```

## Flags (append to `deploy/runtime.env` after P3)

```bash
PTT_CRM_ORDERS_PG=1
PTT_CRM_INVOICES_PG=1
PTT_CRM_SALES_PG=1
PTT_CRM_OWNER_WEEKLY_PG=1
```

## Smoke matrix (P3)

| Route | Expect |
|-------|--------|
| `GET /api/crm/orders` | 401/200 (not 503) |
| `GET /api/crm/invoices` | 401/200 |
| `GET /api/crm/sales/summary` | 401/200 |
| `GET /api/crm/owner-weekly/dashboard` | 401/200 |

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/orders
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/invoices
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/sales/summary
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/owner-weekly/dashboard
```

---

## P1 reference (already deployed)

When `PTT_SQLITE_DISABLED=1`, these flags are forced on by `AppConfigService` even if omitted.

## Deploy code

```bash
# local
cd services/ptt-crm-api && npm run build
rsync -avz services/ptt-crm-api/dist/ deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/dist/
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

## Smoke matrix (P1)

| Route | Expect |
|-------|--------|
| `GET /health` | `ok`, `sqlite_disabled: true`, `postgres: true` |
| `GET /api/crm/customers` | 200 (was 503) |
| `GET /api/crm/cases` | 200 |
| `GET /api/crm/tickets` | 200 |

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/customers
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/cases
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010/api/crm/tickets
```

## Rollback

Remove P1 flags from `deploy/runtime.env` (or set to `0`) and restart API. PG data remains; sqlite file unchanged.

```bash
sudo systemctl restart realosai-api
```

## Notes

- `/api/crm/tickets` is the CSKH board (`crm_tickets`), **not** `/api/v1/staff-tickets`.
- When `PTT_SQLITE_DISABLED=1`, all Wave 1 `PTT_CRM_*_PG` flags are forced on by `AppConfigService`.
