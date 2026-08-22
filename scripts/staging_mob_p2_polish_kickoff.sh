#!/usr/bin/env bash
# RNOS-MOB-P2 kickoff — gate before VPS cutover
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "== RNOS-MOB-P2 Kickoff =="
bash "$ROOT/scripts/rnos_mob_p2_polish_gate.sh"
echo "OK  P2 kickoff — see .local-dev/rnos-mob-p2-polish-gate-report.json"
