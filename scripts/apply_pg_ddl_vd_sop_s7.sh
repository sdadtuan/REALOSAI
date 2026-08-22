#!/usr/bin/env bash
# Apply Video SOP S7 PG DDL (vd_budgets columns + vd_cost_ledger)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL in .env" >&2
  exit 1
fi

DDL="$ROOT/docs/specs/postgresql-ddl-vd-sop-s7.sql"

echo "==> Apply Video SOP S7 DDL"
echo "    DATABASE_URL=set"
echo "    DDL=$DDL"
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Video SOP S7 DDL applied (vd_cost_ledger, vd_budgets extended)"
