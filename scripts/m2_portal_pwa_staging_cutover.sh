#!/usr/bin/env bash
# M2 — Portal PWA staging cutover on VPS (RNOS-M2)
#   APPLY=0 ./scripts/m2_portal_pwa_staging_cutover.sh
#   APPLY=1 ./scripts/m2_portal_pwa_staging_cutover.sh
#   APPLY=1 ROLLBACK=1 ./scripts/m2_portal_pwa_staging_cutover.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APPLY="${APPLY:-0}"
ROLLBACK="${ROLLBACK:-0}"
REPORT="${REPORT:-$ROOT/.local-dev/m2-portal-pwa-staging-cutover-preflight.json}"
PORTAL_PUBLIC_URL="${M2_PORTAL_PUBLIC_URL:-https://portal.pttads.vn}"
PORTAL_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$PORTAL_PUBLIC_URL}"
ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"
STANDALONE="$ROOT/services/portal-web/.next/standalone"
PWA_FLAG="${NEXT_PUBLIC_PWA_ENABLED:-1}"
PUSH_FLAG=1
if [[ "$ROLLBACK" == "1" ]]; then
  PWA_FLAG=0
  PUSH_FLAG=0
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
  "rnos": "RNOS-M2",
  "apply": int("$APPLY"),
  "rollback": int("$ROLLBACK"),
  "pwa_enabled": "$PWA_FLAG",
  "push_enabled": "$PUSH_FLAG",
  "portal_public_url": "$PORTAL_PUBLIC_URL",
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

_set_env_kv() {
  local file="$1" key="$2" val="$3"
  [[ -f "$file" ]] || return 0
  if grep -q "^${key}=" "$file"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    echo "${key}=${val}" >> "$file"
  fi
}

echo "== M2 Portal PWA staging cutover (RNOS-M2) =="
echo "   APPLY=$APPLY ROLLBACK=$ROLLBACK"
echo "   NEXT_PUBLIC_PWA_ENABLED=$PWA_FLAG"
echo "   PTT_PORTAL_PUSH_ENABLED=$PUSH_FLAG"
echo "   PORTAL_PUBLIC_URL=$PORTAL_PUBLIC_URL"
echo "   ENV_FILE=$ENV_FILE"
echo ""

for f in \
  services/portal-web/src/app/manifest.ts \
  services/portal-web/public/sw.js \
  services/ptt-crm-api/src/portal/portal-push-sender.service.ts \
  docs/specs/ddl-portal-push-subscriptions.sql \
  scripts/apply_pg_ddl_portal_push_m2.sh \
  scripts/wave_b2_rebuild_portal_web.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^PTT_PORTAL_VAPID_PUBLIC_KEY=' "$ENV_FILE" && grep -q '^PTT_PORTAL_VAPID_PRIVATE_KEY=' "$ENV_FILE"; then
    log_ok "env-vapid" "VAPID keys present in $ENV_FILE"
  else
    log_warn "env-vapid" "Missing VAPID keys — run: ./scripts/generate_portal_vapid_keys.sh --write-env $ENV_FILE"
  fi
else
  log_warn "env-file" "$ENV_FILE not found (dry-run only on dev machine OK)"
fi

if systemctl is-active --quiet ptt-crm-api 2>/dev/null; then
  log_ok "service-ptt-crm-api" "active"
else
  log_warn "service-ptt-crm-api" "not active"
fi

if systemctl is-active --quiet ptt-portal-web 2>/dev/null; then
  log_ok "service-ptt-portal-web" "active"
else
  log_warn "service-ptt-portal-web" "not active"
fi

if [[ "$APPLY" != "1" ]]; then
  echo ""
  echo "DRY-RUN — set APPLY=1 on VPS to apply DDL, rebuild portal + Nest, restart services"
  write_report
  [[ "$fail" -eq 0 ]]
  exit $?
fi

