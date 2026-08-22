#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-097' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'RES-UC-098' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P36' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P36' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
test -f "$ROOT/scripts/deploy_market_research_p36_vps.sh"
test -f "$ROOT/scripts/apply_pg_ddl_market_research_p36.sh"
echo "OK  P36 M4 docs + deploy"
