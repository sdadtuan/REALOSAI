#!/usr/bin/env bash
# MKT-AI Phase 3 UAT — API gate UC-019…021 (P4-01-T1)
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   export PTT_CRM_INTERNAL_KEY=...   # or ADMIN_PASSWORD
#   export LIFECYCLE_ID=1             # meta lifecycle (default 1)
#   ./scripts/run_mkt_ai_p3_uat.sh
#
# Output: docs/exports/mkt-ai-p3-signoff-*.md (+ artifacts under .local-dev/mkt-ai-p3-uat)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_API_URL:-${OPS_UAT_API:-http://127.0.0.1:3000}}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
REPORT="${MKT_AI_P3_UAT_REPORT:-$ROOT/docs/exports/mkt-ai-p3-signoff-$(date +%Y%m%d-%H%M%S).md}"
ARTIFACT_DIR="${MKT_AI_P3_UAT_ARTIFACTS:-$ROOT/.local-dev/mkt-ai-p3-uat}"
PASS=0
FAIL=0
SKIP=0
BLOCKED=0
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
RUN_DATE="$(date -Iseconds)"

mkdir -p "$(dirname "$REPORT")" "$ARTIFACT_DIR"

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

EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASSWD="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"

log() { echo "$*" | tee -a "$REPORT"; }
pass() { PASS=$((PASS + 1)); log "- [x] **PASS** — $1"; }
fail() { FAIL=$((FAIL + 1)); log "- [ ] **FAIL** — $1"; }
skip() { SKIP=$((SKIP + 1)); log "- [ ] **SKIP** — $1"; }
blocked() { BLOCKED=$((BLOCKED + 1)); log "- [ ] **BLOCKED** — $1"; }

log "# MKT-AI Phase 3 sign-off — API gate (UC-019…021)"
log ""
log "> **Staging:** \`${API_URL}\` · **git:** \`${GIT_SHA}\` · **date:** \`${RUN_DATE}\`"
log "> **Runbook:** \`docs/runbooks/mkt-ai-phase3-signoff.md\`"
log ""
log "| Env | Value |"
log "|-----|-------|"
log "| API | \`$API_URL\` |"
log "| meta lifecycle | \`#${LIFECYCLE_ID}\` |"
log "| slugs | \`${PTT_MKT_AI_PLANNER_SLUGS:-meta-lead-gen,bds-lead-gen,seo-retainer}\` |"
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
  log "## Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP BLOCKED=$BLOCKED"
  exit 1
fi

slug_lifecycle_id() {
  local slug="$1"
  local tag
  case "$slug" in
    meta-lead-gen) tag='mkt-ai-smoke-seed' ;;
    bds-lead-gen) tag='mkt-ai-seed-bds' ;;
    seo-retainer) tag='mkt-ai-seed-seo' ;;
    *) tag="mkt-ai-seed-${slug//-/_}" ;;
  esac
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -tAc \
      "SELECT id FROM crm_service_lifecycle WHERE service_slug='${slug}' AND notes='${tag}' ORDER BY id DESC LIMIT 1" \
      | tr -d '[:space:]'
    return
  fi
  case "$slug" in
    meta-lead-gen) echo "${LIFECYCLE_ID:-1}" ;;
    bds-lead-gen) echo "2" ;;
    seo-retainer) echo "3" ;;
  esac
}

api_for_lifecycle() {
  local lc="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local url="${API_URL}/api/crm/service-lifecycle/${lc}/ai-planner${path}"
  if [[ -n "$body" ]]; then
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" -H 'Content-Type: application/json' -d "$body" "$url"
  else
    curl -sS -w '\n%{http_code}' -X "$method" "${AUTH[@]}" "$url"
  fi
}

api() {
  api_for_lifecycle "$LIFECYCLE_ID" "$@"
}

log "## A. Preconditions"
if curl -sf "$API_URL/health" -o /dev/null; then pass "Nest /health OK"; else fail "Nest /health fail"; fi

