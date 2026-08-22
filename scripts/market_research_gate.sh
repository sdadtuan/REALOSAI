#!/usr/bin/env bash
# Market Research OS P0+P1+P2+P3+P4 gate — EC-RES-02,04,05,06,08,10,11 (+ skip notes for live-only ECs).
#
#   bash scripts/market_research_gate.sh
#
# Live tenancy (EC-RES-06):
#   API_BASE=... BETA_TOKEN=... ACME_PROJECT_ID=... bash scripts/market_research_gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:3000}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

echo "== Market Research P0+P1+P2+P3+P4 gate @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown) =="

echo "== syntax =="
bash -n "$ROOT/scripts/market_research_gate.sh"
bash -n "$ROOT/scripts/smoke_market_research_p0.sh"
bash -n "$ROOT/scripts/deploy_market_research_vps.sh"
if [[ -f "$ROOT/scripts/smoke_market_research_p1.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p1.sh"
fi
if [[ -f "$ROOT/scripts/deploy_market_research_p1_vps.sh" ]]; then
  bash -n "$ROOT/scripts/deploy_market_research_p1_vps.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p2.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p2.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p2_m3.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p2_m3.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p2_m4.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p2_m4.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p2_m5.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p2_m5.sh"
fi
if [[ -f "$ROOT/scripts/deploy_market_research_p2_vps.sh" ]]; then
  bash -n "$ROOT/scripts/deploy_market_research_p2_vps.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3_m1.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3_m1.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3_m2.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3_m2.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3_m3.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3_m3.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3_m4.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3_m4.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p3_m5.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p3_m5.sh"
fi
if [[ -f "$ROOT/scripts/deploy_market_research_p3_vps.sh" ]]; then
  bash -n "$ROOT/scripts/deploy_market_research_p3_vps.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4_m1.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4_m1.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4_m2.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4_m2.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4_m3.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4_m3.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4_m4.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4_m4.sh"
fi
if [[ -f "$ROOT/scripts/smoke_market_research_p4_m5.sh" ]]; then
  bash -n "$ROOT/scripts/smoke_market_research_p4_m5.sh"
fi
if [[ -f "$ROOT/scripts/deploy_market_research_p4_vps.sh" ]]; then
  bash -n "$ROOT/scripts/deploy_market_research_p4_vps.sh"
fi
if [[ -f "$ROOT/scripts/apply_pg_ddl_market_research_p4.sh" ]]; then
  bash -n "$ROOT/scripts/apply_pg_ddl_market_research_p4.sh"
fi
if [[ -f "$ROOT/scripts/apply_pg_ddl_market_research_p2.sh" ]]; then
  bash -n "$ROOT/scripts/apply_pg_ddl_market_research_p2.sh"
fi
echo "OK  bash -n gate / smoke_p0 / deploy / smoke_p1 / deploy_p1 / smoke_p2 / deploy_p2 / smoke_p3 / deploy_p3 / smoke_p4 / deploy_p4"

echo "== unit (EC-RES-04/05/06/08/10/11 + P3 portal) =="
(
  cd "$ROOT/services/ptt-crm-api"
  npm test -- --testPathPattern='market-research|portal-research' --no-coverage
)

echo "EC-RES-01 nav — MANUAL: sidebar Lên kế hoạch shows Research + Marketing plan"
echo "EC-RES-02 POST project — unit + smoke_m1 (skip live if no ACCESS_TOKEN)"
echo "EC-RES-03 desk graceful — live-only; skip unless TAVILY_API_KEY + ACCESS_TOKEN (smoke_m2/m4)"
echo "EC-RES-04 insight_gate 400 — Jest evaluateInsightGate / submit-review"
echo "EC-RES-05 DOCX Evidence — Jest unzip word/document.xml"
echo "EC-RES-06 403 without title — Jest getProject outside scope"
echo "EC-RES-08 flag 404 — Jest MarketResearchEnabledGuard market_research_disabled"
echo "EC-RES-09 deep no insight insert — live-only; skip if RESEARCH_DEEP_PROVIDER=off"
echo "EC-RES-10 409 immutable — Jest PATCH verified evidence"
echo "EC-RES-11 self-approve 403 — Jest cannot_self_approve"
echo "EC-RES-12 ai_runs after desk — live-only; skip if no desk job"

echo "== P1 ECs (Jest only; no live API required) =="
echo "EC-P1-rubric 400 — Jest submitReview missing_confidence_rubric / insight-gate.util"
echo "EC-P1-methodology TC 400 — Jest createReport TC + stub → methodology_incomplete"
echo "EC-P1-plan JSON no statement — Jest insertPlanInsights / assertNoInsightTextLeak"
echo "EC-P1-triangulate no insight insert — Jest runTriangulate does not call createInsight"

echo "== P2 ECs (Jest only; no live API required) =="
echo "EC-P2-consent PII 400 — Jest createConsent notes phone → consent_pii_forbidden"
echo "EC-P2-pulse no insight — Jest createInsight not called / pulse insight_ids: []"
echo "EC-P2-exec_en_locked — Jest POST exec-en when approved is 400 exec_en_locked"
echo "EC-P2-analytics 403 no title — Jest getOpsAnalytics out-of-scope client_id is 403 without title"

echo "== P3 ECs (Jest only; no live API required) =="
echo "EC-P3-publish not client-facing 400 — Jest publish when insight approved_internal is 400 insights_not_client_facing"
echo "EC-P3-portal cross-tenant 403 no title — Jest M2-1a cross-tenant GET → 403, JSON.stringify(body) has no title"
echo "EC-P3-waves CAT_REVIEW 400 — Jest POST wave on CAT_REVIEW is 400 waves_not_tracker"
echo "EC-P3-decision draft insight 400 — Jest POST decision with draft insight is 400 insight_not_approved"

echo "== P4 ECs (Jest only; no live API required) =="
echo "EC-P4-export pdf %PDF- — Jest export format=pdf buffer starts %PDF-"
echo "EC-P4-portal PDF cross-tenant 403 no title — Jest M2-1c Beta GET export.pdf → 403, JSON.stringify(body) has no title"
echo "EC-P4-cite draft insight 400 — Jest POST content-items/:itemId/insights draft → 400 insight_not_approved"
echo "EC-P4-wave NaN 400 — Jest validateCreateWave NaN/Infinity → metric value must be number or null"

if [[ -n "${BETA_TOKEN:-}" && -n "${ACME_PROJECT_ID:-}" ]]; then
  echo "== EC-RES-06 live tenancy =="
  HTTP_CODE="$(curl -sS -o /tmp/mr_gate_tenancy.json -w '%{http_code}' \
    -H "Authorization: Bearer $BETA_TOKEN" \
    "$API_BASE/api/v1/research/projects/$ACME_PROJECT_ID" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_gate_tenancy.json 2>/dev/null || true)"
  [[ "$HTTP_CODE" == "403" ]]
  python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_gate_tenancy.json'))
blob=json.dumps(body)
assert body.get('error')=='forbidden', body
assert 'title' not in body, body
assert 'title' not in blob
print('OK  EC-RES-06 403 without title')
PY
else
  echo "SKIP EC-RES-06 live — set BETA_TOKEN and ACME_PROJECT_ID (Jest already asserts 403 without title)"
fi

echo "PASS market_research_gate"
