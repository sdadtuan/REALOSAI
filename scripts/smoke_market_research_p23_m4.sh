#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-084' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P23' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P23' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
test -f "$ROOT/docs/specs/2026-08-16-talkwalker-brandwatch-bakeoff-scorecard.md"
test -f "$ROOT/scripts/deploy_market_research_p23_vps.sh"
test -f "$ROOT/docs/specs/2026-08-16-postgresql-ddl-market-research-p23.sql"
echo "OK  P23 M4 docs + scorecard + deploy + DDL"