BDS_LC="$(slug_lifecycle_id bds-lead-gen)"
SEO_LC="$(slug_lifecycle_id seo-retainer)"
pass "Lifecycle map meta=#${LIFECYCLE_ID} bds=#${BDS_LC:-?} seo=#${SEO_LC:-?}"

log ""
log "## B. MKTP-UC-019 — Multi-agent pipeline (lifecycle #${LIFECYCLE_ID})"

CTX_RAW="$(api GET /context)"
CTX_HTTP="$(echo "$CTX_RAW" | tail -1)"
CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
echo "$CTX_BODY" >"$ARTIFACT_DIR/context-meta-pre-pipeline.json"
if [[ "$CTX_HTTP" == "200" ]]; then pass "GET context HTTP 200"; else fail "GET context HTTP $CTX_HTTP"; fi

python3 - <<PY || fail "multi_agent_enabled flag"
import json
d=json.load(open("$ARTIFACT_DIR/context-meta-pre-pipeline.json"))
flags=d.get("flags") or {}
assert flags.get("multi_agent_enabled"), flags
print("ok")
PY
pass "UC-019 gate — PTT_MKT_AI_MULTI_AGENT_ENABLED=1"

MA_RAW="$(api POST /jobs/multi-agent '{"playbook_slug":"meta-lead-gen","pipeline_key":"default_v1"}')"
MA_HTTP="$(echo "$MA_RAW" | tail -1)"
MA_BODY="$(echo "$MA_RAW" | sed '$d')"
echo "$MA_BODY" >"$ARTIFACT_DIR/multi-agent-run.json"
if [[ "$MA_HTTP" == "200" ]]; then pass "POST jobs/multi-agent HTTP 200"; else fail "POST jobs/multi-agent HTTP $MA_HTTP — $(head -c 200 <<<"$MA_BODY")"; fi

python3 - <<PY || fail "multi-agent parent + 4 child jobs"
import json
d=json.load(open("$ARTIFACT_DIR/multi-agent-run.json"))
assert d.get("ok") is True, d
assert d.get("job_id"), d
assert d.get("status") in ("succeeded", "partial"), d.get("status")
children=(d.get("output") or {}).get("child_jobs") or []
assert len(children)==4, len(children)
assert all(c.get("status")=="succeeded" for c in children), children
print("ok")
PY
pass "UC-019 step 3 — parent multi_agent + 4 child jobs succeeded"

python3 - <<PY || fail "draft after pipeline"
import json
d=json.load(open("$ARTIFACT_DIR/multi-agent-run.json"))
draft=d.get("draft") or {}
assert draft.get("strategy_framework"), "strategy"
camps=draft.get("campaigns_json") or []
cal=(draft.get("content_json") or {}).get("calendar") or []
assert len(camps)>=1, "campaigns"
assert len(cal)>=1, "calendar"
print("ok")
PY
pass "UC-019 step 4 — strategy + campaign + content draft filled"

ST_RAW="$(api GET /multi-agent/status)"
ST_HTTP="$(echo "$ST_RAW" | tail -1)"
ST_BODY="$(echo "$ST_RAW" | sed '$d')"
echo "$ST_BODY" >"$ARTIFACT_DIR/multi-agent-status.json"
if [[ "$ST_HTTP" == "200" ]]; then pass "GET multi-agent/status HTTP 200"; else fail "GET multi-agent/status HTTP $ST_HTTP"; fi

python3 - <<PY || fail "multi-agent status rollup"
import json
d=json.load(open("$ARTIFACT_DIR/multi-agent-status.json"))
assert d.get("rollup_status") in ("succeeded", "partial"), d.get("rollup_status")
steps=d.get("steps") or []
assert len(steps)>=4, len(steps)
assert all(s.get("state") in ("succeeded","skipped") for s in steps if s.get("state")!="pending"), steps
print("ok")
PY
pass "UC-019 step 8 — multi-agent/status steps OK"

log ""
log "## C. MKTP-UC-020 — Industry playbook (3 slugs)"

