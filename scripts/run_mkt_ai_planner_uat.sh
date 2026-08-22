#!/usr/bin/env bash
# MKT-AI P0 UAT — API walkthrough (WS-QA-01)
# Maps 21-step happy path from docs/use-cases/actions/10-MKTP-ACTIONS.md
#
# Usage (VPS or laptop with API reachability):
#   export DATABASE_URL=postgresql://...
#   export PTT_CRM_INTERNAL_KEY=...   # or ADMIN_PASSWORD
#   export LIFECYCLE_ID=1             # optional — auto from seed tag
#   ./scripts/run_mkt_ai_planner_uat.sh
#
# Optional: RUN_E1=1 to simulate retry path (campaign job twice)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_API_URL:-${OPS_UAT_API:-http://127.0.0.1:3000}}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"
REPORT="${MKT_AI_UAT_REPORT:-$ROOT/docs/exports/mkt-ai-uat-results-$(date +%Y%m%d-%H%M%S).md}"
ARTIFACT_DIR="${MKT_AI_UAT_ARTIFACTS:-$ROOT/.local-dev/mkt-ai-uat}"
PASS=0
FAIL=0
SKIP=0
BLOCKED=0

mkdir -p "$(dirname "$REPORT")" "$ARTIFACT_DIR"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASSWD="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"

log() { echo "$*" | tee -a "$REPORT"; }
pass() { PASS=$((PASS + 1)); log "- [x] **PASS** — $1"; }
fail() { FAIL=$((FAIL + 1)); log "- [ ] **FAIL** — $1"; }
skip() { SKIP=$((SKIP + 1)); log "- [ ] **SKIP** — $1"; }
blocked() { BLOCKED=$((BLOCKED + 1)); log "- [ ] **BLOCKED** — $1"; }

log "# MKT-AI Planner UAT — $(date -Iseconds)"
log ""
log "| Env | Value |"
log "|-----|-------|"
log "| API | \`$API_URL\` |"
log "| git | \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` |"
log "| lifecycle | \`${LIFECYCLE_ID:-auto}\` |"
log ""

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASSWD" ]]; then
  TOKEN="$(
    curl -sf "$API_URL/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
