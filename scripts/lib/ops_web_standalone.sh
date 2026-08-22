#!/usr/bin/env bash
# Shared ops-web standalone build helpers (source from deploy scripts).
set -euo pipefail

ops_web_root() {
  local root="${RNOSAI_ROOT:-}"
  if [[ -z "$root" ]]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi
  printf '%s\n' "$root"
}

ops_web_dir() {
  printf '%s/services/ops-web\n' "$(ops_web_root)"
}

ops_web_static_dir() {
  printf '%s/.next/standalone/.next/static\n' "$(ops_web_dir)"
}

ops_web_sync_static() {
  local app_dir static_dir
  app_dir="$(ops_web_dir)"
  static_dir="$(ops_web_static_dir)"
  cd "$app_dir"

  mkdir -p .next/standalone/.next
  rm -rf .next/standalone/.next/static.new
  cp -r .next/static .next/standalone/.next/static.new
  if [[ -d .next/standalone/.next/static ]]; then
    mv .next/standalone/.next/static .next/standalone/.next/static.old
  fi
  mv .next/standalone/.next/static.new .next/standalone/.next/static
  rm -rf .next/standalone/.next/static.old

  if [[ -d public ]]; then
    rm -rf .next/standalone/public.new
    cp -r public .next/standalone/public.new
    if [[ -d .next/standalone/public ]]; then
      mv .next/standalone/public .next/standalone/public.old
    fi
    mv .next/standalone/public.new .next/standalone/public
    rm -rf .next/standalone/public.old
  fi

  ops_web_verify_static "$static_dir"
}

ops_web_verify_static() {
  local static_dir="${1:-$(ops_web_static_dir)}"
  local css_file css_name chunk_count

  css_file="$(ls "$static_dir"/css/*.css 2>/dev/null | head -1 || true)"
  if [[ -z "$css_file" ]]; then
    echo "FAIL  $static_dir/css missing"
    return 1
  fi

  css_name="$(basename "$css_file")"
  chunk_count="$(find "$static_dir/chunks" -maxdepth 1 -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$chunk_count" -lt 5 ]]; then
    echo "FAIL  $static_dir/chunks has only $chunk_count js files"
    return 1
  fi

  echo "OK  static verified ($css_name, $chunk_count chunks)"
}

