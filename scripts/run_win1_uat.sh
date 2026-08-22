#!/usr/bin/env bash
# WIN-1 UAT runner — automated gates (run on VPS or with OPS_E2E_* set).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPS_URL="${OPS_UAT_URL:-http://127.0.0.1:3200}"
API_URL="${OPS_UAT_API:-http://127.0.0.1:3000}"
REPORT="${OPS_UAT_REPORT:-$ROOT/docs/exports/win-1-uat-results-$(date +%Y%m%d-%H%M%S).md}"
PASS=0
FAIL=0
SKIP=0
BLOCKED=0

mkdir -p "$(dirname "$REPORT")"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

STAFF_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
STAFF_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

log() { echo "$*" | tee -a "$REPORT"; }
pass() { PASS=$((PASS + 1)); log "- [x] **PASS** — $1"; }
fail() { FAIL=$((FAIL + 1)); log "- [ ] **FAIL** — $1"; }
skip() { SKIP=$((SKIP + 1)); log "- [ ] **SKIP** — $1"; }
blocked() { BLOCKED=$((BLOCKED + 1)); log "- [ ] **BLOCKED** — $1"; }

log "# WIN-1 UAT Results — $(date -Iseconds)"
log ""
log "| Env | Value |"
log "|-----|-------|"
log "| ops-web | \`$OPS_URL\` |"
log "| API | \`$API_URL\` |"
log "| git | \`$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)\` |"
log "| staff | \`$STAFF_EMAIL\` |"
log ""

log "## §6 Ops smoke"
if curl -sf "$OPS_URL/login" -o /dev/null; then pass "ops-web /login reachable"; else fail "ops-web /login unreachable"; fi
if curl -sf "$API_URL/health" -o /dev/null; then pass "Nest /health OK"; else fail "Nest /health fail"; fi
if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  fc=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM staff_job_functions;" 2>/dev/null || echo 0)
  gc=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM staff_job_function_grants;" 2>/dev/null || echo 0)
  if [[ "$fc" == "8" && "$gc" -ge 19 ]]; then pass "PG seed: $fc functions, $gc grants"; else fail "PG seed unexpected: functions=$fc grants=$gc"; fi
else
  skip "PG seed check (no psql/DATABASE_URL)"
fi

log ""
log "## VUX-08 PWA assets"
MANIFEST=$(curl -sf "$OPS_URL/manifest.webmanifest" 2>/dev/null || true)
if [[ -n "$MANIFEST" ]]; then
  if echo "$MANIFEST" | grep -q "PTT Revenue OS"; then pass "Manifest name PTT Revenue OS"; else fail "Manifest name mismatch"; fi
  if echo "$MANIFEST" | grep -q '"/crm/leads"'; then pass "Manifest start_url /crm/leads"; else fail "Manifest start_url"; fi
else
  fail "manifest.webmanifest not fetched"
fi
SW=$(curl -sf "$OPS_URL/sw.js" 2>/dev/null || true)
if [[ -n "$SW" && "$SW" == *"ptt-ops-pwa-v3"* ]]; then pass "Service worker ptt-ops-pwa-v3"; else fail "Service worker missing or wrong version"; fi

log ""
log "## API auth + RBAC routes"
internal_hdr=()
if [[ -n "$INTERNAL_KEY" ]]; then internal_hdr=(-H "x-ptt-internal-key: $INTERNAL_KEY"); fi

