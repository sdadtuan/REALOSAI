# Zero SQLite Wave 0 — VPS

## Flags bắt buộc (append nếu thiếu, không xóa flag khác)

```bash
PTT_SQLITE_DISABLED=1
PTT_LEADS_READ_SOURCE=pg
PTT_LEADS_WRITE_ENABLED=1
PTT_CRM_LEADS_FUNNEL_PG=1
PTT_CRM_INTAKE_PG=1
PTT_CRM_CONTRACT_PG=1
PTT_CRM_STAFF_PG=1
PTT_CRM_PAYROLL_PG=1
PTT_CRM_KPI_PG=1
PTT_CRM_LEADS_LEGACY_PG=1
PTT_CRM_SERVICE_LIFECYCLE_PG=1
PTT_CRM_FINANCE_PG=1
PTT_CRM_SVC_FINANCE_PG=1
PTT_CRM_SOP_PG=1
PTT_BDS_PACK=1
PTT_BDS_PG=1
```

## DDL

```bash
cd /var/www/realosai
set -a && source .env && set +a
./scripts/apply_pg_ddl_zero_sqlite_w0.sh
```

Payroll nếu bảng chưa có:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.crm_payroll_policy') AS payroll_policy;"
# null → sau source .env:
./scripts/apply_pg_ddl_payroll_r2_hr.sh
```

## Deploy code

```bash
# local
cd services/ptt-crm-api && npm run build
rsync -avz services/ptt-crm-api/dist/ deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/dist/
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

## Smoke

```bash
curl -sS http://127.0.0.1:3010/health
# ok true, sqlite false, sqlite_disabled true, postgres true, leads_read_source pg
```

| Check | Expect |
|-------|--------|
| `GET /health` | `ok`, `sqlite_disabled: true` |
| Leads / funnel / intake | 200 |
| BĐS project list | 200 |
| Payroll dashboard | 200 (sau DDL) |
| Customers (sqlite-only) | 503 `sqlite_disabled` |

## Rollback

```bash
PTT_SQLITE_DISABLED=0
# giữ ptt.db backup; restart api
sudo systemctl restart realosai-api
```
