#!/usr/bin/env bash
# Apply MKT-AI-01 marketing AI planner DDL (+ P4 depth optional)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner.sql"
DDL_P4="$ROOT/docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner-p4.sql"
DDL_P4_W2="$ROOT/docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner-p4-w2.sql"
DDL_P4_W3="$ROOT/docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner-p4-w3.sql"

echo "==> Apply MKT-AI planner DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
if [[ -f "$DDL_P4" ]]; then
  echo "==> Apply MKT-AI planner P4 depth DDL"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_P4"
fi
if [[ -f "$DDL_P4_W2" ]]; then
  echo "==> Apply MKT-AI planner P4 Wave 2 DDL"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_P4_W2"
fi
if [[ -f "$DDL_P4_W3" ]]; then
  echo "==> Apply MKT-AI planner P4 Wave 3 DDL (WS-P4-09)"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_P4_W3"
fi
echo "OK  MKT-AI planner DDL applied (schema_migrations: 2026-08-08-mkt-ai-planner)"
