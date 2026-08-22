#!/usr/bin/env bash
# MKT-AI weekly ops report — job fail rate, apply/gate ratio, exports (WS-P4-06 / MKTP-UC-025)
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   ./scripts/report_mkt_ai_ops_weekly.sh
#
# Optional:
#   MKT_AI_OPS_REPORT_DAYS=7          # reporting window (default 7)
#   PTT_MKT_AI_OPS_WEEKLY_REPORT=1      # enable cron hook (no-op unless webhook set)
#   MKT_AI_OPS_SLACK_WEBHOOK=https://...  # POST summary on alert
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

REPORT_DAYS="${MKT_AI_OPS_REPORT_DAYS:-7}"
REPORT="${MKT_AI_OPS_REPORT:-$ROOT/docs/exports/mkt-ai-ops-$(date +%Y%m%d-%H%M%S).md}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
ALERT=0

mkdir -p "$(dirname "$REPORT")"

{
  echo "# MKT-AI ops weekly report"
  echo ""
  echo "> **Date:** $(date -Iseconds) · **git:** \`${GIT_SHA}\`"
  echo "> **Window:** last ${REPORT_DAYS} days · **UC:** MKTP-UC-025 (WS-P4-06)"
  echo ""
  echo "## SLO thresholds"
  echo ""
  echo "| Metric | Threshold |"
  echo "|--------|-----------|"
  echo "| Job fail rate (global) | ≤5% |"
  echo "| Job fail rate (any hour) | ≤5% when ≥5 jobs/h |"
  echo "| Multi-agent parent p95 | ≤120s staging |"
  echo "| Apply → TMMT gate pass | ≥70% |"
  echo ""
} >"$REPORT"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v days="$REPORT_DAYS" <<'SQL' | tee -a "$REPORT"
\echo '## Job fail rate by job_type'
SELECT
  job_type,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2)
  END AS fail_pct
FROM mkt_ai_jobs
WHERE created_at >= NOW() - (:days || ' days')::interval
GROUP BY job_type
ORDER BY total DESC, job_type;

\echo ''
\echo '## Weekly memo jobs (WS-P4-09 / MKTP-UC-028)'
SELECT
  COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total
FROM mkt_ai_jobs
WHERE job_type = 'weekly_memo'
  AND created_at >= NOW() - (:days || ' days')::interval;

\echo ''
\echo '## Global fail rate'
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2)
  END AS fail_pct
FROM mkt_ai_jobs
WHERE created_at >= NOW() - (:days || ' days')::interval;

\echo ''
\echo '## Hourly fail spikes (>5% with ≥5 jobs/h)'
SELECT
  date_trunc('hour', created_at) AS hour_bucket,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) AS fail_pct
FROM mkt_ai_jobs
WHERE created_at >= NOW() - (:days || ' days')::interval
GROUP BY 1
HAVING COUNT(*) >= 5
   AND 100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*) > 5
ORDER BY 1 DESC
LIMIT 24;

\echo ''
\echo '## Multi-agent p95 latency (ms)'
SELECT
  COUNT(*) AS multi_agent_jobs,
  ROUND(AVG(latency_ms)) AS avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)) AS p95_ms,
  MAX(latency_ms) AS max_ms
FROM mkt_ai_jobs
WHERE job_type = 'multi_agent'
  AND status IN ('succeeded', 'partial', 'failed')
  AND latency_ms IS NOT NULL
  AND created_at >= NOW() - (:days || ' days')::interval;

\echo ''
\echo '## Apply → TMMT gate pass ratio'
SELECT
  COUNT(*) FILTER (WHERE job_type = 'apply_to_tmmt') AS apply_jobs,
  COUNT(*) FILTER (
    WHERE job_type = 'apply_to_tmmt'
      AND COALESCE((output_json->'validation'->>'ok')::boolean, false)
  ) AS gate_pass,
  CASE WHEN COUNT(*) FILTER (WHERE job_type = 'apply_to_tmmt') = 0 THEN NULL
       ELSE ROUND(
         100.0 * COUNT(*) FILTER (
           WHERE job_type = 'apply_to_tmmt'
             AND COALESCE((output_json->'validation'->>'ok')::boolean, false)
         ) / COUNT(*) FILTER (WHERE job_type = 'apply_to_tmmt'),
         2
       )
  END AS gate_pass_pct
FROM mkt_ai_jobs
WHERE created_at >= NOW() - (:days || ' days')::interval;

\echo ''
\echo '## Export count by format'
SELECT
  format,
  COUNT(*) AS cnt,
  MAX(created_at) AS last_at
FROM mkt_ai_exports
WHERE created_at >= NOW() - (:days || ' days')::interval
GROUP BY format
ORDER BY format;

\echo ''
\echo '## Export week-over-week (current vs prior window)'
WITH bounds AS (
  SELECT
    NOW() - (:days || ' days')::interval AS cur_start,
    NOW() AS cur_end,
    NOW() - (2 * :days || ' days')::interval AS prev_start,
    NOW() - (:days || ' days')::interval AS prev_end
)
SELECT
  COALESCE(cur.cnt, 0) AS exports_current,
  COALESCE(prev.cnt, 0) AS exports_prior,
  COALESCE(cur.cnt, 0) - COALESCE(prev.cnt, 0) AS delta
FROM bounds b
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM mkt_ai_exports e
  WHERE e.created_at >= b.cur_start AND e.created_at < b.cur_end
) cur ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM mkt_ai_exports e
  WHERE e.created_at >= b.prev_start AND e.created_at < b.prev_end
) prev ON true;

