#!/usr/bin/env bash
# Seed MKT-AI UAT lifecycle(s) + official marketing_plan + brief (psql — no psycopg2).
#
# Usage:
#   export DATABASE_URL=postgresql://...
#   ./scripts/seed_mkt_ai_uat_lifecycle.sh
#
# Env:
#   MKT_AI_SEED_SLUGS   comma list (default: meta-lead-gen,bds-lead-gen,seo-retainer)
#   MKT_AI_SEED_SLUG    single slug override (legacy — seeds one slug only)
#   MKT_AI_SEED_STAGE   default onboard
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

MKT_AI_SEED_STAGE="${MKT_AI_SEED_STAGE:-onboard}"

if [[ -n "${MKT_AI_SEED_SLUG:-}" ]]; then
  MKT_AI_SEED_SLUGS="$MKT_AI_SEED_SLUG"
else
  MKT_AI_SEED_SLUGS="${MKT_AI_SEED_SLUGS:-meta-lead-gen,bds-lead-gen,seo-retainer}"
fi

slug_tag() {
  case "$1" in
    meta-lead-gen) echo 'mkt-ai-smoke-seed' ;;
    bds-lead-gen) echo 'mkt-ai-seed-bds' ;;
    seo-retainer) echo 'mkt-ai-seed-seo' ;;
    *) echo "mkt-ai-seed-${1//-/_}" ;;
  esac
}

slug_lead_id() {
  case "$1" in
    meta-lead-gen) echo '900000901' ;;
    bds-lead-gen) echo '900000902' ;;
    seo-retainer) echo '900000903' ;;
    *) echo "9000009$(printf '%02d' $((RANDOM % 90 + 10)))" ;;
  esac
}

slug_brief_json() {
  local slug="$1"
  case "$slug" in
    meta-lead-gen)
      cat <<'JSON'
{
  "brand_name": "ABC Logistics",
  "industry": "Logistics B2B",
  "service_slug": "meta-lead-gen",
  "objective": "lead",
  "budget_monthly_vnd": 80000000,
  "geo_markets": ["HCM", "HN"],
  "challenges": "CPL cao, thiếu ICP rõ ràng",
  "competitors": ["Competitor A"],
  "usp": "Giảm CPL 25% trong 90 ngày"
}
JSON
      ;;
    bds-lead-gen)
      cat <<'JSON'
{
  "brand_name": "Sunrise Residence",
  "industry": "Bất động sản",
  "service_slug": "bds-lead-gen",
  "objective": "lead",
  "budget_monthly_vnd": 120000000,
  "geo_markets": ["Hà Nội", "Bình Dương", "Đà Nẵng"],
  "challenges": "Lead rác cao, chi phí lead dự án mới tăng, khách chậm quyết định",
  "competitors": ["Đại lý địa phương A"],
  "usp": "Agency chuyên BĐS — creative dự án + telesales SLA + CRM scoring"
}
JSON
      ;;
    seo-retainer)
      cat <<'JSON'
{
  "brand_name": "CloudStack SaaS",
  "industry": "Dịch vụ / SaaS",
  "service_slug": "seo-retainer",
  "objective": "awareness",
  "budget_monthly_vnd": 45000000,
  "geo_markets": ["Việt Nam"],
  "challenges": "Organic traffic thấp, keyword cạnh tranh cao, thiếu content pillar",
  "competitors": ["Agency SEO B"],
  "usp": "Retainer SEO 6 tháng — technical audit + content pillar + link building minh bạch"
}
JSON
      ;;
    *)
      echo "{\"service_slug\":\"${slug}\",\"objective\":\"lead\",\"industry\":\"UAT seed\"}"
      ;;
  esac
}

