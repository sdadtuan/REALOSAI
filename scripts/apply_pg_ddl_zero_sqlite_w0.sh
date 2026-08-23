#!/usr/bin/env bash
# Apply Zero SQLite Wave 0 PG DDL (lifecycle finance confirm).
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

DDL="$ROOT/docs/specs/postgresql-ddl-zero-sqlite-w0.sql"
echo "Applying Zero SQLite W0 DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Zero SQLite W0 DDL (crm_lifecycle_finance_confirm)"
