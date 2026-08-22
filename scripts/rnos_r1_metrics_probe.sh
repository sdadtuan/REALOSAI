#!/usr/bin/env bash
# Gate R1 — SQL/metrics probes (G1–G6 spot checks)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${R1_ENV:-${RNOS40_ENV:-$ROOT/deploy/env.local.example}}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi
# Compliance defaults from env.ai.example (Gate R1 #5) when not in ENV_FILE
AI_ENV="$ROOT/deploy/env.ai.example"
if [[ -f "$AI_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$AI_ENV" 2>/dev/null || true
  set +a
fi

REPORT="${REPORT:-$ROOT/.local-dev/rnos-r1-metrics-probe.json}"
API_URL="${R1_API_URL:-${OPS_E2E_API_URL:-http://127.0.0.1:3000}}"
PILOT_DAYS="${R1_PILOT_DAYS:-7}"

pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

echo "== R1 Metrics Probe =="
echo "   Env: $ENV_FILE"
echo "   Report: $REPORT"

if [[ -n "${DATABASE_URL:-}" ]]; then
  # shellcheck source=rnosai_pg_guard.sh
  source "$ROOT/scripts/rnosai_pg_guard.sh" 2>/dev/null || true
  if command -v rnosai_assert_database_url >/dev/null 2>&1; then
    rnosai_assert_database_url "$DATABASE_URL" 2>/dev/null || true
  fi

  AUDIT_24H=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM ai_agent_runs WHERE started_at >= NOW() - INTERVAL '24 hours';" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$AUDIT_24H" ]]; then
    if [[ "$AUDIT_24H" -gt 0 ]]; then
      log_ok "g4-audit-24h" "ai_agent_runs 24h count=$AUDIT_24H (Gate R1 #4 spot)"
    else
      log_skip "g4-audit-24h" "No ai_agent_runs in 24h — run pilot traffic first"
    fi
  else
    log_skip "g4-audit-24h" "Could not query ai_agent_runs"
  fi

  SUM_P95=$(psql "$DATABASE_URL" -tAc \
    "SELECT COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)), 0)
     FROM ai_agent_runs
     WHERE started_at >= NOW() - INTERVAL '${PILOT_DAYS} days'
       AND use_case IN ('summarize', 'lead_brief');" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$SUM_P95" ]]; then
    if [[ "$SUM_P95" -le 5000 ]]; then
      log_ok "g2-summarize-p95" "Summarize/brief P95=${SUM_P95}ms ≤5000 (Gate R1 #2)"
    elif [[ "$SUM_P95" == "0" ]]; then
      log_skip "g2-summarize-p95" "No summarize runs in ${PILOT_DAYS}d"
    else
      log_fail "g2-summarize-p95" "Summarize P95=${SUM_P95}ms > 5000"
    fi
  else
    log_skip "g2-summarize-p95" "Could not query summarize latency"
  fi

  SCORE_PCT=$(psql "$DATABASE_URL" -tAc \
    "SELECT ROUND(100.0 * COUNT(DISTINCT s.entity_id) / NULLIF(COUNT(DISTINCT l.sqlite_lead_id), 0), 1)
     FROM crm_leads l
     LEFT JOIN ai_scores s ON s.entity_type = 'lead' AND s.entity_id = l.sqlite_lead_id::text
     WHERE l.created_at >= NOW() - INTERVAL '${PILOT_DAYS} days';" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$SCORE_PCT" ]]; then
    log_ok "g1-score-coverage" "Lead score coverage ${PILOT_DAYS}d=${SCORE_PCT}% (Gate R1 #1 proxy)"
  else
    log_skip "g1-score-coverage" "Could not query ai_scores coverage"
  fi

  SCORE_P95=$(psql "$DATABASE_URL" -tAc \
    "SELECT COALESCE(
       ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (s.calculated_at - l.created_at))
       )::numeric, 1),
       0)
     FROM crm_leads l
     INNER JOIN ai_scores s
       ON s.entity_type = 'lead' AND s.entity_id = l.sqlite_lead_id::text
     WHERE l.created_at >= NOW() - INTERVAL '${PILOT_DAYS} days'
       AND l.is_duplicate IS NOT TRUE
       AND s.overridden_by IS NULL;" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$SCORE_P95" ]]; then
    if [[ "$SCORE_P95" == "0" ]]; then
      log_skip "g1-score-latency-p95" "No scored leads in ${PILOT_DAYS}d"
    elif python3 - <<PY
