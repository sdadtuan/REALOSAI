#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/docs/specs/2026-08-16-postgresql-ddl-gtm-w3-asean.sql"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required" >&2
  exit 1
fi
psql "$DATABASE_URL" -f "$SQL"
echo "Applied W3 ASEAN DDL"
