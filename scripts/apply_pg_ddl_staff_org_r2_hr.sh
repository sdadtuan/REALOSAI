#!/usr/bin/env bash
# Apply R2-HR staff org DDL (WIN-2-A)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-07-postgresql-ddl-staff-org.sql"

echo "==> Apply R2-HR staff org DDL (WIN-2-A)"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
else
  echo "FAIL: psql required for staff org DDL" >&2
  exit 1
fi

echo "OK  R2-HR staff org DDL applied"
