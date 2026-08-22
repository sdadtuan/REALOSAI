#!/usr/bin/env bash
# Apply R3-A staff_user_clients DDL (WIN-3-C)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-07-postgresql-ddl-staff-user-clients.sql"

echo "==> Apply R3-A staff_user_clients DDL (WIN-3-C)"
echo "    DATABASE_URL=$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  R3-A staff_user_clients DDL applied"
