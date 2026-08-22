#!/usr/bin/env bash
# Apply R3 Admin Audit Center DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-11-postgresql-ddl-admin-audit-r3.sql"

echo "==> Apply R3 Admin Audit DDL"
echo "    DATABASE_URL=$DATABASE_URL"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
else
  echo "psql required for admin audit DDL"
  exit 1
fi

echo "OK  R3 admin audit DDL applied"
