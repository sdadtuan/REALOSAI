#!/usr/bin/env bash
# Apply Content Marketing OS DDL (M0)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-09-postgresql-ddl-content-marketing.sql"

echo "==> Apply Content Marketing OS DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Content Marketing DDL applied (schema_migrations: 2026-08-09-content-marketing)"
