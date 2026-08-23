#!/usr/bin/env python3
"""Backfill SQLite crm_tickets + messages → PostgreSQL (Zero SQLite W1 P1)."""
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
    if not table_exists(con, "crm_tickets"):
        print("no crm_tickets table in sqlite")
        con.close()
        return 0

    tickets = con.execute("SELECT * FROM crm_tickets ORDER BY id").fetchall()
    ticket_count = 0
    for row in tickets:
        sid = int(row["id"])
        cust_legacy = int(row["customer_id"])
        pg_cust = pg_lookup("crm_customers", "sqlite_customer_id", cust_legacy)
        if pg_cust is None:
            print(f"skip ticket {sid}: customer {cust_legacy} missing in PG")
            continue
        fields = [
            "sqlite_ticket_id",
            "customer_id",
            "ticket_type",
            "status",
            "priority",
            "channel",
            "title",
            "description",
            "resolution",
            "assigned_staff_id",
            "sentiment_label",
            "sentiment_score",
            "sentiment_confidence",
            "sentiment_scored_at",
            "created_at",
            "updated_at",
            "resolved_at",
        ]
        keys = row.keys()
        vals = [
            sid,
            pg_cust,
            row["ticket_type"] if "ticket_type" in keys else "phan_anh",
            row["status"] if "status" in keys else "moi",
            row["priority"] if "priority" in keys else "binh_thuong",
            row["channel"] if "channel" in keys else "khac",
            row["title"] if "title" in keys else "",
            row["description"] if "description" in keys else "",
            row["resolution"] if "resolution" in keys else "",
            row["assigned_staff_id"] if "assigned_staff_id" in keys else None,
            row["sentiment_label"] if "sentiment_label" in keys else "",
            row["sentiment_score"] if "sentiment_score" in keys else None,
            row["sentiment_confidence"] if "sentiment_confidence" in keys else None,
            row["sentiment_scored_at"] if "sentiment_scored_at" in keys and row["sentiment_scored_at"] else None,
            row["created_at"] if "created_at" in keys and row["created_at"] else None,
            row["updated_at"] if "updated_at" in keys and row["updated_at"] else None,
            row["resolved_at"] if "resolved_at" in keys and row["resolved_at"] else None,
        ]
        ts_cols = {"sentiment_scored_at", "created_at", "updated_at", "resolved_at"}
        parts: list[str] = []
        for col, val in zip(fields, vals, strict=True):
            if col in ts_cols:
                if val in (None, ""):
                    parts.append("NULL" if col == "resolved_at" or col == "sentiment_scored_at" else "NOW()")
                else:
                    parts.append(f"{sql_lit(val)}::timestamptz")
            else:
                parts.append(sql_lit(val))
        psql(
            f"""
            INSERT INTO crm_tickets ({", ".join(fields)})
            VALUES ({", ".join(parts)})
            ON CONFLICT (sqlite_ticket_id) DO UPDATE SET
              customer_id = EXCLUDED.customer_id,
              ticket_type = EXCLUDED.ticket_type,
              status = EXCLUDED.status,
              priority = EXCLUDED.priority,
              channel = EXCLUDED.channel,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              resolution = EXCLUDED.resolution,
              assigned_staff_id = EXCLUDED.assigned_staff_id,
              sentiment_label = EXCLUDED.sentiment_label,
              sentiment_score = EXCLUDED.sentiment_score,
              sentiment_confidence = EXCLUDED.sentiment_confidence,
              sentiment_scored_at = EXCLUDED.sentiment_scored_at,
              updated_at = EXCLUDED.updated_at,
              resolved_at = EXCLUDED.resolved_at
            """
        )
        ticket_count += 1

    msg_count = 0
    if table_exists(con, "crm_ticket_messages"):
        messages = con.execute("SELECT * FROM crm_ticket_messages ORDER BY id").fetchall()
        for row in messages:
            legacy = int(row["id"])
            ticket_legacy = int(row["ticket_id"])
            pg_ticket = pg_lookup("crm_tickets", "sqlite_ticket_id", ticket_legacy)
            if pg_ticket is None:
                continue
            is_internal = bool(row["is_internal"]) if "is_internal" in row.keys() else True
            psql(
                f"""
                INSERT INTO crm_ticket_messages (
                  sqlite_message_id, ticket_id, author_staff_id, body, is_internal, created_at
                ) VALUES (
                  {legacy},
                  {pg_ticket},
                  {sql_lit(row["author_staff_id"] if "author_staff_id" in row.keys() else None)},
                  {sql_lit(row["body"] if "body" in row.keys() else "")},
                  {sql_lit(is_internal)},
                  COALESCE({sql_lit(row["created_at"] if "created_at" in row.keys() and row["created_at"] else None)}::timestamptz, NOW())
                )
                ON CONFLICT (sqlite_message_id) DO UPDATE SET
                  ticket_id = EXCLUDED.ticket_id,
                  author_staff_id = EXCLUDED.author_staff_id,
                  body = EXCLUDED.body,
                  is_internal = EXCLUDED.is_internal
                """
            )
            msg_count += 1

    con.close()
    print(f"backfilled {ticket_count} tickets, {msg_count} messages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