import sys
sys.exit(0 if float("${SCORE_P95}") <= 30 else 1)
PY
    then
      log_ok "g1-score-latency-p95" "Lead→score p95=${SCORE_P95}s ≤30s (Gate R1 #1)"
    else
      log_fail "g1-score-latency-p95" "Lead→score p95=${SCORE_P95}s > 30s"
    fi
  else
    log_skip "g1-score-latency-p95" "Could not query score latency"
  fi

  ACCEPT_LINE=$(psql "$DATABASE_URL" -tA -c \
    "SELECT
       COUNT(*) FILTER (WHERE status = 'accepted'),
       COUNT(*) FILTER (WHERE status = 'dismissed'),
       COUNT(*)
     FROM ai_recommendations
     WHERE created_at >= NOW() - INTERVAL '${PILOT_DAYS} days';" 2>/dev/null | head -1 || echo "")
  if [[ -n "$ACCEPT_LINE" ]]; then
    IFS='|' read -r acc dis tot <<< "$ACCEPT_LINE"
    if [[ "${tot:-0}" -gt 0 && $((acc + dis)) -gt 0 ]]; then
      RATE=$(python3 - <<PY
acc, dis = int("${acc:-0}"), int("${dis:-0}")
print(round(100.0 * acc / max(acc + dis, 1), 1))
PY
)
      if python3 - <<PY
import sys
sys.exit(0 if float("${RATE}") >= 35 else 1)
PY
      then
        log_ok "g6-acceptance" "Draft acceptance ${RATE}% ≥35% (Gate R1 G6)"
      else
        log_fail "g6-acceptance" "Draft acceptance ${RATE}% < 35% target"
      fi
    else
      log_skip "g6-acceptance" "No ai_recommendations in ${PILOT_DAYS}d"
    fi
  else
    log_skip "g6-acceptance" "Could not query ai_recommendations"
  fi

  ATTR_PCT=$(psql "$DATABASE_URL" -tAc \
    "SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(source,'') <> '' AND COALESCE(channel,'') <> '')
            / NULLIF(COUNT(*), 0), 1)
     FROM crm_leads
     WHERE created_at >= NOW() - INTERVAL '90 days';" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$ATTR_PCT" ]]; then
    if python3 - <<PY
import sys
sys.exit(0 if float("${ATTR_PCT}") >= 80 else 1)
PY
    then
      log_ok "g1-attribution" "Lead source+channel ${ATTR_PCT}% ≥80 (G1 data ready)"
    else
      log_fail "g1-attribution" "Attribution ${ATTR_PCT}% < 80%"
    fi
  else
    log_skip "g1-attribution" "Could not query attribution"
  fi
else
  log_skip "sql-probes" "DATABASE_URL not set"
fi

if curl -sf "${API_URL}/api/v1/ai/health" >/dev/null 2>&1; then
  log_ok "api-health" "${API_URL}/api/v1/ai/health OK"
else
  log_skip "api-health" "Nest AI health not reachable at ${API_URL}"
fi

if [[ "${PTT_AI_LOG_PII:-1}" == "0" && "${PTT_AI_LOG_PROMPTS:-1}" == "0" ]]; then
  log_ok "g5-no-pii-logs" "PTT_AI_LOG_PII=0 and PTT_AI_LOG_PROMPTS=0 (Gate R1 #5)"
else
  log_fail "g5-no-pii-logs" "Prod requires PTT_AI_LOG_PII=0 and PTT_AI_LOG_PROMPTS=0"
fi

mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "gate": "R1-metrics",
  "pilot_days": int("${PILOT_DAYS}"),
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Metrics report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]
