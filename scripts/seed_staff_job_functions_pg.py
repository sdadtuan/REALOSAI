#!/usr/bin/env python3
"""Seed R1.5 job function catalog + default grants into PostgreSQL."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import require_pg  # noqa: E402

JOB_FUNCTION_CATALOG = [
    {
        "code": "leader",
        "label": "Trưởng nhóm",
        "description": "Assign trong team, export KPI",
        "department_scope": "All",
        "sort_order": 1,
    },
    {
        "code": "sales",
        "label": "Kinh doanh",
        "description": "Lead B2B, agency client",
        "department_scope": "DEPT-SALES",
        "sort_order": 2,
    },
    {
        "code": "content",
        "label": "Content / Copy",
        "description": "SEO write, email write",
        "department_scope": "DEPT-SOLUTION, DEPT-AGENCY",
        "sort_order": 3,
    },
    {
        "code": "design",
        "label": "Design / Creative",
        "description": "Meta/FB creative",
        "department_scope": "DEPT-SOLUTION, DEPT-AGENCY",
        "sort_order": 4,
    },
    {
        "code": "analyst",
        "label": "Phân tích / BI",
        "description": "Dashboard export",
        "department_scope": "All",
        "sort_order": 5,
    },
    {
        "code": "ops",
        "label": "Vận hành",
        "description": "CSKH board, SOP",
        "department_scope": "DEPT-CSKH, DEPT-HR",
        "sort_order": 6,
    },
    {
        "code": "technical",
        "label": "Kỹ thuật SEO",
        "description": "Technical SEO, GSC",
        "department_scope": "DEPT-AGENCY",
        "sort_order": 7,
    },
    {
        "code": "compliance",
        "label": "Tuân thủ",
        "description": "Email compliance",
        "department_scope": "DEPT-AGENCY",
        "sort_order": 8,
    },
]

DEFAULT_JOB_FUNCTION_GRANTS: dict[str, dict[str, list[str]]] = {
    "leader": {
        "crm_leads": ["assign"],
        "crm_kpi_records": ["export", "configure"],
        "crm_staff_kpi_am_sp": ["view"],
        "crm_presales_solution": ["release"],
    },
    "sales": {},
    "content": {
        "crm_seo_aeo": ["view"],
        "crm_seo_aeo_write": ["view", "create", "edit"],
        "crm_seo_aeo_reports": ["view"],
        "crm_email_mkt": ["view", "write", "reports"],
    },
    "design": {
        "crm_facebook_ads": ["view", "edit"],
        "meta_campaign_write": ["view"],
    },
    "analyst": {
        "crm_business_dashboard": ["export"],
        "crm_sales_funnel": ["export"],
        "crm_kpi_chart": ["export"],
    },
    "ops": {},
    "technical": {
        "crm_seo_aeo_technical": ["view", "configure"],
        "crm_seo_aeo_settings": ["configure"],
    },
    "compliance": {
        "crm_email_mkt": ["compliance", "deliverability"],
    },
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed staff job functions (R1.5 WIN-1-C)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    from ptt_jobs.db import pg_connection

    fn_count = 0
    grant_count = 0

    with pg_connection() as conn:
        with conn.cursor() as cur:
            for fn in JOB_FUNCTION_CATALOG:
                if dry_run:
                    print(f"would upsert function {fn['code']}")
                else:
                    cur.execute(
                        """
                        INSERT INTO staff_job_functions (code, label, description, department_scope, sort_order, active)
                        VALUES (%(code)s, %(label)s, %(description)s, %(department_scope)s, %(sort_order)s, TRUE)
                        ON CONFLICT (code) DO UPDATE SET
                          label = EXCLUDED.label,
                          description = EXCLUDED.description,
                          department_scope = EXCLUDED.department_scope,
                          sort_order = EXCLUDED.sort_order,
                          active = TRUE
                        """,
                        fn,
                    )
                fn_count += 1

                grants = DEFAULT_JOB_FUNCTION_GRANTS.get(fn["code"], {})
                if not dry_run:
                    cur.execute(
                        "DELETE FROM staff_job_function_grants WHERE function_code = %s",
                        (fn["code"],),
                    )
                for section_id, actions in grants.items():
                    for action in actions:
                        if dry_run:
                            print(f"  would grant {fn['code']} {section_id}.{action}")
                        else:
                            cur.execute(
                                """
                                INSERT INTO staff_job_function_grants (function_code, section_id, action)
                                VALUES (%s, %s, %s)
                                ON CONFLICT DO NOTHING
                                """,
                                (fn["code"], section_id, action),
                            )
                        grant_count += 1

            if not dry_run:
                conn.commit()

    mode = "would seed" if dry_run else "seeded"
    print(f"{mode} {fn_count} job functions, {grant_count} grant rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
