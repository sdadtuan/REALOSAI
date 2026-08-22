#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p2.sql"
grep -q 'hr_labor_contracts' "$DDL"
grep -q 'hr_labor_contract_appendices' "$DDL"
grep -q 'idx_hr_labor_contracts_one_active' "$DDL"
echo "OK  P2 M3 DDL contract tables + one-active index"
