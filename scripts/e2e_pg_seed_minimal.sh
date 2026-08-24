#!/usr/bin/env bash
# Zero SQLite Wave 3 — idempotent minimal PG seed for e2e / Playwright.
#
# Requires DATABASE_URL. Safe to run repeatedly (ON CONFLICT DO NOTHING).
#
# Usage:
#   set -a && source .env && set +a
#   ./scripts/e2e_pg_seed_minimal.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "WARN  DATABASE_URL unset — skip e2e PG seed" >&2
  exit 0
fi

echo "==> E2E PG seed (minimal)"

if [[ -f "$ROOT/scripts/seed_crm_catalog_pg.py" ]]; then
  "$PYTHON" "$ROOT/scripts/seed_crm_catalog_pg.py" || {
    echo "WARN  catalog seed failed (apply_pg_ddl_crm_catalog.sh may be needed)" >&2
  }
fi

if [[ -f "$ROOT/scripts/seed_crm_e2e_pg.py" ]]; then
  "$PYTHON" "$ROOT/scripts/seed_crm_e2e_pg.py" --minimal
fi

if [[ -x "$ROOT/scripts/seed_kpi_definitions.sh" ]]; then
  "$ROOT/scripts/seed_kpi_definitions.sh" 2>/dev/null || true
fi

echo "OK  e2e_pg_seed_minimal"
