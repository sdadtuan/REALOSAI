#!/usr/bin/env python3
"""Apply P3-S2 crm_presales_solution default grants to PostgreSQL (INSERT ON CONFLICT DO NOTHING)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import (  # noqa: E402
    migrate_presales_solution_grants,
    require_pg,
    run_pg_job,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate crm_presales_solution caps to PostgreSQL (SQLite not allowed)"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    print("=== migrate_presales_solution_permissions (PostgreSQL only) ===")
    print(f"  mode: {'dry-run' if dry_run else 'apply'}")

    total = run_pg_job(migrate_presales_solution_grants, dry_run=dry_run)
    print(f"Done — {total} cap rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
