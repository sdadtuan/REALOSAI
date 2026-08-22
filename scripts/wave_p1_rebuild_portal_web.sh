#!/usr/bin/env bash
# Rebuild portal-web (P1 shell deploy — deploy user, no systemctl).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
STATIC_DIR="$ROOT/services/portal-web/.next/standalone/.next/static"

cd "$ROOT/services/portal-web"
echo "== Rebuild portal-web (P1) =="
echo "NEXT_PUBLIC_PTT_API_URL=$OPS_API_URL"
git -C "$ROOT" log -1 --oneline

npm ci
export NEXT_PUBLIC_PTT_API_URL="$OPS_API_URL"
npm run build

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
fi

css_file="$(ls "$STATIC_DIR"/css/*.css 2>/dev/null | head -1 || true)"
if [[ -z "$css_file" ]]; then
  echo "FAIL  $STATIC_DIR/css missing after copy"
  exit 1
fi
echo "OK  static copied ($(basename "$css_file"))"
echo ""
echo "Next: sudo systemctl restart ptt-portal-web"
