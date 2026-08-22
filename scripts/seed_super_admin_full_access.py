#!/usr/bin/env python3
"""Seed tài khoản super admin toàn quyền — PostgreSQL only (ops-web / Nest).

Ví dụ VPS:
  export DATABASE_URL=postgresql://ptt:PASSWORD@127.0.0.1:5433/rnosaidb
  python3 scripts/seed_super_admin_full_access.py --apply \\
    --email admin@pttads.vn --password 'YourPass!'
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rbac_permissions_pg import (  # noqa: E402
    PG_SUPER_ADMIN_POSITION_ID,
    build_super_admin_caps,
    require_pg,
)


def hash_pg_password(plain: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(plain.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    return f"scrypt:{base64.b64encode(salt).decode()}:{base64.b64encode(key).decode()}"


def ensure_pg_super_admin_position(cur, *, email: str) -> int:
    cur.execute(
        """
        SELECT position_id FROM staff_users
        WHERE lower(trim(email)) = lower(trim(%s))
        LIMIT 1
        """,
        (email.strip().lower(),),
    )
    row = cur.fetchone()
    if row:
        return int(row[0])
    return PG_SUPER_ADMIN_POSITION_ID


def apply_pg(
    *,
    caps: list[tuple[str, str]],
    email: str,
    display_name: str,
    password: str,
    position_id: int | None = None,
) -> None:
    from ptt_jobs.db import pg_connection

    pwd_hash = hash_pg_password(password)
    with pg_connection() as conn:
        with conn.cursor() as cur:
            resolved_position_id = position_id or ensure_pg_super_admin_position(cur, email=email)
            cur.execute(
                """
                DELETE FROM staff_section_permissions WHERE position_id = %s
                """,
                (resolved_position_id,),
            )
            for section_id, action in caps:
                cur.execute(
                    """
                    INSERT INTO staff_section_permissions (position_id, section_id, action)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (position_id, section_id, action) DO NOTHING
                    """,
                    (resolved_position_id, section_id, action),
                )

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
                (email.strip().lower(), pwd_hash, display_name[:255], resolved_position_id),
            )
            staff_id = cur.fetchone()[0]
        conn.commit()
    print(
        f"  PG staff_users id={staff_id} email={email.strip().lower()} "
        f"position_id={resolved_position_id}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed super admin full access (PostgreSQL only)")
    parser.add_argument("--email", default=os.environ.get("PTT_SUPER_ADMIN_EMAIL", "admin@pttads.vn"))
    parser.add_argument("--display-name", default="Quản trị hệ thống")
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_PASSWORD") or os.environ.get("PTT_SUPER_ADMIN_PASSWORD"),
        help="Mật khẩu (hoặc ADMIN_PASSWORD / PTT_SUPER_ADMIN_PASSWORD)",
    )
    parser.add_argument("--apply", action="store_true", help="Ghi staff_users + caps vào PostgreSQL")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.password or len(str(args.password)) < 8:
        print("Cần mật khẩu ≥8 ký tự: --password hoặc ADMIN_PASSWORD trong .env", file=sys.stderr)
        return 1

    caps = build_super_admin_caps()
    print("=== PTT — Super admin toàn quyền (PostgreSQL only) ===")
    print(f"  Email (ops-web): {args.email}")
    print(f"  Caps: {len(caps)} section/action pairs")

    if args.dry_run or not args.apply:
        print("  (dry-run — không ghi DB; thêm --apply để ghi)")
        for section_id, action in caps[:12]:
            print(f"    {section_id}.{action}")
        print("    …")
        return 0

    require_pg()
    apply_pg(
        caps=caps,
        email=args.email,
        display_name=args.display_name,
        password=str(args.password),
    )

    print("\nĐăng nhập ops-web: https://rs.pttads.vn/login")
    print(f"  Email: {args.email}")
    print("  (Đăng xuất / đăng nhập lại nếu đang mở session cũ)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
