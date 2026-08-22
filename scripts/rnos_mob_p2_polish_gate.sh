#!/usr/bin/env bash
# RNOS-MOB-P2 — Mobile polish gate (post M1/M2 stable)
#   bash scripts/rnos_mob_p2_polish_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-mob-p2-polish-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-MOB-P2 Mobile Polish Gate =="

for f in \
  services/ops-web/src/components/mobile/PullToRefresh.tsx \
  services/ops-web/src/components/ai/LeadCopilotPanel.tsx \
  services/ops-web/src/app/crm/leads/[id]/page.tsx \
  services/ops-web/src/app/crm/leads/page.tsx \
  services/portal-web/src/components/mobile/PortalSwipeActions.tsx \
  services/portal-web/src/components/CreativeInbox.tsx \
  scripts/mob_p2_polish_staging_cutover.sh \
  scripts/mob_p2_polish_staging_cutover_vps.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'ai-copilot-panel--sheet' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-bottom-sheet" "AI bottom sheet CSS"
else
  log_fail "css-bottom-sheet" "Missing ai-copilot-panel--sheet"
fi

if grep -q 'lead-list-pull-refresh' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-pull-refresh" "Pull refresh CSS"
else
  log_fail "css-pull-refresh" "Missing lead-list-pull-refresh"
fi

if grep -q 'portal-approval-swipe' "$ROOT/services/portal-web/src/app/globals.css"; then
  log_ok "css-portal-swipe" "Portal swipe CSS"
else
  log_fail "css-portal-swipe" "Missing portal-approval-swipe"
fi

if grep -q "variant === 'sheet'" "$ROOT/services/ops-web/src/components/ai/LeadCopilotPanel.tsx"; then
  log_ok "copilot-sheet-variant" "LeadCopilotPanel sheet variant"
else
  log_fail "copilot-sheet-variant" "Missing sheet variant"
fi

echo ""
echo "==> ops-web typecheck"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit >/tmp/rnos-p2-ops-typecheck.log 2>&1); then
  log_ok "ops-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-typecheck" "See /tmp/rnos-p2-ops-typecheck.log"
fi

echo ""
echo "==> portal-web typecheck"
if (cd "$ROOT/services/portal-web" && npx tsc --noEmit >/tmp/rnos-p2-portal-typecheck.log 2>&1); then
  log_ok "portal-typecheck" "tsc --noEmit OK"
else
  log_fail "portal-typecheck" "See /tmp/rnos-p2-portal-typecheck.log"
fi

if [[ "${RUN_E2E:-0}" == "1" ]]; then
  echo ""
  echo "==> M1 PWA gate (includes lead-detail mobile E2E)"
  if bash "$ROOT/scripts/rnos41_pwa_gate.sh"; then
    log_ok "m1-gate" "rnos41_pwa_gate PASS"
  else
    log_fail "m1-gate" "rnos41_pwa_gate FAIL"
  fi
  echo ""
  echo "==> M2 portal gate"
  if bash "$ROOT/scripts/rnos_m2_portal_pwa_gate.sh"; then
    log_ok "m2-gate" "rnos_m2_portal_pwa_gate PASS"
  else
    log_fail "m2-gate" "rnos_m2_portal_pwa_gate FAIL"
  fi
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
  "rnos": "RNOS-MOB-P2",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Report: $REPORT"
echo "PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]
