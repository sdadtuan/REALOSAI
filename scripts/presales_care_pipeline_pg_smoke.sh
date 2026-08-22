#!/usr/bin/env bash
# Lead care pipeline (B2) smoke — Nest + PostgreSQL (Wave B4 / P2 presales gate).
#
#   source deploy/env.local.example
#   export PTT_CRM_LEADS_FUNNEL_NEST=1 PTT_CRM_LEADS_FUNNEL_PG=1 PTT_PRESALES_ON_LEAD=1
#   # start ptt-crm-api on :3000, then:
#   LEAD_ID=9000002 ./scripts/presales_care_pipeline_pg_smoke.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${BASE:-http://127.0.0.1:3000}"
LEAD_ID="${LEAD_ID:-}"
EMAIL="${ADMIN_EMAIL:-admin@pttads.vn}"
PASS="${ADMIN_PASSWORD:-12345678}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== Lead care pipeline PG smoke BASE=$BASE =="

if [[ -z "${DATABASE_URL:-}" ]]; then
  bad "DATABASE_URL not set — source deploy/env.local.example"
else
  if psql "$DATABASE_URL" -t -c "SELECT 1 FROM crm_leads LIMIT 1" >/dev/null 2>&1; then
    ok "PG reachable"
  else
    bad "PG not reachable via DATABASE_URL"
  fi
  care_cols="$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.columns WHERE table_name='crm_leads' AND column_name IN ('care_stage_current','care_stages_done_json');" | tr -d ' ')"
  [[ "$care_cols" == "2" ]] && ok "crm_leads care columns" || bad "missing care columns on PG"
fi

curl -sf "$BASE/health" >/dev/null && ok "Nest /health" || { bad "Nest down on $BASE"; exit 1; }

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
  ok "auth internal key"
else
  TOKEN="$(
    curl -sf "$BASE/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
  if [[ -n "$TOKEN" ]]; then
    AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
    ok "staff login"
  else
    bad "login failed — set PTT_CRM_INTERNAL_KEY or ADMIN_PASSWORD"
    exit 1
  fi
fi

if [[ -z "$LEAD_ID" ]]; then
  LEAD_ID="$(
    curl -sf "$BASE/api/v1/leads?limit=1" "${AUTH[@]}" \
    | python3 -c "import sys,json; ls=json.load(sys.stdin).get('leads') or []; print(ls[0]['id'] if ls else '')" 2>/dev/null || true
  )"
fi
[[ -n "$LEAD_ID" ]] && ok "lead id=$LEAD_ID" || { bad "no LEAD_ID"; exit 1; }

care_get="$(curl -s -o /tmp/care-pipe-get.json -w '%{http_code}' "$BASE/api/v1/leads/$LEAD_ID/care-pipeline" "${AUTH[@]}")"
[[ "$care_get" =~ ^2 ]] && ok "GET care-pipeline (HTTP $care_get)" || bad "GET care-pipeline (HTTP $care_get)"

report_code="$(curl -s -o /tmp/care-pipe-report.json -w '%{http_code}' \
  -X POST "$BASE/api/v1/leads/$LEAD_ID/care-pipeline/report" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"stage":"first_contact","content":"PG smoke B2 report","care_status":"da_lien_he_thanh_cong","care_contact_type":"goi_dien"}')"
[[ "$report_code" =~ ^2 ]] && ok "POST care-pipeline/report (HTTP $report_code)" || bad "POST report (HTTP $report_code)"

complete_code="$(curl -s -o /tmp/care-pipe-complete.json -w '%{http_code}' \
  -X POST "$BASE/api/v1/leads/$LEAD_ID/care-pipeline/complete" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"stage":"first_contact","note":"PG smoke B2 complete — gate presales care"}')"
[[ "$complete_code" =~ ^2 ]] && ok "POST care-pipeline/complete (HTTP $complete_code)" || bad "POST complete (HTTP $complete_code)"

funnel_code="$(curl -s -o /tmp/care-pipe-funnel.json -w '%{http_code}' "$BASE/api/v1/leads/$LEAD_ID/funnel" "${AUTH[@]}")"
[[ "$funnel_code" =~ ^2 ]] && ok "GET funnel (HTTP $funnel_code)" || bad "GET funnel (HTTP $funnel_code)"

python3 - <<'PY'
import json, sys

funnel = json.load(open("/tmp/care-pipe-funnel.json"))
care = funnel.get("care_pipeline") or {}
gate = funnel.get("presales_care_gate") or {}
print(f"  care all_complete={care.get('all_complete')} stage={care.get('current_stage_key')}")
print(f"  presales_care_gate complete={gate.get('complete')} msg={gate.get('message','')[:60]}")
if not care.get("all_complete"):
    print("FAIL care_pipeline.all_complete expected true after B2 complete")
    sys.exit(1)
if not gate.get("complete"):
    print("FAIL presales_care_gate.complete expected true")
    sys.exit(1)
print("OK  care gate + presales_care_gate on PG funnel snapshot")
PY

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_done="$(psql "$DATABASE_URL" -t -A -c "SELECT care_stages_done_json->>'first_contact' IS NOT NULL FROM crm_leads WHERE sqlite_lead_id = ${LEAD_ID} LIMIT 1;" 2>/dev/null | tr -d ' ' || true)"
  [[ "$pg_done" == "t" ]] && ok "PG care_stages_done_json.first_contact set" || bad "PG care_stages_done_json not updated"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo '{"gate":"presales_care_pipeline_pg","ok":true}'
  echo "Lead care pipeline PG smoke PASSED"
  exit 0
fi
echo '{"gate":"presales_care_pipeline_pg","ok":false}'
echo "Lead care pipeline PG smoke FAILED"
exit 1
