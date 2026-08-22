#!/usr/bin/env bash
# Enable WIN-3 scope pilot flags on VPS .env (idempotent append).
# Run on VPS: bash scripts/vps_enable_win3_scope_pilot.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

set_kv() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set_kv STAFF_SCOPE_PILOT 1
echo "OK  STAFF_SCOPE_PILOT=1 in $ENV_FILE"
echo "Note: ops-web needs rebuild with NEXT_PUBLIC_WIN_SCOPE_PILOT=1 (deploy_win3c_vps.sh)"
echo "Restart: sudo systemctl restart ptt-crm-api"
