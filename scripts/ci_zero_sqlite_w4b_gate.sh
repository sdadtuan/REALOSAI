#!/usr/bin/env bash
# Zero SQLite Wave 4b — legacy inventory + active-script hygiene
#
# Checks:
#   W4b-G01  Zero node:sqlite imports in Nest src/ except *.spec.ts
#   W4b-G02  Active e2e/staging scripts PG-only (no export PTT_SQLITE_PATH)
#   W4b-G03  Legacy manifest present (scripts/legacy/zero-sqlite/README.md)
#
# Usage:
#   ./scripts/ci_zero_sqlite_w4b_gate.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
mkdir -p "$PTT_ARTIFACTS_DIR"

fail=0
ok() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

NEST_SRC="$ROOT/services/ptt-crm-api/src"

echo "== Zero SQLite W4b gate =="
echo ""

# W4b-G01 — no node:sqlite in runtime Nest (specs only)
SQLITE_IMPORT_LIST=""
while IFS= read -r -d '' f; do
  [[ "$f" == *.spec.ts ]] && continue
  grep -qE "from ['\"]node:sqlite['\"]" "$f" 2>/dev/null || continue
  SQLITE_IMPORT_LIST+="${f#$NEST_SRC/}"$'\n'
done < <(find "$NEST_SRC" -name '*.ts' -print0 2>/dev/null || true)
SQLITE_IMPORT_LIST="$(printf '%s' "$SQLITE_IMPORT_LIST" | sed '/^$/d' | sort -u)"
SQLITE_IMPORT_COUNT=0
if [[ -n "$SQLITE_IMPORT_LIST" ]]; then
  SQLITE_IMPORT_COUNT="$(printf '%s\n' "$SQLITE_IMPORT_LIST" | sed '/^$/d' | wc -l | tr -d ' ')"
fi
if [[ "$SQLITE_IMPORT_COUNT" -ne 0 ]]; then
  bad "W4b-G01 node:sqlite imports outside specs count=$SQLITE_IMPORT_COUNT"
  printf '%s\n' "$SQLITE_IMPORT_LIST" | sed 's/^/       /'
else
  ok "W4b-G01 zero node:sqlite imports outside *.spec.ts"
fi

# W4b-G02 — active scripts must not export PTT_SQLITE_PATH
ACTIVE_SCRIPTS=(
  local_crm_api_up.sh
  phase5_portal_seo_e2e_gate.sh
  staging_phase2_gate_pack.sh
  staging_phase3_gate_pack.sh
  staging_phase4_gate_pack.sh
  staging_phase5_full_gate.sh
)
W4B02_FAIL=0
for f in "${ACTIVE_SCRIPTS[@]}"; do
  p="$ROOT/scripts/$f"
  if [[ ! -f "$p" ]]; then
    bad "W4b-G02 missing scripts/$f"
    W4B02_FAIL=1
    continue
  fi
  if grep -qE '^export PTT_SQLITE_PATH=' "$p" 2>/dev/null; then
    bad "W4b-G02 scripts/$f must not export PTT_SQLITE_PATH (use e2e_pg_bootstrap.sh)"
    W4B02_FAIL=1
  fi
done
if [[ "$W4B02_FAIL" -eq 0 ]]; then
  ok "W4b-G02 active staging/local scripts PG-only (${#ACTIVE_SCRIPTS[@]} files)"
fi

# W4b-G03 — legacy manifest
LEGACY_README="$ROOT/scripts/legacy/zero-sqlite/README.md"
if [[ -f "$LEGACY_README" ]]; then
  ok "W4b-G03 legacy manifest scripts/legacy/zero-sqlite/README.md"
else
  bad "W4b-G03 missing $LEGACY_README"
fi

REPORT="$PTT_ARTIFACTS_DIR/zero-sqlite-w4b-gate-report.json"
SQLITE_IMPORT_JSON="$(printf '%s\n' "$SQLITE_IMPORT_LIST" | sed '/^$/d' | "$PYTHON" -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
export W4B_GATE_FAIL="$fail"
export W4B_GATE_IMPORT_COUNT="$SQLITE_IMPORT_COUNT"
export W4B_GATE_IMPORT_JSON="$SQLITE_IMPORT_JSON"
export W4B_GATE_REPORT="$REPORT"
"$PYTHON" - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

fail = os.environ.get("W4B_GATE_FAIL", "1")
report = {
    "phase": "zero-sqlite-w4b-gate",
    "ok": fail == "0",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "checks": {
        "node_sqlite_imports_outside_specs": int(os.environ.get("W4B_GATE_IMPORT_COUNT", "0")),
        "node_sqlite_import_files": json.loads(os.environ.get("W4B_GATE_IMPORT_JSON", "[]")),
    },
    "notes": "Migration/backfill scripts listed in scripts/legacy/zero-sqlite/README.md",
}
out = Path(os.environ["W4B_GATE_REPORT"])
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Report → ok={report['ok']} → {out}")
if not report["ok"]:
    raise SystemExit(1)
PY

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Zero SQLite W4b gate: FAIL"
  exit 1
fi
echo "Zero SQLite W4b gate: PASS"
exit 0
