#!/usr/bin/env python3
"""Ensure SQLite tables for CRM Dự án BĐS (crm_re_projects.*)."""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crm_re_projects import ensure_re_projects_schema  # noqa: E402


def main() -> int:
    db_path = os.environ.get("PTT_SQLITE_PATH", str(ROOT / "ptt.db"))
    conn = sqlite3.connect(db_path)
    try:
        ensure_re_projects_schema(conn)
        conn.commit()
        row = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='crm_re_projects'"
        ).fetchone()
        print(f"OK  {db_path}  crm_re_projects table={'yes' if row and row[0] else 'no'}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
