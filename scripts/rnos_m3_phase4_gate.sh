#!/usr/bin/env bash
# RNOS-M3 Phase 4 — GA store gate
#   bash scripts/rnos_m3_phase4_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-phase4-gate-report.json}"
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
  "rnos": "RNOS-M3-Phase4",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}, indent=2) + "\\n")
PY
  rm -f "$tmp"
}
trap '_write_report' EXIT

echo "== RNOS-M3 Phase 4 — GA Store Gate =="

for f in \
  deploy/env.m3-ga-prod.example \
  docs/runbooks/m3-phase4-ga-store-checklist.md \
  docs/runbooks/m3-sentry-native-webview-monitoring.md \
  docs/templates/m3-phase4-signoff-template.json \
  scripts/m3_store_ga_release_ios.sh \
  scripts/m3_store_ga_release_android.sh \
  scripts/m3_ga_sentry_verify.sh \
  scripts/m3_ga_rollback_min_version_block.sh \
  scripts/m3_ga_rollback_pull_listing.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'lane :release' "$ROOT/services/mobile-shell/fastlane/Fastfile"; then
  log_ok "fastlane-ios-release" "ios release lane"
else
  log_fail "fastlane-ios-release" "Missing fastlane ios release"
fi

if grep -q 'lane :production' "$ROOT/services/mobile-shell/fastlane/Fastfile"; then
  log_ok "fastlane-android-production" "android production lane"
else
  log_fail "fastlane-android-production" "Missing fastlane android production"
fi

echo ""
echo "==> Phase 3 gate (nested)"
if SKIP_IOS_BUILD=1 SKIP_ANDROID_BUILD=1 RUN_DEEPLINK_SMOKE=0 bash "$ROOT/scripts/rnos_m3_phase3_gate.sh" >/tmp/rnos-m3-p4-p3.log 2>&1; then
  log_ok "phase3-gate-nested" "rnos_m3_phase3_gate PASS"
else
  log_fail "phase3-gate-nested" "See /tmp/rnos-m3-p4-p3.log"
fi

echo ""
echo "==> Sentry GA verify"
if bash "$ROOT/scripts/m3_ga_sentry_verify.sh" >/tmp/rnos-m3-p4-sentry.log 2>&1; then
  log_ok "sentry-verify" "m3_ga_sentry_verify PASS"
else
  log_fail "sentry-verify" "See /tmp/rnos-m3-p4-sentry.log"
fi

if grep -q 'capacitor-portal' "$ROOT/services/portal-web/src/lib/sentry.client.ts"; then
  log_ok "sentry-capacitor-tag" "client:capacitor-portal wired"
else
  log_fail "sentry-capacitor-tag" "Missing Sentry capacitor tags"
fi

if grep -q 'PTT_MOBILE_MIN_VERSION' "$ROOT/deploy/env.m3-ga-prod.example"; then
  log_ok "rollback-env-doc" "min_version rollback documented"
else
  log_fail "rollback-env-doc" "Missing rollback env in ga prod example"
fi

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Report: $REPORT"
[[ "$fail" -eq 0 ]]
