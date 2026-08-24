#!/usr/bin/env python3
"""Minimal PostgreSQL stubs for Playwright / local e2e (no ptt.db)."""
from __future__ import annotations

import argparse
import json
import os
import sys

E2E_CUSTOMER_SQLITE_ID = 900_001
E2E_CASE_SQLITE_ID = 900_001
E2E_TICKET_SQLITE_ID = 900_001
E2E_LEAD_SQLITE_ID = 900_001


def table_exists(cur, name: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        LIMIT 1
        """,
        (name,),
    )
    return cur.fetchone() is not None


def seed_customer(cur) -> None:
    if not table_exists(cur, "crm_customers"):
        print("skip  crm_customers (table missing)")
        return
    cur.execute(
        """
        INSERT INTO crm_customers (sqlite_customer_id, name, phone, email, company)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (sqlite_customer_id) DO NOTHING
        """,
        (E2E_CUSTOMER_SQLITE_ID, "E2E Demo Customer", "84900000001", "e2e-customer@demo.local", "E2E Co"),
    )
    print("OK    crm_customers stub")


def seed_case(cur) -> None:
    if not table_exists(cur, "crm_cases") or not table_exists(cur, "crm_customers"):
        print("skip  crm_cases (table missing)")
        return
    cur.execute(
        "SELECT id FROM crm_customers WHERE sqlite_customer_id = %s LIMIT 1",
        (E2E_CUSTOMER_SQLITE_ID,),
    )
    row = cur.fetchone()
    if not row:
        print("skip  crm_cases (no e2e customer)")
        return
    customer_id = int(row[0])
    cur.execute(
        """
        INSERT INTO crm_cases (
          sqlite_case_id, customer_id, title, status, pipeline_stage, channel
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (sqlite_case_id) DO NOTHING
        """,
        (E2E_CASE_SQLITE_ID, customer_id, "E2E Demo Case", "moi", "moi", "manual"),
    )
    print("OK    crm_cases stub")


def seed_ticket(cur) -> None:
    if not table_exists(cur, "crm_tickets") or not table_exists(cur, "crm_customers"):
        print("skip  crm_tickets (table missing)")
        return
    cur.execute(
        "SELECT id FROM crm_customers WHERE sqlite_customer_id = %s LIMIT 1",
        (E2E_CUSTOMER_SQLITE_ID,),
    )
    row = cur.fetchone()
    if not row:
        print("skip  crm_tickets (no e2e customer)")
        return
    customer_id = int(row[0])
    cur.execute(
        """
        INSERT INTO crm_tickets (
          sqlite_ticket_id, customer_id, title, status, ticket_type, channel
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (sqlite_ticket_id) DO NOTHING
        """,
        (E2E_TICKET_SQLITE_ID, customer_id, "E2E Demo Ticket", "moi", "phan_anh", "manual"),
    )
    print("OK    crm_tickets stub")


def seed_lead(cur) -> None:
    if not table_exists(cur, "crm_leads"):
        print("skip  crm_leads (table missing)")
        return
    cur.execute(
        """
        INSERT INTO crm_leads (
          sqlite_lead_id, full_name, phone, email, status, source, channel, meta_json
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (sqlite_lead_id) DO NOTHING
        """,
        (
            E2E_LEAD_SQLITE_ID,
            "E2E Demo Lead",
            "84900000002",
            "e2e-lead@demo.local",
            "moi",
            "manual",
            "manual",
            json.dumps({"lead_flow_kind": "spa_operational"}),
        ),
    )
    print("OK    crm_leads stub")


def seed_kpi(cur) -> None:
    if not table_exists(cur, "crm_kpi_metrics"):
        print("skip  crm_kpi_metrics (table missing)")
        return
    cur.execute("SELECT COUNT(*) FROM crm_kpi_metrics")
    if int(cur.fetchone()[0]) > 0:
        print("OK    crm_kpi_metrics already seeded")
        return
    cur.execute(
        """
        INSERT INTO crm_kpi_metrics (
          sqlite_metric_id, code, name, unit, description, sort_order, active
        ) VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        ON CONFLICT (sqlite_metric_id) DO NOTHING
        """,
        (900_001, "LEADS", "Số lead", "count", "E2E stub metric", 10),
    )
    print("OK    crm_kpi_metrics stub")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed minimal CRM PG rows for e2e")
    parser.add_argument("--minimal", action="store_true", default=True, help=argparse.SUPPRESS)
    args = parser.parse_args()
    _ = args

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
            seed_customer(cur)
            seed_case(cur)
            seed_ticket(cur)
            seed_lead(cur)
            seed_kpi(cur)
        conn.commit()
        print("OK  e2e PG seed complete")
        return 0
    except Exception as exc:
        conn.rollback()
        print(f"seed failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
