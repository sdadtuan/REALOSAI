#!/usr/bin/env bash
# RNOS-M3 Phase 1 — Capacitor shell gate
#   bash scripts/rnos_m3_phase1_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-phase1-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-M3 Phase 1 — Capacitor Shell Gate =="

for f in \
  services/mobile-shell/src/shell-bootstrap.ts \
  services/mobile-shell/src/deep-link.ts \
  services/mobile-shell/scripts/build-www.mjs \
  services/mobile-shell/resources/ios/universal-links.md \
  services/mobile-shell/resources/android/deep-link-intent-filter.snippet.xml \
  services/mobile-shell/env.example \
  services/portal-web/src/components/capacitor/CapacitorShellInit.tsx \
  services/portal-web/src/lib/capacitorDeepLink.ts \
  scripts/m3_mobile_shell_init.sh \
  scripts/m3_mobile_shell_sync.sh \
  docs/runbooks/m3-phase1-capacitor-shell-checklist.md; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'CAPACITOR_PORTAL_URL' "$ROOT/services/mobile-shell/capacitor.config.ts"; then
  log_ok "webview-url" "server.url uses CAPACITOR_PORTAL_URL"
else
  log_fail "webview-url" "Missing CAPACITOR_PORTAL_URL in capacitor.config.ts"
fi

if grep -q "scheme: 'pttads'" "$ROOT/services/mobile-shell/capacitor.config.ts"; then
  log_ok "deep-link-scheme" "pttads scheme configured"
else
  log_fail "deep-link-scheme" "Missing ios.scheme pttads"
fi

if grep -q 'StatusBar' "$ROOT/services/mobile-shell/capacitor.config.ts"; then
  log_ok "splash-statusbar-config" "Splash + StatusBar plugins in config"
else
  log_fail "splash-statusbar-config" "Missing StatusBar/SplashScreen config"
fi

if grep -q 'X-PTT-Client' "$ROOT/services/portal-web/src/components/capacitor/CapacitorShellInit.tsx"; then
  log_ok "header-analytics" "fetch patched with X-PTT-Client"
else
  log_fail "header-analytics" "Missing CapacitorShellInit fetch patch"
fi

if grep -q 'appUrlOpen' "$ROOT/services/portal-web/src/components/capacitor/CapacitorShellInit.tsx"; then
  log_ok "deep-link-listener" "App.addListener appUrlOpen wired"
else
  log_fail "deep-link-listener" "Missing deep link listener"
fi

if grep -q 'focusCreativeId' "$ROOT/services/portal-web/src/app/creatives/page.tsx"; then
  log_ok "creatives-focus" "Deep link focus query on /creatives"
else
  log_fail "creatives-focus" "Missing ?focus= on creatives page"
fi

if [[ -x "$ROOT/scripts/m3_mobile_shell_init.sh" && -x "$ROOT/scripts/m3_mobile_shell_sync.sh" ]]; then
  log_ok "shell-scripts-exec" "init/sync scripts executable"
else
  log_fail "shell-scripts-exec" "chmod +x m3_mobile_shell_*.sh"
fi

echo ""
echo "==> mobile-shell build:www + typecheck"
if (
  cd "$ROOT/services/mobile-shell"
  npm install --no-audit --no-fund >/tmp/rnos-m3-p1-shell-npm.log 2>&1
  npm run build:www >/tmp/rnos-m3-p1-shell-build.log 2>&1
  npm run typecheck >/tmp/rnos-m3-p1-shell-tsc.log 2>&1
); then
  log_ok "mobile-shell-build" "build:www + tsc OK"
else
  log_fail "mobile-shell-build" "See /tmp/rnos-m3-p1-shell-build.log"
fi

echo ""
echo "==> portal-web typecheck"
if (
  cd "$ROOT/services/portal-web"
  npm install --no-audit --no-fund >/tmp/rnos-m3-p1-portal-npm.log 2>&1
  npx tsc --noEmit >/tmp/rnos-m3-p1-portal-tsc.log 2>&1
); then
  log_ok "portal-web-typecheck" "tsc --noEmit OK"
else
  log_fail "portal-web-typecheck" "See /tmp/rnos-m3-p1-portal-tsc.log"
fi

echo ""
echo "==> deep-link resolver smoke"
if python3 - <<'PY' >/tmp/rnos-m3-p1-deeplink.log 2>&1
from pathlib import Path
text = Path("services/portal-web/src/lib/capacitorDeepLink.ts").read_text()
assert "pttads" in text and "approve" in text and "/creatives?focus=" in text
print("deep-link source OK")
PY
then
  log_ok "deep-link-smoke" "capacitorDeepLink.ts routes approve → /creatives?focus="
else
  log_fail "deep-link-smoke" "Deep link resolver check failed"
fi

if [[ -f "$ROOT/services/mobile-shell/www/shell-bootstrap.js" ]]; then
  log_ok "shell-bootstrap-built" "www/shell-bootstrap.js present"
else
  log_fail "shell-bootstrap-built" "build:www did not produce shell-bootstrap.js"
fi

echo ""
if [[ "${M3_SKIP_BACKEND_GATE:-0}" == "1" ]]; then
  log_ok "m3-backend-gate" "Skipped (M3_SKIP_BACKEND_GATE=1)"
elif bash "$ROOT/scripts/rnos_m3_backend_gate.sh" >/tmp/rnos-m3-p1-backend-gate.log 2>&1; then
  log_ok "m3-backend-gate" "rnos_m3_backend_gate PASS"
else
  log_fail "m3-backend-gate" "See /tmp/rnos-m3-p1-backend-gate.log"
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
  "rnos": "RNOS-M3-Phase1",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "== Summary: $pass pass / $fail fail =="
[[ "$fail" -eq 0 ]]
