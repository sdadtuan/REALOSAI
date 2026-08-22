#!/usr/bin/env bash
# WIN-4-A staging: Keycloak on VPS + nginx /auth + env + group seed + smoke.
#
# On VPS:
#   cd /var/www/rnosai && bash scripts/vps_enable_win4a_keycloak.sh
#
# From laptop:
#   APPLY=1 ./scripts/vps_enable_win4a_keycloak.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ISSUER="${PTT_STAFF_KEYCLOAK_ISSUER:-https://rs.pttads.vn/auth/realms/ptt-staff}"

run_local() {
  cd "$ROOT"
  echo "== WIN-4-A Keycloak staging @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== .env SSO vars =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  {
    echo "# WIN-4-A SSO — auto-generated $(date -Iseconds)"
    echo "STAFF_AUTH_MODE=dual"
    echo "STAFF_SCOPE_PILOT=1"
    echo "PTT_STAFF_KEYCLOAK_ISSUER=$ISSUER"
    echo "PTT_STAFF_KEYCLOAK_FETCH_ISSUER=http://127.0.0.1:8080/auth/realms/ptt-staff"
    echo "PTT_STAFF_KEYCLOAK_AUDIENCE=ptt-ops-web"
    echo "STAFF_MFA_REQUIRED_POSITIONS=gdkd,super-admin"
  } >"$RUNTIME_ENV"
  echo "Wrote $RUNTIME_ENV (deploy-owned runtime overrides)"

  ENV_FILE="$ROOT/.env"
  if [[ -w "$ENV_FILE" ]]; then
    grep -q '^STAFF_AUTH_MODE=' "$ENV_FILE" && sed -i.bak 's/^STAFF_AUTH_MODE=.*/STAFF_AUTH_MODE=dual/' "$ENV_FILE" || echo 'STAFF_AUTH_MODE=dual' >>"$ENV_FILE"
    grep -q '^PTT_STAFF_KEYCLOAK_ISSUER=' "$ENV_FILE" && sed -i.bak "s|^PTT_STAFF_KEYCLOAK_ISSUER=.*|PTT_STAFF_KEYCLOAK_ISSUER=$ISSUER|" "$ENV_FILE" || echo "PTT_STAFF_KEYCLOAK_ISSUER=$ISSUER" >>"$ENV_FILE"
  else
    echo "Note: $ENV_FILE not writable — using deploy/runtime.env only"
  fi

  echo "== nginx Keycloak /auth (rs site include only) =="
  mkdir -p /var/www/ptt/deploy
  cp "$ROOT/deploy/nginx-keycloak-auth.conf" /var/www/ptt/deploy/nginx-keycloak-auth.conf
  if [[ -x "$ROOT/scripts/fix_nginx_keycloak_duplicate.sh" ]]; then
    sudo -n "$ROOT/scripts/fix_nginx_keycloak_duplicate.sh" || true
  fi
  sudo -n /usr/sbin/nginx -t && sudo -n /usr/bin/systemctl reload nginx && echo "OK nginx reloaded" || echo "WARN nginx reload failed"

  echo "== Keycloak docker =="
  docker compose -f "$ROOT/docker-compose.keycloak.vps.yml" up -d
  for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:8080/auth/realms/ptt-staff/.well-known/openid-configuration" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  curl -sf "http://127.0.0.1:8080/auth/realms/ptt-staff/.well-known/openid-configuration" | python3 -c "import json,sys; print('issuer:', json.load(sys.stdin)['issuer'])" || {
    echo "Keycloak not ready" >&2
    exit 1
  }

  bash "$ROOT/scripts/keycloak_import_staff_realm.sh" || true
  bash "$ROOT/scripts/keycloak_configure_staff_mfa.sh" || echo "WARN MFA config partial — manual IT-KC-04"

  echo "== PG seed group map + demo users =="
  bash "$ROOT/scripts/seed_win4a_sso_staging.sh"

  echo "== Nest API rebuild + restart =="
  cd "$ROOT/services/ptt-crm-api"
  npm run build
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 3
  curl -sf http://127.0.0.1:3000/health | python3 -c "import json,sys; d=json.load(sys.stdin); print('staff_auth_mode:', d.get('staff_auth_mode'), 'sso:', d.get('staff_sso_configured'))"

  echo "== external issuer probe =="
  curl -sf "$ISSUER/.well-known/openid-configuration" | python3 -c "import json,sys; print('public issuer OK:', json.load(sys.stdin)['issuer'])" || echo "WARN public issuer not reachable yet"

  echo "== WIN-4-A Keycloak staging ready =="
  echo "Issuer: $ISSUER"
  echo "Admin:  https://rs.pttads.vn/auth/admin (admin / see KC_ADMIN_PASSWORD)"
  echo "Test:   https://rs.pttads.vn/login"
  echo "Groups: https://rs.pttads.vn/admin/crm/sso/groups"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/vps_enable_win4a_keycloak.sh --local"
else
  echo "Dry-run. APPLY=1 to run on ${VPS_USER}@${VPS_HOST}"
  echo "Or on VPS: bash scripts/vps_enable_win4a_keycloak.sh --local"
fi
