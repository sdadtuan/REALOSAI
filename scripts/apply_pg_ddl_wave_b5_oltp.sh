#!/usr/bin/env bash
# Apply Wave B5 PG OLTP bridge (intake BANT + contract promote / lifecycle).
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

echo "Applying Wave B4 funnel DDL (prerequisite)..."
"$ROOT/scripts/apply_pg_ddl_wave_b4_funnel.sh"

DDL="$ROOT/docs/specs/2026-08-02-wave-b5-pg-oltp-bridge.sql"
echo "Applying Wave B5 OLTP bridge DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Wave B5 PG DDL applied (PTT_CRM_INTAKE_PG=1, PTT_CRM_CONTRACT_PG=1 default on)"
