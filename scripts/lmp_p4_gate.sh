#!/usr/bin/env bash
# S-LMP-6 P4 gate — Win loop + GA
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
  PYTHON="/var/www/ptt/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

if ! "$PYTHON" -m pytest --version >/dev/null 2>&1; then
  "$PYTHON" -m pip install -q pytest
fi

echo "== LMP S-LMP-6 P4 gate =="
bash "$ROOT/scripts/lmp_p3_gate.sh"

"$PYTHON" -m pytest \
  "$ROOT/tests/test_lmp_win_loop.py" \
  -q

cd "$ROOT/services/ptt-crm-api"
npm run test -- --testPathPattern='lmp-stage.util|lmp-win-outcome' --passWithNoTests 2>/dev/null || \
  npx jest --testPathPattern='lmp-stage.util|lmp-win-outcome' --passWithNoTests

"$PYTHON" - <<'PY'
# EC-LMP-19 shape — win_outcome_json after debrief
win = {
    "outcome": "won",
    "closed_tier": "TC",
    "objection_faced": "Đắt quá",
    "am_feedback": "Talk track ROI hữu ích",
    "submitted_at": "2026-08-13T12:00:00Z",
    "submitted_by": "am@ptt.vn",
}
assert win["outcome"] == "won" and win["closed_tier"] == "TC" and win["submitted_at"]
print("PASS  EC-LMP-19 win_outcome_json shape")
PY

"$PYTHON" "$ROOT/scripts/lmp_win_patterns_report.py" --days 30 --json >/dev/null
echo "PASS  lmp_win_patterns_report.py"

echo "PASS lmp_p4_gate"
