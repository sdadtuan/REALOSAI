#!/usr/bin/env bash
# Full LMP acceptance chain P0→P4 (S-LMP-6 LMP-72)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== LMP full gate (P0→P4) =="
bash "$ROOT/scripts/lead_meeting_prep_gate.sh"
bash "$ROOT/scripts/lmp_p4_gate.sh"
echo "PASS lmp_full_gate"
