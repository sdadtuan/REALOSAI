#!/usr/bin/env bash
# Zero SQLite Wave 3 — shared PG environment for e2e / local Nest (no ptt.db).
#
# Usage (after DATABASE_URL is set):
#   set -a && source .env && set +a
#   source scripts/e2e_pg_bootstrap.sh
#
# Or from Playwright wrappers:
#   source "$ROOT/scripts/e2e_pg_bootstrap.sh"
#
# Intentionally unsets PTT_SQLITE_PATH so Nest never opens sqlite when DISABLED=1.
set -euo pipefail

E2E_PG_BOOTSTRAP_ROOT="${E2E_PG_BOOTSTRAP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)}"

export PTT_SQLITE_DISABLED=1
unset PTT_SQLITE_PATH

export PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
export PTT_LEADS_WRITE_SOURCE="${PTT_LEADS_WRITE_SOURCE:-pg}"
export PTT_LEAD_INGEST_RULES_SOURCE="${PTT_LEAD_INGEST_RULES_SOURCE:-pg}"
export PTT_LEADS_WRITE_ENABLED="${PTT_LEADS_WRITE_ENABLED:-1}"

# Wave 1 CRM modules
export PTT_CRM_CUSTOMERS_PG="${PTT_CRM_CUSTOMERS_PG:-1}"
export PTT_CRM_CASES_PG="${PTT_CRM_CASES_PG:-1}"
export PTT_CRM_TICKETS_PG="${PTT_CRM_TICKETS_PG:-1}"
export PTT_CRM_PROPOSALS_PG="${PTT_CRM_PROPOSALS_PG:-1}"
export PTT_CRM_MARKETING_PLANS_PG="${PTT_CRM_MARKETING_PLANS_PG:-1}"
export PTT_CRM_CONFIG_PG="${PTT_CRM_CONFIG_PG:-1}"
export PTT_CRM_ORDERS_PG="${PTT_CRM_ORDERS_PG:-1}"
export PTT_CRM_INVOICES_PG="${PTT_CRM_INVOICES_PG:-1}"
export PTT_CRM_SALES_PG="${PTT_CRM_SALES_PG:-1}"
export PTT_CRM_OWNER_WEEKLY_PG="${PTT_CRM_OWNER_WEEKLY_PG:-1}"
export PTT_CRM_PAYROLL_PG="${PTT_CRM_PAYROLL_PG:-1}"

# Dual-write modules
export PTT_CRM_LEADS_LEGACY_PG="${PTT_CRM_LEADS_LEGACY_PG:-1}"
export PTT_CRM_LEADS_FUNNEL_PG="${PTT_CRM_LEADS_FUNNEL_PG:-1}"
export PTT_CRM_LEADS_CONTRACT_PG="${PTT_CRM_LEADS_CONTRACT_PG:-1}"
export PTT_CRM_INTAKE_PG="${PTT_CRM_INTAKE_PG:-1}"
export PTT_CRM_STAFF_PG="${PTT_CRM_STAFF_PG:-1}"
export PTT_CRM_SERVICE_LIFECYCLE_PG="${PTT_CRM_SERVICE_LIFECYCLE_PG:-1}"
export PTT_CRM_FINANCE_PG="${PTT_CRM_FINANCE_PG:-1}"
export PTT_CRM_SVC_FINANCE_PG="${PTT_CRM_SVC_FINANCE_PG:-1}"
export PTT_CRM_KPI_PG="${PTT_CRM_KPI_PG:-1}"
export PTT_CRM_SOP_PG="${PTT_CRM_SOP_PG:-1}"

# BĐS
export PTT_BDS_PACK="${PTT_BDS_PACK:-1}"
export PTT_BDS_PG="${PTT_BDS_PG:-1}"

# Flask retired — Nest-only HTTP
export PTT_FLASK_MONOLITH_MODE="${PTT_FLASK_MONOLITH_MODE:-retired}"
export PTT_WEBHOOKS_FLASK_FALLBACK="${PTT_WEBHOOKS_FLASK_FALLBACK:-0}"

export E2E_PG_BOOTSTRAP=1
