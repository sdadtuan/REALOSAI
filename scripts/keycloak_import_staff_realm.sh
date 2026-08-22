#!/usr/bin/env bash
# Import / update Keycloak realm ptt-staff (local docker or remote admin CLI).
#
# Local:
#   docker compose -f docker-compose.keycloak.yml up -d
#   bash scripts/keycloak_import_staff_realm.sh
#
# Remote (example):
#   KEYCLOAK_URL=https://auth.example KC_ADMIN=admin KC_ADMIN_PASSWORD='…' \
#     bash scripts/keycloak_import_staff_realm.sh --remote
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REALM_JSON="$ROOT/deploy/keycloak/realm-ptt-staff.json"
KC_URL="${KEYCLOAK_URL:-http://127.0.0.1:8080}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"

if [[ ! -f "$REALM_JSON" ]]; then
  echo "Missing $REALM_JSON" >&2
  exit 1
fi

echo "== Import realm ptt-staff =="
echo "   KEYCLOAK_URL=$KC_URL"

if [[ "${1:-}" == "--remote" ]]; then
  command -v kcadm.sh >/dev/null 2>&1 || {
    echo "Install Keycloak admin CLI or use docker exec" >&2
    exit 1
  }
  kcadm.sh config credentials --server "$KC_URL" --realm master --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD"
  kcadm.sh create partialImport -r ptt-staff -s ifResourceExists=OVERWRITE -f "$REALM_JSON" 2>/dev/null \
    || kcadm.sh create realms -f "$REALM_JSON"
else
  if ! docker compose -f "$ROOT/docker-compose.keycloak.yml" ps --status running 2>/dev/null | grep -q keycloak; then
    echo "Starting keycloak container…"
    docker compose -f "$ROOT/docker-compose.keycloak.yml" up -d
    sleep 8
  fi
  echo "Realm file mounted at container start (--import-realm)."
  echo "To force re-import: docker compose -f docker-compose.keycloak.yml down -v && up -d"
fi

echo "OK  realm ptt-staff — verify:"
echo "  curl -sf $KC_URL/realms/ptt-staff/.well-known/openid-configuration | jq -r .issuer"
