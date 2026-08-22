#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q "conjoint/what-if" "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'cj-whatif-form' "$ROOT/services/ops-web/src/components/research/ConjointPane.tsx"
grep -q 'simulateResearchConjointWhatIf' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
echo "OK  P34 M3 API + staff form wiring"
