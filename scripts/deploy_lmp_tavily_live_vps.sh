#!/usr/bin/env bash
# Enable live Tavily research for LMP Intel (worker collect.py).
#
# From laptop (requires TAVILY_API_KEY in env — never commit):
#   TAVILY_API_KEY=tvly-... APPLY=1 ./scripts/deploy_lmp_tavily_live_vps.sh
#
# On VPS directly:
#   TAVILY_API_KEY=tvly-... bash scripts/deploy_lmp_tavily_live_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

patch_runtime_kv() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  [[ -f "$env_file" ]] || touch "$env_file"
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    # shellcheck disable=SC2001
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    echo "${key}=${value}" >> "$env_file"
  fi
}

run_local() {
  : "${TAVILY_API_KEY:?Set TAVILY_API_KEY (tvly-...) before deploy}"

  cd "$ROOT"
  echo "== LMP Tavily live @ $(git rev-parse --short HEAD) =="

  local runtime_env="$ROOT/deploy/runtime.env"
  patch_runtime_kv "$runtime_env" "TAVILY_API_KEY" "$TAVILY_API_KEY"
  patch_runtime_kv "$runtime_env" "MAX_TAVILY_CREDITS_PER_LEAD" "${MAX_TAVILY_CREDITS_PER_LEAD:-8}"
  patch_runtime_kv "$runtime_env" "LMP_REQUIRE_TAVILY" "${LMP_REQUIRE_TAVILY:-1}"
  patch_runtime_kv "$runtime_env" "PTT_CRM_API_URL" "${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
  patch_runtime_kv "$runtime_env" "PTT_LEAD_MEETING_PREP_ENABLED" "1"
  patch_runtime_kv "$runtime_env" "PTT_JOBS_ENABLED" "1"
  echo "OK  runtime.env patched (TAVILY + LMP flags)"

  PYTHON="${PYTHON:-python3}"
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    PYTHON="$ROOT/.venv/bin/python"
  elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
    PYTHON="/var/www/ptt/.venv/bin/python"
  fi
  export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

  echo "== Tavily smoke (collect_company) =="
  set -a
  # shellcheck disable=SC1090
  source "$runtime_env"
  set +a
  "$PYTHON" - <<'PY'
import os
from ptt_crm.lead_meeting_prep.collect import collect_company

r = collect_company({"lead_id": 0, "company_name": "FPT Telecom"})
if r.get("stub"):
    raise SystemExit(f"Tavily smoke FAIL — still stub: {r.get('note')}")
credits = int(r.get("credits_used") or 0)
sources = len(r.get("company_sources") or [])
if credits < 1 or sources < 1:
    raise SystemExit(f"Tavily smoke FAIL — credits={credits} sources={sources}")
print(f"PASS  Tavily live — credits={credits} sources={sources} partial={r.get('partial')}")
PY

  echo "== restart ptt-worker =="
  sudo -n /usr/bin/systemctl restart ptt-worker
  sleep 2
  systemctl is-active ptt-worker
  echo "OK  ptt-worker active"

  echo ""
  echo "== Tavily live deploy complete =="
  echo "UAT: lead mới hoặc Chạy lại prep → tab Intel có nguồn Tavily (tavily_credits > 0)"
  echo "Note: prep cũ (stub) cần force rerun để refresh Intel"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  : "${TAVILY_API_KEY:?Set TAVILY_API_KEY before APPLY=1}"
  ssh "${VPS_USER}@${VPS_HOST}" \
    "cd ${VPS_ROOT} && git pull --ff-only origin main && TAVILY_API_KEY='${TAVILY_API_KEY}' MAX_TAVILY_CREDITS_PER_LEAD='${MAX_TAVILY_CREDITS_PER_LEAD:-8}' LMP_REQUIRE_TAVILY='${LMP_REQUIRE_TAVILY:-1}' bash scripts/deploy_lmp_tavily_live_vps.sh --local"
else
  echo "Dry-run. Example:"
  echo "  TAVILY_API_KEY=tvly-... APPLY=1 $0"
  echo "Or on VPS: TAVILY_API_KEY=tvly-... bash $0 --local"
fi
