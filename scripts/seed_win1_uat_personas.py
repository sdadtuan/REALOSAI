#!/usr/bin/env python3
"""Seed WIN-1 UAT personas (VUX-04): MKT-02 + content vs design job functions.

Usage (VPS):
  export DATABASE_URL=postgresql://...
  export WIN1_UAT_PASSWORD='YourPass8+'   # or OPS_E2E_STAFF_PASSWORD
  python3 scripts/seed_win1_uat_personas.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import ensure_position, fetch_position_id, migrate_position_defaults, require_pg  # noqa: E402
from seed_super_admin_full_access import hash_pg_password  # noqa: E402

UAT_PERSONAS = (
    {
        "email": "win1-content@pttads.vn",
        "display_name": "P1 Content UAT",
        "function_code": "content",
    },
    {
        "email": "win1-design@pttads.vn",
        "display_name": "P2 Design UAT",
        "function_code": "design",
    },
)

POSITION_CODE = "MKT-02"


def assign_user_function(cur, *, user_id: str, function_code: str, actor: str) -> None:
    cur.execute(
        "DELETE FROM staff_user_job_functions WHERE user_id = %s::uuid",
        (user_id,),
    )
    cur.execute(
        """
        INSERT INTO staff_user_job_functions (user_id, function_code, assigned_by)
        VALUES (%s::uuid, %s, %s)
        ON CONFLICT (user_id, function_code) DO UPDATE SET
            assigned_by = EXCLUDED.assigned_by,
            assigned_at = NOW()
        """,
        (user_id, function_code, actor),
    )
    cur.execute(
        """
        UPDATE crm_staff
        SET job_function_primary = %s, updated_at = NOW()
        WHERE lower(trim(email)) = lower(trim(
            (SELECT email FROM staff_users WHERE id = %s::uuid)
        ))
        """,
        (function_code, user_id),
    )


def upsert_persona(cur, *, email: str, display_name: str, password: str, position_id: int) -> str:
    pwd_hash = hash_pg_password(password)
    cur.execute(
        """
        INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
        VALUES (%s, %s, %s, %s, TRUE)
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            display_name = EXCLUDED.display_name,
            position_id = EXCLUDED.position_id,
            active = TRUE,
            updated_at = NOW()
        RETURNING id::text
        """,
        (email.strip().lower(), pwd_hash, display_name[:255], position_id),
    )
    return str(cur.fetchone()[0])


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed WIN-1 UAT personas (content vs design)")
    parser.add_argument("--apply", action="store_true", help="Write to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--password",
        default=os.environ.get("WIN1_UAT_PASSWORD")
        or os.environ.get("OPS_E2E_STAFF_PASSWORD")
        or os.environ.get("ADMIN_PASSWORD"),
        help="Shared test password (≥8 chars)",
    )
    args = parser.parse_args()

    if not args.password or len(str(args.password)) < 8:
        print("Cần mật khẩu ≥8 ký tự: WIN1_UAT_PASSWORD / OPS_E2E_STAFF_PASSWORD / ADMIN_PASSWORD", file=sys.stderr)
        return 1

    dry_run = args.dry_run or not args.apply
    print("=== WIN-1 UAT personas (VUX-04) ===")
    print(f"  Position: {POSITION_CODE}")
    print(f"  Password: (from env, len={len(str(args.password))})")
    for p in UAT_PERSONAS:
        print(f"  - {p['email']} → function `{p['function_code']}`")

    if dry_run:
        print("  (dry-run — thêm --apply để ghi DB)")
        return 0

    require_pg()
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            migrate_position_defaults(cur, POSITION_CODE, dry_run=False, ensure_exists=True)
            position_id = fetch_position_id(cur, POSITION_CODE)
            if position_id is None:
                position_id = ensure_position(cur, POSITION_CODE)
            for persona in UAT_PERSONAS:
                user_id = upsert_persona(
                    cur,
                    email=persona["email"],
                    display_name=persona["display_name"],
                    password=str(args.password),
                    position_id=int(position_id),
                )
                assign_user_function(
                    cur,
                    user_id=user_id,
                    function_code=persona["function_code"],
                    actor="seed_win1_uat_personas",
                )
                print(
                    f"  OK {persona['email']} id={user_id} "
                    f"position_id={position_id} function={persona['function_code']}"
                )
        conn.commit()

    print("")
    print("Login UAT:")
    for p in UAT_PERSONAS:
        print(f"  {p['email']} / (WIN1_UAT_PASSWORD)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
