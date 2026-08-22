#!/usr/bin/env python3
"""Seed granular Meta RBAC caps for B8.1 (Buyer vs Tracking) — PostgreSQL only."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import fetch_position_id, require_pg, upsert_grants  # noqa: E402

RBAC_SEED: dict[str, list[tuple[str, str]]] = {
    "MKT-02": [
        ("crm_facebook_ads", "view"),
        ("crm_facebook_ads", "edit"),
        ("meta_campaign_write", "view"),
        ("crm_board", "edit"),
    ],
    "TECH-01": [
        ("crm_facebook_ads", "view"),
        ("crm_agency", "configure"),
    ],
    "MKT-01": [
        ("crm_facebook_ads", "view"),
        ("crm_facebook_ads", "edit"),
        ("crm_facebook_ads", "configure"),
        ("meta_campaign_write", "view"),
        ("meta_campaign_write", "approve"),
        ("crm_agency", "configure"),
        ("crm_board", "edit"),
    ],
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed B8.1 Meta granular RBAC permissions")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run or not args.apply
    require_pg()

    rows: list[tuple[int, str, str]] = []
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            for code, caps in RBAC_SEED.items():
                pid = fetch_position_id(cur, code)
                if pid is None:
                    print(f"WARN  skip {code} — not in crm_positions", file=sys.stderr)
                    continue
                for section, action in caps:
                    rows.append((pid, section, action))

            if dry_run:
                for pid, section, action in rows:
                    print(f"would upsert position_id={pid} {section}.{action}")
            else:
                for pid, section, action in rows:
                    upsert_grants(cur, pid, [(section, action)], dry_run=False)
                conn.commit()

    print(f"Seeded {len(rows)} B8.1 RBAC permission rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
