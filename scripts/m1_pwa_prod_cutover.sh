#!/usr/bin/env bash
# M1 — PWA staff prod cutover on VPS (RNOS-41)
#   APPLY=0 ./scripts/m1_pwa_prod_cutover.sh          # dry-run preflight
#   APPLY=1 ./scripts/m1_pwa_prod_cutover.sh          # enable PWA + rebuild + restart
#   APPLY=1 ROLLBACK=1 ./scripts/m1_pwa_prod_cutover.sh  # disable PWA + rebuild + restart
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APPLY="${APPLY:-0}"
ROLLBACK="${ROLLBACK:-0}"
REPORT="${REPORT:-$ROOT/.local-dev/m1-pwa-prod-cutover-preflight.json}"
OPS_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
PUBLIC_URL="${M1_PWA_PUBLIC_URL:-$OPS_API_URL}"
ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"
STANDALONE="$ROOT/services/ops-web/.next/standalone"
PWA_FLAG="${NEXT_PUBLIC_PWA_ENABLED:-1}"
if [[ "$ROLLBACK" == "1" ]]; then
  PWA_FLAG=0
fi

pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_warn() { echo "WARN  $1 — $2"; }

write_report() {
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
  "rnos": "RNOS-41",
  "apply": int("$APPLY"),
  "rollback": int("$ROLLBACK"),
  "pwa_enabled": "$PWA_FLAG",
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
}

echo "== M1 PWA prod cutover (RNOS-41) =="
echo "   APPLY=$APPLY ROLLBACK=$ROLLBACK"
echo "   NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG"
echo "   NEXT_PUBLIC_PTT_API_URL=$OPS_API_URL"
echo "   PUBLIC_URL=$PUBLIC_URL"
echo ""

# ── Artifacts ──
for f in \
  services/ops-web/src/app/manifest.ts \
  services/ops-web/public/sw.js \
  services/ops-web/public/icons/icon.svg \
  services/ops-web/src/components/pwa/PwaShell.tsx; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if systemctl is-active --quiet ptt-crm-api 2>/dev/null; then
  log_ok "service-ptt-crm-api" "active"
else
  log_warn "service-ptt-crm-api" "not active (start before staff smoke)"
fi

if systemctl is-active --quiet ptt-ops-web 2>/dev/null; then
  log_ok "service-ptt-ops-web" "active"
else
  log_warn "service-ptt-ops-web" "not active"
fi

if [[ "$APPLY" != "1" ]]; then
  echo ""
  echo "DRY-RUN only — set APPLY=1 to rebuild ops-web and restart ptt-ops-web"
  write_report
  [[ "$fail" -eq 0 ]]
  exit $?
fi

echo ""
echo "==> Backup reminder"
if [[ -x "$ROOT/scripts/backup_ptt_data.sh" ]]; then
  echo "    Run: ./scripts/backup_ptt_data.sh (required before prod cutover)"
else
  log_warn "backup-script" "backup_ptt_data.sh not found"
fi

echo ""
echo "==> Update .env NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^NEXT_PUBLIC_PWA_ENABLED=' "$ENV_FILE"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s/^NEXT_PUBLIC_PWA_ENABLED=.*/NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG/" "$ENV_FILE"
    else
      sed -i "s/^NEXT_PUBLIC_PWA_ENABLED=.*/NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG/" "$ENV_FILE"
    fi
  else
    echo "NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG" >> "$ENV_FILE"
  fi
  log_ok "env-pwa-flag" "Updated $ENV_FILE"
else
  log_warn "env-file" "$ENV_FILE not found — export NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG during build"
fi

echo ""
echo "==> Generate PWA PNG icons (RNOS-41.1)"
python3 "$ROOT/scripts/generate_ops_pwa_icons.py"

echo ""
echo "==> Rebuild ops-web"
AI_COPILOT_FLAG=1
if [[ -f "$ENV_FILE" ]] && grep -q '^NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=' "$ENV_FILE"; then
  AI_COPILOT_FLAG="$(grep '^NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
(
  cd "$ROOT/services/ops-web"
  npm ci
  export NEXT_PUBLIC_PTT_API_URL="$OPS_API_URL"
  export NEXT_PUBLIC_PWA_ENABLED="$PWA_FLAG"
  export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED="${AI_COPILOT_FLAG:-1}"
  npm run build
  mkdir -p .next/standalone/.next
  rm -rf .next/standalone/.next/static .next/standalone/public
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public
)

if [[ -f "$STANDALONE/public/sw.js" ]]; then
  log_ok "standalone-sw" "$STANDALONE/public/sw.js"
else
  log_fail "standalone-sw" "sw.js missing after build"
fi

if [[ -d "$STANDALONE/.next/static/css" ]]; then
  log_ok "standalone-static" "CSS present"
else
  log_fail "standalone-static" "Missing .next/static in standalone"
fi

echo ""
echo "==> Restart ptt-ops-web"
if command -v systemctl >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl restart ptt-ops-web
  elif sudo -n systemctl restart ptt-ops-web 2>/dev/null; then
    :
  else
    echo "WARN  Run manually: sudo systemctl restart ptt-ops-web"
    log_warn "systemctl-restart" "Need sudo for systemctl restart ptt-ops-web"
  fi
  sleep 2
  if systemctl is-active --quiet ptt-ops-web 2>/dev/null; then
    log_ok "ops-web-restart" "ptt-ops-web active"
  else
    log_fail "ops-web-restart" "ptt-ops-web not active after restart"
  fi
else
  log_warn "systemctl" "systemctl not available — restart ops-web manually"
fi

echo ""
echo "==> Verify HTTPS (may fail from local dev without DNS)"
if curl -sf "${PUBLIC_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  START_URL=$(curl -sf "${PUBLIC_URL}/manifest.webmanifest" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("start_url",""))' 2>/dev/null || echo "")
  if [[ "$START_URL" == "/crm/leads" ]]; then
    log_ok "prod-manifest" "${PUBLIC_URL}/manifest.webmanifest start_url=/crm/leads"
  else
    log_warn "prod-manifest" "start_url=$START_URL (expected /crm/leads)"
  fi
else
  log_warn "prod-manifest" "Could not reach ${PUBLIC_URL}/manifest.webmanifest (check DNS/VPN or run curl on VPS)"
fi

if curl -sf "${PUBLIC_URL}/sw.js" 2>/dev/null | grep -q 'ptt-ops-pwa-v1'; then
  log_ok "prod-sw" "${PUBLIC_URL}/sw.js"
else
  log_warn "prod-sw" "Could not verify ${PUBLIC_URL}/sw.js (run on VPS after restart)"
fi

write_report
[[ "$fail" -eq 0 ]]
