#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rg -q 'EmployeeFileShell' "$ROOT/services/ops-web/src/components/hr/EmployeeFileShell.tsx"
rg -q 'EmployeeFileShell' "$ROOT/services/ops-web/src/app/crm/staff/[id]/page.tsx"
rg -q 'fetchHrStaffProfile' "$ROOT/services/ops-web/src/lib/hr-employee-file-api.ts"
echo "OK  P1 M2 ops-web wiring"
