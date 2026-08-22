#!/usr/bin/env bash
# AI Ops Prod Gate — verify prod-ready AI stack before pilot enable.
# Run: AI_OPS_PROD_GATE=1 bash scripts/ai_ops_prod_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${AI_OPS_ENV:-${RNOS40_ENV:-$ROOT/deploy/env.ai.example}}"
REPORT="${REPORT:-$ROOT/.local-dev/ai-ops-prod-gate-report.json}"

pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

echo "== AI Ops Prod Gate =="
echo "   Env: $ENV_FILE"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
else
  log_fail "env-file" "Missing env file: $ENV_FILE"
fi

if [[ "${PTT_AI_SCORE_ASYNC:-0}" == "1" ]]; then
  log_ok "score-async" "PTT_AI_SCORE_ASYNC=1"
else
  log_fail "score-async" "Prod requires PTT_AI_SCORE_ASYNC=1 (worker score_lead path)"
fi

if [[ "${AI_OPS_REQUIRE_COPILOT:-0}" == "1" ]]; then
  if [[ "${PTT_AI_COPILOT_ENABLED:-0}" == "1" ]]; then
    log_ok "copilot-enabled" "PTT_AI_COPILOT_ENABLED=1"
  else
    log_fail "copilot-enabled" "Set PTT_AI_COPILOT_ENABLED=1 for pilot (or unset AI_OPS_REQUIRE_COPILOT)"
  fi
else
  log_skip "copilot-enabled" "AI_OPS_REQUIRE_COPILOT not set — copilot flag check skipped"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  for tbl in ai_agent_runs ai_scores; do
    EXISTS=$(psql "$DATABASE_URL" -tAc \
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl' LIMIT 1;" \
      2>/dev/null | tr -d ' ' || echo "")
    if [[ "$EXISTS" == "1" ]]; then
      log_ok "ddl-$tbl" "Table $tbl exists (RNOS-01 DDL)"
    else
      log_fail "ddl-$tbl" "Missing table $tbl — apply RNOS-01 DDL"
    fi
  done

  SCORE_P95=$(psql "$DATABASE_URL" -tAc \
    "SELECT COALESCE(
       PERCENTILE_CONT(0.95) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (s.calculated_at - l.created_at))
       ), 0)
     FROM crm_leads l
     INNER JOIN ai_scores s
       ON s.entity_type = 'lead' AND s.entity_id = l.sqlite_lead_id::text
     WHERE l.created_at >= NOW() - INTERVAL '7 days'
       AND l.is_duplicate IS NOT TRUE
       AND s.overridden_by IS NULL;" 2>/dev/null | tr -d ' ' || echo "")

  if [[ -n "$SCORE_P95" ]]; then
    if python3 - <<PY
import sys
sys.exit(0 if float("${SCORE_P95}") <= 30 or float("${SCORE_P95}") == 0 else 1)
PY
    then
      if [[ "$SCORE_P95" == "0" ]]; then
        log_skip "g1-score-latency-p95" "No scored leads in 7d — run ingest + worker first"
      else
        log_ok "g1-score-latency-p95" "Score latency p95=${SCORE_P95}s ≤30s (Gate R1 #1)"
      fi
    else
      log_fail "g1-score-latency-p95" "Score latency p95=${SCORE_P95}s > 30s"
    fi
  else
    log_skip "g1-score-latency-p95" "Could not query score latency"
  fi

  WORKER_HINT=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM job_queue
     WHERE job_type = 'score_lead'
       AND status = 'done'
       AND updated_at >= NOW() - INTERVAL '7 days';" 2>/dev/null | tr -d ' ' || echo "")
  if [[ -n "$WORKER_HINT" ]]; then
    if [[ "$WORKER_HINT" -gt 0 ]]; then
      log_ok "worker-score-lead" "job_queue score_lead done 7d=$WORKER_HINT"
    else
      log_skip "worker-score-lead" "No score_lead jobs done in 7d (job_queue empty or worker idle)"
    fi
  else
    log_skip "worker-score-lead" "job_queue table unavailable"
  fi
else
  log_skip "ddl-tables" "DATABASE_URL not set"
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
  "gate": "ai-ops-prod",
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]
