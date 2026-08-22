#!/usr/bin/env bash
# WIN-4-D — disable Nest password login on production (Keycloak cutover).
#
# Usage (on VPS after SSO pilot):
#   DRY_RUN=1 bash scripts/staff_auth_cutover_keycloak.sh
#   APPLY=1  bash scripts/staff_auth_cutover_keycloak.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_ENV="${RUNTIME_ENV:-$ROOT/deploy/runtime.env}"
DRY_RUN="${DRY_RUN:-0}"
APPLY="${APPLY:-0}"

echo "== WIN-4-D SSO cutover (staff_auth_cutover_keycloak) =="
echo "Runtime env: $RUNTIME_ENV"

patch_kv() {
  local key="$1"
  local val="$2"
  mkdir -p "$(dirname "$RUNTIME_ENV")"
  touch "$RUNTIME_ENV"
  if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$RUNTIME_ENV"
  else
    echo "${key}=${val}" >>"$RUNTIME_ENV"
  fi
}

for kv in \
  "STAFF_AUTH_MODE=keycloak" \
  "STAFF_NEST_LOGIN_ALLOWED=0" \
  "NEXT_PUBLIC_WIN_SSO=1"; do
  key="${kv%%=*}"
  val="${kv#*=}"
  echo "  set $key=$val"
  if [[ "$DRY_RUN" != "1" && "$APPLY" == "1" ]]; then
    patch_kv "$key" "$val"
  fi
done

if [[ "$APPLY" == "1" && "$DRY_RUN" != "1" ]]; then
  echo "Restarting ptt-crm-api + ptt-ops-web (requires sudo)…"
  sudo -n /usr/bin/systemctl restart ptt-crm-api ptt-ops-web || true
  sleep 2
  curl -sf http://127.0.0.1:3000/health | python3 -c "import json,sys; h=json.load(sys.stdin); print('staff_auth_mode=', h.get('staff_auth_mode'))" || true
fi

echo "Done. Set APPLY=1 to apply; DRY_RUN=1 to preview only."
