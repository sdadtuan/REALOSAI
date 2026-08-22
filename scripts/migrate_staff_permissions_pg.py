#!/usr/bin/env python3
"""Apply default position grants to PostgreSQL staff_section_permissions (PG-only)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import (  # noqa: E402
    PILOT_POSITION_CODES,
    all_default_position_codes,
    migrate_position_defaults,
    require_pg,
)


def _parse_codes(args: argparse.Namespace) -> list[str]:
    if args.all_defaults:
        return all_default_position_codes()
    if args.all_pilot:
        return list(PILOT_POSITION_CODES)
    if args.position:
        return [args.position.strip()]
    raise SystemExit("Specify --position CODE, --all-pilot, or --all-defaults")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate RBAC default grants to PostgreSQL (SQLite not allowed)"
    )
    parser.add_argument("--position", help="Position code, e.g. MKT-01")
    parser.add_argument("--all-pilot", action="store_true", help="CSKH-01, KD-01, MKT-01")
    parser.add_argument("--all-defaults", action="store_true", help="All _POSITION_DEFAULT codes")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write to PG (default without --apply is dry-run)",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Remove position grants not in code defaults (use with --apply for trim migrations)",
    )
    parser.add_argument(
        "--r2-gdkd",
        action="store_true",
        help="R2-A: map crm_leads.assign → crm_gdkd.assign + SUPER-ADMIN crm_gdkd.*",
    )
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply

    if args.r2_gdkd:
        require_pg()
        print("=== migrate_staff_permissions_pg --r2-gdkd (PostgreSQL only) ===")
        print(f"  mode: {'dry-run' if dry_run else 'apply'}")
        from ptt_jobs.db import pg_connection
        from rbac_permissions_pg import migrate_r2_gdkd

        with pg_connection() as conn:
            with conn.cursor() as cur:
                total = migrate_r2_gdkd(cur, dry_run=dry_run)
            if not dry_run:
                conn.commit()
        print(f"Done — processed {total} cap rows")
        return 0

    codes = _parse_codes(args)

    require_pg()
    print("=== migrate_staff_permissions_pg (PostgreSQL only) ===")
    print(f"  positions: {', '.join(codes)}")
    print(f"  mode: {'dry-run' if dry_run else 'apply'}")

    from ptt_jobs.db import pg_connection
    from rbac_permissions_pg import ensure_super_admin_crm_position

    total = 0
    with pg_connection() as conn:
        with conn.cursor() as cur:
            ensure_super_admin_crm_position(cur, dry_run=dry_run)
            for code in codes:
                if code.upper() == "SUPER-ADMIN":
                    continue
                total += migrate_position_defaults(
                    cur,
                    code,
                    dry_run=dry_run,
                    sync=args.sync,
                )
        if not dry_run:
            conn.commit()

    print(f"Done — processed {total} cap rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
