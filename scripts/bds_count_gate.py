#!/usr/bin/env python3
import os, sqlite3, subprocess, sys

SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")
DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")

def sqlite_count() -> int:
    con = sqlite3.connect(SQLITE)
    n = con.execute("SELECT COUNT(*) FROM crm_re_projects").fetchone()[0]
    con.close()
    return int(n)

def pg_count() -> int:
    out = subprocess.check_output(
        ["psql", DSN, "-tA", "-c", "SELECT COUNT(*) FROM crm_re_projects"],
        text=True,
    )
    return int(out.strip())

def main() -> int:
    s, p = sqlite_count(), pg_count()
    print(f"sqlite={s} pg={p}")
    if s != p:
        print("BDS-20 count mismatch", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
