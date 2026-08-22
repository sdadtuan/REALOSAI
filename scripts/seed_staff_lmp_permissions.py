#!/usr/bin/env python3
"""Seed crm_lmp section permissions for sales positions (S-LMP-2)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import fetch_position_id, require_pg, upsert_grants  # noqa: E402

LMP_CAPS: dict[str, list[str]] = {
    "AM-01": ["view", "run", "feedback"],
    "AM-02": ["view", "run"],
    "MKT-01": ["view"],
    "GDKD-01": ["view", "feedback"],
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed staff PG permissions for crm_lmp")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    rows: list[tuple[int, str, str]] = []
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            for code, caps in LMP_CAPS.items():
                pid = fetch_position_id(cur, code)
                if pid is None:
                    print(f"WARN  skip {code} — not in crm_positions", file=sys.stderr)
                    continue
                for action in caps:
                    rows.append((pid, "crm_lmp", action))

            if dry_run:
                for pid, section, action in rows:
                    print(f"would upsert position_id={pid} {section}.{action}")
            else:
                for pid, section, action in rows:
                    upsert_grants(cur, pid, [(section, action)], dry_run=False)
                conn.commit()

    print(f"Seeded {len(rows)} crm_lmp permission rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
