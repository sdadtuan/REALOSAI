#!/usr/bin/env bash
# Apply R1-S1 staff RBAC DDL (audit + grants_customized + staff_positions view)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
DDL="$ROOT/docs/specs/2026-08-06-postgresql-ddl-staff-positions.sql"
PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

echo "==> Apply R1-S1 staff RBAC DDL"
echo "    DATABASE_URL=$DATABASE_URL"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
else
  echo "==> psql not found — applying via Python (psycopg2)"
  "$PYTHON" -c "
from pathlib import Path
from ptt_crm.pg_schema import _apply_sql_file
_apply_sql_file(Path('$DDL'))
"
fi

echo "OK  R1-S1 staff RBAC DDL applied"
