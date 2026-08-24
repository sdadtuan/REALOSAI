#!/usr/bin/env bash
# Zero SQLite Wave 4 P5 — full verification matrix
#
# Checks:
#   W4-G01…G02,G04  via ci_zero_sqlite_w4_gate.sh
#   W4-G03          ci_zero_sqlite_w3_verify.sh PASS (Wave 3 matrix + zero stragglers)
#
# Usage:
#   ./scripts/ci_zero_sqlite_w4_verify.sh
#   ./scripts/ci_zero_sqlite_w4_verify.sh --skip-build
#   ./scripts/ci_zero_sqlite_w4_verify.sh --skip-gate   # W3 verify only
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

SKIP_GATE=0
SKIP_BUILD=0
GATE_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-gate) SKIP_GATE=1 ;;
    --skip-build) SKIP_BUILD=1; GATE_ARGS+=(--skip-build) ;;
    -h|--help)
      echo "Usage: ci_zero_sqlite_w4_verify.sh [--skip-gate] [--skip-build]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

W4_GATE_OK=0
W3_VERIFY_OK=0

echo "== Zero SQLite W4 P5 verify =="
echo ""

if [[ "$SKIP_GATE" -eq 0 ]]; then
  if [[ "${#GATE_ARGS[@]}" -gt 0 ]]; then
    if "$ROOT/scripts/ci_zero_sqlite_w4_gate.sh" "${GATE_ARGS[@]}"; then
      W4_GATE_OK=1
    else
      fail=1
    fi
  elif "$ROOT/scripts/ci_zero_sqlite_w4_gate.sh"; then
    W4_GATE_OK=1
  else
    fail=1
  fi
  echo ""
else
  W4_GATE_OK=1
  ok "W4 gate skipped (--skip-gate)"
fi

echo "==> W4-G03 W3 verify matrix"
if "$ROOT/scripts/ci_zero_sqlite_w3_verify.sh"; then
  ok "W4-G03 ci_zero_sqlite_w3_verify.sh PASS"
  W3_VERIFY_OK=1
else
  bad "W4-G03 ci_zero_sqlite_w3_verify.sh FAIL"
  fail=1
fi

REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w4-verify-report.json"
export W4_VERIFY_FAIL="$fail"
export W4_VERIFY_GATE_OK="$W4_GATE_OK"
export W4_VERIFY_W3_OK="$W3_VERIFY_OK"
export W4_VERIFY_REPORT="$REPORT"
"$PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

fail = os.environ.get("W4_VERIFY_FAIL", "1")
report = {
    "phase": "zero-sqlite-w4-p5",
    "ok": fail == "0",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "checks": {
        "w4_gate_ok": os.environ.get("W4_VERIFY_GATE_OK", "0") == "1",
        "w3_verify_ok": os.environ.get("W4_VERIFY_W3_OK", "0") == "1",
    },
    "artifacts": {
        "w4_gate": str(Path(os.environ.get("PTT_ARTIFACTS_DIR", ".")) / "zero-sqlite-w4-gate-report.json"),
        "w3_verify": str(Path(os.environ.get("PTT_ARTIFACTS_DIR", ".")) / "zero-sqlite-w3-p5-verify-report.json"),
    },
    "notes": "W4 complete when G01–G04 and W3 verify PASS; archive ptt.db is W4 P6",
}
out = Path(os.environ["W4_VERIFY_REPORT"])
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → ok={report['ok']} → {out}")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W4 P5 verify: FAIL"
  exit 1
fi
echo "Zero SQLite W4 P5 verify: PASS"
exit 0
