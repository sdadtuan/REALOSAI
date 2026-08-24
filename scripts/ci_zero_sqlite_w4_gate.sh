#!/usr/bin/env bash
# Zero SQLite Wave 4 P5 — CI / pre-deploy gate
#
# Checks:
#   W4-G01  Zero *-sqlite.repository.ts in Nest src/
#   W4-G02  Zero `new DatabaseSync` in Nest src/ except *.spec.ts
#   W4-G04  services/ptt-crm-api npm run build OK
#
# Usage:
#   ./scripts/ci_zero_sqlite_w4_gate.sh
#   ./scripts/ci_zero_sqlite_w4_gate.sh --skip-build
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

SKIP_BUILD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      echo "Usage: ci_zero_sqlite_w4_gate.sh [--skip-build]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

NEST_SRC="$ROOT/services/ptt-crm-api/src"
NEST_PKG="$ROOT/services/ptt-crm-api"

echo "== Zero SQLite W4 gate =="
echo ""

# W4-G01 — no sqlite repository injectables
SQLITE_REPOS=0
if [[ -d "$NEST_SRC" ]]; then
  while IFS= read -r -d '' f; do
    SQLITE_REPOS=$((SQLITE_REPOS + 1))
    bad "W4-G01 unexpected sqlite repo: ${f#$NEST_SRC/}"
  done < <(find "$NEST_SRC" -name '*-sqlite.repository.ts' -print0 2>/dev/null || true)
fi
if [[ "$SQLITE_REPOS" -eq 0 ]]; then
  ok "W4-G01 zero *-sqlite.repository.ts in Nest src/"
fi

# W4-G02 — no runtime DatabaseSync instantiation
DS_LIST=""
while IFS= read -r -d '' f; do
  [[ "$f" == *.spec.ts ]] && continue
  grep -q 'new DatabaseSync' "$f" 2>/dev/null || continue
  DS_LIST+="${f#$NEST_SRC/}"$'\n'
done < <(find "$NEST_SRC" -name '*.ts' -print0 2>/dev/null || true)
DS_LIST="$(printf '%s' "$DS_LIST" | sed '/^$/d' | sort -u)"
DS_COUNT=0
if [[ -n "$DS_LIST" ]]; then
  DS_COUNT="$(printf '%s\n' "$DS_LIST" | sed '/^$/d' | wc -l | tr -d ' ')"
fi
if [[ "$DS_COUNT" -ne 0 ]]; then
  bad "W4-G02 Nest new DatabaseSync outside specs count=$DS_COUNT"
  printf '%s\n' "$DS_LIST" | sed 's/^/       /'
else
  ok "W4-G02 zero new DatabaseSync outside *.spec.ts"
fi

# W4-G04 — Nest build
BUILD_OK=0
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  ok "W4-G04 Nest build skipped (--skip-build)"
  BUILD_OK=1
elif [[ -d "$NEST_PKG" ]]; then
  echo ""
  echo "==> W4-G04 npm run build (ptt-crm-api)"
  if (cd "$NEST_PKG" && npm run build >/dev/null); then
    ok "W4-G04 Nest npm run build PASS"
    BUILD_OK=1
  else
    bad "W4-G04 Nest npm run build FAIL — run: cd services/ptt-crm-api && npm run build"
  fi
else
  bad "W4-G04 missing services/ptt-crm-api"
fi

REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w4-gate-report.json"
DS_JSON="$(printf '%s\n' "$DS_LIST" | sed '/^$/d' | "$PYTHON" -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
export W4_GATE_FAIL="$fail"
export W4_GATE_SQLITE_REPOS="$SQLITE_REPOS"
export W4_GATE_DS_COUNT="$DS_COUNT"
export W4_GATE_DS_JSON="$DS_JSON"
export W4_GATE_BUILD_OK="$BUILD_OK"
export W4_GATE_REPORT="$REPORT"
"$PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

fail = os.environ.get("W4_GATE_FAIL", "1")
report = {
    "phase": "zero-sqlite-w4-gate",
    "ok": fail == "0",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "checks": {
        "sqlite_repository_count": int(os.environ.get("W4_GATE_SQLITE_REPOS", "0")),
        "database_sync_outside_specs": int(os.environ.get("W4_GATE_DS_COUNT", "0")),
        "database_sync_files": json.loads(os.environ.get("W4_GATE_DS_JSON", "[]")),
        "nest_build_ok": os.environ.get("W4_GATE_BUILD_OK", "0") == "1",
    },
    "notes": "W4-G03 (W3 verify PASS) runs in ci_zero_sqlite_w4_verify.sh",
}
out = Path(os.environ["W4_GATE_REPORT"])
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → ok={report['ok']} → {out}")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W4 gate: FAIL"
  exit 1
fi
echo "Zero SQLite W4 gate: PASS"
exit 0
