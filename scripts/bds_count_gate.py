#!/usr/bin/env python3
import os, sqlite3, subprocess, sys

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

def sqlite_count(table: str) -> int:
    con = sqlite3.connect(SQLITE)
    n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    con.close()
    return int(n)

def pg_count(table: str) -> int:
    out = subprocess.check_output(
        ["psql", DSN, "-tA", "-c", f"SELECT COUNT(*) FROM {table}"],
        text=True,
    )
    return int(out.strip())

def main() -> int:
    ok = 0
    for table in ("crm_re_projects", "crm_re_project_products"):
        try:
            s, p = sqlite_count(table), pg_count(table)
        except Exception as e:
            print(f"{table} skip_or_fail {e}", file=sys.stderr)
            return 1
        print(f"{table} sqlite={s} pg={p}")
        if table == "crm_re_project_products":
            if s > p:
                print("BDS-20 count mismatch", table, file=sys.stderr)
                ok = 1
            elif p > s:
                print(
                    f"{table} note: pg > sqlite (import-only PG rows allowed)",
                    file=sys.stderr,
                )
        elif s != p:
            print("BDS-20 count mismatch", table, file=sys.stderr)
            ok = 1
    return ok

if __name__ == "__main__":
    raise SystemExit(main())
