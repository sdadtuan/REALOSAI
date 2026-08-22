#!/usr/bin/env bash
# RNOS-M2 — Generate VAPID key pair for Portal Web Push
# Usage:
#   ./scripts/generate_portal_vapid_keys.sh
#   ./scripts/generate_portal_vapid_keys.sh --write-env /var/www/ptt/.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRITE_ENV=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write-env)
      WRITE_ENV="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT/services/ptt-crm-api"
if [[ ! -d node_modules/web-push ]]; then
  npm install --no-save web-push@^3.6.7 >/dev/null
fi

read -r PUBLIC_KEY PRIVATE_KEY <<EOF
$(node - <<'NODE'
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log(keys.publicKey);
console.log(keys.privateKey);
NODE
)
EOF

echo "== RNOS-M2 VAPID keys =="
echo "PTT_PORTAL_VAPID_PUBLIC_KEY=$PUBLIC_KEY"
echo "PTT_PORTAL_VAPID_PRIVATE_KEY=$PRIVATE_KEY"
echo "PTT_PORTAL_VAPID_SUBJECT=mailto:portal-push@pttads.vn"
echo ""
echo "Add to /var/www/ptt/.env then restart ptt-crm-api."

if [[ -n "$WRITE_ENV" ]]; then
  for kv in \
    "PTT_PORTAL_PUSH_ENABLED=1" \
    "PTT_PORTAL_VAPID_PUBLIC_KEY=$PUBLIC_KEY" \
    "PTT_PORTAL_VAPID_PRIVATE_KEY=$PRIVATE_KEY" \
    "PTT_PORTAL_VAPID_SUBJECT=mailto:portal-push@pttads.vn"; do
    key="${kv%%=*}"
    val="${kv#*=}"
    if grep -q "^${key}=" "$WRITE_ENV" 2>/dev/null; then
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s|^${key}=.*|${key}=${val}|" "$WRITE_ENV"
      else
        sed -i "s|^${key}=.*|${key}=${val}|" "$WRITE_ENV"
      fi
    else
      echo "${key}=${val}" >> "$WRITE_ENV"
    fi
  done
  echo "OK  Updated $WRITE_ENV"
fi
