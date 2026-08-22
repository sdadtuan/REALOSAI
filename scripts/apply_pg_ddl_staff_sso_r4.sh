#!/usr/bin/env bash
# Apply R4 staff SSO DDL (WIN-4-A)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-07-postgresql-ddl-staff-sso-r4.sql"

echo "==> Apply R4 staff SSO DDL (WIN-4-A)"
echo "    DATABASE_URL=$DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  R4 staff SSO DDL applied"
