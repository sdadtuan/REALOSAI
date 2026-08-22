#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql"
echo "==> Apply Market Research P20 DDL (pgvector, fail-soft)"
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector" >/tmp/p20_vector_ext.log 2>&1; then
  echo "WARN  P20 skipped: CREATE EXTENSION vector failed (install postgresql-*-pgvector to enable)"
  cat /tmp/p20_vector_ext.log || true
  exit 0
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  market research P20 DDL"
