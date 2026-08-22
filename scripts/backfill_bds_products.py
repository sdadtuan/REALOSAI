#!/usr/bin/env python3
"""Copy crm_re_project_products SQLite → PG. Tenant = crm_re_projects.tenant_id."""
import os, sqlite3, subprocess

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

COLS = (
    "id,project_id,unit_code,tower,floor,product_line,zone,typology,is_corner,"
    "sales_staff_id,product_type,area_m2,bedrooms,direction,view_type,"
    "list_price_vnd,net_price_vnd,status,notes,price_batch"
)
BOOL_COLS = {"is_corner"}
INT_COLS = {"id", "project_id", "sales_staff_id", "bedrooms", "list_price_vnd", "net_price_vnd"}
NUM_COLS = {"area_m2"}


def sql_literal(col: str, value) -> str:
    if value is None or value == "":
        if col in BOOL_COLS:
            return "FALSE"
        if col in INT_COLS or col in NUM_COLS:
            return "NULL" if col in {"sales_staff_id", "bedrooms", "area_m2"} else "0"
        return "''"
    if col in BOOL_COLS:
        return "TRUE" if bool(value) and value != 0 else "FALSE"
    if col in INT_COLS:
        return str(int(value))
    if col in NUM_COLS:
        return str(float(value))
    return "'" + str(value).replace("'", "''") + "'"


def csv_cell(col: str, value):
    if value is None or value == "":
        if col in BOOL_COLS:
            return "false"
        if col in INT_COLS or col in NUM_COLS:
            return r"\N" if col in {"sales_staff_id", "bedrooms", "area_m2"} else "0"
        return ""
    if col in BOOL_COLS:
        return "true" if bool(value) and value != 0 else "false"
    return value


def insert_on_conflict_do_nothing(rows) -> None:
    col_list = COLS.split(",")
    for r in rows:
        values = ", ".join(sql_literal(c, r[c]) for c in col_list)
        sql = (
            f"INSERT INTO crm_re_project_products ({COLS}) VALUES ({values}) "
            "ON CONFLICT (id) DO NOTHING"
        )
        subprocess.check_call(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", sql])


def main() -> int:
    con = sqlite3.connect(SQLITE)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(f"SELECT {COLS} FROM crm_re_project_products").fetchall()
    except sqlite3.Error:
        print("no sqlite products table")
        con.close()
        return 0
    con.close()
    import csv, tempfile
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    col_list = COLS.split(",")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow([csv_cell(c, r[c]) for c in col_list])
    try:
        subprocess.check_call(
            [
                "psql", DSN, "-v", "ON_ERROR_STOP=1", "-c",
                f"\\copy crm_re_project_products ({COLS}) FROM '{path}' WITH (FORMAT csv, NULL '\\N')",
            ]
        )
    except subprocess.CalledProcessError:
        insert_on_conflict_do_nothing(rows)
    subprocess.check_call(
        [
            "psql", DSN, "-v", "ON_ERROR_STOP=1", "-c",
            "UPDATE crm_re_project_products u SET tenant_id = p.tenant_id "
            "FROM crm_re_projects p WHERE u.project_id = p.id AND u.tenant_id IS NULL",
        ]
    )
    os.remove(path)
    print(f"backfilled {len(rows)} products")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
