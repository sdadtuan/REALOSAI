#!/usr/bin/env bash
# RNOS-M3 Phase 3 — Pilot enterprise gate
#   bash scripts/rnos_m3_phase3_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-phase3-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

_write_report() {
  mkdir -p "$(dirname "$REPORT")"
  local tmp; tmp="$(mktemp)"
  printf '%s\n' "${results[@]}" > "$tmp"
  python3 - <<PY
import json, datetime
from pathlib import Path
checks = [json.loads(l) for l in Path("$tmp").read_text().splitlines() if l.strip()]
Path("$REPORT").write_text(json.dumps({
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-M3-Phase3",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}, indent=2) + "\\n")
PY
  rm -f "$tmp"
}
trap '_write_report' EXIT

echo "== RNOS-M3 Phase 3 — Pilot Enterprise Gate =="

for f in \
  deploy/m3-pilot-cohort.example.json \
  docs/runbooks/m3-phase3-pilot-enterprise-checklist.md \
  docs/templates/m3-pilot-uat-v1-checklist.md \
  docs/templates/m3-phase3-signoff-template.json \
  scripts/m3_pilot_cohort_validate.sh \
  scripts/m3_pilot_uat_probes.sh \
  scripts/m3_pilot_seed_uat_fixtures.sh \
  scripts/m3_pilot_kpi_collect.sh \
  services/portal-web/e2e/m3-pilot-uat-probes.spec.ts; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if [[ -x "$ROOT/scripts/m3_pilot_cohort_validate.sh" ]]; then
  log_ok "cohort-script-exec" "m3_pilot_cohort_validate.sh executable"
else
  log_fail "cohort-script-exec" "chmod +x m3_pilot_cohort_validate.sh"
fi

# Phase 2 prerequisite artifacts
if [[ -f "$ROOT/docs/templates/m3-app-store-review-notes.md" ]]; then
  log_ok "phase2-review-notes" "App Review notes present"
else
  log_fail "phase2-review-notes" "Complete Phase 2 first"
fi

echo ""
echo "==> Phase 2 capacitor gate (nested)"
if SKIP_IOS_BUILD=1 SKIP_ANDROID_BUILD=1 RUN_DEEPLINK_SMOKE=0 bash "$ROOT/scripts/rnos_m3_capacitor_gate.sh" >/tmp/rnos-m3-p3-cap-gate.log 2>&1; then
  log_ok "phase2-gate-nested" "rnos_m3_capacitor_gate PASS"
else
  log_fail "phase2-gate-nested" "See /tmp/rnos-m3-p3-cap-gate.log"
fi

echo ""
echo "==> UAT probes"
if bash "$ROOT/scripts/m3_pilot_uat_probes.sh" >/tmp/rnos-m3-p3-uat.log 2>&1; then
  log_ok "uat-probes" "m3_pilot_uat_probes PASS"
else
  log_fail "uat-probes" "See /tmp/rnos-m3-p3-uat.log"
fi

echo ""
echo "==> Playwright UAT resolver"
if (cd "$ROOT/services/portal-web" && PORTAL_E2E_SKIP_SERVER=1 npx playwright test e2e/m3-pilot-uat-probes.spec.ts --project=chromium >/tmp/rnos-m3-p3-pw.log 2>&1); then
  log_ok "uat-playwright" "m3-pilot-uat-probes.spec.ts PASS"
else
  log_fail "uat-playwright" "See /tmp/rnos-m3-p3-pw.log"
fi

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Report: $REPORT"
[[ "$fail" -eq 0 ]]