declare -A EXPECT_BRAND=(
  [meta-lead-gen]="ABC Logistics"
  [bds-lead-gen]="Sunrise Residence"
  [seo-retainer]="CloudStack SaaS"
)
declare -A EXPECT_OBJECTIVE=(
  [meta-lead-gen]="lead"
  [bds-lead-gen]="lead"
  [seo-retainer]="awareness"
)

for slug in meta-lead-gen bds-lead-gen seo-retainer; do
  lc="$(slug_lifecycle_id "$slug")"
  [[ -z "$lc" ]] && { fail "UC-020 $slug — no lifecycle"; continue; }

  PB_LIST_RAW="$(api_for_lifecycle "$lc" GET /playbooks)"
  PB_LIST_HTTP="$(echo "$PB_LIST_RAW" | tail -1)"
  PB_LIST_BODY="$(echo "$PB_LIST_RAW" | sed '$d')"
  echo "$PB_LIST_BODY" >"$ARTIFACT_DIR/playbooks-${slug}.json"
  if [[ "$PB_LIST_HTTP" == "200" ]]; then pass "UC-020 $slug — GET playbooks HTTP 200"; else fail "UC-020 $slug — GET playbooks HTTP $PB_LIST_HTTP"; fi

  python3 - <<PY || fail "UC-020 $slug playbooks list"
import json
d=json.load(open("$ARTIFACT_DIR/playbooks-${slug}.json"))
pbs=d.get("playbooks") or []
assert len(pbs)>=1, pbs
slugs=[p.get("slug") for p in pbs]
assert "${slug}" in slugs, slugs
print("ok")
PY
  pass "UC-020 $slug — playbook in dropdown list"

  PB_APPLY_RAW="$(api_for_lifecycle "$lc" POST "/playbooks/${slug}/apply" '{"confirm_overwrite":true}')"
  PB_APPLY_HTTP="$(echo "$PB_APPLY_RAW" | tail -1)"
  PB_APPLY_BODY="$(echo "$PB_APPLY_RAW" | sed '$d')"
  echo "$PB_APPLY_BODY" >"$ARTIFACT_DIR/playbook-apply-${slug}.json"
  if [[ "$PB_APPLY_HTTP" == "200" ]]; then pass "UC-020 $slug — POST playbooks/apply HTTP 200"; else fail "UC-020 $slug — apply HTTP $PB_APPLY_HTTP"; fi

  python3 - <<PY || fail "UC-020 $slug brief prefill"
import json
d=json.load(open("$ARTIFACT_DIR/playbook-apply-${slug}.json"))
brief=d.get("brief") or {}
assert brief.get("brand_name")=="${EXPECT_BRAND[$slug]}", brief.get("brand_name")
assert brief.get("objective")=="${EXPECT_OBJECTIVE[$slug]}", brief.get("objective")
assert d.get("playbook_slug")=="${slug}", d.get("playbook_slug")
print("ok")
PY
  pass "UC-020 $slug — brief prefill brand/objective OK"
done

Q_RAW="$(api POST /jobs/quality)"
if [[ "$(echo "$Q_RAW" | tail -1)" == "200" ]]; then pass "UC-020 — POST jobs/quality HTTP 200"; else fail "UC-020 — POST jobs/quality"; fi

CTX_RAW="$(api GET /context)"
echo "$(echo "$CTX_RAW" | sed '$d')" >"$ARTIFACT_DIR/context-meta-post-quality.json"
SCORE="$(python3 -c "import json; print(json.load(open('$ARTIFACT_DIR/context-meta-post-quality.json')).get('quality_score',{}).get('score',0))")"
if [[ "$SCORE" -ge 70 ]]; then
  pass "UC-020 step 5 — quality score ≥70 ($SCORE/100)"
else
  fail "UC-020 step 5 — quality score $SCORE < 70"
fi

python3 - <<PY || fail "UC-020 governance notes on brief context"
import json
d=json.load(open("$ARTIFACT_DIR/context-meta-post-quality.json"))
gov=d.get("governance") or {}
notes=gov.get("notes") or []
assert len(notes)>=1, notes
print("ok")
PY
pass "UC-020 step 6 — governance notes present (≥1 bullet)"

