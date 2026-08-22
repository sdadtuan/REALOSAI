#!/usr/bin/env bash
# MKT-AI Phase 3 sign-off gate — multi-slug seed + smoke (WS-P4-01).
#
# Usage:
#   cd /var/www/rnosai && source .env
#   ./scripts/close_mkt_ai_p3_signoff.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

export PTT_MKT_AI_PLANNER_SLUGS="${PTT_MKT_AI_PLANNER_SLUGS:-meta-lead-gen,bds-lead-gen,seo-retainer}"

echo "== MKT-AI Phase 3 sign-off @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="
echo "Pilot slugs: ${PTT_MKT_AI_PLANNER_SLUGS}"

echo ""
echo "== 1/4 Seed lifecycles (meta + bds + seo) =="
bash "$ROOT/scripts/seed_mkt_ai_uat_lifecycle.sh"

echo ""
echo "== 2/4 RBAC caps =="
bash "$ROOT/scripts/seed_mkt_ai_pilot_rbac.sh" --apply

export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"

echo ""
echo "== 3/4 Multi-slug context smoke =="
bash "$ROOT/scripts/smoke_mkt_ai_multi_slug.sh"

echo ""
echo "== 4/5 P0 regression smoke (lifecycle #1) =="
export LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"

echo ""
echo "== 5/5 P3 UAT UC-019…021 (PO sign-off API gate) =="
export LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
bash "$ROOT/scripts/run_mkt_ai_p3_uat.sh"
RC=$?

echo ""
if [[ "$RC" -eq 0 ]]; then
  echo "OK  P3 API UAT pass — PO sign manual UI rows in:"
  echo "    docs/runbooks/mkt-ai-phase3-signoff.md"
  echo "    docs/exports/mkt-ai-p3-signoff-*.md"
elif [[ "$RC" -eq 2 ]]; then
  echo "WARN P3 UAT blocked — check report in docs/exports/"
  exit 2
else
  echo "FAIL P3 UAT — see docs/exports/mkt-ai-p3-signoff-*.md"
  exit 1
fi
