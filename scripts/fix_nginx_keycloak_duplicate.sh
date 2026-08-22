#!/usr/bin/env bash
# Remove duplicate Keycloak location /auth/ when both rs site and ptt seo-gate include it.
#
# rs.pttads.vn (nginx-rs-flask-retired.conf) includes:
#   /var/www/rnosai/deploy/nginx-keycloak-auth.conf
# Legacy WIN-4-A also appended the same block via:
#   /var/www/ptt/deploy/nginx-seo-gate-a-redirect.conf
#
#   sudo ./scripts/fix_nginx_keycloak_duplicate.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Usage: sudo $0"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEO_GATE="/var/www/ptt/deploy/nginx-seo-gate-a-redirect.conf"

mkdir -p /var/www/ptt/deploy
if [[ -f "$ROOT/deploy/nginx-keycloak-auth.conf" ]]; then
  cp "$ROOT/deploy/nginx-keycloak-auth.conf" /var/www/ptt/deploy/nginx-keycloak-auth.conf
fi

if [[ ! -f "$SEO_GATE" ]]; then
  echo "SKIP  no ptt seo-gate file ($SEO_GATE)"
  exit 0
fi

backup="${SEO_GATE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$SEO_GATE" "$backup"
echo "Backup → $backup"

python3 - "$SEO_GATE" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines(keepends=True)
out: list[str] = []
removed = 0
skip_comment = False

for line in lines:
    stripped = line.strip()
    if "WIN-4-A Keycloak OIDC" in line:
        skip_comment = True
        removed += 1
        continue
    if skip_comment and stripped == "":
        skip_comment = False
        removed += 1
        continue
    skip_comment = False
    if "nginx-keycloak-auth.conf" in line:
        removed += 1
        continue
    out.append(line)

path.write_text("".join(out))
if removed:
    print(f"OK    removed {removed} duplicate Keycloak include line(s) from seo-gate")
else:
    print("SKIP  no Keycloak include in seo-gate (already clean)")
PY
