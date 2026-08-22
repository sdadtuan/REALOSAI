#!/usr/bin/env bash
# Enable Apify Facebook enrichment for LMP worker on VPS.
#
# From laptop:
#   APIFY_API_TOKEN=apify_api_... APPLY=1 ./scripts/deploy_lmp_apify_vps.sh
#
# On VPS:
#   APIFY_API_TOKEN=apify_api_... bash scripts/deploy_lmp_apify_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

patch_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  for kv in \
    "LMP_APIFY_ENABLED=1" \
    "LMP_APIFY_TIMEOUT_SEC=120"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
    else
      echo "$kv" >> "$env_file"
    fi
  done
  if [[ -n "${APIFY_API_TOKEN:-}" ]]; then
    if grep -q "^APIFY_API_TOKEN=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^APIFY_API_TOKEN=.*|APIFY_API_TOKEN=${APIFY_API_TOKEN}|" "$env_file"
    else
      echo "APIFY_API_TOKEN=${APIFY_API_TOKEN}" >> "$env_file"
    fi
  else
    echo "WARN  APIFY_API_TOKEN not set — enable flag only"
  fi
}

run_local() {
  cd "$ROOT"
  echo "== LMP Apify FB @ $(git rev-parse --short HEAD) =="
  patch_env "$ROOT/deploy/runtime.env"
  patch_env "$ROOT/.env"
  patch_env "/etc/ptt/runtime.env" || true

  PYTHON="${PYTHON:-python3}"
  [[ -x "$ROOT/.venv/bin/python" ]] && PYTHON="$ROOT/.venv/bin/python"
  export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
  "$PYTHON" -m pytest tests/test_lmp_apify_facebook.py -q

  sudo -n /usr/bin/systemctl restart ptt-worker 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-worker && echo " worker OK" || echo "WARN  worker restart failed"

  echo "== Apify deploy complete =="
  echo "UAT: lead có facebook URL → prep → social_channels + apify_runs > 0"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && APIFY_API_TOKEN='${APIFY_API_TOKEN:-}' bash scripts/deploy_lmp_apify_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 and APIFY_API_TOKEN to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi
