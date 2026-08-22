#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-16-postgresql-ddl-market-research-p36.sql"
echo "==> Apply Market Research P36 DDL (IVFFlat, fail-soft)"
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector" >/tmp/p36_vector_ext.log 2>&1; then
  echo "WARN  P36 skipped: CREATE EXTENSION vector failed (install postgresql-*-pgvector to enable)"
  cat /tmp/p36_vector_ext.log || true
  exit 0
fi
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL" >/tmp/p36_ivf.log 2>&1; then
  echo "WARN  P36 skipped: IVFFlat index failed (pgvector extension or embedding_vec missing)"
  cat /tmp/p36_ivf.log || true
  exit 0
fi
echo "OK  market research P36 DDL"
