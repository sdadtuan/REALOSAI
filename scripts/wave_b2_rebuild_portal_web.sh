#!/usr/bin/env bash
# Rebuild portal-web on VPS (deploy user — no systemctl).
# After this: sudo systemctl restart ptt-portal-web
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://portal.pttads.vn}"
PWA_ENABLED="${NEXT_PUBLIC_PWA_ENABLED:-1}"
STATIC_DIR="$ROOT/services/portal-web/.next/standalone/.next/static"

cd "$ROOT/services/portal-web"
echo "== Rebuild portal-web (deploy) =="
echo "NEXT_PUBLIC_PTT_API_URL=$PORTAL_API_URL"
echo "NEXT_PUBLIC_PWA_ENABLED=$PWA_ENABLED"
git -C "$ROOT" log -1 --oneline 2>/dev/null || true

python3 "$ROOT/scripts/generate_portal_pwa_icons.py"

npm ci
export NEXT_PUBLIC_PTT_API_URL="$PORTAL_API_URL"
export NEXT_PUBLIC_PWA_ENABLED="$PWA_ENABLED"
npm run build

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  cp -r public .next/standalone/public
fi

css_file="$(ls "$STATIC_DIR"/css/*.css 2>/dev/null | head -1 || true)"
if [[ -z "$css_file" ]]; then
  echo "FAIL  $STATIC_DIR/css missing after copy"
  exit 1
fi
echo "OK  portal-web standalone ready ($(basename "$css_file"))"
if [[ -f .next/standalone/public/sw.js ]]; then
  echo "OK  sw.js present"
else
  echo "WARN  sw.js missing in standalone/public"
fi

echo ""
echo "Next: sudo systemctl restart ptt-portal-web"
