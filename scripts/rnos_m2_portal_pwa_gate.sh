#!/usr/bin/env bash
# RNOS-M2 — Portal PWA + mobile nav gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORTAL_URL="${PORTAL_E2E_URL:-http://127.0.0.1:3100}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m2-portal-pwa-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-M2 Portal PWA Gate =="

for f in \
  services/portal-web/src/app/manifest.ts \
  services/portal-web/public/sw.js \
  services/portal-web/public/icons/icon.svg \
  services/portal-web/public/icons/icon-192.png \
  services/portal-web/public/icons/icon-512.png \
  services/portal-web/src/components/pwa/PortalPwaShell.tsx \
  services/portal-web/src/components/PortalMobileBottomNav.tsx \
  services/portal-web/src/hooks/usePortalPush.ts \
  services/portal-web/e2e/pwa-rnos-m2.spec.ts \
  services/ptt-crm-api/src/portal/portal-push.controller.ts \
  docs/specs/ddl-portal-push-subscriptions.sql \
  scripts/apply_pg_ddl_portal_push_m2.sh \
  scripts/playwright_portal_pwa_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'portal-mobile-bottom-nav' "$ROOT/services/portal-web/src/app/globals.css"; then
  log_ok "css-mobile-nav" "portal-mobile-bottom-nav in globals.css"
else
  log_fail "css-mobile-nav" "Missing mobile nav CSS"
fi

if grep -q 'test:e2e:pwa' "$ROOT/services/portal-web/package.json"; then
  log_ok "npm-script" 'test:e2e:pwa in package.json'
else
  log_fail "npm-script" 'Add test:e2e:pwa script'
fi

echo "==> portal-web TypeScript check"
if (
  cd "$ROOT/services/portal-web"
  export NEXT_PUBLIC_PWA_ENABLED=1
  npx tsc --noEmit
); then
  log_ok "portal-web-typecheck" "tsc --noEmit OK"
else
  log_fail "portal-web-typecheck" "TypeScript check failed"
fi

WEB_PID=""
_wait_http() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq 1 "$tries"); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

if ! curl -sf "${PORTAL_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  echo "==> Start portal-web for manifest/SW checks"
  (
    cd "$ROOT/services/portal-web"
    export PORTAL_PORT="${PORTAL_PORT:-$(node -e "console.log(new URL(process.argv[1]).port||3100)" "$PORTAL_URL")}"
    export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-http://127.0.0.1:3000}"
    export NEXT_PUBLIC_PWA_ENABLED=1
    npm run dev
  ) >/tmp/rnos-m2-gate-portal-web.log 2>&1 &
  WEB_PID=$!
  if _wait_http "${PORTAL_URL}/manifest.webmanifest" 90; then
    log_ok "portal-web-dev" "Started for gate checks"
  else
    log_fail "portal-web-dev" "Could not start portal-web — see /tmp/rnos-m2-gate-portal-web.log"
  fi
fi

if curl -sf "${PORTAL_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  log_ok "manifest-http" "${PORTAL_URL}/manifest.webmanifest"
else
  log_fail "manifest-http" "manifest not reachable"
fi

if curl -sf "${PORTAL_URL}/sw.js" | grep -q 'ptt-portal-pwa-v1'; then
  log_ok "sw-http" "${PORTAL_URL}/sw.js"
else
  log_fail "sw-http" "Service worker not served at /sw.js"
fi

[[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
WEB_PID=""

if bash "$ROOT/scripts/playwright_portal_pwa_e2e.sh"; then
  log_ok "playwright-e2e" "pwa-rnos-m2.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright Portal PWA E2E failed"
fi

if [[ -d "$ROOT/services/mobile-shell" && -f "$ROOT/services/mobile-shell/capacitor.config.ts" ]]; then
  log_ok "m3-scaffold" "services/mobile-shell present"
else
  log_fail "m3-scaffold" "Missing M3 Capacitor scaffold"
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
  "rnos": "RNOS-M2",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "== Summary: $pass pass / $fail fail =="
[[ "$fail" -eq 0 ]]
