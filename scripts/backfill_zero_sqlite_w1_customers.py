#!/usr/bin/env python3
"""Backfill SQLite crm_customers + satellite tables → PostgreSQL (Zero SQLite W1 P1)."""
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
    if not table_exists(con, "crm_customers"):
        print("no crm_customers table in sqlite")
        con.close()
        return 0

    customers = con.execute("SELECT * FROM crm_customers ORDER BY id").fetchall()
    inserted = 0
    for row in customers:
        sid = int(row["id"])
        cols = [
            "sqlite_customer_id",
            "name",
            "phone",
            "email",
            "address",
            "company",
            "is_placeholder",
            "placeholder_lead_id",
            "lead_source",
            "lead_source_note",
            "date_of_birth",
            "gender",
            "id_number",
            "occupation",
            "interests",
            "profile_notes",
            "created_at",
        ]
        vals = [
            sid,
            row["name"] if "name" in row.keys() else "",
            row["phone"] if "phone" in row.keys() else "",
            row["email"] if "email" in row.keys() else "",
            row["address"] if "address" in row.keys() else "",
            row["company"] if "company" in row.keys() else "",
            bool(row["is_placeholder"]) if "is_placeholder" in row.keys() else False,
            row["placeholder_lead_id"] if "placeholder_lead_id" in row.keys() else None,
            row["lead_source"] if "lead_source" in row.keys() else "",
            row["lead_source_note"] if "lead_source_note" in row.keys() else "",
            row["date_of_birth"] if "date_of_birth" in row.keys() else "",
            row["gender"] if "gender" in row.keys() else "",
            row["id_number"] if "id_number" in row.keys() else "",
            row["occupation"] if "occupation" in row.keys() else "",
            row["interests"] if "interests" in row.keys() else "",
            row["profile_notes"] if "profile_notes" in row.keys() else "",
            row["created_at"] if "created_at" in row.keys() and row["created_at"] else None,
        ]
        created = vals[-1]
        created_sql = f"COALESCE({sql_lit(created)}::timestamptz, NOW())" if created else "NOW()"
        val_sql = ", ".join(sql_lit(v) for v in vals[:-1]) + f", {created_sql}"
        psql(
            f"""
            INSERT INTO crm_customers ({", ".join(cols)})
            VALUES ({val_sql})
            ON CONFLICT (sqlite_customer_id) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              address = EXCLUDED.address,
              company = EXCLUDED.company,
              is_placeholder = EXCLUDED.is_placeholder,
              placeholder_lead_id = EXCLUDED.placeholder_lead_id,
              lead_source = EXCLUDED.lead_source,
              lead_source_note = EXCLUDED.lead_source_note,
              date_of_birth = EXCLUDED.date_of_birth,
              gender = EXCLUDED.gender,
              id_number = EXCLUDED.id_number,
              occupation = EXCLUDED.occupation,
              interests = EXCLUDED.interests,
              profile_notes = EXCLUDED.profile_notes
            """
        )
        inserted += 1

    def customer_pg_id(sqlite_id: int) -> int | None:
        out = subprocess.check_output(
            [
                "psql",
                DSN,
                "-v",
                "ON_ERROR_STOP=1",
                "-t",
                "-A",
                "-c",
                f"SELECT id FROM crm_customers WHERE sqlite_customer_id = {sqlite_id} LIMIT 1",
            ],
            text=True,
        ).strip()
        return int(out) if out else None

    satellites: list[tuple[str, str, str]] = [
        ("crm_customer_relations", "sqlite_relation_id", "customer_id"),
        ("crm_customer_purchases", "sqlite_purchase_id", "customer_id"),
        ("crm_customer_issues", "sqlite_issue_id", "customer_id"),
        ("crm_customer_brief_scans", "sqlite_brief_id", "customer_id"),
    ]
    sat_count = 0
    for table, bridge_col, fk_col in satellites:
        if not table_exists(con, table):
            continue
        rows = con.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
        for row in rows:
            legacy_id = int(row["id"])
            cust_legacy = int(row[fk_col])
            pg_cust = customer_pg_id(cust_legacy)
            if pg_cust is None:
                print(f"skip {table} id={legacy_id}: customer {cust_legacy} missing in PG")
                continue
            col_names = [c for c in row.keys() if c not in ("id", fk_col)]
            insert_cols = [bridge_col, fk_col] + col_names
            insert_vals = [legacy_id, pg_cust] + [row[c] for c in col_names]
            val_sql = ", ".join(sql_lit(v) for v in insert_vals)
            updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in col_names)
            psql(
                f"""
                INSERT INTO {table} ({", ".join(insert_cols)})
                VALUES ({val_sql})
                ON CONFLICT ({bridge_col}) DO UPDATE SET
                  {fk_col} = EXCLUDED.{fk_col},
                  {updates}
                """
            )
            sat_count += 1

    con.close()
    print(f"backfilled {inserted} customers, {sat_count} satellite rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
