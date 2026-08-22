#!/usr/bin/env python3
"""Export PostgreSQL staff_section_permissions → SQL (backup / review)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import require_pg  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Export staff section permissions from PostgreSQL")
    parser.add_argument(
        "--position-id",
        type=int,
        default=0,
        help="Filter by position_id (0 = all)",
    )
    args = parser.parse_args()

    require_pg()
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            if args.position_id:
                cur.execute(
                    """
                    SELECT position_id, section_id, action
                    FROM staff_section_permissions
                    WHERE position_id = %s
                    ORDER BY position_id, section_id, action
                    """,
                    (args.position_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT position_id, section_id, action
                    FROM staff_section_permissions
                    ORDER BY position_id, section_id, action
                    """
                )
            rows = cur.fetchall()

    if not rows:
        print("-- No rows to export", file=sys.stderr)
        return 0

    print("BEGIN;")
    for row in rows:
        pid = int(row[0])
        section = str(row[1]).replace("'", "''")
        action = str(row[2] or "view").replace("'", "''")
        print(
            f"INSERT INTO staff_section_permissions (position_id, section_id, action) "
            f"VALUES ({pid}, '{section}', '{action}') "
            f"ON CONFLICT (position_id, section_id, action) DO NOTHING;"
        )
    print("COMMIT;")
    print(f"-- total rows: {len(rows)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
