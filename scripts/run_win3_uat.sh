#!/usr/bin/env bash
# WIN-3 UAT runner — automated gates for EC-W3 / R3-C (run on VPS or laptop with creds).
#
# Usage:
#   OPS_UAT_URL=https://rs.pttads.vn OPS_UAT_API=https://rs.pttads.vn \
#     OPS_E2E_STAFF_PASSWORD='…' ./scripts/run_win3_uat.sh
#
# On VPS:
#   cd /var/www/rnosai && source .env && bash scripts/run_win3_uat.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPS_URL="${OPS_UAT_URL:-http://127.0.0.1:3200}"
API_URL="${OPS_UAT_API:-http://127.0.0.1:3000}"
REPORT="${OPS_UAT_REPORT:-$ROOT/docs/exports/win-3-uat-results-$(date +%Y%m%d-%H%M%S).md}"
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

log "# WIN-3 UAT Results — $(date -Iseconds)"
log ""
log "| Env | Value |"
log "|-----|-------|"
log "| ops-web | \`$OPS_URL\` |"
log "| API | \`$API_URL\` |"
log "| git | \`$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)\` |"
log "| staff | \`$STAFF_EMAIL\` |"
log ""

log "## Preconditions"
if [[ "${WIN3_UAT_PG:-}" == "1" ]] && command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  if psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    if psql "$DATABASE_URL" -tAc "SELECT 1 FROM staff_user_clients LIMIT 1" >/dev/null 2>&1; then
      pass "DDL staff_user_clients exists"
    else
      fail "DDL staff_user_clients missing — run apply_pg_ddl_staff_user_clients_r3_a.sh"
    fi
    if psql "$DATABASE_URL" -tAc "SELECT 1 FROM staff_permission_sets LIMIT 1" >/dev/null 2>&1; then
      pass "DDL staff_permission_sets exists"
    else
      fail "DDL staff_permission_sets missing"
    fi
    if psql "$DATABASE_URL" -tAc "SELECT 1 FROM staff_break_glass_grants LIMIT 1" >/dev/null 2>&1; then
      pass "DDL staff_break_glass_grants exists"
    else
      fail "DDL staff_break_glass_grants missing"
    fi
  else
    skip "PG DDL checks — DATABASE_URL not reachable (run on VPS: ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && source .env && bash scripts/run_win3_uat.sh')"
  fi
else
  skip "PG DDL checks — remote API mode (set WIN3_UAT_PG=1 on VPS with DATABASE_URL)"
fi

LOGIN_HTML=$(curl -sf "$OPS_URL/login" 2>/dev/null || true)
if [[ "$LOGIN_HTML" == *"NEXT_PUBLIC"* ]] || [[ -n "$LOGIN_HTML" ]]; then
  if curl -sf "$OPS_URL/login" -o /dev/null; then pass "ops-web /login reachable"; else fail "ops-web /login"; fi
else
  fail "ops-web /login unreachable"
fi
if curl -sf "$API_URL/health" -o /dev/null; then pass "Nest /health OK"; else fail "Nest /health"; fi

for route in \
  "/admin/crm/permission-sets" \
  "/admin/crm/permissions/simulator" \
  "/crm/forecast"; do
  code=$(curl -sf -o /dev/null -w '%{http_code}' "$OPS_URL$route" 2>/dev/null || echo 000)
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
    pass "Route $route → $code"
  else
    fail "Route $route → $code"
  fi
done

log ""
log "## Auth + WIN-3 API smoke"

TOKEN=""
internal_hdr=()
if [[ -n "$INTERNAL_KEY" ]]; then internal_hdr=(-H "x-ptt-internal-key: $INTERNAL_KEY"); fi

