#!/usr/bin/env python3
"""Diff catalog vs PG super-admin caps; apply missing rows (PG-only, non-destructive)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import (  # noqa: E402
    PG_SUPER_ADMIN_POSITION_ID,
    require_pg,
    run_pg_job,
    sync_super_admin_missing_caps,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync SUPER-ADMIN caps to PostgreSQL")
    parser.add_argument(
        "--position-id",
        type=int,
        default=PG_SUPER_ADMIN_POSITION_ID,
        help="staff_section_permissions.position_id (default 1)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    print("=== sync_super_admin_caps_pg (PostgreSQL only) ===")
    print(f"  position_id: {args.position_id}")
    print(f"  mode: {'dry-run' if dry_run else 'apply'}")

    def _job(cur, *, dry_run: bool = False, **_: object) -> int:
        added, existing = sync_super_admin_missing_caps(
            cur,
            position_id=args.position_id,
            dry_run=dry_run,
        )
        print(f"  catalog missing: {added}; existing caps: {existing}")
        return added

    run_pg_job(_job, dry_run=dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
