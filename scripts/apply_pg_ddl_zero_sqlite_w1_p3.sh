#!/usr/bin/env bash
# Apply Zero SQLite Wave 1 P3 DDL (orders/invoices bridge, sales, owner-weekly).
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

echo "Applying Wave 1 P2 prerequisite..."
"$ROOT/scripts/apply_pg_ddl_zero_sqlite_w1_p2.sh"

RNOS25="$ROOT/docs/specs/postgresql-ddl-rnos25-orders-invoices-zero-sqlite.sql"
if [[ -f "$RNOS25" ]]; then
  echo "Applying RNOS-25 orders/invoices base (zero-sqlite safe, no lead_id FK)..."
  psql "$URL" -v ON_ERROR_STOP=1 -f "$RNOS25"
fi

DDL="$ROOT/docs/specs/postgresql-ddl-zero-sqlite-w1-p3.sql"
echo "Applying Zero SQLite W1 P3 DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"

echo "OK  Zero SQLite W1 P3 DDL (orders, invoices, sales, owner-weekly)"
