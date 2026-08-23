#!/usr/bin/env python3
"""Backfill SQLite crm_proposals + quote lines → PostgreSQL (Zero SQLite W1 P2)."""
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
    if not table_exists(con, "crm_proposals"):
        print("no crm_proposals table in sqlite")
        con.close()
        return 0

    proposals = con.execute("SELECT * FROM crm_proposals ORDER BY id").fetchall()
    prop_count = 0
    for row in proposals:
        sid = int(row["id"])
        cust_legacy = int(row["customer_id"])
        pg_cust = pg_lookup("crm_customers", "sqlite_customer_id", cust_legacy)
        if pg_cust is None:
            print(f"skip proposal {sid}: customer {cust_legacy} missing in PG")
            continue
        keys = row.keys()
        fields = [
            "sqlite_proposal_id",
            "customer_id",
            "lead_id",
            "presales_id",
            "lifecycle_id",
            "service_slugs",
            "total_vnd",
            "timeline_months",
            "notes",
            "ai_output",
            "status",
            "valid_until",
            "price_adjustment_reason",
            "created_at",
            "updated_at",
        ]
        vals = [
            sid,
            pg_cust,
            row["lead_id"] if "lead_id" in keys else None,
            row["presales_id"] if "presales_id" in keys else None,
            row["lifecycle_id"] if "lifecycle_id" in keys else None,
            row["service_slugs"] if "service_slugs" in keys else "[]",
            row["total_vnd"] if "total_vnd" in keys else 0,
            row["timeline_months"] if "timeline_months" in keys else 1,
            row["notes"] if "notes" in keys else "",
            row["ai_output"] if "ai_output" in keys else "{}",
            row["status"] if "status" in keys else "draft",
            row["valid_until"] if "valid_until" in keys else None,
            row["price_adjustment_reason"] if "price_adjustment_reason" in keys else "",
            row["created_at"] if "created_at" in keys and row["created_at"] else None,
            row["updated_at"] if "updated_at" in keys and row["updated_at"] else None,
        ]
        ts_cols = {"created_at", "updated_at"}
        parts: list[str] = []
        for col, val in zip(fields, vals, strict=True):
            if col in ts_cols:
                parts.append(f"COALESCE({sql_lit(val)}::timestamptz, NOW())" if val else "NOW()")
            else:
                parts.append(sql_lit(val))
        psql(
            f"""
            INSERT INTO crm_proposals ({", ".join(fields)})
            VALUES ({", ".join(parts)})
            ON CONFLICT (sqlite_proposal_id) DO UPDATE SET
              customer_id = EXCLUDED.customer_id,
              lead_id = EXCLUDED.lead_id,
              presales_id = EXCLUDED.presales_id,
              lifecycle_id = EXCLUDED.lifecycle_id,
              service_slugs = EXCLUDED.service_slugs,
              total_vnd = EXCLUDED.total_vnd,
              timeline_months = EXCLUDED.timeline_months,
              notes = EXCLUDED.notes,
              ai_output = EXCLUDED.ai_output,
              status = EXCLUDED.status,
              valid_until = EXCLUDED.valid_until,
              price_adjustment_reason = EXCLUDED.price_adjustment_reason,
              updated_at = EXCLUDED.updated_at
            """
        )
        prop_count += 1

    line_count = 0
    if table_exists(con, "crm_quote_line_item"):
        lines = con.execute("SELECT * FROM crm_quote_line_item ORDER BY id").fetchall()
        for row in lines:
            legacy = int(row["id"])
            prop_legacy = int(row["proposal_id"])
            pg_prop = pg_lookup("crm_proposals", "sqlite_proposal_id", prop_legacy)
            if pg_prop is None:
                continue
            cols = [
                "sqlite_line_id",
                "proposal_id",
                "dv_code",
                "sku_code",
                "package_tier",
                "service_slug",
                "reference_price_min",
                "reference_price_max",
                "final_price_vnd",
                "scope_notes",
                "lifecycle_id",
                "sort_order",
            ]
            keys = row.keys()
            vals = [
                legacy,
                pg_prop,
                row["dv_code"] if "dv_code" in keys else "",
                row["sku_code"] if "sku_code" in keys else None,
                row["package_tier"] if "package_tier" in keys else "standard",
                row["service_slug"] if "service_slug" in keys else "",
                row["reference_price_min"] if "reference_price_min" in keys else 0,
                row["reference_price_max"] if "reference_price_max" in keys else 0,
                row["final_price_vnd"] if "final_price_vnd" in keys else 0,
                row["scope_notes"] if "scope_notes" in keys else "",
                row["lifecycle_id"] if "lifecycle_id" in keys else None,
                row["sort_order"] if "sort_order" in keys else 0,
            ]
            psql(
                f"""
                INSERT INTO crm_quote_line_item ({", ".join(cols)})
                VALUES ({", ".join(sql_lit(v) for v in vals)})
                ON CONFLICT (sqlite_line_id) DO UPDATE SET
                  proposal_id = EXCLUDED.proposal_id,
                  dv_code = EXCLUDED.dv_code,
                  sku_code = EXCLUDED.sku_code,
                  package_tier = EXCLUDED.package_tier,
                  service_slug = EXCLUDED.service_slug,
                  reference_price_min = EXCLUDED.reference_price_min,
                  reference_price_max = EXCLUDED.reference_price_max,
                  final_price_vnd = EXCLUDED.final_price_vnd,
                  scope_notes = EXCLUDED.scope_notes,
                  lifecycle_id = EXCLUDED.lifecycle_id,
                  sort_order = EXCLUDED.sort_order
                """
            )
            line_count += 1

    con.close()
    print(f"backfilled {prop_count} proposals, {line_count} quote lines")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
