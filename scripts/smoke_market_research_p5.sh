#!/usr/bin/env bash
# Run Market Research OS P5 smokes M1–M5 when the script exists.
#
#   bash scripts/smoke_market_research_p5.sh
#
# Each p5_mN script skips live when API is down, audio fixture is missing,
# or SparkToro is off (same pattern as the milestone smokes).
#
# Gates (documented in milestone smokes):
#   consent missing/expired → 400 consent_required|consent_expired
#   excerpt > 500 → 400 raw_transcript_forbidden
#   SparkToro does not createInsight
#   paid estimate tier high → 400 reliability_capped
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== Market Research P5 smoke (m1–m5 if present) =="

for mile in m1 m2 m3 m4 m5; do
  script="$ROOT/scripts/smoke_market_research_p5_${mile}.sh"
  if [[ -x "$script" || -f "$script" ]]; then
    echo "==> $script"
    bash "$script"
  else
    echo "SKIP $mile — $script not present"
  fi
done

echo "OK  smoke_market_research_p5"