seed_one_slug() {
  local slug="$1"
  local tag lead_id brief_json sync_lifecycle_1
  tag="$(slug_tag "$slug")"
  lead_id="$(slug_lead_id "$slug")"
  brief_json="$(slug_brief_json "$slug")"
  brief_sql="${brief_json//\'/\'\'}"
  sync_lifecycle_1=0
  [[ "$slug" == "meta-lead-gen" ]] && sync_lifecycle_1=1

  echo "== Seed slug=${slug} tag=${tag} lead=${lead_id} =="

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO crm_leads (sqlite_lead_id, full_name, phone, email, status, source)
VALUES (${lead_id}, 'MKT-AI UAT Lead (${slug})', '', 'mkt-ai-uat-${slug}@pttads.vn', 'qualified', 'uat')
ON CONFLICT (sqlite_lead_id) DO NOTHING;

DO \$\$
DECLARE
  v_lifecycle_id bigint;
  v_plan_id bigint;
  v_lead_id bigint;
  v_target bigint;
  v_brief jsonb := '${brief_sql}'::jsonb;
  v_slug text := '${slug}';
  v_tag text := '${tag}';
  v_stage text := '${MKT_AI_SEED_STAGE}';
  v_seed_lead bigint := ${lead_id};
  v_sync_1 int := ${sync_lifecycle_1};
BEGIN
  SELECT id INTO v_lifecycle_id
  FROM crm_service_lifecycle
  WHERE service_slug = v_slug AND notes = v_tag
  ORDER BY id DESC
  LIMIT 1;

  IF v_lifecycle_id IS NULL THEN
    INSERT INTO crm_service_lifecycle (service_slug, stage, status, notes, lead_id)
    VALUES (v_slug, v_stage, 'active', v_tag, v_seed_lead)
    RETURNING id INTO v_lifecycle_id;
    RAISE NOTICE 'INSERT lifecycle_id=% slug=%', v_lifecycle_id, v_slug;
  ELSE
    UPDATE crm_service_lifecycle
    SET lead_id = COALESCE(lead_id, v_seed_lead),
        service_slug = v_slug
    WHERE id = v_lifecycle_id;
    RAISE NOTICE 'REUSE lifecycle_id=% slug=%', v_lifecycle_id, v_slug;
  END IF;

  SELECT COALESCE(
    (SELECT lead_id FROM crm_service_lifecycle WHERE id = v_lifecycle_id),
    (SELECT sqlite_lead_id FROM crm_leads ORDER BY sqlite_lead_id LIMIT 1),
    v_seed_lead
  ) INTO v_lead_id;

  IF v_sync_1 = 1 THEN
    FOR v_target IN SELECT unnest(ARRAY[v_lifecycle_id, 1::bigint]) LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM crm_service_lifecycle WHERE id = v_target);

      UPDATE crm_service_lifecycle
      SET lead_id = COALESCE(lead_id, v_lead_id),
          service_slug = COALESCE(NULLIF(trim(service_slug), ''), v_slug)
      WHERE id = v_target;

      SELECT marketing_plan_id INTO v_plan_id FROM crm_service_lifecycle WHERE id = v_target;
      IF v_plan_id IS NOT NULL THEN
        RAISE NOTICE 'REUSE lifecycle % marketing_plan_id=%', v_target, v_plan_id;
        CONTINUE;
      END IF;

      INSERT INTO crm_marketing_plans (
        code, name, status, plan_kind, lead_id, lifecycle_id,
        north_star, objectives, notes,
        strategy_framework_json, target_market_prof_json, target_market_steps4_json
      )
      VALUES (
        format('LC-%s-OFFICIAL', v_target),
        format('Lifecycle #%s TMMT (chính thức)', v_target),
        'draft',
        'official',
        COALESCE((SELECT lead_id FROM crm_service_lifecycle WHERE id = v_target), v_lead_id),
        v_target,
        format('UAT TMMT %s', v_slug),
        'Seed official plan for MKT-AI UAT',
        'UAT seed official plan',
        '{"target_market":"UAT seed context"}'::jsonb,
        '{"market_context":"Seed context","segmentation_icp":"Seed ICP placeholder for UAT apply path"}'::jsonb,
        '{}'::jsonb
      )
      RETURNING id INTO v_plan_id;

      UPDATE crm_service_lifecycle SET marketing_plan_id = v_plan_id WHERE id = v_target;
      RAISE NOTICE 'INSERT lifecycle % marketing_plan_id=%', v_target, v_plan_id;
    END LOOP;
  ELSE
    UPDATE crm_service_lifecycle
    SET lead_id = COALESCE(lead_id, v_lead_id)
    WHERE id = v_lifecycle_id;

    SELECT marketing_plan_id INTO v_plan_id FROM crm_service_lifecycle WHERE id = v_lifecycle_id;
    IF v_plan_id IS NULL THEN
      INSERT INTO crm_marketing_plans (
        code, name, status, plan_kind, lead_id, lifecycle_id,
        north_star, objectives, notes,
        strategy_framework_json, target_market_prof_json, target_market_steps4_json
      )
      VALUES (
        format('LC-%s-OFFICIAL', v_lifecycle_id),
        format('Lifecycle #%s TMMT (chính thức)', v_lifecycle_id),
        'draft',
        'official',
        v_lead_id,
        v_lifecycle_id,
        format('UAT TMMT %s', v_slug),
        'Seed official plan for MKT-AI UAT',
        format('UAT seed official plan (%s)', v_slug),
        '{"target_market":"UAT seed context"}'::jsonb,
        '{"market_context":"Seed context","segmentation_icp":"Seed ICP placeholder for UAT apply path"}'::jsonb,
        '{}'::jsonb
      )
      RETURNING id INTO v_plan_id;

      UPDATE crm_service_lifecycle SET marketing_plan_id = v_plan_id WHERE id = v_lifecycle_id;
      RAISE NOTICE 'INSERT lifecycle % marketing_plan_id=%', v_lifecycle_id, v_plan_id;
    END IF;
  END IF;

  INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, created_by, updated_by)
  VALUES (v_lifecycle_id, v_brief, '[]'::jsonb, 'uat-seed', 'uat-seed')
  ON CONFLICT (lifecycle_id) DO UPDATE
    SET brief_json = EXCLUDED.brief_json,
        updated_by = 'uat-seed',
        updated_at = NOW();

  RAISE NOTICE 'UPSERT mkt_ai_briefs lifecycle_id=% slug=%', v_lifecycle_id, v_slug;
