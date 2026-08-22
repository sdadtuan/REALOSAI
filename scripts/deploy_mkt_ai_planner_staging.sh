#!/usr/bin/env bash
# MKT-AI S1 — Apply DDL + flags + smoke on staging VPS (rs.pttads.vn)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_mkt_ai_planner_staging.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_mkt_ai_planner_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MKT_AI_GA_SLUGS='meta-lead-gen,bds-lead-gen,seo-retainer'
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== MKT-AI planner staging kickoff @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/5 Apply DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_mkt_ai_planner.sh"

  echo "== 2/5 Verify DDL =="
  bash "$ROOT/scripts/verify_mkt_ai_ddl.sh"

  echo "== 2b/5 Verify playbook JSON (WS-P4-08) =="
  bash "$ROOT/scripts/verify_mkt_ai_playbooks.sh"

  echo "== 3/5 Enable API + FE flags =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=${MKT_AI_GA_SLUGS}" \
    "PTT_MKT_AI_RAG_ENABLED=1" \
    "PTT_MKT_AI_APPROVAL_REQUIRED=1" \
    "PTT_MKT_AI_KPI_ALERT_ENABLED=1" \
    "PTT_MKT_AI_PLAYBOOKS_ENABLED=1" \
    "PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE=1" \
    "PTT_MKT_AI_GOVERNANCE_BANNER=1" \
    "PTT_MKT_AI_MULTI_AGENT_ENABLED=1" \
    "PTT_MKT_AI_MULTI_AGENT_ASYNC=1" \
    "PTT_MKT_AI_PLAN_DEPTH_ENABLED=1" \
    "PTT_MKT_AI_BRIEF_UPLOAD_ENABLED=1" \
    "PTT_MKT_AI_SCENARIO_COMPARE=1" \
    "PTT_MKT_AI_SECTION_COMMENTS=1" \
    "PTT_MKT_AI_EXPORT_PPTX=1" \
    "PTT_MKT_AI_PORTAL_SUMMARY=1" \
    "NEXT_PUBLIC_MKT_AI_PORTAL_SUMMARY=1" \
    "PTT_MKT_AI_OPS_WEEKLY_REPORT=1" \
    "PTT_MKT_AI_KPI_CLOSED_LOOP=1" \
    "PTT_MKT_AI_WEEKLY_MEMO_CRON='0 9 * * 1'" \
    "NEXT_PUBLIC_MKT_AI_PLANNER=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  for kv in \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=${MKT_AI_GA_SLUGS}" \
    "PTT_MKT_AI_RAG_ENABLED=1" \
    "PTT_MKT_AI_APPROVAL_REQUIRED=1" \
    "PTT_MKT_AI_KPI_ALERT_ENABLED=1" \
    "PTT_MKT_AI_PLAYBOOKS_ENABLED=1" \
    "PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE=1" \
    "PTT_MKT_AI_GOVERNANCE_BANNER=1" \
    "PTT_MKT_AI_MULTI_AGENT_ENABLED=1" \
    "PTT_MKT_AI_MULTI_AGENT_ASYNC=1" \
    "PTT_MKT_AI_PLAN_DEPTH_ENABLED=1" \
    "PTT_MKT_AI_BRIEF_UPLOAD_ENABLED=1" \
    "PTT_MKT_AI_SCENARIO_COMPARE=1" \
    "PTT_MKT_AI_SECTION_COMMENTS=1" \
    "PTT_MKT_AI_EXPORT_PPTX=1" \
    "PTT_MKT_AI_PORTAL_SUMMARY=1" \
    "PTT_MKT_AI_KPI_CLOSED_LOOP=1" \
    "PTT_MKT_AI_WEEKLY_MEMO_CRON='0 9 * * 1'"; do
    key="${kv%%=*}"
    if [[ -f "$ROOT/.env" && -w "$ROOT/.env" ]]; then
      if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${kv}|" "$ROOT/.env"
      else
        echo "$kv" >>"$ROOT/.env"
      fi
    else
      echo "SKIP .env update (not writable) — runtime.env overrides apply"
    fi
  done

  echo "== 4/5 Restart Nest API (if systemd available) =="
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart (no passwordless sudo or not on VPS)"
    echo "     Manual: sudo systemctl restart ptt-crm-api"
  fi

  echo "== 4b/5 Seed UAT lifecycles (3 pilot slugs) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/seed_mkt_ai_uat_lifecycle.sh" || echo "WARN seed failed — set LIFECYCLE_ID manually"
  else
    echo "SKIP seed — DATABASE_URL not set"
  fi

  echo "== 4c/5 Multi-slug smoke =="
  export PTT_MKT_AI_PLANNER_SLUGS="${MKT_AI_GA_SLUGS}"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/smoke_mkt_ai_multi_slug.sh" || echo "WARN multi-slug smoke failed"
  else
    echo "SKIP multi-slug smoke — DATABASE_URL not set"
  fi

  echo "== 5/5 Smoke ai-planner/context (lifecycle #1) =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export ADMIN_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
  export ADMIN_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
  bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"

  echo "== 5a/5 Plan depth smoke (WS-P4-02 S2) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/smoke_mkt_ai_plan_depth.sh" || echo "WARN plan depth smoke failed"
  else
    echo "SKIP plan depth smoke — DATABASE_URL not set"
  fi

  echo "== 5a2/5 Plan depth Wave 2 smoke (WS-P4-04) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/smoke_mkt_ai_plan_depth_wave2.sh" || echo "WARN plan depth wave2 smoke failed"
  else
    echo "SKIP plan depth wave2 smoke — DATABASE_URL not set"
  fi

  echo "== 5a2b/5 Plan depth Wave 3 smoke (WS-P4-09) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/smoke_mkt_ai_plan_depth_wave3.sh" || echo "WARN plan depth wave3 smoke failed"
  else
    echo "SKIP plan depth wave3 smoke — DATABASE_URL not set"
  fi

  echo "== 5a3/5 Portal plan summary smoke (WS-P4-05) =="
  bash "$ROOT/scripts/smoke_mkt_ai_portal_summary.sh" || echo "WARN portal summary smoke failed"

  echo "== 5a4/5 Admin playbooks smoke (WS-P4-08) =="
  bash "$ROOT/scripts/smoke_mkt_ai_playbooks_admin.sh" || echo "WARN admin playbooks smoke failed"

  echo "== 5b/5 Build API + ops-web =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    (cd "$ROOT/services/ptt-crm-api" && npm ci && npm run build) || echo "WARN API build failed"
  fi
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    NEXT_PUBLIC_MKT_AI_PLANNER=1 bash "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null \
      || bash "$ROOT/scripts/deploy_ops_web.sh" 2>/dev/null \
      || echo "WARN ops-web deploy skipped"
  fi
  if [[ -x "$ROOT/scripts/wave_b2_rebuild_portal_web.sh" ]]; then
    NEXT_PUBLIC_MKT_AI_PORTAL_SUMMARY=1 bash "$ROOT/scripts/wave_b2_rebuild_portal_web.sh" 2>/dev/null \
      || echo "WARN portal-web rebuild skipped"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK (post-build)"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null; then
    echo "ops-web restarted"
  fi

  echo "== 5c/5 Full regression + ops report (WS-P4-06) =="
  echo "     SKIP_PORTAL_SMOKE=1 bash scripts/run_mkt_ai_planner_full_regression.sh"
  echo "     bash scripts/report_mkt_ai_ops_weekly.sh"

  echo "== MKT-AI staging kickoff complete =="
  echo "Flags: PTT_MKT_AI_PLANNER_ENABLED=1 PTT_MKT_AI_PLANNER_SLUGS=${MKT_AI_GA_SLUGS} PTT_MKT_AI_PLAYBOOKS_ENABLED=1 PTT_MKT_AI_MULTI_AGENT_ENABLED=1 NEXT_PUBLIC_MKT_AI_PLANNER=1"
  echo "Ops-web: rebuild with NEXT_PUBLIC_MKT_AI_PLANNER=1 to show tab (deploy_ops_web.sh)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_mkt_ai_planner_staging.sh --local"
else
  echo "Dry-run. Set APPLY=1 to run on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_mkt_ai_planner_staging.sh --local"
fi