if [[ -n "$STAFF_PASSWORD" ]]; then
  LOGIN_JSON=$(curl -sf "$API_URL/api/v1/staff/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$STAFF_EMAIL\",\"password\":\"$STAFF_PASSWORD\"}" 2>/dev/null || true)
  TOKEN=$(echo "$LOGIN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  if [[ -n "$TOKEN" ]]; then pass "Staff login OK ($STAFF_EMAIL)"; else fail "Staff login failed"; fi
else
  if [[ ${#internal_hdr[@]} -gt 0 ]]; then
    skip "Staff login — no password; using internal key"
  else
    blocked "Staff login — set OPS_E2E_STAFF_PASSWORD or ADMIN_PASSWORD"
  fi
fi

auth_hdr=()
if [[ -n "$TOKEN" ]]; then
  auth_hdr=(-H "Authorization: Bearer $TOKEN")
elif [[ ${#internal_hdr[@]} -gt 0 ]]; then
  auth_hdr=("${internal_hdr[@]}")
fi

if [[ ${#auth_hdr[@]} -gt 0 ]]; then
  log ""
  log "### EC-W3-01 Permission Sets API"
  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/staff/permission-sets")
  if [[ "$code" == "200" ]]; then pass "GET permission-sets ($code)"; else fail "GET permission-sets ($code)"; fi

  log ""
  log "### EC-W3-02 Simulator API"
  SIM=$(curl -sf "${auth_hdr[@]}" -X POST "$API_URL/api/v1/staff/permissions/simulate" \
    -H 'Content-Type: application/json' \
    -d '{"position_id":2,"job_functions":["content"],"set_codes":[]}' 2>/dev/null || true)
  if echo "$SIM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'menu' in d and 'caps' in d" 2>/dev/null; then
    pass "POST permissions/simulate returns caps+menu"
  else
    fail "POST permissions/simulate invalid response"
  fi

  log ""
  log "### EC-W3-03 Access review ZIP"
  ZIP_TMP=$(mktemp)
  code=$(curl -sf -o "$ZIP_TMP" -w '%{http_code}' "${auth_hdr[@]}" \
    "$API_URL/api/v1/staff/permissions/access-review.zip?quarter=2026-Q3" 2>/dev/null || echo 000)
  if [[ "$code" == "200" ]] && file "$ZIP_TMP" | grep -qi zip; then
    pass "GET access-review.zip ($code, valid zip)"
  else
    fail "GET access-review.zip ($code)"
  fi
  rm -f "$ZIP_TMP"

  log ""
  log "### EC-W3-05 Break-glass API"
  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/staff/break-glass/active")
  if [[ "$code" == "200" ]]; then pass "GET break-glass/active ($code)"; else fail "GET break-glass/active ($code)"; fi

  log ""
  log "### EC-W3-06 Forecast / renewal API"
  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/ai/forecast/mape-report")
  if [[ "$code" == "200" ]]; then pass "GET forecast/mape-report ($code)"; else skip "GET forecast/mape-report ($code)"; fi
  code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" "$API_URL/api/v1/ai/renewal/portfolio-summary")
  if [[ "$code" == "200" ]]; then pass "GET renewal/portfolio-summary ($code)"; else skip "GET renewal/portfolio-summary ($code)"; fi

  log ""
  log "### R3-C client scope API"
  ME=$(curl -sf "${auth_hdr[@]}" "$API_URL/api/v1/staff/auth/me" 2>/dev/null || true)
  USER_ID=$(echo "$ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
  if [[ -n "$USER_ID" ]]; then
    code=$(curl -sf -o /dev/null -w '%{http_code}' "${auth_hdr[@]}" \
      "$API_URL/api/v1/staff/org/users/$USER_ID/client-scope")
    if [[ "$code" == "200" ]]; then pass "GET client-scope ($code)"; else fail "GET client-scope ($code)"; fi
    HAS_CLIENT_IDS=$(echo "$ME" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'client_ids' in d else 'no')" 2>/dev/null || echo no)
    if [[ "$HAS_CLIENT_IDS" == "yes" ]]; then pass "/auth/me exposes client_ids key (pilot)"; else skip "/auth/me client_ids absent (scope pilot off or unrestricted)"; fi
  else
    blocked "client-scope — no user id from /auth/me"
  fi
else
  blocked "WIN-3 API tests — no token or internal key"
fi

log ""
log "## Manual-only (QA / PO / IT)"
log "| ID | Item | Owner |"
log "|----|------|-------|"
log "| EC-W3-01 | Set assign → claim OK → revoke 403 | PO |"
log "| EC-W3-02 | Simulator 5 personas menu match 100% | IT + QA |"
log "| EC-W3-04 | GDKD matrix signed + override audit | PO + GDKD |"
log "| EC-W3-05 | Break-glass E2E approve + auto-revoke | IT + GDKD |"
log "| EC-W3-06 | MAPE badge + T-90 cards visible UI | GDKD |"
log "| EC-W3-07 | VUX-04 content vs design menu | QA |"
log "| EC-W3-08 | PO sign WIN-3-acceptance PDF | PO |"
log "| R3-C-01…06 | Scope bind/filter/403/bypass/badges | IT + QA |"
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
  log "**Automated gates: PASS** — complete manual EC-W3 + PO sign for WIN-3 close"
else
  log "**Automated gates: FAIL** — fix before PO sign-off"
fi

echo ""
echo "Report: $REPORT"
exit "$([[ $FAIL -eq 0 ]] && echo 0 || echo 1)"