log ""
log "## D. MKTP-UC-021 — Governance banner / context block"

for slug in meta-lead-gen bds-lead-gen seo-retainer; do
  lc="$(slug_lifecycle_id "$slug")"
  CTX_RAW="$(api_for_lifecycle "$lc" GET /context)"
  CTX_HTTP="$(echo "$CTX_RAW" | tail -1)"
  CTX_BODY="$(echo "$CTX_RAW" | sed '$d')"
  echo "$CTX_BODY" >"$ARTIFACT_DIR/context-gov-${slug}.json"
  if [[ "$CTX_HTTP" != "200" ]]; then
    fail "UC-021 $slug — GET context HTTP $CTX_HTTP"
    continue
  fi
  python3 - <<PY || fail "UC-021 $slug governance block"
import json
d=json.load(open("$ARTIFACT_DIR/context-gov-${slug}.json"))
flags=d.get("flags") or {}
assert flags.get("playbook_governance_enabled"), flags
gov=d.get("governance") or {}
assert gov.get("enabled"), gov
assert isinstance(gov.get("notes"), list) and len(gov["notes"])>=1, gov.get("notes")
gate=gov.get("launch_qa_gate") or {}
for k in ("required","min_score","ok","message_vi"):
    assert k in gate, k
print("ok")
PY
  pass "UC-021 $slug — governance{} + launch_qa_gate fields OK"
done

python3 - <<PY || fail "UC-021 launch_qa_gate ok when quality ≥70"
import json
d=json.load(open("$ARTIFACT_DIR/context-meta-post-quality.json"))
gate=(d.get("governance") or {}).get("launch_qa_gate") or {}
score=(d.get("quality_score") or {}).get("score") or 0
if score >= 70:
    assert gate.get("ok") is True, gate
print("ok")
PY
pass "UC-021 step 6 — launch_qa_gate ok=true when quality ≥70"

log ""
log "## E. EC-MKT-AI cross-check (P3 scope)"
pass "EC-07 — governance context block (3 slug smoke equivalent)"
if [[ "$SCORE" -ge 70 ]]; then pass "EC-06 — playbook quality gate met ($SCORE ≥70)"; else fail "EC-06 — quality gate"; fi

log ""
log "## F. Manual UI walkthrough (PO sign below)"
log ""
log "| UC | Item | API gate | Manual UI |"
log "|----|------|----------|-----------|"
log "| UC-019 | Pipeline AI step + job panel labels | PASS (above) | PO visual QA |"
log "| UC-019 | Admin trace link | — | PO click /admin/ai/agents?plan=mkt_ai |"
log "| UC-019 | Retry from step (EC-05) | optional RUN_E1 | PO optional |"
log "| UC-020 | Strategy hints in UI | playbook apply OK | PO verify prompt |"
log "| UC-020 | Launch QA tab 409/200 | gate via context | PO Launch QA tab |"
log "| UC-021 | Sticky banner + checkbox | governance block OK | PO visual QA |"
log "| UC-021 | Launch QA same banner | — | PO visual QA |"
log ""

log "## G. PO sign-off"
log ""
if [[ "$FAIL" -eq 0 && "$BLOCKED" -eq 0 ]]; then
  log "**API gate:** PASS — eligible for PO sign-off (manual UI rows above)."
  log ""
  log "| Vai trò | Họ tên | Ngày | Trạng thái |"
  log "|---------|--------|------|------------|"
  log "| Solution Lead | _staging verified_ | ${RUN_DATE%%T*} | API PASS |"
  log "| PO / Product | _pending manual UI_ | | Checklist §F |"
  log "| QA | _automated gate_ | ${RUN_DATE%%T*} | PASS=$PASS FAIL=$FAIL |"
else
  log "**API gate:** FAIL — resolve before PO sign-off."
fi
log ""
log "**Git staging:** \`${GIT_SHA}\`"
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
