#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/postgresql-ddl-bds-re-oltp-p3.sql"
echo "==> Apply BĐS RE OLTP P3 DDL (KPI, risks, budget, buyer leads)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  bds RE OLTP P3 DDL"