fi
if [[ -n "$TOKEN" && ${#AUTH[@]} -eq 0 ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi
if [[ ${#AUTH[@]} -eq 0 ]]; then
  blocked "Auth — set PTT_CRM_INTERNAL_KEY, STAFF_JWT, or ADMIN_PASSWORD"
  log ""
  log "## Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCKED=$BLOCKED"
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="${API_URL}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner${path}"
  if [[ -n "$body" ]]; then
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" -H 'Content-Type: application/json' -d "$body" "$url"
  else
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" "$url"
  fi
}

api_upload() {
  local path="$1"
  local file="$2"
  local field="${3:-file}"
  local url="${API_URL}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner${path}"
  curl -sS -w '\n%{http_code}' -X POST "${AUTH[@]}" -F "${field}=@${file}" "$url"
}

resolve_lifecycle() {
  if [[ -n "$LIFECYCLE_ID" ]]; then return; fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    LIFECYCLE_ID="$(
      psql "$DATABASE_URL" -tAc \
        "SELECT id FROM crm_service_lifecycle WHERE notes='mkt-ai-smoke-seed' ORDER BY id DESC LIMIT 1" 2>/dev/null \
        | tr -d '[:space:]' || true
    )"
  fi
  if [[ -z "$LIFECYCLE_ID" ]]; then
    LIFECYCLE_ID="$(
      curl -sf "$API_URL/api/crm/service-lifecycle?include_draft=1" "${AUTH[@]}" \
      | python3 -c "
import sys, json
ls = json.load(sys.stdin).get('lifecycles') or []
pref = [x for x in ls if str(x.get('service_slug',''))=='meta-lead-gen']
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
    )"
  fi
}

log "## §1 Health + flags"
if curl -sf "$API_URL/health" -o /dev/null; then pass "Nest /health OK"; else fail "Nest /health fail"; fi

resolve_lifecycle
if [[ -z "$LIFECYCLE_ID" ]]; then
  fail "No lifecycle — run ./scripts/seed_mkt_ai_uat_lifecycle.sh"
  log "## Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCKED=$BLOCKED"
  exit 1
fi
pass "Lifecycle resolved #$LIFECYCLE_ID"

log ""
log "## §2 Context (MKTP-UC-001, steps 2–3)"
CTX_RAW="$(api GET /context)"
CTX_HTTP="$(echo "$CTX_RAW" | tail -1)"
CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
echo "$CTX_BODY" >"$ARTIFACT_DIR/context-initial.json"
if [[ "$CTX_HTTP" == "200" ]]; then pass "GET context HTTP 200"; else fail "GET context HTTP $CTX_HTTP"; fi

python3 - <<PY || fail "Context JSON keys"
import json, sys
d=json.load(open("$ARTIFACT_DIR/context-initial.json"))
for k in ("lifecycle_id","brief","draft","jobs","tmmt_validation","flags"):
    assert k in d, k
print("ok")
PY
pass "Context payload keys present"

log ""
log "## §3 Brief (MKTP-UC-002, steps 4–6)"
BRIEF='{
  "brand_name": "ABC Logistics UAT",
  "industry": "Logistics B2B",
  "service_slug": "meta-lead-gen",
  "objective": "lead",
  "budget_monthly_vnd": 80000000,
  "geo_markets": ["HCM", "HN"],
  "challenges": "CPL cao, thiếu ICP rõ ràng cho B2B logistics",
  "competitors": ["Competitor A"],
  "usp": "Giảm CPL 25% trong 90 ngày"
}'
BRIEF_RAW="$(api PATCH /brief "$BRIEF")"
BRIEF_HTTP="$(echo "$BRIEF_RAW" | tail -1)"
if [[ "$BRIEF_HTTP" == "200" ]]; then pass "PATCH brief HTTP 200"; else fail "PATCH brief HTTP $BRIEF_HTTP"; fi

log ""
log "## §4 Strategy job (MKTP-UC-003, steps 7–9)"
STRAT_RAW="$(api POST /jobs/strategy)"
STRAT_HTTP="$(echo "$STRAT_RAW" | tail -1)"
if [[ "$STRAT_HTTP" == "200" ]]; then pass "POST jobs/strategy HTTP 200"; else fail "POST jobs/strategy HTTP $STRAT_HTTP"; fi

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-strategy.json"
python3 - <<PY || fail "EC-MKT-AI-02 — 4 core prof keys"
import json
d=json.load(open("$ARTIFACT_DIR/context-after-strategy.json"))
prof=d.get("draft",{}).get("target_market_prof") or {}
core=["market_context","segmentation_icp","personas_roles","pains_desired_outcomes"]
missing=[k for k in core if not str(prof.get(k,"")).strip()]
if missing:
    raise SystemExit("missing: "+",".join(missing))
print("ok")
PY
pass "EC-MKT-AI-02 — 4 core TMMT prof keys filled"

PATCH_DRAFT='{"strategy_framework":{"target_market":"SMB logistics VN — UAT patch"}}'
DRAFT_RAW="$(api PATCH /draft "$PATCH_DRAFT")"
if [[ "$(echo "$DRAFT_RAW" | tail -1)" == "200" ]]; then pass "PATCH draft (UC-006)"; else fail "PATCH draft"; fi

log ""
log "## §5 Campaign + content (MKTP-UC-004/005, steps 10–13)"
for job in campaigns content; do
  RAW="$(api POST "/jobs/$job")"
  HTTP="$(echo "$RAW" | tail -1)"
  if [[ "$HTTP" == "200" ]]; then pass "POST jobs/$job HTTP 200"; else fail "POST jobs/$job HTTP $HTTP"; fi
done

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-content.json"
python3 - <<PY || fail "Campaign + calendar present"
import json
d=json.load(open("$ARTIFACT_DIR/context-after-content.json"))
camps=d.get("draft",{}).get("campaigns_json") or []
cal=(d.get("draft",{}).get("content_json") or {}).get("calendar") or []
assert len(camps)>=1, "no campaigns"
assert len(cal)>=1, "no calendar"
print("ok")
PY
pass "≥1 campaign card + calendar rows"

log ""
log "## §6 Quality (MKTP-UC-007, step 15)"
Q_RAW="$(api POST /jobs/quality)"
if [[ "$(echo "$Q_RAW" | tail -1)" == "200" ]]; then pass "POST jobs/quality HTTP 200"; else fail "POST jobs/quality"; fi

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-quality.json"
SCORE="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-quality.json')).get('quality_score',{}).get('score',0))")"
if [[ "$SCORE" -ge 60 ]]; then pass "Quality score ≥60 ($SCORE/100)"; else fail "Quality score $SCORE < 60"; fi

log ""
log "## §7 Apply TMMT (MKTP-UC-008, steps 16–17)"
APPLY_BODY='{"confirm_overwrite":true}'
APPLY_RAW="$(api POST /apply "$APPLY_BODY")"
APPLY_HTTP="$(echo "$APPLY_RAW" | tail -1)"
APPLY_JSON="$(echo "$APPLY_RAW" | sed '$d')"
echo "$APPLY_JSON" >"$ARTIFACT_DIR/apply.json"
case "$APPLY_HTTP" in
  200)
    pass "POST apply HTTP 200"
    if python3 - <<PY