\echo ''
\echo '## Top lifecycles by failed jobs'
SELECT lifecycle_id,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) AS total
FROM mkt_ai_jobs
WHERE created_at >= NOW() - (:days || ' days')::interval
GROUP BY lifecycle_id
HAVING COUNT(*) FILTER (WHERE status = 'failed') > 0
ORDER BY failed DESC, total DESC
LIMIT 10;
SQL

GLOBAL_FAIL="$(psql "$DATABASE_URL" -tAc \
  "SELECT CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND(100.0*COUNT(*) FILTER (WHERE status='failed')/COUNT(*),2) END
   FROM mkt_ai_jobs
   WHERE created_at >= NOW() - interval '${REPORT_DAYS} days'" \
  | tr -d '[:space:]')"

GATE_PASS_PCT="$(psql "$DATABASE_URL" -tAc \
  "SELECT CASE WHEN COUNT(*) FILTER (WHERE job_type='apply_to_tmmt')=0 THEN -1
          ELSE ROUND(100.0*COUNT(*) FILTER (
            WHERE job_type='apply_to_tmmt'
              AND COALESCE((output_json->'validation'->>'ok')::boolean,false)
          )/COUNT(*) FILTER (WHERE job_type='apply_to_tmmt'),2) END
   FROM mkt_ai_jobs
   WHERE created_at >= NOW() - interval '${REPORT_DAYS} days'" \
  | tr -d '[:space:]')"

P95_MS="$(psql "$DATABASE_URL" -tAc \
  "SELECT COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)),0)
   FROM mkt_ai_jobs
   WHERE job_type='multi_agent'
     AND latency_ms IS NOT NULL
     AND created_at >= NOW() - interval '${REPORT_DAYS} days'" \
  | tr -d '[:space:]')"

HOURLY_SPIKES="$(psql "$DATABASE_URL" -tAc \
  "SELECT COUNT(*) FROM (
     SELECT 1
     FROM mkt_ai_jobs
     WHERE created_at >= NOW() - interval '${REPORT_DAYS} days'
     GROUP BY date_trunc('hour', created_at)
     HAVING COUNT(*) >= 5
        AND 100.0*COUNT(*) FILTER (WHERE status='failed')/COUNT(*) > 5
   ) s" \
  | tr -d '[:space:]')"

{
  echo ""
  echo "## SLO evaluation"
  echo ""
} >>"$REPORT"

slo_line() {
  local label="$1"
  local status="$2"
  local detail="$3"
  echo "| ${label} | ${status} | ${detail} |" >>"$REPORT"
  if [[ "$status" == "FAIL" ]]; then ALERT=1; fi
}

{
  echo "| Check | Status | Detail |"
  echo "|-------|--------|--------|"
} >>"$REPORT"

if python3 -c "import sys; sys.exit(0 if float('${GLOBAL_FAIL:-0}') <= 5 else 1)" 2>/dev/null; then
  slo_line "Global fail rate" "OK" "${GLOBAL_FAIL:-0}%"
else
  slo_line "Global fail rate" "FAIL" "${GLOBAL_FAIL:-?}% (>5%)"
fi

if [[ "${HOURLY_SPIKES:-0}" -eq 0 ]]; then
  slo_line "Hourly fail spikes" "OK" "none"
else
  slo_line "Hourly fail spikes" "FAIL" "${HOURLY_SPIKES} hour(s) >5%"
fi

if [[ -z "${P95_MS:-}" || "${P95_MS:-0}" -eq 0 ]]; then
  slo_line "Multi-agent p95" "OK" "no parent jobs (n/a)"
elif python3 -c "import sys; sys.exit(0 if float('${P95_MS}') <= 120000 else 1)" 2>/dev/null; then
  slo_line "Multi-agent p95" "OK" "${P95_MS}ms"
else
  slo_line "Multi-agent p95" "WARN" "${P95_MS}ms (>120s staging SLO)"
fi

if [[ "${GATE_PASS_PCT:-}" == "-1" ]]; then
  slo_line "Apply → gate pass" "OK" "no apply jobs (n/a)"
elif python3 -c "import sys; sys.exit(0 if float('${GATE_PASS_PCT}') >= 70 else 1)" 2>/dev/null; then
  slo_line "Apply → gate pass" "OK" "${GATE_PASS_PCT}%"
else
  slo_line "Apply → gate pass" "FAIL" "${GATE_PASS_PCT}% (<70%)"
fi

{
  echo ""
  echo "**Report file:** \`${REPORT}\`"
  echo ""
  echo "_Cron: set \`PTT_MKT_AI_OPS_WEEKLY_REPORT=1\` and schedule weekly; optional \`MKT_AI_OPS_SLACK_WEBHOOK\`._"
} >>"$REPORT"

echo ""
echo "Report: $REPORT"

if [[ -n "${MKT_AI_OPS_SLACK_WEBHOOK:-}" && "$ALERT" -eq 1 ]]; then
  payload="$(python3 - "$GLOBAL_FAIL" "$GATE_PASS_PCT" "$REPORT" <<'PY'
import json, sys
fail_rate, gate_pass, report = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
  "text": f"MKT-AI ops alert — fail_rate={fail_rate}% gate_pass={gate_pass}% report={report}"
}))
PY
)"
  curl -sf -X POST "$MKT_AI_OPS_SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "$payload" >/dev/null \
    && echo "OK  Slack alert sent" \
    || echo "WARN Slack webhook failed"
fi

if [[ "${PTT_MKT_AI_OPS_WEEKLY_REPORT:-0}" == "1" ]]; then
  echo "OK  PTT_MKT_AI_OPS_WEEKLY_REPORT=1 — report generated"
fi

if [[ "$ALERT" -eq 1 ]]; then
  echo "WARN SLO alert — see report §SLO evaluation"
  exit 2
fi

echo "OK  report_mkt_ai_ops_weekly — SLO green"
exit 0
