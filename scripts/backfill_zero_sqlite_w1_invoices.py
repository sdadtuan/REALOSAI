#!/usr/bin/env python3
"""Backfill SQLite crm_invoices + invoice lines → PostgreSQL (Zero SQLite W1 P3)."""
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
    if not table_exists(con, "crm_invoices"):
        print("no crm_invoices table in sqlite")
        con.close()
        return 0

    invoices = con.execute("SELECT * FROM crm_invoices ORDER BY id").fetchall()
    inv_count = 0
    line_count = 0
    for row in invoices:
        sid = int(row["id"])
        cust_legacy = int(row["customer_id"])
        pg_cust = pg_lookup("crm_customers", "sqlite_customer_id", cust_legacy)
        if pg_cust is None:
            print(f"skip invoice {sid}: customer {cust_legacy} missing in PG")
            continue
        pg_order = None
        if row["order_id"] is not None:
            pg_order = pg_lookup("crm_orders", "sqlite_order_id", int(row["order_id"]))
        pg_lifecycle = None
        if row["lifecycle_id"] is not None:
            pg_lifecycle = pg_lookup(
                "crm_service_lifecycle", "sqlite_lifecycle_id", int(row["lifecycle_id"])
            )
        issued = row["issued_on"] if row["issued_on"] else None
        due = row["due_on"] if row["due_on"] else None
        fields = [
            "sqlite_invoice_id",
            "invoice_number",
            "order_id",
            "contract_id",
            "lifecycle_id",
            "customer_id",
            "status",
            "issued_on",
            "due_on",
            "amount_vnd",
            "paid_vnd",
            "notes",
            "created_at",
            "updated_at",
        ]
        values = [
            sid,
            row["invoice_number"],
            pg_order,
            row["contract_id"],
            pg_lifecycle,
            pg_cust,
            row["status"],
            issued,
            due,
            row["amount_vnd"],
            row["paid_vnd"],
            row["notes"],
            row["created_at"],
            row["updated_at"],
        ]
        cols = ", ".join(fields)
        vals = ", ".join(sql_lit(v) for v in values)
        psql(
            f"INSERT INTO crm_invoices ({cols}) VALUES ({vals}) "
            f"ON CONFLICT (sqlite_invoice_id) DO UPDATE SET "
            f"status = EXCLUDED.status, paid_vnd = EXCLUDED.paid_vnd, updated_at = EXCLUDED.updated_at"
        )
        pg_inv = pg_lookup("crm_invoices", "sqlite_invoice_id", sid)
        if pg_inv is None:
            continue
        inv_count += 1
        if table_exists(con, "crm_invoice_lines"):
            lines = con.execute(
                "SELECT * FROM crm_invoice_lines WHERE invoice_id = ? ORDER BY id", (sid,)
            ).fetchall()
            for line in lines:
                lid = int(line["id"])
                line_fields = [
                    "sqlite_line_id",
                    "invoice_id",
                    "product_slug",
                    "description",
                    "quantity",
                    "unit_price_vnd",
                    "amount_vnd",
                    "sort_order",
                ]
                line_vals = [
                    lid,
                    pg_inv,
                    line["product_slug"],
                    line["description"],
                    line["quantity"],
                    line["unit_price_vnd"],
                    line["amount_vnd"],
                    line["sort_order"],
                ]
                lcols = ", ".join(line_fields)
                lvals = ", ".join(sql_lit(v) for v in line_vals)
                psql(
                    f"INSERT INTO crm_invoice_lines ({lcols}) VALUES ({lvals}) "
                    f"ON CONFLICT (sqlite_line_id) DO UPDATE SET "
                    f"amount_vnd = EXCLUDED.amount_vnd, sort_order = EXCLUDED.sort_order"
                )
                line_count += 1

    con.close()
    print(f"backfill invoices: {inv_count} invoices, {line_count} lines")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
