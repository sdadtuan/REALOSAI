#!/usr/bin/env bash
# Run Market Research OS P8 smokes M1–M4 when the script exists.
#
#   bash scripts/smoke_market_research_p8.sh
#
# Each p8_mN script skips live when API is down or RAG is off
# (same pattern as the milestone smokes).
#
# Gates (documented in milestone smokes):
#   flag off P0 prompt
#   draft not in prior
#   PII skip RAG
#   1 draft
#   no publish
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P8 smoke (m1–m4 if present) =="

for mile in m1 m2 m3 m4; do
  script="$ROOT/scripts/smoke_market_research_p8_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p8"
