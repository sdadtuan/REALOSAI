#!/usr/bin/env bash
# Run Market Research OS P9 smokes M1–M4 when the script exists.
#
#   bash scripts/smoke_market_research_p9.sh
#
# Live M4 skips when sparktoro_enabled is false (prod default).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P9 smoke (m1–m4) =="

for mile in m1 m2 m3 m4; do
  script="$ROOT/scripts/smoke_market_research_p9_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p9"
