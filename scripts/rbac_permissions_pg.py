#!/usr/bin/env python3
"""PostgreSQL-only RBAC helpers — no SQLite (policy RBAC-R1 v1.2)."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from admin_page_permissions import (  # noqa: E402
    MKT_POSITION_SEEDS,
    _POSITION_DEFAULT,
    default_grants_for_position,
)
from cms_permissions import CMS_ACTIONS  # noqa: E402
from ptt_ui_button_permissions import CRM_UI_BUTTONS  # noqa: E402

PILOT_POSITION_CODES: tuple[str, ...] = ("CSKH-01", "KD-01", "MKT-01")

POSITION_SEED_META: dict[str, tuple[str, str]] = {
    "CSKH-01": ("Nhân viên CSKH vận hành", "CSKH board + leads vận hành"),
    "KD-01": ("Account Manager B2B Sales", "AM presales handoff"),
    "MKT-01": ("Trưởng phòng Marketing / Solution", "Solution queue + MKT hub"),
    "MKT-02": ("Nhân viên Marketing", "Campaign ops"),
    "VH-01": ("Vận hành / HR", "HR / SOP / payroll"),
    "SUPER-ADMIN": ("Quản trị hệ thống (toàn quyền)", "Full access"),
}

for code, name, desc, _sort in MKT_POSITION_SEEDS:
    POSITION_SEED_META.setdefault(code, (name, desc))

PG_SUPER_ADMIN_POSITION_ID = 1


def require_pg() -> None:
    from ptt_jobs.db import pg_available

    if not pg_available():
        raise SystemExit(
            "DATABASE_URL required — SQLite is not allowed for RBAC migrations/seeds."
        )


def cap_rows_for_position(position_code: str) -> list[tuple[str, str]]:
    grants = default_grants_for_position(position_code)
    rows: list[tuple[str, str]] = []
    for section_id, actions in grants.items():
        for action in actions:
            if action:
                rows.append((section_id, action))
    return rows


def presales_solution_cap_rows(position_code: str) -> list[tuple[str, str]]:
    acts = default_grants_for_position(position_code).get("crm_presales_solution") or []
    return [("crm_presales_solution", act) for act in acts if act]


def all_default_position_codes() -> list[str]:
    return sorted(_POSITION_DEFAULT.keys())


def fetch_position_id(cur, code: str) -> int | None:
    cur.execute(
        """
        SELECT id FROM crm_positions
        WHERE lower(trim(code)) = lower(trim(%s)) AND active = TRUE
        LIMIT 1
        """,
        (code.strip(),),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def ensure_position(cur, code: str) -> int:
    existing = fetch_position_id(cur, code)
    if existing is not None:
        return existing

    meta = POSITION_SEED_META.get(code)
    name = meta[0] if meta else code
    cur.execute(
        """
        INSERT INTO crm_positions (code, name, active)
        VALUES (%s, %s, TRUE)
        RETURNING id
        """,
        (code.strip(), name[:255]),
    )
    return int(cur.fetchone()[0])


def upsert_grants(
    cur,
    position_id: int,
    caps: Iterable[tuple[str, str]],
    *,
    dry_run: bool = False,
) -> int:
    count = 0
    for section_id, action in caps:
        if dry_run:
            print(f"  would upsert position_id={position_id} {section_id}.{action}")
            count += 1
            continue
        cur.execute(
            """
            INSERT INTO staff_section_permissions (position_id, section_id, action)
            VALUES (%s, %s, %s)
            ON CONFLICT (position_id, section_id, action) DO NOTHING
            """,
            (position_id, section_id, action),
        )
        count += 1
    return count


def ensure_super_admin_crm_position(cur, *, dry_run: bool = False) -> int:
    """Reserve crm_positions.id=1 for SUPER-ADMIN before pilot seeds."""
    existing = fetch_position_id(cur, "SUPER-ADMIN")
    if existing == PG_SUPER_ADMIN_POSITION_ID:
        return existing
    if existing is not None and existing != PG_SUPER_ADMIN_POSITION_ID:
        raise SystemExit(
            f"SUPER-ADMIN position_id={existing} != {PG_SUPER_ADMIN_POSITION_ID} — fix crm_positions manually"
        )
    cur.execute(
        """
        SELECT id, code FROM crm_positions WHERE id = %s LIMIT 1
        """,
        (PG_SUPER_ADMIN_POSITION_ID,),
    )
    row = cur.fetchone()
    name = POSITION_SEED_META["SUPER-ADMIN"][0]
    if row:
        if dry_run:
            print(f"  would update crm_positions id=1 → SUPER-ADMIN")
            return PG_SUPER_ADMIN_POSITION_ID
        cur.execute(
            """
            UPDATE crm_positions
            SET code = %s, name = %s, active = TRUE, updated_at = NOW()
            WHERE id = %s
            """,
            ("SUPER-ADMIN", name[:255], PG_SUPER_ADMIN_POSITION_ID),
        )
        return PG_SUPER_ADMIN_POSITION_ID
    if dry_run:
        print("  would insert crm_positions id=1 SUPER-ADMIN")
        return PG_SUPER_ADMIN_POSITION_ID
    cur.execute(
        """
        INSERT INTO crm_positions (id, code, name, active)
        VALUES (%s, %s, %s, TRUE)
        ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            active = TRUE,
            updated_at = NOW()
        RETURNING id
        """,
        (PG_SUPER_ADMIN_POSITION_ID, "SUPER-ADMIN", name[:255]),
    )
    return int(cur.fetchone()[0])


def prune_position_defaults(
    cur,
    position_id: int,
    position_code: str,
    *,
    dry_run: bool = False,
) -> int:
    """Remove position grants not in the code default matrix (idempotent sync)."""
    desired = set(cap_rows_for_position(position_code))
    current = fetch_pg_caps(cur, position_id)
    removed = 0
    for section_id, action in sorted(current - desired):
        if dry_run:
            print(f"  would delete position_id={position_id} {section_id}.{action}")
        else:
            cur.execute(
                """
                DELETE FROM staff_section_permissions
                WHERE position_id = %s AND section_id = %s AND action = %s
                """,
                (position_id, section_id, action),
            )
        removed += 1
    return removed


def migrate_position_defaults(
    cur,
    position_code: str,
    *,
    dry_run: bool = False,
    ensure_exists: bool = True,
    sync: bool = False,
) -> int:
    pid = fetch_position_id(cur, position_code)
    if pid is None:
        if not ensure_exists:
            print(f"WARN  skip {position_code} — not in crm_positions", file=sys.stderr)
            return 0
        if dry_run:
            print(f"  would ensure crm_positions row for {position_code}")
            pid = -1
        else:
            pid = ensure_position(cur, position_code)

    caps = cap_rows_for_position(position_code)
    if not caps:
        print(f"WARN  no default caps for {position_code}", file=sys.stderr)
        return 0

    removed = 0
    if sync and pid != -1:
        removed = prune_position_defaults(cur, pid, position_code, dry_run=dry_run)
        if removed:
            print(f"{'DRY  ' if dry_run else 'OK   '} {position_code} pruned {removed} stale cap(s)")

    print(f"{'DRY  ' if dry_run else 'OK   '} {position_code} position_id={pid} caps={len(caps)}")
    return removed + upsert_grants(cur, pid, caps, dry_run=dry_run)


def migrate_presales_solution_grants(cur, *, dry_run: bool = False) -> int:
    cur.execute(
        """
        SELECT id, code FROM crm_positions
        WHERE active = TRUE
        ORDER BY id
        """
    )
    total = 0
    for row in cur.fetchall():
        pid = int(row[0])
        code = str(row[1] or "")
        caps = presales_solution_cap_rows(code)
        if not caps:
            continue
        print(f"{'DRY  ' if dry_run else 'OK   '} presales {code} position_id={pid} caps={len(caps)}")
        total += upsert_grants(cur, pid, caps, dry_run=dry_run)
    return total


def fetch_pg_caps(cur, position_id: int) -> set[tuple[str, str]]:
    cur.execute(
        """
        SELECT section_id, action
        FROM staff_section_permissions
        WHERE position_id = %s
        """,
        (position_id,),
    )
    return {(str(r[0]), str(r[1])) for r in cur.fetchall()}


def build_super_admin_caps() -> list[tuple[str, str]]:
    """Mirror seed_super_admin_full_access.build_full_caps without importing sqlite."""
    from admin_page_permissions import ADMIN_CRM_SECTIONS

    extra_actions = frozenset(
        {
            "assign",
            "write",
            "settings",
            "compliance",
            "deliverability",
            "reports",
            "run",
        }
    )
    actions = set(CMS_ACTIONS) | set(extra_actions)
    caps: set[tuple[str, str]] = set()

    for sec in ADMIN_CRM_SECTIONS:
        sid = str(sec["id"])
        for act in actions:
            caps.add((sid, act))

    for btn in CRM_UI_BUTTONS:
        caps.add((str(btn["id"]), str(btn["requires_action"])))

    aggregate = (
        ("dashboard", "view"),
        ("crm_board", "view"),
        ("crm_board", "edit"),
        ("crm_board", "create"),
        ("crm_email_mkt", "view"),
        ("crm_email_mkt", "write"),
        ("crm_email_mkt", "settings"),
        ("crm_email_mkt", "compliance"),
        ("crm_email_mkt", "approve"),
        ("crm_email_mkt", "deliverability"),
        ("crm_email_mkt", "reports"),
        ("crm_agency", "view"),
        ("crm_agency", "edit"),
        ("crm_agency", "create"),
        ("crm_agency", "configure"),
        ("crm_agency", "delete"),
        ("crm_agency", "export"),
        ("crm_agency", "approve"),
        ("crm_facebook_ads", "view"),
        ("crm_facebook_ads", "edit"),
        ("crm_facebook_ads", "create"),
        ("crm_facebook_ads", "configure"),
        ("meta_campaign_write", "view"),
        ("meta_campaign_write", "approve"),
        ("crm_facebook_ads", "delete"),
        ("crm_facebook_ads", "export"),
        ("crm_google_ads", "view"),
        ("crm_google_ads", "export"),
        ("crm_leads", "assign"),
    )
    caps.update(aggregate)
    for act in ("override", "assign", "review_queue", "view_all_leads"):
        caps.add(("crm_gdkd", act))
    return sorted(caps)


def sync_super_admin_missing_caps(
    cur,
    *,
    position_id: int = PG_SUPER_ADMIN_POSITION_ID,
    dry_run: bool = False,
) -> tuple[int, int]:
    catalog = set(build_super_admin_caps())
    existing = fetch_pg_caps(cur, position_id)
    missing = sorted(catalog - existing)
    if dry_run:
        for section_id, action in missing[:20]:
            print(f"  would add position_id={position_id} {section_id}.{action}")
        if len(missing) > 20:
            print(f"  … and {len(missing) - 20} more")
        return len(missing), len(existing)

    for section_id, action in missing:
        cur.execute(
            """
            INSERT INTO staff_section_permissions (position_id, section_id, action)
            VALUES (%s, %s, %s)
            ON CONFLICT (position_id, section_id, action) DO NOTHING
            """,
            (position_id, section_id, action),
        )
    return len(missing), len(existing)


GDKD_ACTIONS: tuple[str, ...] = ("override", "assign", "review_queue", "view_all_leads")

B2B_PROJECTS_CAPS: tuple[tuple[str, str], ...] = (
    ("crm_b2b_projects", "view"),
    ("crm_b2b_projects", "manage"),
)


def migrate_b2b_projects_caps(cur, *, dry_run: bool = False) -> int:
    """Seed crm_b2b_projects.view for KD-01; view+manage for SUPER-ADMIN."""
    total = 0
    kd_pid = fetch_position_id(cur, "KD-01")
    if kd_pid is not None:
        total += upsert_grants(cur, kd_pid, [("crm_b2b_projects", "view")], dry_run=dry_run)
        print(f"{'DRY  ' if dry_run else 'OK   '} KD-01 crm_b2b_projects.view")
    super_pid = fetch_position_id(cur, "SUPER-ADMIN") or PG_SUPER_ADMIN_POSITION_ID
    total += upsert_grants(cur, super_pid, list(B2B_PROJECTS_CAPS), dry_run=dry_run)
    print(f"{'DRY  ' if dry_run else 'OK   '} SUPER-ADMIN crm_b2b_projects view+manage")
    return total


def migrate_r2_gdkd(cur, *, dry_run: bool = False) -> int:
    """Map legacy crm_leads.assign → crm_gdkd.assign; seed full crm_gdkd.* for SUPER-ADMIN."""
    cur.execute(
        """
        SELECT DISTINCT position_id
        FROM staff_section_permissions
        WHERE section_id = 'crm_leads' AND action = 'assign'
        """
    )
    position_ids = [int(row[0]) for row in cur.fetchall()]
    total = 0

    for pid in position_ids:
        total += upsert_grants(cur, pid, [("crm_gdkd", "assign")], dry_run=dry_run)

    super_pid = fetch_position_id(cur, "SUPER-ADMIN") or PG_SUPER_ADMIN_POSITION_ID
    total += upsert_grants(
        cur,
        super_pid,
        [("crm_gdkd", act) for act in GDKD_ACTIONS],
        dry_run=dry_run,
    )

    print(
        f"{'DRY  ' if dry_run else 'OK   '} r2-gdkd migrated assign on {len(position_ids)} position(s); super-admin crm_gdkd.*"
    )
    return total


def run_pg_job(fn: Callable[..., int], *, dry_run: bool = False, **kwargs: object) -> int:
    require_pg()
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            result = fn(cur, dry_run=dry_run, **kwargs)
        if not dry_run:
            conn.commit()
    return int(result)
