#!/usr/bin/env bash
# CSKH AI Pilot — weekly KPI report (G2/G6 + R1 probes)
# Usage:
#   PILOT_WEEK=10 bash scripts/cskh_pilot_weekly_report.sh
#   REPORT=.local-dev/cskh-pilot-week-10-report.md bash scripts/cskh_pilot_weekly_report.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${CSKH_PILOT_ENV:-${R1_ENV:-$ROOT/deploy/env.local.example}}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi
if [[ -f "$ROOT/deploy/env.ai.example" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/deploy/env.ai.example" 2>/dev/null || true
  set +a
fi

WEEK="${PILOT_WEEK:-?}"
DAYS="${CSKH_PILOT_DAYS:-7}"
REPORT="${REPORT:-$ROOT/.local-dev/cskh-pilot-week-${WEEK}-report.md}"
API_URL="${CSKH_API_URL:-${R1_API_URL:-http://127.0.0.1:3000}}"

mkdir -p "$(dirname "$REPORT")"

# Pilot denominator from env (same logic as Nest config)
PILOT_DENOM=5
if [[ -n "${PTT_AI_PILOT_USER_IDS:-}" ]]; then
  PILOT_DENOM=$(echo "$PTT_AI_PILOT_USER_IDS" | tr ',' '\n' | grep -c . || echo 5)
fi
[[ "$PILOT_DENOM" -lt 1 ]] && PILOT_DENOM=5

DAU_TODAY=""
DAU_7D_AVG=""
ACCEPT_RATE=""
ACCEPTED=""
DISMISSED=""
RESOLVED=""
SUM_P95=""
AI_ERR_RATE=""
SCORE_COV=""

if [[ -n "${DATABASE_URL:-}" ]]; then
  DAU_TODAY=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(DISTINCT actor_id)
     FROM ai_agent_runs
     WHERE started_at >= date_trunc('day', NOW())
       AND use_case IN ('summarize','score_lead','score_deal','follow_up_draft','route_rep','nba_suggest','nl_query','copilot_draft')
       AND actor_id IS NOT NULL
       AND actor_id NOT IN ('system','cron','internal');" 2>/dev/null | tr -d ' ' || echo "")

  DAU_7D_AVG=$(psql "$DATABASE_URL" -tAc \
    "SELECT ROUND(AVG(dau)::numeric, 1) FROM (
       SELECT date_trunc('day', started_at)::date AS d,
              COUNT(DISTINCT actor_id)::int AS dau
       FROM ai_agent_runs
       WHERE started_at >= NOW() - INTERVAL '${DAYS} days'
         AND use_case IN ('summarize','score_lead','score_deal','follow_up_draft','route_rep','nba_suggest','nl_query','copilot_draft')
         AND actor_id IS NOT NULL
         AND actor_id NOT IN ('system','cron','internal')
       GROUP BY 1
     ) t;" 2>/dev/null | tr -d ' ' || echo "")

  read -r ACCEPTED DISMISSED RESOLVED <<< "$(psql "$DATABASE_URL" -tA -c \
    "SELECT
       COALESCE(COUNT(*) FILTER (WHERE status = 'accepted'), 0),
       COALESCE(COUNT(*) FILTER (WHERE status = 'dismissed'), 0),
       COALESCE(COUNT(*) FILTER (WHERE status IN ('accepted','dismissed')), 0)
     FROM ai_recommendations
     WHERE created_at >= NOW() - INTERVAL '${DAYS} days';" 2>/dev/null | head -1 | tr '|' ' ' || echo "0 0 0")"

  if [[ "${RESOLVED:-0}" -gt 0 ]]; then
    ACCEPT_RATE=$(python3 - <<PY
acc, dis = int("${ACCEPTED:-0}"), int("${DISMISSED:-0}")
print(round(100.0 * acc / max(acc + dis, 1), 1))
PY
)
  else
    ACCEPT_RATE="—"
  fi

  SUM_P95=$(psql "$DATABASE_URL" -tAc \
    "SELECT COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)), 0)
     FROM ai_agent_runs
     WHERE started_at >= NOW() - INTERVAL '${DAYS} days'
       AND use_case IN ('summarize', 'lead_brief');" 2>/dev/null | tr -d ' ' || echo "")

  AI_ERR_RATE=$(psql "$DATABASE_URL" -tAc \
    "SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'ok')
                   / NULLIF(COUNT(*), 0), 1)
     FROM ai_agent_runs
     WHERE started_at >= NOW() - INTERVAL '${DAYS} days';" 2>/dev/null | tr -d ' ' || echo "")

  SCORE_COV=$(psql "$DATABASE_URL" -tAc \
    "SELECT ROUND(100.0 * COUNT(DISTINCT s.entity_id) / NULLIF(COUNT(DISTINCT l.sqlite_lead_id), 0), 1)
     FROM crm_leads l
     LEFT JOIN ai_scores s ON s.entity_type = 'lead' AND s.entity_id = l.sqlite_lead_id::text
     WHERE l.created_at >= NOW() - INTERVAL '${DAYS} days';" 2>/dev/null | tr -d ' ' || echo "")
fi

DAU_RATE="—"
if [[ -n "${DAU_TODAY:-}" && "$PILOT_DENOM" -gt 0 ]]; then
  DAU_RATE=$(python3 - <<PY
print(round(100.0 * int("${DAU_TODAY:-0}") / int("${PILOT_DENOM}"), 1))
PY
)
fi

G2_PASS="FAIL"
if [[ -n "${DAU_RATE:-}" && "$DAU_RATE" != "—" ]]; then
  if python3 - <<PY
import sys
rate = float("${DAU_RATE}")
sys.exit(0 if rate >= 60 else 1)
PY
  then
    G2_PASS="PASS"
  fi
fi

G6_PASS="FAIL"
if [[ "$ACCEPT_RATE" != "—" ]]; then
  if python3 - <<PY
import sys
rate = float("${ACCEPT_RATE}")
sys.exit(0 if rate >= 35 else 1)
PY
  then
    G6_PASS="PASS"
  fi
fi

GENERATED=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S")

cat > "$REPORT" <<EOF
# CSKH AI Pilot — Weekly Report (Tuần ${WEEK})

> Generated: ${GENERATED} UTC · Window: ${DAYS} days · Env: ${ENV_FILE}

## KPI snapshot

| KPI | Target | Value | Gate |
|-----|--------|-------|------|
| Copilot DAU today (G2) | ≥60% of ${PILOT_DENOM} pilot | ${DAU_TODAY:-n/a}/${PILOT_DENOM} (${DAU_RATE}%) | ${G2_PASS} |
| Copilot DAU avg (${DAYS}d) | trend | ${DAU_7D_AVG:-n/a} | — |
| AI acceptance (G6) | ≥35% | ${ACCEPT_RATE}% (${ACCEPTED:-0} acc / ${DISMISSED:-0} dis) | ${G6_PASS} |
| Summarize P95 | ≤5000 ms | ${SUM_P95:-n/a} ms | — |
| AI error rate | <5% | ${AI_ERR_RATE:-n/a}% | — |
| Lead score coverage | proxy G3 | ${SCORE_COV:-n/a}% | — |

## Dashboard

- UI: \`/crm/ai/insights\` → CopilotAdoptionPanel
- API: \`GET ${API_URL}/api/v1/ai/analytics/adoption?days=${DAYS}\`

## Next steps

1. Copy template: \`docs/templates/cskh-ai-pilot-weekly-review.md\`
2. Host 45-min review (playbook §7)
3. Attach this report to weekly notes

## Related scripts

\`\`\`bash
R1_PILOT_DAYS=${DAYS} bash scripts/rnos_r1_metrics_probe.sh
bash scripts/rnos_r1_prod_pilot_gate.sh  # gate tuần 12
\`\`\`
EOF

echo "Wrote: $REPORT"
cat "$REPORT"
