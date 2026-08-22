#!/usr/bin/env bash
# Workshop Buổi 1 — seed / reset 1 lead sandbox trên staging (rs.pttads.vn).
#
# Lead cố định: #900000910 · B2B prospect · dịch vụ pilot meta-lead-gen
#
#   source .env   # DATABASE_URL + PTT_CRM_INTERNAL_KEY
#   ./scripts/seed_workshop_buoi1_sandbox_lead.sh              # reset — B2 xong, chưa pre-sales (demo live)
#   ./scripts/seed_workshop_buoi1_sandbox_lead.sh --consult    # sẵn tab Tư vấn, R5 trống (thực hành ngay)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

WORKSHOP_LEAD_ID="${WORKSHOP_LEAD_ID:-900000910}"
SERVICE_SLUG="${WORKSHOP_SERVICE_SLUG:-meta-lead-gen}"
BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
MODE="reset"
for arg in "$@"; do
  case "$arg" in
    --consult) MODE="consult" ;;
    --reset) MODE="reset" ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

: "${DATABASE_URL:?DATABASE_URL required}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

HDR=(-H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" -H "Content-Type: application/json")

fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== Workshop Buổi 1 sandbox lead #${WORKSHOP_LEAD_ID} mode=${MODE} BASE=${BASE} =="

curl -sf "$BASE/health" >/dev/null && ok "Nest /health" || { bad "Nest down on $BASE"; exit 1; }

echo "-- PG: upsert lead + cleanup presales/intake --"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v lead_id="$WORKSHOP_LEAD_ID" -v slug="$SERVICE_SLUG" <<'SQL'
INSERT INTO crm_leads (
  sqlite_lead_id, full_name, phone, email, status, source, owner_id,
  is_duplicate, meta_json, channel, received_at, created_at, updated_at,
  write_source, sync_version, care_stage_current, care_stages_done_json
) VALUES (
  :lead_id,
  '[WORKSHOP B1] ABC Logistics B2B',
  '0909100910',
  'workshop-b1-sandbox@pttads.vn',
  'qualified',
  'workshop',
  NULL,
  FALSE,
  jsonb_build_object(
    'lead_flow_kind', 'b2b_prospect',
    'workshop_tag', 'buoi1_presales_r5',
    'workshop_cohort', '2026-08',
    'company_name', 'ABC Logistics Việt Nam',
    'industry', 'Logistics B2B',
    'nest_write', true,
    'staging_only', true
  ),
  'workshop',
  NOW(), NOW(), NOW(),
  'workshop_seed', 1,
  'first_contact',
  '{}'::jsonb
)
ON CONFLICT (sqlite_lead_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  meta_json = crm_leads.meta_json || EXCLUDED.meta_json,
  care_stage_current = 'first_contact',
  care_stages_done_json = '{}'::jsonb,
  updated_at = NOW(),
  write_source = 'workshop_seed';

DELETE FROM crm_lead_intake_sessions WHERE lead_id = :lead_id;
DELETE FROM crm_lead_presales WHERE lead_id = :lead_id;
SQL
ok "lead #${WORKSHOP_LEAD_ID} upserted + presales/intake cleared"

echo "-- API: B2 care pipeline (Liên hệ OK + hoàn thành B2) --"
report_code="$(curl -s -o /tmp/ws-b1-report.json -w '%{http_code}' \
  -X POST "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/care-pipeline/report" \
  "${HDR[@]}" \
  -d '{"stage":"first_contact","content":"Workshop B1 — AM gọi xác nhận nhu cầu Meta Lead Gen B2B logistics","care_status":"da_lien_he_thanh_cong","care_contact_type":"goi_dien"}')"
[[ "$report_code" =~ ^2 ]] && ok "POST care report (HTTP $report_code)" || bad "POST care report (HTTP $report_code)"

complete_code="$(curl -s -o /tmp/ws-b1-complete.json -w '%{http_code}' \
  -X POST "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/care-pipeline/complete" \
  "${HDR[@]}" \
  -d '{"stage":"first_contact","note":"Workshop B1 — B2 hoàn tất, sẵn sàng demo Pre-sales"}')"
[[ "$complete_code" =~ ^2 ]] && ok "POST care complete (HTTP $complete_code)" || bad "POST care complete (HTTP $complete_code)"

if [[ "$MODE" == "consult" ]]; then
  echo "-- API: start pre-sales + intake GO + advance Consult --"
  presales_code="$(curl -s -o /tmp/ws-b1-presales.json -w '%{http_code}' \
    -X POST "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/presales" \
    "${HDR[@]}" \
    -d "{\"service_slug\":\"${SERVICE_SLUG}\"}")"
  [[ "$presales_code" =~ ^2 ]] && ok "POST presales (HTTP $presales_code)" || bad "POST presales (HTTP $presales_code)"

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v lead_id="$WORKSHOP_LEAD_ID" -v slug="$SERVICE_SLUG" <<'SQL'
INSERT INTO crm_lead_intake_sessions (
  lead_id, service_slug, mode, status, contact_name, company_name, source,
  bant_json, bant_total, lead_temperature, decision, decision_reason,
  answers_json, started_at, completed_at, created_at, updated_at
) VALUES (
  :lead_id, :'slug', 'phone', 'completed',
  'Chị Lan — Marketing Manager', 'ABC Logistics Việt Nam', 'workshop',
  '{"budget":5,"authority":5,"need":5,"timeline":5,"fit":3,"history":3}'::jsonb,
  26, 'warm', 'go', 'Workshop seed — BANT Go 26/30',
  '{"crm_fields":{"need":"<p>Cần giảm CPL lead B2B logistics, ICP rõ ràng</p>"}}'::jsonb,
  NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW(), NOW()
);

UPDATE crm_lead_presales_tasks t
SET is_done = TRUE, done_at = NOW(), updated_at = NOW(),
    notes = COALESCE(NULLIF(TRIM(notes), ''), '') || E'\n[Workshop seed] Lead tasks auto-complete'
FROM crm_lead_presales p
WHERE t.presales_id = p.id AND p.lead_id = :lead_id AND t.stage = 'lead' AND t.is_done = FALSE;
SQL
  ok "intake GO + lead tasks marked done"

  advance_code="$(curl -s -o /tmp/ws-b1-advance.json -w '%{http_code}' \
    -X POST "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/presales/advance" \
    "${HDR[@]}" \
    -d '{"confirm":true}')"
  [[ "$advance_code" =~ ^2 ]] && ok "POST presales/advance → consult (HTTP $advance_code)" || bad "POST advance (HTTP $advance_code)"
fi

funnel_code="$(curl -s -o /tmp/ws-b1-funnel.json -w '%{http_code}' \
  "$BASE/api/v1/leads/${WORKSHOP_LEAD_ID}/funnel" "${HDR[@]}")"
[[ "$funnel_code" =~ ^2 ]] && ok "GET funnel (HTTP $funnel_code)" || bad "GET funnel (HTTP $funnel_code)"

python3 - <<PY
import json, sys

lead_id = ${WORKSHOP_LEAD_ID}
mode = "${MODE}"
funnel = json.load(open("/tmp/ws-b1-funnel.json"))
gate = funnel.get("presales_care_gate") or {}
ps = funnel.get("presales")
print(f"  care_gate.complete={gate.get('complete')}")
print(f"  presales.stage={(ps or {}).get('stage')}")
print(f"  service_slug={(ps or {}).get('service_slug')}")

if not gate.get("complete"):
    print("FAIL presales_care_gate not complete")
    sys.exit(1)
if mode == "reset" and ps:
    print("FAIL reset mode should not have presales yet")
    sys.exit(1)
if mode == "consult":
    if (ps or {}).get("stage") != "consult":
        print(f"FAIL expected consult stage, got {(ps or {}).get('stage')}")
        sys.exit(1)
if mode == "reset" and not ps:
    print("OK  reset: B2 done, presales chưa bắt đầu — sẵn demo live")
print(json.dumps({
    "workshop_buoi1_sandbox": True,
    "lead_id": lead_id,
    "mode": mode,
    "url": f"https://rs.pttads.vn/crm/leads/{lead_id}",
    "r5_anchor": f"https://rs.pttads.vn/crm/leads/{lead_id}#funnel-presales-r5",
}, ensure_ascii=False))
PY

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Workshop Buổi 1 sandbox seed PASSED"
  echo "  Lead URL: https://rs.pttads.vn/crm/leads/${WORKSHOP_LEAD_ID}"
  exit 0
fi
echo "Workshop Buổi 1 sandbox seed FAILED"
exit 1
