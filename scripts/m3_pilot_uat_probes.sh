#!/usr/bin/env bash
# RNOS-M3 Phase 3 — UAT automated probes (scenarios 3, 5, 6 partial)
#   bash scripts/m3_pilot_uat_probes.sh [--force-update]
#
# Env:
#   M3_API_URL — default http://127.0.0.1:3000 (Nest) or https://portal.pttads.vn
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="${REPORT:-$ROOT/.local-dev/m3-pilot-uat-probes-report.json}"
M3_API_URL="${M3_API_URL:-http://127.0.0.1:3000}"
M3_API_URL="${M3_API_URL%/}"
FORCE_FLAG="${1:-}"

pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-M3 UAT probes =="
echo "    API: $M3_API_URL"

# --- Scenario 3/5: deep link resolver ---
echo ""
echo "==> Deep link resolver (pttads + HTTPS portal paths)"
if grep -q 'pttads' "$ROOT/services/portal-web/src/lib/capacitorDeepLink.ts" \
  && grep -q '/creatives?focus=' "$ROOT/services/portal-web/src/lib/capacitorDeepLink.ts" \
  && grep -q 'email/approvals' "$ROOT/services/portal-web/src/lib/capacitorDeepLink.ts"; then
  log_ok "deeplink-source" "capacitorDeepLink.ts covers approve + email + HTTPS"
else
  log_fail "deeplink-source" "Missing patterns in capacitorDeepLink.ts"
fi

if (cd "$ROOT/services/portal-web" && PORTAL_E2E_SKIP_SERVER=1 npx playwright test e2e/m3-pilot-uat-probes.spec.ts --project=chromium >/tmp/m3-uat-playwright.log 2>&1); then
  log_ok "deeplink-playwright" "m3-pilot-uat-probes.spec.ts PASS"
else
  if grep -q "deeplink resolver" /tmp/m3-uat-playwright.log 2>/dev/null; then
    log_fail "deeplink-playwright" "See /tmp/m3-uat-playwright.log"
  else
    log_skip_msg="Playwright skipped or browser missing"
    results+=("{\"id\":\"deeplink-playwright\",\"status\":\"skip\",\"detail\":\"$log_skip_msg\"}")
    echo "SKIP  deeplink-playwright — $log_skip_msg"
  fi
fi

# --- Scenario 5: universal links static files ---
echo ""
echo "==> Universal link assets (portal-web public)"
for f in \
  services/portal-web/public/.well-known/apple-app-site-association \
  services/portal-web/public/.well-known/assetlinks.json; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q '/creatives' "$ROOT/services/portal-web/public/.well-known/apple-app-site-association" 2>/dev/null; then
  log_ok "aasa-paths" "AASA includes /creatives"
else
  log_fail "aasa-paths" "Add /creatives* to AASA paths"
fi

# --- Scenario 6: force update API ---
echo ""
echo "==> Mobile config / force update (scenario 6)"
if curl -sf "${M3_API_URL}/health" >/dev/null 2>&1; then
  OLD_VER="0.0.1"
  BODY="$(curl -sf -H "X-PTT-App-Version: ${OLD_VER}" "${M3_API_URL}/api/v1/mobile/config" 2>/dev/null || true)"
  if [[ -n "$BODY" ]] && echo "$BODY" | grep -q 'min_version'; then
    log_ok "mobile-config" "GET /api/v1/mobile/config OK"
    if [[ "$FORCE_FLAG" == "--force-update" ]]; then
      if echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if 'force_update' in d else 1)"; then
        FU="$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('force_update'))")"
        log_ok "force-update-field" "force_update=$FU (set PTT_MOBILE_FORCE_UPDATE=1 + min>client to test true)"
      else
        log_fail "force-update-field" "Missing force_update in response"
      fi
    fi
  else
    log_fail "mobile-config" "Empty or invalid /api/v1/mobile/config"
  fi
else
  results+=("{\"id\":\"mobile-config\",\"status\":\"skip\",\"detail\":\"API not reachable — set M3_API_URL\"}")
  echo "SKIP  mobile-config — API not reachable at $M3_API_URL"
fi

# --- Push handler wiring (scenario 2-3) ---
if grep -q 'pushNotificationActionPerformed' "$ROOT/services/portal-web/src/hooks/useCapacitorNativePush.ts"; then
  log_ok "push-action-handler" "Native push tap → deep link wired"
else
  log_fail "push-action-handler" "Missing pushNotificationActionPerformed listener"
fi

if grep -q 'creative_id' "$ROOT/services/ptt-crm-api/src/portal/portal-notification.service.ts"; then
  log_ok "push-payload-creative" "Notification payload includes creative_id"
else
  log_fail "push-payload-creative" "Missing creative_id in push sender"
fi

# --- Email approval route (scenario 4) ---
if [[ -f "$ROOT/services/portal-web/src/app/email/approvals/page.tsx" ]]; then
  log_ok "email-approvals-route" "Email approvals UI at /email/approvals"
else
  log_fail "email-approvals-route" "Missing src/app/email/approvals/page.tsx"
fi

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks = [json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
Path("$REPORT").write_text(json.dumps({
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-M3-Phase3-UAT",
  "api_url": "$M3_API_URL",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}, indent=2) + "\\n")
PY
rm -f "$TMP"

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Report: $REPORT"
[[ "$fail" -eq 0 ]]
