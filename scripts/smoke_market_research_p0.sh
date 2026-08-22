#!/usr/bin/env bash
# Run Market Research OS smokes M0–M7 when the script exists.
#
#   bash scripts/smoke_market_research_p0.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P0 smoke (m0–m7 if present) =="

for mile in m0 m1 m2 m3 m4 m5 m6 m7; do
  script="$ROOT/scripts/smoke_market_research_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p0"
