#!/usr/bin/env bash
# Permanent ops-web deploy: build → atomic static → release symlink → restart → verify.
#
# Deploy user (build + publish):
#   cd /var/www/rnosai && git pull && ./scripts/deploy_ops_web.sh
#
# Sudo (restart + nginx + verify) — run if deploy user lacks systemctl:
#   sudo ./scripts/deploy_ops_web.sh --restart
#
# One-shot as root after pull:
#   sudo ./scripts/deploy_ops_web.sh --all
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RNOSAI_ROOT="$ROOT"
# shellcheck source=lib/ops_web_standalone.sh
. "$ROOT/scripts/lib/ops_web_standalone.sh"

MODE="${1:-build}"
OPS_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
export NEXT_PUBLIC_PTT_API_URL="$OPS_API_URL"

do_build=0
do_restart=0

case "$MODE" in
  build) do_build=1 ;;
  --restart) do_restart=1 ;;
  --activate-latest) ;;
  --all) do_build=1; do_restart=1 ;;
  --verify-only) ;;
  *)
    echo "Usage: $0 [build|--restart|--activate-latest|--all|--verify-only]"
    exit 1
    ;;
esac

if [[ "$MODE" == "--activate-latest" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "FAIL  --activate-latest requires sudo (current/ops-web symlink is root-owned on VPS)"
    exit 1
  fi
  ops_web_activate_release
  systemctl restart ptt-ops-web
  sleep 2
  systemctl is-active ptt-ops-web
  ops_web_verify_local || true
  ops_web_verify_public || true
  exit 0
fi

if [[ "$do_build" == "1" ]]; then
  ops_web_build
  ops_web_publish_release >/dev/null
  ops_web_prune_releases
  echo ""
  echo "Build OK. If service not restarted yet, run:"
  echo "  sudo $0 --restart"
fi

if [[ "$do_restart" == "1" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "FAIL  --restart requires sudo"
    exit 1
  fi

  cp "$ROOT/deploy/ptt-ops-web.service" /etc/systemd/system/ptt-ops-web.service
  ops_web_bootstrap_release_from_legacy
  ops_web_activate_release || true
  systemctl daemon-reload
  systemctl restart ptt-ops-web
  sleep 2
  systemctl is-active ptt-ops-web

  if [[ -x "$ROOT/scripts/apply_nginx_rs_vps_ssl.sh" ]]; then
    if [[ -x "$ROOT/scripts/remove_nginx_rs_static_alias.sh" ]]; then
      "$ROOT/scripts/remove_nginx_rs_static_alias.sh" || true
    fi
    "$ROOT/scripts/apply_nginx_rs_vps_ssl.sh"
  fi

  ops_web_verify_local
  ops_web_verify_public
fi

if [[ "$MODE" == "--verify-only" ]]; then
  ops_web_verify_local || true
  ops_web_verify_public || true
fi

echo ""
echo "Done. Hard-refresh browser if a tab was open during deploy."
