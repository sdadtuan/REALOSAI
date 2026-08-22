#!/usr/bin/env bash
# Apply Sprint 0 Deal Room S0 PG DDL (F4 proposals optional + F5 teaser tokens).
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

PROPOSALS_DDL="$ROOT/docs/specs/2026-08-11-deal-room-s0-proposals-ddl.sql"
TEASER_DDL="$ROOT/docs/specs/2026-08-11-deal-room-s0-teaser-ddl.sql"

echo "Applying Deal Room S0 proposals DDL (optional — crm_proposals may be SQLite-only)..."
if psql "$URL" -v ON_ERROR_STOP=1 -f "$PROPOSALS_DDL" 2>/tmp/deal-room-proposals-ddl.err; then
  echo "OK  proposals DDL"
else
  echo "WARN proposals DDL skipped ($(head -1 /tmp/deal-room-proposals-ddl.err))"
fi

echo "Applying Deal Room S0 teaser DDL (F5)..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$TEASER_DDL"
echo "OK  Deal Room S0 teaser PG DDL applied"
