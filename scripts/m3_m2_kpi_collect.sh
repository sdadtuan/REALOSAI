#!/usr/bin/env bash
# RNOS-M3 Phase 0 — Collect M2 KPI snapshot for Product report
#   DATABASE_URL=postgresql://... bash scripts/m3_m2_kpi_collect.sh
# Output: .local-dev/m3-m2-kpi-snapshot.json + .local-dev/m3-m2-kpi-snapshot.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DAYS="${KPI_DAYS:-30}"
OUT_JSON="${OUT_JSON:-$ROOT/.local-dev/m3-m2-kpi-snapshot.json}"
OUT_MD="${OUT_MD:-$ROOT/.local-dev/m3-m2-kpi-snapshot.md}"
DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5432/ptt_agency}"

mkdir -p "$(dirname "$OUT_JSON")"

if ! command -v psql >/dev/null 2>&1; then
  echo "FAIL  psql not found" >&2
  exit 1
fi

echo "== M2 KPI collect (last ${DAYS} days) =="
echo "    DATABASE_URL=$DATABASE_URL"

run_query() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -F '|' -c "$1" 2>/dev/null || echo ""
}

# Push platform breakdown
push_rows="$(run_query "
SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)::text
FROM (
  SELECT
    CASE
      WHEN user_agent ILIKE '%iphone%' OR user_agent ILIKE '%ipad%' OR user_agent ILIKE '%ios%' THEN 'ios'
      WHEN user_agent ILIKE '%android%' THEN 'android'
      ELSE 'other'
    END AS platform,
    count(*)::int AS subscriptions,
    count(DISTINCT portal_user_id)::int AS users
  FROM portal_push_subscriptions
  WHERE created_at >= NOW() - (${DAYS} || ' days')::interval
  GROUP BY 1
) t;
")"

push_total="$(run_query "
SELECT coalesce(json_build_object(
  'total_subscriptions', count(*)::int,
  'distinct_users', count(DISTINCT portal_user_id)::int
)::text, '{}')
FROM portal_push_subscriptions;
")"

approve_stats="$(run_query "
SELECT coalesce(json_build_object(
  'approved_count', count(*)::int,
  'median_hours', round(percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600.0
  )::numeric, 2),
  'avg_hours', round(avg(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600.0)::numeric, 2)
)::text, '{}')
FROM creative_submissions
WHERE status IN ('approved', 'rejected')
  AND reviewed_at IS NOT NULL
  AND submitted_at >= NOW() - (${DAYS} || ' days')::interval;
")"

pending_stats="$(run_query "
SELECT coalesce(json_build_object(
  'pending_count', count(*)::int,
  'avg_pending_hours', round(avg(EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 3600.0)::numeric, 2)
)::text, '{}')
FROM creative_submissions
WHERE status = 'pending_client';
")"

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

python3 - <<PY
import json, os
from pathlib import Path

def parse_json(s):
    s = (s or "").strip()
    if not s:
        return []
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return s

snapshot = {
    "generated_at": "$generated_at",
    "window_days": int("$DAYS"),
    "source": "scripts/m3_m2_kpi_collect.sh",
    "push_by_platform": parse_json("""$push_rows"""),
    "push_totals": parse_json("""$push_total"""),
    "creative_approve_time": parse_json("""$approve_stats"""),
    "creative_pending": parse_json("""$pending_stats"""),
    "pwa_install_rate": {
        "note": "Manual / analytics — fill in Product report",
        "approvers_invited": None,
        "approvers_installed_pwa": None,
        "install_rate_pct": None,
    },
    "ios_push_delivery_pct": {
        "note": "Requires push send logs or pilot survey — fill manually",
        "value": None,
    },
    "android_push_delivery_pct": {
        "note": "Requires push send logs or pilot survey — fill manually",
        "value": None,
    },
}
Path("$OUT_JSON").write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\\n")

md = f"""# M2 KPI Snapshot (auto-collected)

**Generated:** {snapshot['generated_at']} · **Window:** {snapshot['window_days']} days

## Push subscriptions (Web Push M2)

| Platform | Subscriptions | Users |
|----------|---------------|-------|
"""
for row in snapshot["push_by_platform"] if isinstance(snapshot["push_by_platform"], list) else []:
    md += f"| {row.get('platform','?')} | {row.get('subscriptions',0)} | {row.get('users',0)} |\\n"

pt = snapshot["push_totals"] if isinstance(snapshot["push_totals"], dict) else {}
md += f"""
**Totals (all time):** {pt.get('total_subscriptions','?')} subscriptions · {pt.get('distinct_users','?')} users

## Creative approve time

{json.dumps(snapshot['creative_approve_time'], indent=2, ensure_ascii=False)}

## Pending backlog

{json.dumps(snapshot['creative_pending'], indent=2, ensure_ascii=False)}

## Manual fields (Product completes)

- PWA install rate: approvers_installed / approvers_invited
- iOS push delivery %: pilot test matrix
- Android push delivery %: pilot test matrix

→ Full report template: `docs/templates/m3-m2-kpi-review-report.md`
"""
Path("$OUT_MD").write_text(md)
print(f"OK  {Path('$OUT_JSON')}")
print(f"OK  {Path('$OUT_MD')}")
PY
