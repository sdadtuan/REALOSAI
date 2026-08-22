#!/usr/bin/env bash
# M2 — Portal PWA + Web Push cutover on VPS portal.pttads.vn (RNOS-M2)
#
# Usage (from dev laptop with SSH to VPS):
#   PTT_VPS_HOST=rs.pttads.vn APPLY=0 ./scripts/m2_portal_pwa_staging_cutover_vps.sh
#   LOCAL_SYNC=1 PTT_VPS_HOST=rs.pttads.vn APPLY=1 ./scripts/m2_portal_pwa_staging_cutover_vps.sh
#   APPLY=1 ROLLBACK=1 ./scripts/m2_portal_pwa_staging_cutover_vps.sh
#
# Env:
#   PTT_VPS_HOST           SSH host (default: rs.pttads.vn — same VPS as portal.pttads.vn)
#   PTT_VPS_USER           SSH user (default: deploy)
#   PTT_VPS_ROOT           Repo on VPS (default: /var/www/ptt)
#   M2_PORTAL_PUBLIC_URL   Portal HTTPS origin (default: https://portal.pttads.vn)
#   LOCAL_SYNC             1 = rsync M2 portal-web + Nest push + scripts (code chưa push git)
#   GIT_PULL               1 = git pull on VPS when LOCAL_SYNC=0 (default: 1)
#   APPLY                  0 dry-run preflight on VPS | 1 apply cutover
#   ROLLBACK               1 disable portal PWA + push (pass-through)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/ptt}"
PORTAL_PUBLIC_URL="${M2_PORTAL_PUBLIC_URL:-https://portal.pttads.vn}"
APPLY="${APPLY:-0}"
ROLLBACK="${ROLLBACK:-0}"
GIT_PULL="${GIT_PULL:-1}"
LOCAL_SYNC="${LOCAL_SYNC:-0}"

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}")
RSYNC=(rsync -avz --delete --exclude node_modules --exclude .next --exclude test-results \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new")

echo "== M2 Portal PWA VPS cutover → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
echo "   Portal URL: ${PORTAL_PUBLIC_URL}"
echo "   APPLY=$APPLY ROLLBACK=$ROLLBACK LOCAL_SYNC=$LOCAL_SYNC GIT_PULL=$GIT_PULL"
echo ""

if [[ "$LOCAL_SYNC" == "1" ]]; then
  echo "==> LOCAL_SYNC: rsync M2 Portal PWA + push artifacts"
  (
    cd "$ROOT"
    "${RSYNC[@]}" \
      ./scripts/m2_portal_pwa_staging_cutover.sh \
      ./scripts/wave_b2_rebuild_portal_web.sh \
      ./scripts/generate_portal_pwa_icons.py \
      ./scripts/generate_portal_vapid_keys.sh \
      ./scripts/apply_pg_ddl_portal_push_m2.sh \
      ./deploy/nginx-portal-pwa.snippet.conf \
      ./docs/specs/ddl-portal-push-subscriptions.sql \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/"
    "${RSYNC[@]}" \
      ./services/portal-web/ \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/portal-web/"
    "${RSYNC[@]}" \
      ./services/ptt-crm-api/ \
      "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/"
  )
  GIT_PULL=0
  echo "OK  LOCAL_SYNC complete"
fi

"${SSH[@]}" bash -s -- "$VPS_ROOT" "$APPLY" "$ROLLBACK" "$GIT_PULL" "$PORTAL_PUBLIC_URL" <<'EOS'
set -euo pipefail
VPS_ROOT="$1"
APPLY="$2"
ROLLBACK="$3"
GIT_PULL="$4"
PORTAL_PUBLIC_URL="$5"
cd "$VPS_ROOT"

echo "==> VPS preflight"
test -d "$VPS_ROOT/.git" || { echo "FAIL: not a git repo: $VPS_ROOT"; exit 1; }
test -f "$VPS_ROOT/scripts/m2_portal_pwa_staging_cutover.sh" || {
  echo "FAIL: scripts/m2_portal_pwa_staging_cutover.sh missing — LOCAL_SYNC=1 or git pull first"
  exit 1
}

if [[ "$GIT_PULL" == "1" ]]; then
  echo "==> git pull --ff-only"
  git pull --ff-only || git pull --ff-only origin HEAD
fi

chmod +x "$VPS_ROOT/scripts/m2_portal_pwa_staging_cutover.sh" 2>/dev/null || true
chmod +x "$VPS_ROOT/scripts/wave_b2_rebuild_portal_web.sh" 2>/dev/null || true
chmod +x "$VPS_ROOT/scripts/apply_pg_ddl_portal_push_m2.sh" 2>/dev/null || true
chmod +x "$VPS_ROOT/scripts/generate_portal_vapid_keys.sh" 2>/dev/null || true

export M2_PORTAL_PUBLIC_URL="$PORTAL_PUBLIC_URL"
export NEXT_PUBLIC_PTT_API_URL="$PORTAL_PUBLIC_URL"
export PTT_ENV_FILE="${PTT_ENV_FILE:-/var/www/ptt/.env}"
export APPLY="$APPLY"
export ROLLBACK="$ROLLBACK"

if [[ "$APPLY" == "1" && "$ROLLBACK" != "1" ]]; then
  if [[ -x "$VPS_ROOT/scripts/backup_ptt_data.sh" ]]; then
    echo "==> Backup before M2 cutover"
    "$VPS_ROOT/scripts/backup_ptt_data.sh" || echo "WARN backup failed — continue at your own risk"
  fi
fi

bash "$VPS_ROOT/scripts/m2_portal_pwa_staging_cutover.sh"

if [[ "$APPLY" == "1" && "$ROLLBACK" != "1" ]]; then
  echo ""
  echo "==> Post-cutover smoke (Approver portal)"
  curl -sf "${PORTAL_PUBLIC_URL}/login" >/dev/null && echo "OK  /login"
  curl -sf "${PORTAL_PUBLIC_URL}/health" >/dev/null && echo "OK  /health"
  if curl -sf "${PORTAL_PUBLIC_URL}/manifest.webmanifest" | grep -q 'PTT Portal'; then
    echo "OK  /manifest.webmanifest"
  else
    echo "WARN /manifest.webmanifest not verified — include deploy/nginx-portal-pwa.snippet.conf in nginx"
  fi
  if curl -sf "${PORTAL_PUBLIC_URL}/sw.js" | grep -q 'ptt-portal-pwa-v1'; then
    echo "OK  /sw.js"
  else
    echo "WARN /sw.js not verified — check nginx + standalone/public/sw.js"
  fi
  if curl -sf "${PORTAL_PUBLIC_URL}/api/v1/portal/push/vapid-public-key" | grep -q '"enabled"'; then
    echo "OK  push vapid-public-key"
  else
    echo "WARN push API not verified — check PTT_PORTAL_PUSH_ENABLED + VAPID keys in .env"
  fi
  echo ""
  echo "Approver smoke: ${PORTAL_PUBLIC_URL}/creatives + /email/approvals @ mobile"
  echo "Push: Settings → Bật thông báo đẩy → Gửi test push"
fi
EOS

echo ""
echo "Done. Approver pilot: ${PORTAL_PUBLIC_URL} → Add to Home Screen + push subscribe"
