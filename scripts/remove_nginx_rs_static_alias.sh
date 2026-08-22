#!/usr/bin/env bash
# Remove legacy nginx /_next/static/ disk alias — static is served only by ops-web :3200.
#   sudo ./scripts/remove_nginx_rs_static_alias.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Usage: sudo $0"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/nginx_ssl_paths.sh
. "$ROOT/scripts/lib/nginx_ssl_paths.sh"
DEST="${NGINX_RS_SITE:-/etc/nginx/sites-available/rs.pttads.vn}"

if [[ ! -f "$DEST" ]]; then
  echo "WARN  nginx site missing: $DEST — apply full site instead:"
  echo "      sudo $ROOT/scripts/apply_nginx_rs_vps_ssl.sh"
  exit 0
fi

backup="${DEST}.bak.$(date +%Y%m%d%H%M%S)"
cp "$DEST" "$backup"
echo "Backup → $backup"

python3 - "$DEST" <<'PY'
import re
import sys
from pathlib import Path

dest = Path(sys.argv[1])
text = dest.read_text()
pattern = r"\n?\s*# Next\.js static assets[^\n]*\n\s*location /_next/static/ \{[^}]+\}\n"
new_text, n = re.subn(pattern, "\n", text, count=1)
if n == 0:
    print("SKIP  no /_next/static/ alias block found")
else:
    dest.write_text(new_text)
    print("OK    removed /_next/static/ alias block")
PY

nginx -t
systemctl reload nginx
echo "OK  nginx reloaded — static now proxied to ops-web only"
