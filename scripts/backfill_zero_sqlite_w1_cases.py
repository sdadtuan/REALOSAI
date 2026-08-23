#!/usr/bin/env python3
"""Backfill SQLite crm_cases + events/care_reports → PostgreSQL (Zero SQLite W1 P1)."""
from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from typing import Any

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")


def sql_lit(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    if text == "":
        return "''"
    return "'" + text.replace("'", "''") + "'"


def psql(sql: str) -> None:
    subprocess.check_call(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", sql])


def pg_lookup(table: str, bridge_col: str, legacy_id: int) -> int | None:
    out = subprocess.check_output(
        [
            "psql",
            DSN,
            "-v",
            "ON_ERROR_STOP=1",
            "-t",
            "-A",
            "-c",
            f"SELECT id FROM {table} WHERE {bridge_col} = {legacy_id} LIMIT 1",
        ],
        text=True,
    ).strip()
    return int(out) if out else None


def table_exists(con: sqlite3.Connection, name: str) -> bool:
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return row is not None


def main() -> int:
    if not os.path.isfile(SQLITE):
        print(f"sqlite not found: {SQLITE}", file=sys.stderr)
        return 1

    con = sqlite3.connect(SQLITE)
    con.row_factory = sqlite3.Row
    if not table_exists(con, "crm_cases"):
        print("no crm_cases table in sqlite")
        con.close()
        return 0

    cases = con.execute("SELECT * FROM crm_cases ORDER BY id").fetchall()
    case_count = 0
    for row in cases:
        sid = int(row["id"])
        cust_legacy = int(row["customer_id"])
        pg_cust = pg_lookup("crm_customers", "sqlite_customer_id", cust_legacy)
        if pg_cust is None:
            print(f"skip case {sid}: customer {cust_legacy} missing in PG")
            continue
        fields = [
            "sqlite_case_id",
            "customer_id",
            "title",
            "description",
            "channel",
            "priority",
            "status",
            "assigned_to",
            "assigned_staff_id",
            "assigned_at",
            "pipeline_stage",
            "stage_entered_at",
            "lead_source",
            "deal_value_vnd",
            "campaign_id",
            "created_at",
            "updated_at",
        ]
        vals = [
            sid,
            pg_cust,
            row["title"] if "title" in row.keys() else "",
            row["description"] if "description" in row.keys() else "",
            row["channel"] if "channel" in row.keys() else "khac",
            row["priority"] if "priority" in row.keys() else "binh_thuong",
            row["status"] if "status" in row.keys() else "moi",
            row["assigned_to"] if "assigned_to" in row.keys() else "",
            row["assigned_staff_id"] if "assigned_staff_id" in row.keys() else None,
            row["assigned_at"] if "assigned_at" in row.keys() and row["assigned_at"] else None,
            row["pipeline_stage"] if "pipeline_stage" in row.keys() else "moi",
            row["stage_entered_at"] if "stage_entered_at" in row.keys() and row["stage_entered_at"] else None,
            row["lead_source"] if "lead_source" in row.keys() else "",
            row["deal_value_vnd"] if "deal_value_vnd" in row.keys() else 0,
            row["campaign_id"] if "campaign_id" in row.keys() else None,
            row["created_at"] if "created_at" in row.keys() and row["created_at"] else None,
            row["updated_at"] if "updated_at" in row.keys() and row["updated_at"] else None,
        ]
        ts_cols = {"assigned_at", "stage_entered_at", "created_at", "updated_at"}
        parts: list[str] = []
        for col, val in zip(fields, vals, strict=True):
            if col in ts_cols:
                parts.append(f"COALESCE({sql_lit(val)}::timestamptz, NOW())" if val else "NOW()")
            else:
                parts.append(sql_lit(val))
        psql(
            f"""
            INSERT INTO crm_cases ({", ".join(fields)})
            VALUES ({", ".join(parts)})
            ON CONFLICT (sqlite_case_id) DO UPDATE SET
              customer_id = EXCLUDED.customer_id,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              channel = EXCLUDED.channel,
              priority = EXCLUDED.priority,
              status = EXCLUDED.status,
              assigned_to = EXCLUDED.assigned_to,
              assigned_staff_id = EXCLUDED.assigned_staff_id,
              pipeline_stage = EXCLUDED.pipeline_stage,
              lead_source = EXCLUDED.lead_source,
              deal_value_vnd = EXCLUDED.deal_value_vnd,
              campaign_id = EXCLUDED.campaign_id,
              updated_at = EXCLUDED.updated_at
            """
        )
        case_count += 1

    def backfill_child(table: str, bridge: str, sqlite_table: str) -> int:
        if not table_exists(con, sqlite_table):
            return 0
        n = 0
        rows = con.execute(f"SELECT * FROM {sqlite_table} ORDER BY id").fetchall()
        for row in rows:
            legacy = int(row["id"])
            case_legacy = int(row["case_id"])
            pg_case = pg_lookup("crm_cases", "sqlite_case_id", case_legacy)
            if pg_case is None:
                continue
            skip = {"id", "case_id"}
            cols = [bridge, "case_id"] + [c for c in row.keys() if c not in skip]
            vals = [legacy, pg_case] + [row[c] for c in row.keys() if c not in skip]
            updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in row.keys() if c not in skip)
            psql(
                f"""
                INSERT INTO {table} ({", ".join(cols)})
                VALUES ({", ".join(sql_lit(v) for v in vals)})
                ON CONFLICT ({bridge}) DO UPDATE SET case_id = EXCLUDED.case_id, {updates}
                """
            )
            n += 1
        return n

    events = backfill_child("crm_case_events", "sqlite_event_id", "crm_case_events")
    reports = backfill_child("crm_care_reports", "sqlite_report_id", "crm_care_reports")

    con.close()
    print(f"backfilled {case_count} cases, {events} events, {reports} care reports")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
