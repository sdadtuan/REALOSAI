#!/usr/bin/env python3
"""Seed crm_b2b_projects caps on PostgreSQL (B2B Lead Project OS P1)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import migrate_b2b_projects_caps, require_pg, run_pg_job  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate crm_b2b_projects caps to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    print("=== migrate_b2b_projects_permissions (PostgreSQL only) ===")
    print(f"  mode: {'dry-run' if dry_run else 'apply'}")

    total = run_pg_job(migrate_b2b_projects_caps, dry_run=dry_run)
    print(f"Done — {total} cap rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
