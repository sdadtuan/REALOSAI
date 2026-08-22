#!/usr/bin/env bash
# MKT-AI prod pilot — daily/weekly monitor (7-day soak · P4-01-T7 / MKTP-UC-025 partial)
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   export MKT_AI_PILOT_LIFECYCLE_ID=42
#   ./scripts/mkt_ai_prod_pilot_monitor.sh
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

SOAK_DAYS="${MKT_AI_PILOT_SOAK_DAYS:-7}"
REPORT="${MKT_AI_PILOT_MONITOR_REPORT:-$ROOT/docs/exports/mkt-ai-prod-pilot-monitor-$(date +%Y%m%d-%H%M%S).md}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

mkdir -p "$(dirname "$REPORT")"

CLIENT_NAME="${MKT_AI_PILOT_CLIENT_NAME:-(unset)}"
SERVICE_SLUG="${MKT_AI_PILOT_SERVICE_SLUG:-meta-lead-gen}"

{
  echo "# MKT-AI prod pilot monitor"
  echo ""
  echo "> **Date:** $(date -Iseconds) · **git:** \`${GIT_SHA}\`"
  echo "> **Lifecycle:** #${MKT_AI_PILOT_LIFECYCLE_ID} · **slug:** \`${SERVICE_SLUG}\` · **client:** ${CLIENT_NAME}"
  echo "> **Window:** last ${SOAK_DAYS} days"
  echo ""
} >"$REPORT"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v lc="$MKT_AI_PILOT_LIFECYCLE_ID" \
  -v days="$SOAK_DAYS" <<'SQL' | tee -a "$REPORT"
\echo '## Job summary (pilot lifecycle)'
SELECT job_type, status, COUNT(*) AS cnt,
       ROUND(AVG(latency_ms)) AS avg_ms,
       MAX(created_at) AS last_at
FROM mkt_ai_jobs
WHERE lifecycle_id = :lc
  AND created_at >= NOW() - (:days || ' days')::interval
GROUP BY job_type, status
ORDER BY job_type, status;

\echo ''
\echo '## Fail rate (pilot lifecycle)'
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) AS total,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2)
  END AS fail_pct
FROM mkt_ai_jobs
WHERE lifecycle_id = :lc
  AND created_at >= NOW() - (:days || ' days')::interval;

\echo ''
\echo '## Multi-agent parent jobs'
SELECT id, status, latency_ms, created_at,
       output_json->>'playbook_slug' AS playbook,
       jsonb_array_length(COALESCE(output_json->'child_jobs', '[]'::jsonb)) AS child_count
FROM mkt_ai_jobs
WHERE lifecycle_id = :lc
  AND job_type = 'multi_agent'
  AND created_at >= NOW() - (:days || ' days')::interval
ORDER BY id DESC
LIMIT 10;

\echo ''
\echo '## Exports (audit)'
SELECT format, status, COUNT(*) AS cnt, MAX(created_at) AS last_at
FROM mkt_ai_exports
WHERE lifecycle_id = :lc
  AND created_at >= NOW() - (:days || ' days')::interval
GROUP BY format, status
ORDER BY format;

\echo ''
\echo '## SLO check'
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'OK (no jobs yet)'
    WHEN 100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*) > 5
      THEN 'FAIL fail_rate > 5%'
    ELSE 'OK fail_rate <= 5%'
  END AS slo_status
FROM mkt_ai_jobs
WHERE lifecycle_id = :lc
  AND created_at >= NOW() - (:days || ' days')::interval;
SQL

echo ""
echo "Report: $REPORT"

FAIL_RATE="$(psql "$DATABASE_URL" -tAc \
  "SELECT CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND(100.0*COUNT(*) FILTER (WHERE status='failed')/COUNT(*),2) END
   FROM mkt_ai_jobs
   WHERE lifecycle_id=${MKT_AI_PILOT_LIFECYCLE_ID}
     AND created_at >= NOW() - interval '${SOAK_DAYS} days'" \
  | tr -d '[:space:]')"

if [[ -n "$FAIL_RATE" ]] && python3 -c "import sys; sys.exit(0 if float('${FAIL_RATE}') <= 5 else 1)" 2>/dev/null; then
  echo "OK  SLO fail_rate=${FAIL_RATE}% (threshold 5%)"
  exit 0
fi

echo "WARN SLO fail_rate=${FAIL_RATE:-?}% exceeds 5% or no data"
exit 2