END \$\$;
SQL

  local lifecycle_id
  lifecycle_id="$(psql "$DATABASE_URL" -tAc \
    "SELECT id FROM crm_service_lifecycle WHERE notes='${tag}' AND service_slug='${slug}' ORDER BY id DESC LIMIT 1" \
    | tr -d '[:space:]')"
  echo "OK  slug=${slug} LIFECYCLE_ID=${lifecycle_id:-?} tag=${tag}"
}

echo "== Seed MKT-AI UAT lifecycles (slugs=${MKT_AI_SEED_SLUGS}) =="

IFS=',' read -r -a SLUGS <<< "$MKT_AI_SEED_SLUGS"
declare -A LIFECYCLE_MAP=()
for raw in "${SLUGS[@]}"; do
  slug="$(echo "$raw" | tr -d '[:space:]')"
  [[ -z "$slug" ]] && continue
  seed_one_slug "$slug" >/tmp/mkt-ai-seed-last.txt
  id="$(grep '^OK  slug=' /tmp/mkt-ai-seed-last.txt | sed -n 's/.*LIFECYCLE_ID=\([^ ]*\).*/\1/p')"
  LIFECYCLE_MAP["$slug"]="$id"
done

PLAN1="$(psql "$DATABASE_URL" -tAc \
  "SELECT COALESCE(marketing_plan_id::text, 'null') FROM crm_service_lifecycle WHERE id=1" \
  | tr -d '[:space:]')"

echo ""
echo "== Summary =="
for slug in "${!LIFECYCLE_MAP[@]}"; do
  echo "  ${slug} → lifecycle #${LIFECYCLE_MAP[$slug]} (tag=$(slug_tag "$slug"))"
done
echo "OK  lifecycle #1 marketing_plan_id=${PLAN1}"
echo "Tip: export LIFECYCLE_ID=${LIFECYCLE_MAP['meta-lead-gen']:-${SLUGS[0]:-1}} for meta UAT"
echo "Tip: bash scripts/smoke_mkt_ai_multi_slug.sh — verify all pilot slugs"
