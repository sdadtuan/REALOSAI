#!/usr/bin/env bash
# Run Market Research OS P7 smokes M1–M5 when the script exists.
#
#   bash scripts/smoke_market_research_p7.sh
#
# Each p7_mN script skips live when API is down or RAG is off
# (same pattern as the milestone smokes).
#
# Gates (documented in milestone smokes):
#   draft no hit
#   PII skip embed
#   403 no statement
#   flag off → rag_disabled
#   attach does not change statement
#   no createInsight
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P7 smoke (m1–m5 if present) =="

for mile in m1 m2 m3 m4 m5; do
  script="$ROOT/scripts/smoke_market_research_p7_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p7"
