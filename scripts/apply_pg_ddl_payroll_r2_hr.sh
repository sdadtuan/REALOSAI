#!/usr/bin/env bash
# Apply R2-HR payroll DDL (WIN-2-B)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-07-postgresql-ddl-payroll.sql"

echo "==> Apply R2-HR payroll DDL (WIN-2-B)"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  R2-HR payroll DDL applied"
