#!/usr/bin/env bash
# Smoke GET ai-planner/context for all GA pilot slugs (WS-P4-01).
#
# Usage:
#   export PTT_API_URL=http://127.0.0.1:3000
#   export ADMIN_PASSWORD=...
#   ./scripts/smoke_mkt_ai_multi_slug.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_BASE="${PTT_API_URL:-${OPS_UAT_API:-http://127.0.0.1:3000}}"
PILOT_SLUGS="${PTT_MKT_AI_PLANNER_SLUGS:-meta-lead-gen,bds-lead-gen,seo-retainer}"
DATABASE_URL="${DATABASE_URL:-}"

slug_tag() {
  case "$1" in
    meta-lead-gen) echo 'mkt-ai-smoke-seed' ;;
    bds-lead-gen) echo 'mkt-ai-seed-bds' ;;
    seo-retainer) echo 'mkt-ai-seed-seo' ;;
    *) echo "mkt-ai-seed-${1//-/_}" ;;
  esac
}

resolve_lifecycle_id() {
  local slug="$1"
  local tag
  tag="$(slug_tag "$slug")"
  if [[ -n "$DATABASE_URL" ]]; then
    psql "$DATABASE_URL" -tAc \
      "SELECT id FROM crm_service_lifecycle WHERE service_slug='${slug}' AND notes='${tag}' ORDER BY id DESC LIMIT 1" \
      | tr -d '[:space:]'
    return
  fi
  echo ""
}

echo "== MKT-AI multi-slug smoke (slugs=${PILOT_SLUGS}) @ ${API_BASE} =="

IFS=',' read -r -a SLUGS <<< "$PILOT_SLUGS"
FAIL=0
for raw in "${SLUGS[@]}"; do
  slug="$(echo "$raw" | tr -d '[:space:]')"
  [[ -z "$slug" ]] && continue

  lifecycle_id="$(resolve_lifecycle_id "$slug")"
  if [[ -z "$lifecycle_id" && "$slug" == "meta-lead-gen" ]]; then
    lifecycle_id="${LIFECYCLE_ID:-1}"
  fi
  if [[ -z "$lifecycle_id" ]]; then
    echo "FAIL slug=${slug} — no lifecycle (run seed_mkt_ai_uat_lifecycle.sh)"
    FAIL=1
    continue
  fi

  echo ""
  echo "-- slug=${slug} lifecycle #${lifecycle_id} --"
  if ! LIFECYCLE_ID="$lifecycle_id" bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"; then
    echo "FAIL slug=${slug} lifecycle #${lifecycle_id}"
    FAIL=1
  fi
done

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "FAIL multi-slug smoke — check PTT_MKT_AI_PLANNER_SLUGS and seed"
  exit 1
fi
echo "OK  multi-slug smoke passed (${PILOT_SLUGS})"
