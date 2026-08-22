#!/usr/bin/env bash
# RNOS-M3 — Backend + portal artifacts gate (no native builds)
#   bash scripts/rnos_m3_backend_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-backend-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-M3 Backend Gate =="

for f in \
  services/mobile-shell/capacitor.config.ts \
  services/mobile-shell/www/native-bridge.js \
  services/mobile-shell/README.md \
  services/portal-web/public/capacitor-native-bridge.js \
  services/portal-web/src/hooks/useCapacitorNativePush.ts \
  services/portal-web/src/lib/capacitor.ts \
  services/ptt-crm-api/src/portal/portal-mobile.controller.ts \
  services/ptt-crm-api/src/portal/portal-mobile.service.ts \
  services/ptt-crm-api/src/portal/portal-native-device.repository.ts \
  services/ptt-crm-api/src/portal/portal-native-push-sender.service.ts \
  docs/specs/ddl-portal-native-device-tokens.sql \
  scripts/apply_pg_ddl_portal_native_m3.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'PortalMobileController' "$ROOT/services/ptt-crm-api/src/portal/portal.module.ts"; then
  log_ok "nest-module-wire" "PortalMobileController in portal.module.ts"
else
  log_fail "nest-module-wire" "Wire PortalMobile* in portal.module.ts"
fi

if grep -q 'mobileNativePushEnabled' "$ROOT/services/ptt-crm-api/src/config/app-config.service.ts"; then
  log_ok "app-config-m3" "M3 env vars in app-config.service.ts"
else
  log_fail "app-config-m3" "Missing M3 config fields"
fi

if grep -q 'nativeSender' "$ROOT/services/ptt-crm-api/src/portal/portal-push-sender.service.ts"; then
  log_ok "push-fanout-native" "PortalPushSenderService fans out to native"
else
  log_fail "push-fanout-native" "Missing native fanout in push sender"
fi

if grep -q 'CapacitorNativePushCard' "$ROOT/services/portal-web/src/app/settings/page.tsx"; then
  log_ok "portal-settings-m3" "Settings native push card"
else
  log_fail "portal-settings-m3" "Missing CapacitorNativePushCard"
fi

if grep -q 'pttads' "$ROOT/services/mobile-shell/capacitor.config.ts"; then
  log_ok "deep-link-scheme" "pttads scheme in capacitor.config.ts"
else
  log_fail "deep-link-scheme" "Missing pttads deep link config"
fi

if [[ -x "$ROOT/scripts/apply_pg_ddl_portal_native_m3.sh" ]]; then
  log_ok "ddl-script-exec" "apply_pg_ddl_portal_native_m3.sh executable"
else
  log_fail "ddl-script-exec" "chmod +x scripts/apply_pg_ddl_portal_native_m3.sh"
fi

echo ""
echo "==> ptt-crm-api unit tests (portal mobile)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- --testPathPattern='portal-mobile|portal-native-push' --passWithNoTests >/tmp/rnos-m3-api-test.log 2>&1); then
  log_ok "api-unit-tests" "portal-mobile specs PASS"
else
  log_fail "api-unit-tests" "See /tmp/rnos-m3-api-test.log"
fi

echo ""
echo "==> ptt-crm-api TypeScript build"
if (cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit -p tsconfig.json >/tmp/rnos-m3-api-typecheck.log 2>&1); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "See /tmp/rnos-m3-api-typecheck.log"
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
  "rnos": "RNOS-M3-Backend",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "== Summary: $pass pass / $fail fail =="
[[ "$fail" -eq 0 ]]
