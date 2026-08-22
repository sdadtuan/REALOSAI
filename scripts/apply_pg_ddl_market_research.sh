#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-14-postgresql-ddl-market-research.sql"
DDL_M2="$ROOT/docs/specs/2026-08-14-postgresql-ddl-market-research-m2.sql"
echo "==> Apply Market Research DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "==> Apply Market Research M2 DDL (verified-only checksum unique)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL_M2"
echo "OK  market research DDL"
