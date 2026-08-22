#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'HrLaborContractController' "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-employee-file.module.ts"
grep -q 'contracts' "$ROOT/services/ops-web/src/lib/hr-employee-file-api.ts"
grep -q 'ContractPanel' "$ROOT/services/ops-web/src/components/hr/EmployeeFileShell.tsx"
echo "OK  P2 M4 module + frontend wiring"
