#!/usr/bin/env bash
# Apply P3-S1 presales solution handoff PG DDL.
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

DDL="$ROOT/docs/specs/2026-08-06-postgresql-ddl-presales-solution-handoff.sql"
echo "Applying P3-S1 presales solution handoff DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  P3-S1 presales solution handoff PG DDL applied"
