#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rg -q 'WalletPanel' "$ROOT/services/ops-web/src/components/hr/WalletPanel.tsx"
rg -q 'wallet' "$ROOT/services/ops-web/src/components/hr/IdentityHeader.tsx"
rg -q 'fetchHrStaffWallet' "$ROOT/services/ops-web/src/lib/hr-employee-file-api.ts"
echo "OK  P4 M2 ops-web wallet wiring"
