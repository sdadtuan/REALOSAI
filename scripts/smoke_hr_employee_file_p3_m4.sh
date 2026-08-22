#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'HrInsuranceController' "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-employee-file.module.ts"
grep -q 'InsurancePanel' "$ROOT/services/ops-web/src/components/hr/EmployeeFileShell.tsx"
grep -q 'fetchHrStaffInsurance' "$ROOT/services/ops-web/src/lib/hr-employee-file-api.ts"
echo "OK  P3 M4 module + frontend wiring"
