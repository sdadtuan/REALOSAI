#!/usr/bin/env python3
"""Aggregate anonymized win patterns from crm_lead_meeting_prep.win_outcome_json (S-LMP-6)."""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Install psycopg2: pip install psycopg2-binary", file=sys.stderr)
    raise


def main() -> int:
    parser = argparse.ArgumentParser(description="LMP win patterns report")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--json", action="store_true", help="Print JSON only")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        print("DATABASE_URL required", file=sys.stderr)
        return 1

    days = max(1, min(args.days, 365))
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT win_outcome_json, result_json
                FROM crm_lead_meeting_prep
                WHERE updated_at >= NOW() - (%s * INTERVAL '1 day')
                  AND COALESCE(win_outcome_json->>'submitted_at', '') <> ''
                """,
                (days,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    tier = Counter()
    objections = Counter()
    industry_dv: Counter[tuple[str, str]] = Counter()

    for row in rows:
        win = row["win_outcome_json"] or {}
        if isinstance(win, str):
            win = json.loads(win)
        t = str(win.get("closed_tier") or "unknown").upper()
        tier[t] += 1
        obj = str(win.get("objection_faced") or "").strip().lower()
        if obj:
            objections[obj[:120]] += 1
        result = row.get("result_json") or {}
        if isinstance(result, str):
            result = json.loads(result)
        industry = str(win.get("industry_slug") or "unknown")
        for svc in result.get("recommended_services") or []:
            if isinstance(svc, dict) and svc.get("dv_code"):
                industry_dv[(industry, str(svc["dv_code"]))] += 1

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_days": days,
        "debrief_count": len(rows),
        "tier_mix": dict(tier),
        "top_objections": objections.most_common(10),
        "industry_dv_pairs": [
            {"industry": k[0], "dv_code": k[1], "count": v}
            for k, v in industry_dv.most_common(15)
        ],
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"Win patterns — last {days} days ({report['debrief_count']} debriefs)")
        print("Tier mix:", report["tier_mix"])
        print("Top objections:")
        for obj, cnt in report["top_objections"][:5]:
            print(f"  - {obj} ({cnt})")
        print("Industry × DV:")
        for row in report["industry_dv_pairs"][:5]:
            print(f"  - {row['industry']} → {row['dv_code']} ({row['count']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
