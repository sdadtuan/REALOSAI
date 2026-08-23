#!/usr/bin/env bash
# Apply Zero SQLite Wave 1 P1 DDL (customers/cases/tickets CSKH).
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

echo "Applying Wave B5 OLTP bridge (prerequisite)..."
"$ROOT/scripts/apply_pg_ddl_wave_b5_oltp.sh"

DDL="$ROOT/docs/specs/postgresql-ddl-zero-sqlite-w1-p1.sql"
echo "Applying Zero SQLite W1 P1 DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Zero SQLite W1 P1 DDL (customers/cases/tickets CSKH)"
