#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-bds-p12.sql"
echo "==> Apply BĐS P12 DDL"
psql "${DATABASE_URL:?DATABASE_URL required}" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  bds P12 DDL"
