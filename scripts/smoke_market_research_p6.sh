#!/usr/bin/env bash
# Run Market Research OS P6 smokes M1–M5 when the script exists.
#
#   bash scripts/smoke_market_research_p6.sh
#
# Each p6_mN script skips live when API is down or Qualtrics/SparkToro is off
# (same pattern as the milestone smokes).
#
# Gates (documented in milestone smokes):
#   PII cell → 400 survey_pii_forbidden
#   BR-RES-02 missing value+unit+base → 400
#   POST van-westendorp not PRICE_OFFER → 400 vw_not_price_offer
#   import / VW / Qualtrics do not createInsight
#   Qualtrics flag/key off → 200 {ok:true, note:qualtrics_disabled}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P6 smoke (m1–m5 if present) =="

for mile in m1 m2 m3 m4 m5; do
  script="$ROOT/scripts/smoke_market_research_p6_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p6"
