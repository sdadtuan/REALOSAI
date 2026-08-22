#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p6.sql"
test -f "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-doc-wallet-me.service.ts"
test -f "$ROOT/services/ops-web/src/app/crm/hr/my-wallet/page.tsx"
test -f "$ROOT/services/ops-web/src/components/hr/HrPendingWalletQueue.tsx"
echo "OK  P6 M2 artifact check"