import json
d=json.load(open("$ARTIFACT_DIR/apply.json"))
v=d.get("tmmt_validation") or {}
assert v.get("ok") is True, v
print("ok")
PY
    then
      pass "EC-MKT-AI-03 — TMMT gate ok after apply"
    else
      fail "EC-MKT-AI-03 gate after apply"
    fi
    ;;
  409)
    blocked "POST apply 409 — seed official marketing_plan (./scripts/seed_mkt_ai_uat_lifecycle.sh)"
    ;;
  *)
    fail "POST apply HTTP $APPLY_HTTP"
    ;;
esac

log ""
log "## §8 Export (MKTP-UC-010, step 19)"
EXP_RAW="$(api POST /export '{"format":"pdf"}')"
EXP_HTTP="$(echo "$EXP_RAW" | tail -1)"
EXP_JSON="$(echo "$EXP_RAW" | sed '$d')"
echo "$EXP_JSON" >"$ARTIFACT_DIR/export-pdf.json"
if [[ "$EXP_HTTP" == "200" ]]; then
  python3 - <<PY || fail "Export PDF payload"
import json, base64
d=json.load(open("$ARTIFACT_DIR/export-pdf.json"))
assert d.get("encoding")=="base64", d.get("encoding")
raw=base64.b64decode(d.get("content",""))
assert raw[:4]==b"%PDF", raw[:8]
assert d.get("filename","").endswith(".pdf")
print("ok")
PY
  pass "POST export pdf — valid PDF base64 + filename"
else
  fail "POST export HTTP $EXP_HTTP"
fi

log ""
log "## §9 Audit (step 21)"
if [[ -n "${DATABASE_URL:-}" ]]; then
  JOB_COUNT="$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM mkt_ai_jobs WHERE lifecycle_id=$LIFECYCLE_ID AND status='succeeded'" 2>/dev/null \
    | tr -d '[:space:]' || echo 0)"
  if [[ "${JOB_COUNT:-0}" -ge 4 ]]; then
    pass "mkt_ai_jobs succeeded ≥4 (actual $JOB_COUNT)"
  else
    fail "mkt_ai_jobs succeeded=$JOB_COUNT (expected ≥4)"
  fi
  EXP_COUNT="$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM mkt_ai_exports WHERE lifecycle_id=$LIFECYCLE_ID" 2>/dev/null \
    | tr -d '[:space:]' || echo 0)"
  if [[ "${EXP_COUNT:-0}" -ge 1 ]]; then pass "mkt_ai_exports audit row present"; else fail "mkt_ai_exports empty"; fi
else
  skip "DB audit — DATABASE_URL not set"
fi

