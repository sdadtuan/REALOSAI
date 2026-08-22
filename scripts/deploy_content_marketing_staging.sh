#!/usr/bin/env bash
# Content Marketing OS M0 — DDL + flags + API build on staging VPS (rs.pttads.vn)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_content_marketing_staging.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_content_marketing_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMKT_PILOT_SLUGS='tiep-thi-noi-dung'
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== Content Marketing M0 staging @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/4 Apply Content Marketing DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_content_marketing.sh"
  bash "$ROOT/scripts/apply_pg_ddl_cmkt_video_social_v1.sh"

  echo "== 2/4 Enable API flags =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_CONTENT_MARKETING_ENABLED=1" \
    "PTT_CONTENT_MARKETING_FE=1" \
    "PTT_CONTENT_MARKETING_SLUGS=${CMKT_PILOT_SLUGS}" \
    "PTT_CONTENT_MARKETING_AI_ENABLED=1" \
    "PTT_CONTENT_MARKETING_APPROVAL_REQUIRED=1" \
    "PTT_CONTENT_MARKETING_MEDIA_ENABLED=1" \
    "PTT_CMKT_IMAGE_GEN=1" \
    "PTT_CMKT_VIDEO_GEN=1" \
    "PTT_CMKT_VIDEO_PROVIDER=ffmpeg" \
    "PTT_CMKT_VIDEO_SOCIAL=1" \
    "PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP=3" \
    "PTT_CONTENT_MARKETING_CLIENT_GATE=1" \
    "PTT_CMKT_PORTAL_SUMMARY=1" \
    "NEXT_PUBLIC_CMKT_PORTAL_SUMMARY=1" \
    "NEXT_PUBLIC_CONTENT_MARKETING=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  echo "== 3/4 Build + restart Nest API =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    (cd "$ROOT/services/ptt-crm-api" && npm ci && npm run build)
  fi
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    NEXT_PUBLIC_CONTENT_MARKETING=1 bash "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null \
      || NEXT_PUBLIC_CONTENT_MARKETING=1 bash "$ROOT/scripts/deploy_ops_web.sh" 2>/dev/null \
      || echo "WARN ops-web deploy skipped"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart (no passwordless sudo or not on VPS)"
    echo "     Manual: sudo systemctl restart ptt-crm-api"
  fi

  echo "== 4/4 Smoke GET /content-marketing/context =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export ADMIN_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
  export ADMIN_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
  export LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
  if [[ -n "${STAFF_TOKEN:-}" ]]; then
    bash "$ROOT/scripts/smoke_content_marketing_m0.sh" || echo "WARN M0 smoke failed — grant crm_content.view cap"
    bash "$ROOT/scripts/smoke_content_marketing_p2_media.sh" || echo "WARN P2 media smoke failed — check media caps/flags"
  else
    echo "SKIP smoke — set STAFF_TOKEN or run smoke_content_marketing_m0.sh after cap grant"
    echo "      P2 media: bash scripts/smoke_content_marketing_p2_media.sh"
  fi

  echo "== Content Marketing M6 staging complete =="
  echo "Flags: PTT_CONTENT_MARKETING_MEDIA_ENABLED=1 PTT_CMKT_IMAGE_GEN=1 PTT_CMKT_VIDEO_GEN=1"
  echo "Video V1: PTT_CMKT_VIDEO_PROVIDER=ffmpeg PTT_CMKT_VIDEO_SOCIAL=1 cap=3 (ensure ffmpeg on VPS)"
  echo "Next: grant crm_content caps via Admin → Permission Sets; then M1 FE tab"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_content_marketing_staging.sh --local"
else
  echo "Dry-run. Set APPLY=1 to run on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_content_marketing_staging.sh --local"
fi
