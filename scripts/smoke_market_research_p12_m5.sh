#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/scripts/deploy_market_research_p12_vps.sh"
grep -q 'portal-web' "$ROOT/scripts/deploy_market_research_p12_vps.sh"
grep -q 'Walkthrough UAT P12' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
grep -q 'RES-UC-073' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
echo "OK  P12 M5 deploy script + UAT docs present"
