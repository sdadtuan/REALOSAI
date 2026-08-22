#!/usr/bin/env bash
# Apply PostgreSQL DDL v3 — Phase 2 (OLTP leads + performance)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

DDL_OLTP="$ROOT/docs/specs/2026-07-17-postgresql-ddl-v3-leads-oltp.sql"
DDL_PERF="$ROOT/docs/specs/2026-07-17-postgresql-ddl-v3-performance.sql"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

echo "==> Apply PG DDL v3 (Phase 2)"
echo "    DATABASE_URL=$DATABASE_URL"

cd "$ROOT"
"$PYTHON" -c "
from ptt_crm.pg_schema import pg_leads_replica_ready, pg_leads_migration_applied
assert pg_leads_replica_ready(), 'Apply v2 first: ./scripts/apply_pg_ddl_v2_leads.sh'
assert pg_leads_migration_applied(), 'schema_migrations v2 missing'
print('OK  v2 prerequisite met')
"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -f "$DDL_OLTP"
  psql "$DATABASE_URL" -f "$DDL_PERF"
else
  echo "==> psql not found — applying via Python (psycopg2)"
  "$PYTHON" -c "from ptt_crm.pg_schema import apply_ddl_v3; apply_ddl_v3()"
fi

"$PYTHON" -c "
from ptt_crm.pg_schema import pg_v3_migration_applied, pg_v3_ready
assert pg_v3_migration_applied(), 'schema_migrations v3 missing'
assert pg_v3_ready(), 'v3 tables missing'
print('OK  DDL v3 applied — migrations + core tables ready')
"

echo ""
echo "Next (production — recommended):"
echo "  set -a && source .env && set +a"
echo "  ./scripts/deploy_post_v3.sh              # FK + idempotency + RNOS-01 Timeline + hub sync"
echo "  ./scripts/deploy_post_v3.sh --backup     # same + pg_dump first"
echo ""
echo "Next (staging / Phase 2 cutover only):"
echo "  deploy/env.staging-write-pilot.example + ./scripts/staging_write_cutover_pilot.sh"
echo "  deploy/env.staging-closed-loop-pilot.example + ./scripts/staging_closed_loop_pilot.sh --sync"
echo "  See docs/runbooks/cutover-leads-write-phase2.md §3"
