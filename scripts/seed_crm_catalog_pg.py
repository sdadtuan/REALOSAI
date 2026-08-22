#!/usr/bin/env python3
"""Seed default CRM catalog services/industries into PostgreSQL (no ptt.db)."""
from __future__ import annotations

import json
import os
import sys

DEFAULT_SERVICES = [
    ("lead-gen", "Lead generation", 10),
]

DEFAULT_INDUSTRIES = [
    ("spa", "Spa & Beauty", "Spa, thẩm mỹ, wellness", 10),
    ("bds", "Bất động sản", "BĐS, dự án, môi giới", 20),
    ("giao-duc", "Giáo dục", "Trường, trung tâm, EdTech", 30),
    ("fnb", "F&B", "Nhà hàng, cafe, F&B chain", 40),
    ("khac", "Khác", "Ngành khác / chưa phân loại", 50),
]


def main() -> int:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL required", file=sys.stderr)
        return 1

    try:
        import psycopg2
    except ImportError:
        print("psycopg2 required", file=sys.stderr)
        return 1

    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'crm_catalog_industries'
                LIMIT 1
                """
            )
            if cur.fetchone() is None:
                print("Run ./scripts/apply_pg_ddl_crm_catalog.sh first", file=sys.stderr)
                return 1

            cur.execute("SELECT COUNT(*) FROM crm_catalog_services")
            svc_count = int(cur.fetchone()[0])
            if svc_count == 0:
                for slug, name, sort_order in DEFAULT_SERVICES:
                    cur.execute(
                        """
                        INSERT INTO crm_catalog_services (slug, name, description, sort_order, active)
                        VALUES (%s, %s, '', %s, TRUE)
                        ON CONFLICT (slug) DO NOTHING
                        """,
                        (slug, name, sort_order),
                    )

            cur.execute("SELECT COUNT(*) FROM crm_catalog_industries")
            ind_count = int(cur.fetchone()[0])
            if ind_count == 0:
                for slug, name, desc, sort_order in DEFAULT_INDUSTRIES:
                    cur.execute(
                        """
                        INSERT INTO crm_catalog_industries
                            (slug, name, description, traits_json, sort_order, active)
                        VALUES (%s, %s, %s, %s::jsonb, %s, TRUE)
                        ON CONFLICT (slug) DO NOTHING
                        """,
                        (slug, name, desc, json.dumps({}), sort_order),
                    )

        conn.commit()
        print(f"OK  catalog seed — services={svc_count or len(DEFAULT_SERVICES)}, industries={ind_count or len(DEFAULT_INDUSTRIES)}")
        return 0
    except Exception as exc:
        conn.rollback()
        print(f"seed failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
