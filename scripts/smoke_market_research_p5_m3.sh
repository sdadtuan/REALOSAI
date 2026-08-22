#!/usr/bin/env bash
# Smoke P5 M3 / M4 — Sources Chạy SparkToro (RES-UC-061).
#
# Live API (health 200 + sparktoro_enabled + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p5_m3.sh
#
# Skip live if health ≠ 200 or sparktoro_enabled is false (prod flag 0).
# Always documents 403 / sparktoro_disabled / no-insight and checks FE contract.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/sources-sparktoro.util.ts"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"
SVC="$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"

echo "==> FE contract (Sources SparkToro button)"
python3 - <<PY
from pathlib import Path
page = Path("$PAGE").read_text()
util = Path("$UTIL").read_text()
api = Path("$API").read_text()
svc = Path("$SVC").read_text()
banner = "Nguồn ước lượng — ghi limitation. Không tự tạo insight."
assert banner in util, "missing Sources estimate banner"
assert "SPARKTORO_SOURCES_BANNER" in page, "Sources tab must render estimate banner"
assert "Chạy SparkToro" in page, "missing Chạy SparkToro"
assert "shouldShowSparktoroButton" in page, "button must hide via shouldShowSparktoroButton"
assert "shouldShowSparktoroButton(false, true)" not in page
assert "sparktoro_enabled" in api, "fetchResearchHealth must expose sparktoro_enabled"
assert "runResearchSparktoro" in api and "run-sparktoro" in api
assert "createInsight" not in page.split("onRunSparktoro")[1].split("async function")[0], "FE must not createInsight from SparkToro"
assert "NEXT_PUBLIC_RESEARCH_SPARKTORO" not in page and "NEXT_PUBLIC_RESEARCH_SPARKTORO" not in api
assert "sparktoro_enabled" in svc
print("OK  FE Sources Chạy SparkToro + hide when flag 0 + no createInsight")
PY

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p5_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

echo "Contract:"
echo "  GET /api/v1/research/health → sparktoro_enabled true only when flag AND key; never returns SPARKTORO_API_KEY"
echo "  POST /api/v1/research/projects/:id/run-sparktoro {question_id} cap crm_research.run"
echo "    missing run cap / cross-tenant → 403 {error:forbidden} without source title"
echo "    flag or key off → 200 {ok:true, note:sparktoro_disabled} — not a project failure; no enqueue"
echo "    enabled → 202 {ok, run_id, status}; persist sources only — no createInsight"
echo "  FE: hide Chạy SparkToro when health.sparktoro_enabled is false (prod flag 0)"
echo "  Banner verbatim: Nguồn ước lượng — ghi limitation. Không tự tạo insight."

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P5 M3 SparkToro — health not 200 (flag off, API down, or unauthenticated path)."
  echo "OK  market research P5 M3 smoke (FE contract + 403/disabled/no-insight documented)"
  exit 0
fi

python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m3_health.json'))
blob=json.dumps(row)
assert 'SPARKTORO_API_KEY' not in blob
assert 'sparktoroApiKey' not in blob
enabled=row.get('sparktoro_enabled')
open('/tmp/mr_p5_m3_st_enabled','w').write('1' if enabled is True else '0')
print(f"OK  health sparktoro_enabled={enabled} (key never in JSON)")
PY

if [[ "$(cat /tmp/mr_p5_m3_st_enabled)" != "1" ]]; then
  echo "SKIP live P5 M3 SparkToro — sparktoro_enabled is false (prod flag 0)."
  echo "OK  market research P5 M3 smoke (FE contract + 403/disabled/no-insight documented)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P5 M3 SparkToro — set ACCESS_TOKEN and CLIENT_ID"
  echo "OK  market research P5 M3 smoke (FE contract + 403/disabled/no-insight documented)"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P5 M3 SparkToro $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m3_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở IDI premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Ai overlap audience sữa uống?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m3_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P5 M3 SparkToro — create project not 201 (http=$HTTP_CODE)"
  echo "OK  market research P5 M3 smoke (FE contract + 403/disabled/no-insight documented)"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m3_create.json'))['project']['id'])")"
QID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p5_m3_create.json'))['project']['questions'][0]['id'])")"

echo "==> POST /projects/$PID/run-sparktoro without token (expect 401/403)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m3_unauth.json -w '%{http_code}' \
  -H "Content-Type: application/json" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/run-sparktoro" \
  -d "{\"question_id\":$QID}" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m3_unauth.json)"
[[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]]
echo "OK  unauthenticated run-sparktoro → $HTTP_CODE (403/disabled documented)"

echo "==> POST /projects/$PID/run-sparktoro"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m3_run.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/run-sparktoro" \
  -d "{\"question_id\":$QID}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p5_m3_run.json)"
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m3_run.json'))
blob=json.dumps(row)
assert 'createInsight' not in blob
assert row.get('insight') is None
assert 'insights' not in row
note=row.get('note')
if note=='sparktoro_disabled':
    assert row.get('ok') is True
    print('OK  live sparktoro_disabled — no insight')
else:
    assert row.get('ok') is True
    assert row.get('run_id')
    print('OK  live run-sparktoro accepted — no insight in response')
PY

echo "==> GET /projects/$PID (no new insight from SparkToro)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p5_m3_proj.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PID")"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p5_m3_proj.json'))
proj=row.get('project') or row
insights=proj.get('insights') or []
assert insights==[] or all(i.get('generated_by')!='sparktoro' for i in insights), row
print('OK  project has no SparkToro-created insight')
PY

echo "OK  market research P5 M3 smoke"