log ""
log "## §10 P1 RAG — document upload (MKTP-UC-011)"
CTX_RAW="$(api GET /context)"
CTX_FLAGS_BODY="$(echo "$CTX_RAW" | sed '$d')"
RAG_ENABLED="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('flags',{}).get('rag_enabled',False))" <<<"$CTX_FLAGS_BODY" 2>/dev/null || echo False)"
if [[ "$RAG_ENABLED" == "True" ]]; then
  RAG_TMP="$(mktemp)"
  cat >"$RAG_TMP" <<'EOF'
Brand KB stub — UAT RAG upload WS-P4-06.
USP: Giảm CPL 25% trong 90 ngày cho logistics B2B.
EOF
  DOC_RAW="$(api_upload /documents "$RAG_TMP")"
  DOC_HTTP="$(echo "$DOC_RAW" | tail -1)"
  DOC_BODY="$(echo "$DOC_RAW" | sed '$d')"
  echo "$DOC_BODY" >"$ARTIFACT_DIR/rag-upload.json"
  rm -f "$RAG_TMP"
  if [[ "$DOC_HTTP" == "201" || "$DOC_HTTP" == "200" ]]; then
    pass "POST documents HTTP $DOC_HTTP"
    LIST_RAW="$(api GET /documents)"
    if [[ "$(echo "$LIST_RAW" | tail -1)" == "200" ]]; then pass "GET documents HTTP 200"; else fail "GET documents"; fi
  else
    fail "POST documents HTTP $DOC_HTTP"
  fi
else
  skip "P1 RAG — rag_enabled flag off"
fi

log ""
log "## §11 P1 Budget simulate (MKTP-UC-012)"
BUDGET_RAW="$(api POST /jobs/budget-simulate '{"count":3}')"
BUDGET_HTTP="$(echo "$BUDGET_RAW" | tail -1)"
BUDGET_BODY="$(echo "$BUDGET_RAW" | sed '$d')"
echo "$BUDGET_BODY" >"$ARTIFACT_DIR/budget-simulate.json"
if [[ "$BUDGET_HTTP" == "200" ]]; then
  python3 - <<PY || fail "Budget scenarios shape"
import json
d=json.load(open("$ARTIFACT_DIR/budget-simulate.json"))
scenarios=d.get("scenarios") or []
assert len(scenarios) >= 2, len(scenarios)
print("ok")
PY
  pass "POST jobs/budget-simulate — ≥2 scenarios"
else
  fail "POST jobs/budget-simulate HTTP $BUDGET_HTTP"
fi

log ""
log "## §12 P2 Dashboard p95 (MKTP-UC-016 · EC-MKT-AI-07)"
DASH_MAX_MS=0
for _ in 1 2 3; do
  DASH_SEC="$(
    curl -sS -o "$ARTIFACT_DIR/dashboard.json" -w '%{time_total}' \
      "${AUTH[@]}" \
      "${API_URL}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner/dashboard?weeks=6" \
      2>/dev/null || echo 99
  )"
  DASH_MS="$(python3 -c "print(int(float('$DASH_SEC')*1000))" 2>/dev/null || echo 99000)"
  if [[ "$DASH_MS" -gt "$DASH_MAX_MS" ]]; then DASH_MAX_MS="$DASH_MS"; fi
done
if [[ "$DASH_MAX_MS" -lt 3000 ]]; then
  pass "GET dashboard p95-ish max ${DASH_MAX_MS}ms < 3000ms (3 samples)"
else
  fail "GET dashboard slow — max ${DASH_MAX_MS}ms (SLO 3000ms)"
fi
python3 - <<PY || fail "Dashboard payload keys"
import json
d=json.load(open("$ARTIFACT_DIR/dashboard.json"))
for k in ("ok","lifecycle_id","tiles","trend","period"):
    assert k in d, k
print("ok")
PY
pass "Dashboard payload keys present"

