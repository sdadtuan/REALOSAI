#!/usr/bin/env bash
# Apply Video SOP S12 DDL (optional index; safe no-op if S11 applied)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-vd-sop-s12.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "SKIP no DATABASE_URL"
  exit 0
fi

echo "==> Apply Video SOP S12 DDL"
echo "    DATABASE_URL=set"
echo "    DDL=$DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Video SOP S12 DDL applied"
