#!/usr/bin/env bash
# MKT-AI prod pilot gate — preflight + smoke + kickoff report (P4-01-T7)
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   export MKT_AI_PILOT_LIFECYCLE_ID=42
#   export PTT_CRM_INTERNAL_KEY=...
#   ./scripts/mkt_ai_prod_pilot_gate.sh
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

: "${DATABASE_URL:?DATABASE_URL required}"
: "${MKT_AI_PILOT_LIFECYCLE_ID:?MKT_AI_PILOT_LIFECYCLE_ID required}"

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
REPORT="${MKT_AI_PILOT_GATE_REPORT:-$ROOT/docs/exports/mkt-ai-prod-pilot-kickoff-$(date +%Y%m%d-%H%M%S).md}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
SERVICE_SLUG="${MKT_AI_PILOT_SERVICE_SLUG:-meta-lead-gen}"
CLIENT_NAME="${MKT_AI_PILOT_CLIENT_NAME:-(unset)}"
SOAK_DAYS="${MKT_AI_PILOT_SOAK_DAYS:-7}"

mkdir -p "$(dirname "$REPORT")"
PASS=0
FAIL=0

log() { echo "$*" | tee -a "$REPORT"; }
pass() { PASS=$((PASS + 1)); log "- [x] $1"; }
fail() { FAIL=$((FAIL + 1)); log "- [ ] **FAIL** — $1"; }

log "# MKT-AI prod pilot kickoff gate"
log ""
log "> **git:** \`${GIT_SHA}\` · **date:** $(date -Iseconds)"
log "> **Lifecycle:** #${MKT_AI_PILOT_LIFECYCLE_ID} · **slug:** \`${SERVICE_SLUG}\` · **client:** ${CLIENT_NAME}"
log "> **Soak:** ${SOAK_DAYS} days · **Runbook:** \`docs/runbooks/mkt-ai-prod-pilot-checklist.md\`"
log ""

log "## 1. Lifecycle preflight"
if bash "$ROOT/scripts/verify_mkt_ai_pilot_lifecycle.sh" >>"$REPORT" 2>&1; then
  pass "Pilot lifecycle verified (official plan + slug)"
else
  fail "Pilot lifecycle preflight"
fi

log ""
log "## 2. Module flags"
for flag in PTT_MKT_AI_PLANNER_ENABLED PTT_MKT_AI_PLANNER_SLUGS PTT_MKT_AI_MULTI_AGENT_ENABLED; do
  val="${!flag:-unset}"
  if [[ "$flag" == "PTT_MKT_AI_PLANNER_ENABLED" && "$val" == "1" ]]; then
    pass "${flag}=${val}"
  elif [[ "$flag" == "PTT_MKT_AI_PLANNER_SLUGS" && "$val" == "$SERVICE_SLUG" ]]; then
    pass "${flag}=${val} (single slug pilot)"
  elif [[ "$flag" == "PTT_MKT_AI_MULTI_AGENT_ENABLED" && "$val" == "1" ]]; then
    pass "${flag}=${val}"
  else
    fail "${flag}=${val} (expected pilot values)"
  fi
done

log ""
log "## 3. API smoke (pilot lifecycle)"
export LIFECYCLE_ID="$MKT_AI_PILOT_LIFECYCLE_ID"
export PTT_API_URL="$API_URL"
if bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh" >>"$REPORT" 2>&1; then
  pass "GET ai-planner/context HTTP 200 + governance"
else
  fail "Context smoke on lifecycle #${MKT_AI_PILOT_LIFECYCLE_ID}"
fi

log ""
log "## 4. RBAC"
if bash "$ROOT/scripts/seed_mkt_ai_pilot_rbac.sh" --apply >>"$REPORT" 2>&1; then
  pass "crm_mkt_ai caps seeded for SP/AM"
else
  fail "RBAC seed"
fi

log ""
log "## 5. Rollback drill (dry-run only)"
log "Run manually before go-live: \`bash scripts/mkt_ai_prod_pilot_rollback.sh\` then re-enable."
log "Target: tab hidden + API 404 within 5 minutes."

log ""
log "## 6. Soak plan (${SOAK_DAYS} days)"
log ""
log "| Day | Action | Owner |"
log "|-----|--------|-------|"
log "| D0 | SP completes wizard on pilot lifecycle | SP |"
log "| D0–D6 | \`bash scripts/mkt_ai_prod_pilot_monitor.sh\` daily | DevOps |"
log "| D7 | Sign \`deploy/mkt-ai-prod-pilot-signoff.template.json\` | PO |"
log ""

log "## Summary"
log ""
log "| PASS | FAIL |"
log "|------|------|"
log "| ${PASS} | ${FAIL} |"
log ""
log "**Monitor cron (suggested):**"
log "\`0 9 * * * cd /var/www/rnosai && source .env && bash scripts/mkt_ai_prod_pilot_monitor.sh\`"
log ""

if [[ "$FAIL" -gt 0 ]]; then
  log "**Gate:** FAIL — fix before enabling prod pilot users"
  exit 1
fi

log "**Gate:** PASS — enable SP/AM on lifecycle #${MKT_AI_PILOT_LIFECYCLE_ID}"
log "Report: \`$REPORT\`"
exit 0
