#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'cj-whatif-persist' "$ROOT/services/ops-web/src/components/research/ConjointPane.tsx"
grep -q 'cj-whatif-history' "$ROOT/services/ops-web/src/components/research/ConjointPane.tsx"
grep -q "Get('projects/:id/conjoint/what-if')" "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'fetchResearchConjointWhatIfRuns' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'StaffMarketResearchWhatIfGuard' "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
echo "OK  P38 M3 persist UI + GET what-if API"
