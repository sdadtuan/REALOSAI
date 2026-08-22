#!/usr/bin/env bash
# Run Market Research OS P3 smokes M1–M5 when the script exists.
#
#   bash scripts/smoke_market_research_p3.sh
#
# Each p3_mN script skips live when API is down (same pattern as the milestone smokes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P3 smoke (m1–m5 if present) =="

for mile in m1 m2 m3 m4 m5; do
  script="$ROOT/scripts/smoke_market_research_p3_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p3"