TOKEN=""
if [[ -n "$STAFF_PASSWORD" ]]; then
  LOGIN_JSON=$(curl -sf "$API_URL/api/v1/staff/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$STAFF_EMAIL\",\"password\":\"$STAFF_PASSWORD\"}" 2>/dev/null || true)
  TOKEN=$(echo "$LOGIN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  if [[ -n "$TOKEN" ]]; then pass "Staff login OK ($STAFF_EMAIL)"; else
    if [[ ${#internal_hdr[@]} -gt 0 ]]; then
      skip "Staff login failed — using internal key for API tests"
    else
      fail "Staff login failed — set OPS_E2E_STAFF_PASSWORD or PTT_CRM_INTERNAL_KEY"
    fi
  fi
else
  if [[ ${#internal_hdr[@]} -gt 0 ]]; then
    skip "Staff login — no password; using internal key for API tests"
  else
    blocked "Staff login — set OPS_E2E_STAFF_PASSWORD or ADMIN_PASSWORD in .env"
  fi
fi

auth_hdr=()
if [[ -n "$TOKEN" ]]; then
  auth_hdr=(-H "Authorization: Bearer $TOKEN")
elif [[ ${#internal_hdr[@]} -gt 0 ]]; then
  auth_hdr=("${internal_hdr[@]}")
fi

if [[ ${#auth_hdr[@]} -gt 0 ]]; then
  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/staff/permissions/job-functions")
  if [[ "$code" == "200" ]]; then pass "GET job-functions list ($code)"; else fail "GET job-functions ($code)"; fi

  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/staff/org/users")
  if [[ "$code" == "200" ]]; then pass "GET org/users ($code)"; else fail "GET org/users ($code)"; fi

  USER_ID=$(curl -sf "${auth_hdr[@]}" "$API_URL/api/v1/staff/org/users" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d[0]['id'] if isinstance(d,list) and d else d.get('users',[{}])[0].get('id','')))" 2>/dev/null || true)
  if [[ -z "$USER_ID" && -n "$TOKEN" ]]; then
    USER_ID=$(curl -sf "${auth_hdr[@]}" "$API_URL/api/v1/staff/auth/me" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  fi

  if [[ -n "$USER_ID" ]]; then
    log ""
    log "## VUX-05 SoD API (409)"
    SOD_BODY=$(curl -s -w '\n%{http_code}' "${auth_hdr[@]}" -X PUT "$API_URL/api/v1/staff/org/users/$USER_ID/job-functions" \
      -H 'Content-Type: application/json' \
      -d '{"functions":["content","compliance"]}')
    SOD_CODE=$(echo "$SOD_BODY" | tail -1)
    if [[ "$SOD_CODE" == "409" ]]; then pass "PUT content+compliance → 409 sod_violation"; else fail "SoD PUT expected 409 got $SOD_CODE"; fi

    log ""
    log "## Excel API (P0-2)"
    TEMPLATE_CT=$(curl -sf -o /tmp/win1-template.xlsx -w '%{http_code}:%{content_type}' "${auth_hdr[@]}" "$API_URL/api/v1/leads/import/template.xlsx")
    if [[ "$TEMPLATE_CT" == *"200"* && "$TEMPLATE_CT" == *"spreadsheet"* ]]; then pass "Lead template xlsx"; else fail "Lead template ($TEMPLATE_CT)"; fi
    EXPORT_CT=$(curl -sf -o /tmp/win1-export.xlsx -w '%{http_code}:%{content_type}' "${auth_hdr[@]}" "$API_URL/api/v1/leads/export.xlsx")
    if [[ "$EXPORT_CT" == *"200"* && "$EXPORT_CT" == *"spreadsheet"* ]]; then pass "Lead export xlsx"; else fail "Lead export ($EXPORT_CT)"; fi

    CSKH_CT=$(curl -sf -o /tmp/win1-cskh.xlsx -w '%{http_code}:%{content_type}' "${auth_hdr[@]}" "$API_URL/api/crm/cskh-board/export?format=xlsx" 2>/dev/null || echo fail)
    if [[ "$CSKH_CT" == *"200"* ]]; then pass "CSKH export xlsx"; else skip "CSKH export ($CSKH_CT) — may need cap/data"; fi
  else
    blocked "SoD/Excel API — no user id"
  fi
else
  blocked "Authenticated API tests — no token or internal key"
fi

log ""
log "## Admin routes (unauth redirect)"
for path in \
  "/admin/crm/permissions" \
  "/admin/crm/permissions/functions" \
  "/admin/crm/permissions/users" \
  "/crm/leads" \
  "/crm/hr" \
  "/crm/staff?tab=import"; do
  code=$(curl -sf -o /dev/null -w '%{http_code}' "$OPS_URL$path" 2>/dev/null || echo 000)
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then pass "Route $path → $code"; else fail "Route $path → $code"; fi
done

log ""
log "## Manual-only (QA/PO)"
log "- [ ] VUX-02 mobile 390px — win-leads-mobile-list, Gọi/Chi tiết, filter chips"
log "- [ ] VUX-04 P1 content vs P2 design menu — cần 2 NV + gán function + re-login"
log "- [ ] VUX-05 UI SoD — Lưu disabled trên permissions/functions & users"
log "- [ ] Import wizard UI — leads + roster"
log "- [ ] PO sign-off — \`docs/specs/win-1-acceptance-checklist.md\`"
log ""
log "## Summary"
log "| Result | Count |"
log "|--------|-------|"
log "| PASS | $PASS |"
log "| FAIL | $FAIL |"
log "| SKIP | $SKIP |"
log "| BLOCKED | $BLOCKED |"
log ""
if [[ "$FAIL" -eq 0 ]]; then
  log "**Automated gates: PASS** (manual items remain for PO)"
else
  log "**Automated gates: FAIL** — fix before sign-off"
fi

echo ""
echo "Report: $REPORT"
exit "$([[ $FAIL -eq 0 ]] && echo 0 || echo 1)"
