#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-vd-sop-s14.sql"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "SKIP no DATABASE_URL"
  exit 0
fi
echo "==> Apply Video SOP S14 DDL (no-op comment)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Video SOP S14 DDL applied"
