#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-081' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P20 — RES-UC-081' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P20' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
test -f "$ROOT/scripts/deploy_market_research_p20_vps.sh"
echo "OK  P20 M4 docs + deploy script"
