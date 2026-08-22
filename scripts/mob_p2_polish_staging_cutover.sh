#!/usr/bin/env bash
# RNOS-MOB-P2 — Mobile polish cutover on VPS (after M1/M2 stable)
#   APPLY=0 ./scripts/mob_p2_polish_staging_cutover.sh
#   APPLY=1 ./scripts/mob_p2_polish_staging_cutover.sh
#
# Requires M1/M2 already live:
#   NEXT_PUBLIC_PWA_ENABLED=1 on ops-web + portal-web
#   PTT_PORTAL_PUSH_ENABLED=1 (M2)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APPLY="${APPLY:-0}"
REPORT="${REPORT:-$ROOT/.local-dev/mob-p2-polish-staging-cutover-preflight.json}"
STAFF_URL="${M1_PWA_PUBLIC_URL:-https://rs.pttads.vn}"
PORTAL_URL="${M2_PORTAL_PUBLIC_URL:-https://portal.pttads.vn}"
ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"

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
  "rnos": "RNOS-MOB-P2",
  "apply": int("$APPLY"),
  "staff_url": "$STAFF_URL",
  "portal_url": "$PORTAL_URL",
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

echo "== RNOS-MOB-P2 polish cutover (post M1/M2) =="
echo "   APPLY=$APPLY"
echo "   STAFF_URL=$STAFF_URL PORTAL_URL=$PORTAL_URL"
echo ""

for f in \
  services/ops-web/src/components/mobile/PullToRefresh.tsx \
  services/portal-web/src/components/mobile/PortalSwipeActions.tsx \
  scripts/wave_b1_rebuild_ops_web.sh \
  scripts/wave_b2_rebuild_portal_web.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^NEXT_PUBLIC_PWA_ENABLED=1' "$ENV_FILE" 2>/dev/null; then
    log_ok "env-m1-pwa" "NEXT_PUBLIC_PWA_ENABLED=1"
  else
    log_warn "env-m1-pwa" "Run M1 cutover first — NEXT_PUBLIC_PWA_ENABLED not 1"
  fi
else
  log_warn "env-file" "$ENV_FILE not found (dry-run on dev OK)"
fi

echo ""
echo "==> M1/M2 soak check (HTTPS)"
if curl -sf "${STAFF_URL}/sw.js" 2>/dev/null | grep -q 'ptt-ops-pwa-v1'; then
  log_ok "m1-sw-live" "${STAFF_URL}/sw.js"
else
  log_warn "m1-sw-live" "M1 sw.js not verified — apply M1 before P2 on prod"
fi
if curl -sf "${PORTAL_URL}/sw.js" 2>/dev/null | grep -q 'ptt-portal-pwa-v1'; then
  log_ok "m2-sw-live" "${PORTAL_URL}/sw.js"
else
  log_warn "m2-sw-live" "M2 sw.js not verified — apply M2 before P2 on prod"
fi

if [[ "$APPLY" != "1" ]]; then
  echo ""
  echo "DRY-RUN — set APPLY=1 to rebuild ops-web + portal-web with P2 polish"
  write_report
  [[ "$fail" -eq 0 ]]
  exit $?
fi

echo ""
echo "==> Rebuild ops-web (P2 polish — bottom sheet + pull refresh)"
(
  export NEXT_PUBLIC_PTT_API_URL="$STAFF_URL"
  export NEXT_PUBLIC_PWA_ENABLED=1
  if [[ -f "$ENV_FILE" ]]; then
    val="$(grep '^NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
    export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED="${val:-0}"
  fi
  bash "$ROOT/scripts/wave_b1_rebuild_ops_web.sh"
)
log_ok "ops-rebuild" "ops-web standalone ready"

echo ""
echo "==> Rebuild portal-web (P2 swipe cards)"
(
  export NEXT_PUBLIC_PTT_API_URL="$PORTAL_URL"
  export NEXT_PUBLIC_PWA_ENABLED=1
  bash "$ROOT/scripts/wave_b2_rebuild_portal_web.sh"
)
log_ok "portal-rebuild" "portal-web standalone ready"

echo ""
echo "==> Restart frontends"
if command -v systemctl >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    systemctl restart ptt-ops-web ptt-portal-web
  elif sudo -n systemctl restart ptt-ops-web ptt-portal-web 2>/dev/null; then
    :
  else
    log_warn "systemctl" "Run: sudo systemctl restart ptt-ops-web ptt-portal-web"
  fi
  sleep 2
  systemctl is-active --quiet ptt-ops-web 2>/dev/null && log_ok "ops-active" "ptt-ops-web" || log_fail "ops-active" "down"
  systemctl is-active --quiet ptt-portal-web 2>/dev/null && log_ok "portal-active" "ptt-portal-web" || log_fail "portal-active" "down"
fi

write_report
[[ "$fail" -eq 0 ]]