ops_web_build() {
  local app_dir root api_url pwa_enabled mkt_ai_planner
  root="$(ops_web_root)"
  app_dir="$(ops_web_dir)"
  api_url="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  pwa_enabled="${NEXT_PUBLIC_PWA_ENABLED:-1}"

  if [[ -f "$root/deploy/runtime.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$root/deploy/runtime.env"
    set +a
  fi
  mkt_ai_planner="${NEXT_PUBLIC_MKT_AI_PLANNER:-0}"

  cd "$app_dir"
  echo "== ops-web build =="
  echo "NEXT_PUBLIC_PTT_API_URL=$api_url"
  echo "NEXT_PUBLIC_PWA_ENABLED=$pwa_enabled"
  echo "NEXT_PUBLIC_MKT_AI_PLANNER=$mkt_ai_planner"
  git -C "$root" log -1 --oneline

  npm ci
  export NEXT_PUBLIC_PTT_API_URL="$api_url"
  export NEXT_PUBLIC_PWA_ENABLED="$pwa_enabled"
  export NEXT_PUBLIC_MKT_AI_PLANNER="$mkt_ai_planner"
  npm run build
  ops_web_sync_static
}

ops_web_bootstrap_release_from_legacy() {
  local root legacy release_path current_link
  root="$(ops_web_root)"
  current_link="$root/current/ops-web"
  legacy="$(ops_web_dir)/.next/standalone"

  if [[ -L "$current_link" || -d "$current_link" ]]; then
    return 0
  fi
  if [[ ! -f "$legacy/server.js" ]]; then
    echo "FAIL  no release and no legacy standalone — run ./scripts/deploy_ops_web.sh first"
    return 1
  fi

  release_path="$root/releases/ops-web-legacy-bootstrap"
  mkdir -p "$root/releases"
  rsync -a --delete "$legacy/" "$release_path/"
  ln -sfn "$release_path" "$current_link"
  echo "OK  bootstrapped current/ops-web from legacy standalone"
}

ops_web_latest_release() {
  local root="${1:-$(ops_web_root)}"
  ls -1dt "$root/releases/ops-web-"* 2>/dev/null | head -1 || true
}

ops_web_activate_release() {
  local release_path="${1:-}"
  local root current_link resolved

  root="$(ops_web_root)"
  current_link="$root/current/ops-web"
  if [[ -z "$release_path" ]]; then
    release_path="$(ops_web_latest_release "$root")"
  fi
  if [[ -z "$release_path" || ! -d "$release_path" ]]; then
    echo "FAIL  no ops-web release to activate under $root/releases/"
    return 1
  fi

  mkdir -p "$root/current"
  if [[ "$(id -u)" -eq 0 ]]; then
    chown deploy:deploy "$root/current" 2>/dev/null || true
  fi

  ln -sfn "$release_path" "$current_link"
  resolved="$(readlink -f "$current_link" 2>/dev/null || readlink "$current_link" 2>/dev/null || true)"
  if [[ "$resolved" != "$release_path" ]]; then
    echo "WARN  could not update $current_link (likely owned by root)"
    echo "      Run: sudo ln -sfn '$release_path' '$current_link'"
    echo "      Or:  sudo $root/scripts/deploy_ops_web.sh --activate-latest"
    return 1
  fi

  echo "OK  active release → $release_path"
}

ops_web_publish_release() {
  local root release_id release_path
  root="$(ops_web_root)"
  release_id="$(git -C "$root" rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
  release_path="$root/releases/ops-web-$release_id"

  mkdir -p "$root/releases" "$root/current"
  rm -rf "$release_path"
  mkdir -p "$release_path"
  rsync -a --delete "$(ops_web_dir)/.next/standalone/" "$release_path/"
  ops_web_activate_release "$release_path" || true

  echo "OK  release published → $release_path"
  printf '%s\n' "$release_path"
}

ops_web_sample_chunk() {
  local static_dir chunk
  static_dir="$(ops_web_static_dir)"
  chunk="$(basename "$(ls "$static_dir/chunks/"*.js 2>/dev/null | head -1)")"
  printf '%s\n' "$chunk"
}

ops_web_verify_local() {
  local css chunk css_code chunk_code
  css="$(basename "$(ls "$(ops_web_static_dir)"/css/*.css | head -1)")"
  chunk="$(ops_web_sample_chunk)"

  css_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3200/_next/static/css/$css")"
  chunk_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3200/_next/static/chunks/$chunk")"
  echo "node :3200 css/$css → HTTP $css_code"
  echo "node :3200 chunks/$chunk → HTTP $chunk_code"

  if [[ "$css_code" != "200" || "$chunk_code" != "200" ]]; then
    echo "FAIL  ops-web local static not served"
    return 1
  fi
  echo "OK  ops-web local static"
}

ops_web_verify_public() {
  local domain css chunk css_code chunk_code
  domain="${OPS_WEB_PUBLIC_DOMAIN:-rs.pttads.vn}"
  css="$(basename "$(ls "$(ops_web_static_dir)"/css/*.css | head -1)")"
  chunk="$(ops_web_sample_chunk)"

  css_code="$(curl -sk -o /dev/null -w "%{http_code}" "https://$domain/_next/static/css/$css")"
  chunk_code="$(curl -sk -o /dev/null -w "%{http_code}" "https://$domain/_next/static/chunks/$chunk")"
  echo "https $domain css/$css → HTTP $css_code"
  echo "https $domain chunks/$chunk → HTTP $chunk_code"

  if [[ "$css_code" != "200" || "$chunk_code" != "200" ]]; then
    echo "FAIL  public static not served"
    return 1
  fi
  echo "OK  public static"
}

ops_web_prune_releases() {
  local root keep
  root="$(ops_web_root)"
  keep="${OPS_WEB_RELEASE_KEEP:-5}"
  mapfile -t old < <(ls -1dt "$root/releases/ops-web-"* 2>/dev/null | tail -n +"$((keep + 1))" || true)
  for dir in "${old[@]:-}"; do
    [[ -d "$dir" ]] || continue
    rm -rf "$dir" 2>/dev/null || echo "WARN  prune skipped (permission): $dir"
  done
}
