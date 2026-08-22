#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNBOOK="$ROOT/docs/runbooks/market-research-rag-staging-backfill.md"
ACTIONS="$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
[[ -f "$RUNBOOK" ]] || { echo "FAIL  missing runbook"; exit 1; }
grep -q 'install_pgvector_vps.sh' "$RUNBOOK"
grep -q 'rag/reembed/preview' "$RUNBOOK"
grep -q 'Walkthrough UAT P13' "$ACTIONS"
grep -q 'Walkthrough UAT P39' "$ACTIONS"
echo "OK  P39 M2 runbook + Actions §P39 + P13 UAT cross-ref"
