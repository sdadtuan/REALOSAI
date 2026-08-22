#!/usr/bin/env bash
# RNOS-39 — AI Copilot E2E gate (bootstrap + Playwright + report)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos39-gate-report.json}"
pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

echo "== RNOS-39 Gate =="
echo "   Report: $REPORT"

for f in \
  services/ops-web/e2e/ai-copilot.spec.ts \
  services/ops-web/e2e/helpers/ai-copilot-helpers.ts \
  services/ops-web/e2e/README.md \
  scripts/playwright_ops_ai_copilot_e2e.sh \
  scripts/rnos39_e2e_bootstrap.sh \
  .github/workflows/rnos39-ai-copilot-e2e.yml; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'test:e2e:ai-copilot' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:ai-copilot in package.json'
else
  log_fail "npm-script" 'Add test:e2e:ai-copilot script'
fi

if bash "$ROOT/scripts/playwright_ops_ai_copilot_e2e.sh"; then
  log_ok "playwright-e2e" "ai-copilot.spec.ts PASS — see .local-dev/rnos39-e2e-report.json"
else
  log_fail "playwright-e2e" "Playwright E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-39",
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]
