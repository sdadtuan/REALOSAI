#!/usr/bin/env bash
# Apply Wave B6 PG DDL (svc-finance, staff roster, KPI, finance config, SOP crm_* tables).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL in .env" >&2
  exit 1
fi

echo "Applying Wave B5 OLTP bridge (prerequisite)..."
"$ROOT/scripts/apply_pg_ddl_wave_b5_oltp.sh"

DDL="$ROOT/docs/specs/2026-08-02-wave-b6-finance-kpi-staff-sop.sql"
echo "Applying Wave B6 finance/kpi/staff/sop DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Wave B6 PG DDL applied (PTT_CRM_SVC_FINANCE_PG=1, PTT_CRM_KPI_PG=1, PTT_CRM_SOP_PG=1, PTT_CRM_FINANCE_PG=1 default on)"
