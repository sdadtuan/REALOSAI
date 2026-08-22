#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-12-postgresql-ddl-spc.sql"

echo "==> Apply SPC DDL"
echo "    DATABASE_URL=${DATABASE_URL%%@*}@***"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK SPC DDL applied"
