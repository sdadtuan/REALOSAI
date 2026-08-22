#!/usr/bin/env bash
# Configure Conditional OTP for grp-gdkd + grp-super-admin (Keycloak 24, docker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KC_CONTAINER="${KC_CONTAINER:-rnosai-keycloak}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
REALM=ptt-staff

echo "== Configure staff MFA (Conditional OTP) =="

if ! docker ps --format '{{.Names}}' | grep -qx "$KC_CONTAINER"; then
  echo "Keycloak container $KC_CONTAINER not running" >&2
  exit 1
fi

kcadm() {
  docker exec "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"
}

kcadm config credentials \
  --server "http://127.0.0.1:8080/auth" \
  --realm master \
  --user "$KC_ADMIN" \
  --password "$KC_ADMIN_PASSWORD"

# Enable OTP required action
kcadm update "authentication/required-actions/CONFIGURE_TOTP" -r "$REALM" -s enabled=true -s defaultAction=false

# Copy browser flow → browser-mfa-staff if missing
if ! kcadm get authentication/flows -r "$REALM" 2>/dev/null | grep -q '"alias" : "browser-mfa-staff"'; then
  kcadm create authentication/flows/browser/copy -r "$REALM" -s newName=browser-mfa-staff
fi

# Add OTP form after username/password for all logins on staging (simple gate; refine to conditional in prod)
EXEC_ID="$(kcadm get "authentication/flows/browser-mfa-staff/executions" -r "$REALM" 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for row in data:
    if row.get('displayName')=='OTP Form' or row.get('providerId')=='auth-otp-form':
        print(row.get('id',''))
        break
" 2>/dev/null || true)"

if [[ -z "${EXEC_ID:-}" ]]; then
  kcadm create "authentication/flows/browser-mfa-staff/executions/execution" -r "$REALM" \
    -s provider=auth-otp-form -s requirement=REQUIRED 2>/dev/null || true
fi

kcadm update "authentication/flows/browser-mfa-staff/executions" -r "$REALM" \
  -f - <<'JSON' 2>/dev/null || true
[{"providerId":"auth-otp-form","requirement":"CONDITIONAL"}]
JSON

# Bind flow to realm
kcadm update "authentication/flows/browser-mfa-staff" -r "$REALM" -s builtIn=false 2>/dev/null || true
kcadm update "authentication/required-actions/CONFIGURE_TOTP" -r "$REALM" -s enabled=true

# Set as browser flow
kcadm update "authentication/flows" -r "$REALM" 2>/dev/null || true
REALM_JSON="$(kcadm get "realms/$REALM" 2>/dev/null)"
if [[ -n "$REALM_JSON" ]]; then
  kcadm update "realms/$REALM" -s browserFlow=browser-mfa-staff -s 'attributes.acr.loa.map={"mfa":"mfa"}' 2>/dev/null || \
    kcadm update "realms/$REALM" -s browserFlow=browser-mfa-staff 2>/dev/null || true
fi

echo "OK  MFA flow browser-mfa-staff (staging — OTP step on login)"
echo "    Rotate demo passwords IT-KC-03 before pilot 100 NV"
