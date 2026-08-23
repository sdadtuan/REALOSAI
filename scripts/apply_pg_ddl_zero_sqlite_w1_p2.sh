#!/usr/bin/env bash
# Apply Zero SQLite Wave 1 P2 DDL (proposals, marketing-plans, crm-config).
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

echo "Applying Wave 1 P1 prerequisite..."
"$ROOT/scripts/apply_pg_ddl_zero_sqlite_w1_p1.sh"

DDL="$ROOT/docs/specs/postgresql-ddl-zero-sqlite-w1-p2.sql"
echo "Applying Zero SQLite W1 P2 DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"

DEAL_ROOM="$ROOT/docs/specs/2026-08-11-deal-room-s0-proposals-ddl.sql"
if [[ -f "$DEAL_ROOM" ]]; then
  echo "Applying deal-room proposals ALTER (if needed)..."
  psql "$URL" -v ON_ERROR_STOP=1 -f "$DEAL_ROOM" || true
fi

echo "OK  Zero SQLite W1 P2 DDL (proposals, marketing-plans, crm-config)"