echo ""
echo "==> Backup reminder"
if [[ -x "$ROOT/scripts/backup_ptt_data.sh" ]]; then
  echo "    Recommended: ./scripts/backup_ptt_data.sh"
fi

echo ""
echo "==> Apply portal push DDL"
export DATABASE_URL="${DATABASE_URL:-$(grep '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  bash "$ROOT/scripts/apply_pg_ddl_portal_push_m2.sh"
  log_ok "ddl-push" "portal_push_subscriptions applied"
else
  log_fail "ddl-push" "DATABASE_URL not set"
fi

echo ""
echo "==> Update .env PWA + push flags"
if [[ -f "$ENV_FILE" ]]; then
  _set_env_kv "$ENV_FILE" NEXT_PUBLIC_PWA_ENABLED "$PWA_FLAG"
  _set_env_kv "$ENV_FILE" PTT_PORTAL_PUSH_ENABLED "$PUSH_FLAG"
  if [[ "$PUSH_FLAG" == "1" ]] && ! grep -q '^PTT_PORTAL_VAPID_PUBLIC_KEY=' "$ENV_FILE"; then
    log_warn "env-vapid-generate" "Generating VAPID keys into $ENV_FILE"
    bash "$ROOT/scripts/generate_portal_vapid_keys.sh" --write-env "$ENV_FILE"
  fi
  log_ok "env-update" "Updated portal PWA/push flags"
else
  log_fail "env-update" "$ENV_FILE missing"
fi

echo ""
echo "==> Rebuild Nest API (web-push sender)"
(
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
)
log_ok "nest-build" "ptt-crm-api build OK"

echo ""
echo "==> Rebuild portal-web"
(
  export NEXT_PUBLIC_PTT_API_URL="$PORTAL_API_URL"
  export NEXT_PUBLIC_PWA_ENABLED="$PWA_FLAG"
  bash "$ROOT/scripts/wave_b2_rebuild_portal_web.sh"
)
if [[ -f "$STANDALONE/public/sw.js" ]]; then
  log_ok "portal-standalone-sw" "sw.js in standalone"
else
  log_fail "portal-standalone-sw" "sw.js missing"
fi

echo ""
echo "==> Restart services"
if command -v systemctl >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl restart ptt-crm-api ptt-portal-web
  elif sudo -n systemctl restart ptt-crm-api ptt-portal-web 2>/dev/null; then
    :
  else
    log_warn "systemctl-restart" "Run: sudo systemctl restart ptt-crm-api ptt-portal-web"
  fi
  sleep 2
  systemctl is-active --quiet ptt-crm-api 2>/dev/null && log_ok "nest-restart" "ptt-crm-api active" || log_fail "nest-restart" "ptt-crm-api down"
  systemctl is-active --quiet ptt-portal-web 2>/dev/null && log_ok "portal-restart" "ptt-portal-web active" || log_fail "portal-restart" "ptt-portal-web down"
fi

echo ""
echo "==> Verify HTTPS"
if curl -sf "${PORTAL_PUBLIC_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  log_ok "portal-manifest" "${PORTAL_PUBLIC_URL}/manifest.webmanifest"
else
  log_warn "portal-manifest" "Could not reach manifest (run curl on VPS)"
fi

if curl -sf "${PORTAL_PUBLIC_URL}/sw.js" 2>/dev/null | grep -q 'ptt-portal-pwa-v1'; then
  log_ok "portal-sw" "${PORTAL_PUBLIC_URL}/sw.js"
else
  log_warn "portal-sw" "Could not verify sw.js"
fi

if curl -sf "${PORTAL_PUBLIC_URL}/api/v1/portal/push/vapid-public-key" 2>/dev/null | grep -q '"enabled":true'; then
  log_ok "push-vapid" "VAPID endpoint enabled"
else
  log_warn "push-vapid" "Push not enabled or API unreachable"
fi

write_report
[[ "$fail" -eq 0 ]]