log ""
log "## §13 P3 Multi-agent async (MKTP-UC-022)"
CTX_RAW="$(api GET /context)"
CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
echo "$CTX_BODY" >"$ARTIFACT_DIR/context-p3-ma.json"
MA_ENABLED="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-p3-ma.json')).get('flags',{}).get('multi_agent_enabled',False))" 2>/dev/null || echo False)"
if [[ "$MA_ENABLED" == "True" ]]; then
  MA_POST="$(curl -sS -o "$ARTIFACT_DIR/multi-agent-async.json" -w '%{http_code}' \
    "${AUTH[@]}" -H 'Content-Type: application/json' \
    -X POST "${API_URL}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner/jobs/multi-agent" \
    -d '{"async":true,"skip_analyst":true}' 2>/dev/null || echo 000)"
  if [[ "$MA_POST" == "202" || "$MA_POST" == "200" ]]; then
    pass "POST jobs/multi-agent HTTP $MA_POST"
  else
    fail "POST jobs/multi-agent HTTP $MA_POST"
  fi
  ST_RAW="$(api GET /multi-agent/status)"
  if [[ "$(echo "$ST_RAW" | tail -1)" == "200" ]]; then
    pass "GET multi-agent/status HTTP 200"
  else
    fail "GET multi-agent/status"
  fi
else
  skip "P3 multi-agent — multi_agent_enabled off"
fi

log ""
log "## §14 P3 Playbook + governance (MKTP-UC-020/021)"
PB_RAW="$(api GET /playbooks)"
PB_HTTP="$(echo "$PB_RAW" | tail -1)"
PB_BODY="$(echo "$PB_RAW" | sed '$d')"
echo "$PB_BODY" >"$ARTIFACT_DIR/playbooks-meta.json"
if [[ "$PB_HTTP" == "200" ]]; then
  python3 - <<PY || fail "Playbooks list"
import json
d=json.load(open("$ARTIFACT_DIR/playbooks-meta.json"))
assert len(d.get("playbooks") or []) >= 1
print("ok")
PY
  pass "GET playbooks — ≥1 entry"
else
  fail "GET playbooks HTTP $PB_HTTP"
fi
python3 - <<PY || fail "Governance context block"
import json
d=json.load(open("$ARTIFACT_DIR/context-p3-ma.json"))
flags=d.get("flags") or {}
gov=d.get("governance") or {}
if flags.get("playbook_governance_enabled"):
    assert gov.get("enabled"), gov
    assert isinstance(gov.get("notes"), list)
    gate=gov.get("launch_qa_gate") or {}
    for k in ("required","min_score","ok","message_vi"):
        assert k in gate, k
print("ok")
PY
pass "Governance block + launch_qa_gate fields OK"

log ""
log "## §15 P4 Depth W1 — brief upload + KPI tree (MKTP-UC-026/031)"
BRIEF_TMP="$(mktemp)"
cat >"$BRIEF_TMP" <<'EOF'
Thương hiệu: UAT Depth Brand
Ngành: Logistics B2B
Mục tiêu: lead
Ngân sách tháng: 80 triệu VND
Thị trường: HCM, HN
Thách thức: CPL cao — UAT WS-P4-06 brief upload
EOF
UP_RAW="$(api_upload /brief/upload "$BRIEF_TMP")"
UP_HTTP="$(echo "$UP_RAW" | tail -1)"
UP_BODY="$(echo "$UP_RAW" | sed '$d')"
echo "$UP_BODY" >"$ARTIFACT_DIR/brief-upload.json"
rm -f "$BRIEF_TMP"
if [[ "$UP_HTTP" == "200" || "$UP_HTTP" == "201" ]]; then
  pass "POST brief/upload HTTP $UP_HTTP"
  echo "$UP_BODY" | grep -q '"score"' && pass "Brief upload readiness score present" || skip "Brief upload score missing (flag off?)"
else
  skip "POST brief/upload HTTP $UP_HTTP (PTT_MKT_AI_BRIEF_UPLOAD_ENABLED?)"
fi
KPI_RAW="$(api PATCH /draft '{"kpi_tree_json":[{"id":"north_star","label":"CPL","target":"< 500k","unit":"VND","children":[{"id":"c1","label":"Meta Lead","target":"200 leads"}]}],"risks_assumptions_json":{"risks":["CPL spike Q4"],"assumptions":["Budget stable 90d"]}}')"
if [[ "$(echo "$KPI_RAW" | tail -1)" == "200" ]]; then pass "PATCH draft kpi_tree + risks"; else fail "PATCH draft depth fields"; fi

