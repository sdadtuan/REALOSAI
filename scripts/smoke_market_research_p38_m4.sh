#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-100' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P38' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P38' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
test -f "$ROOT/scripts/deploy_market_research_p38_vps.sh"
test -f "$ROOT/scripts/apply_pg_ddl_market_research_p38.sh"
test -f "$ROOT/docs/specs/2026-08-16-postgresql-ddl-market-research-p38.sql"
echo "OK  P38 M4 docs + deploy + DDL"
