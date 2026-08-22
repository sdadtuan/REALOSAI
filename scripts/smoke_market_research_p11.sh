#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P11 smoke (m1–m5) =="
for mile in m1 m2 m3 m4 m5; do
  script="$ROOT/scripts/smoke_market_research_p11_${mile}.sh"
  echo "==> $script"
  bash "$script"
done
echo "OK  smoke_market_research_p11"