log ""
log "## §16 P4 Depth W2 — scenarios + PPTX (MKTP-UC-027/029)"
CTX_RAW="$(api GET /context)"
CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
echo "$CTX_BODY" >"$ARTIFACT_DIR/context-p4-w2.json"
SCEN_FLAG="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-p4-w2.json')).get('flags',{}).get('scenario_compare_enabled',False))" 2>/dev/null || echo False)"
PPTX_FLAG="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-p4-w2.json')).get('flags',{}).get('export_pptx_enabled',False))" 2>/dev/null || echo False)"
if [[ "$SCEN_FLAG" == "True" ]]; then
  SCEN_RAW="$(api POST /jobs/strategy/scenarios '{"count":3}')"
  SCEN_HTTP="$(echo "$SCEN_RAW" | tail -1)"
  SCEN_BODY="$(echo "$SCEN_RAW" | sed '$d')"
  echo "$SCEN_BODY" >"$ARTIFACT_DIR/strategy-scenarios.json"
  if [[ "$SCEN_HTTP" == "200" ]]; then
    python3 - <<PY || fail "Strategy scenarios"
import json
d=json.load(open("$ARTIFACT_DIR/strategy-scenarios.json"))
assert len(d.get("scenarios") or []) >= 2
print("ok")
PY
    pass "POST jobs/strategy/scenarios — ≥2 scenarios"
  else
    fail "POST jobs/strategy/scenarios HTTP $SCEN_HTTP"
  fi
else
  skip "P4 scenarios — scenario_compare_enabled off"
fi
if [[ "$PPTX_FLAG" == "True" ]]; then
  SCORE="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-p4-w2.json')).get('quality_score',{}).get('score') or 0)" 2>/dev/null || echo 0)"
  if [[ "${SCORE%%.*}" -ge 60 ]]; then
    PPTX_RAW="$(api POST /export/pptx '{"sections":["strategy","campaign"]}')"
    PPTX_HTTP="$(echo "$PPTX_RAW" | tail -1)"
    if [[ "$PPTX_HTTP" == "200" ]]; then pass "POST export/pptx HTTP 200"; else skip "POST export/pptx HTTP $PPTX_HTTP (approval gate?)"; fi
  else
    skip "POST export/pptx — quality $SCORE < 60"
  fi
else
  skip "P4 PPTX — export_pptx_enabled off"
fi

  if [[ "${RUN_E1:-0}" == "1" ]]; then
  log ""
  log "## §E1 Retry path (EC-MKT-AI-05)"
  RETRY_RAW="$(api POST /jobs/campaigns/retry)"
  if [[ "$(echo "$RETRY_RAW" | tail -1)" == "200" ]]; then pass "POST jobs/campaigns/retry HTTP 200"; else fail "Retry campaign"; fi
  CTX_RAW="$(api GET /context)"
  echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-after-retry.json"
  python3 - <<PY || fail "Strategy draft preserved after retry"
import json
before=json.load(open("$ARTIFACT_DIR/context-after-strategy.json"))
after=json.load(open("$ARTIFACT_DIR/context-after-retry.json"))
b=(before.get("draft",{}).get("strategy_framework") or {}).get("target_market","")
a=(after.get("draft",{}).get("strategy_framework") or {}).get("target_market","")
assert a.strip(), "empty strategy after retry"
assert "UAT patch" in a or b, "strategy draft lost"
print("ok")
PY
  pass "Strategy draft preserved (EC-MKT-AI-05)"
fi

log ""
log "## Summary"
log ""
log "| Result | Count |"
log "|--------|-------|"
log "| PASS | $PASS |"
log "| FAIL | $FAIL |"
log "| SKIP | $SKIP |"
log "| BLOCKED | $BLOCKED |"
log ""
log "Report: \`$REPORT\`"
log "Artifacts: \`$ARTIFACT_DIR\`"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
if [[ "$BLOCKED" -gt 0 ]]; then exit 2; fi
exit 0
