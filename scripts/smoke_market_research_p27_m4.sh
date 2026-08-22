#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-088' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P27' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P27' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
test -f "$ROOT/scripts/deploy_market_research_p27_vps.sh"
echo "OK  P27 M4 docs + deploy"
