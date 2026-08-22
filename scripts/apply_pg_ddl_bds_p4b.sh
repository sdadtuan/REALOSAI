#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-bds-p4b.sql"
echo "==> Apply BĐS P4b DDL"
psql "${DATABASE_URL:?DATABASE_URL required}" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  bds P4b DDL"
