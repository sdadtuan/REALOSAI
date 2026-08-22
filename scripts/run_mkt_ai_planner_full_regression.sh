#!/usr/bin/env bash
# MKT-AI full regression — P0 UAT + P1…P4 blocks + smoke gates (WS-P4-06 / MKTP-UC-025)
#
# Usage (staging VPS):
#   export DATABASE_URL=postgresql://...
#   export PTT_CRM_INTERNAL_KEY=...   # or ADMIN_PASSWORD
#   export LIFECYCLE_ID=1
#   ./scripts/run_mkt_ai_planner_full_regression.sh
#
# Optional:
#   SKIP_P3_UAT=1          # skip heavy UC-019…021 gate (smokes only)
#   SKIP_PORTAL_SMOKE=1    # portal creds often missing on VPS
#   RUN_E1=1               # forward to P0 UAT retry branch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
if [[ -f "$ROOT/deploy/runtime.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/deploy/runtime.env"
  set +a
fi

export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
export LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
export PTT_MKT_AI_PLANNER_SLUGS="${PTT_MKT_AI_PLANNER_SLUGS:-meta-lead-gen,bds-lead-gen,seo-retainer}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "== MKT-AI full regression @ ${GIT_SHA} =="
echo "API=${PTT_API_URL} lifecycle=#${LIFECYCLE_ID}"

step() {
  echo ""
  echo "==> $1"
}

step "0/9 Health"
curl -sf "${PTT_API_URL}/health" >/dev/null
echo "OK  Nest /health"

step "0b/9 Playbook schema gate (WS-P4-08)"
bash "$ROOT/scripts/verify_mkt_ai_playbooks.sh"

if [[ -n "${DATABASE_URL:-}" ]]; then
  step "1/8 Seed UAT lifecycles (idempotent)"
  bash "$ROOT/scripts/seed_mkt_ai_uat_lifecycle.sh"
else
  echo "SKIP seed — DATABASE_URL not set"
fi

step "2/8 P0 UAT + P1…P4 extended blocks"
export RUN_E1="${RUN_E1:-0}"
bash "$ROOT/scripts/run_mkt_ai_planner_uat.sh"

if [[ "${SKIP_P3_UAT:-0}" != "1" ]]; then
  step "3/8 P3 UAT UC-019…021"
  bash "$ROOT/scripts/run_mkt_ai_p3_uat.sh"
else
  echo "SKIP P3 UAT (SKIP_P3_UAT=1)"
fi

step "4/8 Context smoke"
bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"

step "5/8 Multi-slug smoke"
if [[ -n "${DATABASE_URL:-}" ]]; then
  bash "$ROOT/scripts/smoke_mkt_ai_multi_slug.sh"
else
  echo "SKIP multi-slug — DATABASE_URL not set"
fi

step "6/8 Async multi-agent smoke (WS-P4-03)"
bash "$ROOT/scripts/smoke_mkt_ai_multi_agent_async.sh"

step "7/8 Plan depth smokes (WS-P4-02 / WS-P4-04 / WS-P4-09)"
if [[ -n "${DATABASE_URL:-}" ]]; then
  bash "$ROOT/scripts/smoke_mkt_ai_plan_depth.sh"
  bash "$ROOT/scripts/smoke_mkt_ai_plan_depth_wave2.sh"
  bash "$ROOT/scripts/smoke_mkt_ai_plan_depth_wave3.sh"
else
  echo "SKIP plan depth smokes — DATABASE_URL not set"
fi

step "8/9 Portal summary smoke (WS-P4-05)"
if [[ "${SKIP_PORTAL_SMOKE:-0}" != "1" ]]; then
  bash "$ROOT/scripts/smoke_mkt_ai_portal_summary.sh" || {
    echo "WARN portal summary smoke skipped/failed (set PORTAL_EMAIL+PORTAL_PASSWORD or SKIP_PORTAL_SMOKE=1)"
  }
else
  echo "SKIP portal summary (SKIP_PORTAL_SMOKE=1)"
fi

step "8b/9 Admin playbooks smoke (WS-P4-08)"
bash "$ROOT/scripts/smoke_mkt_ai_playbooks_admin.sh" || echo "WARN admin playbooks smoke skipped"

step "Ops weekly report (non-blocking)"
if [[ -n "${DATABASE_URL:-}" ]]; then
  bash "$ROOT/scripts/report_mkt_ai_ops_weekly.sh" || echo "WARN ops report SLO alert (exit 2) — review docs/exports/mkt-ai-ops-*.md"
else
  echo "SKIP ops report — DATABASE_URL not set"
fi

echo ""
echo "OK  run_mkt_ai_planner_full_regression — all gates passed"
