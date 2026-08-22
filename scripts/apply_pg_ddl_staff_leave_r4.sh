#!/usr/bin/env bash
# Apply WIN-4-D leave + staff notifications DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-07-postgresql-ddl-staff-leave-r4.sql"

echo "==> Apply WIN-4-D staff leave + notifications DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  WIN-4-D leave DDL applied"
