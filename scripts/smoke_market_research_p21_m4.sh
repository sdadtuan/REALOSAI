#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-082' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P21 — RES-UC-082' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P21' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
grep -q 'ConjointPane' "$ROOT/services/ops-web/src/components/research/ConjointPane.tsx"
test -f "$ROOT/scripts/deploy_market_research_p21_vps.sh"
echo "OK  P21 M4 docs + ops-web + deploy script"
