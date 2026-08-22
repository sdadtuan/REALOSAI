"""Pre-sales trên Lead — Lead/Consult/Proposal trước khi có KH + Lifecycle."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

PRESALES_STAGES: tuple[str, ...] = ("lead", "consult", "proposal")
PRESALES_STATUSES: tuple[str, ...] = ("active", "converted", "cancelled")

ENV_PRESALES_ON_LEAD = "PTT_PRESALES_ON_LEAD"


class PresalesAdvanceError(ValueError):
    """Không thể chuyển giai đoạn pre-sales."""


class PresalesPromoteError(ValueError):
    """Không thể promote pre-sales sang lifecycle."""


def _ts() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def presales_on_lead_enabled() -> bool:
    raw = (os.getenv(ENV_PRESALES_ON_LEAD) or "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def presales_stage_index(stage: str) -> int:
    key = str(stage or "").strip()
    try:
        return PRESALES_STAGES.index(key)
    except ValueError:
        return 0


def next_presales_stage(stage: str) -> str | None:
    idx = presales_stage_index(stage)
    if idx < 0 or idx >= len(PRESALES_STAGES) - 1:
        return None
    return PRESALES_STAGES[idx + 1]


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_lead_presales (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id          INTEGER NOT NULL UNIQUE REFERENCES crm_leads(id) ON DELETE CASCADE,
            service_slug     TEXT NOT NULL DEFAULT '',
            stage            TEXT NOT NULL DEFAULT 'lead',
            status           TEXT NOT NULL DEFAULT 'active',
            assigned_am      INTEGER REFERENCES crm_staff(id) ON DELETE SET NULL,
            lifecycle_id     INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
            stage_entered_at TEXT NOT NULL DEFAULT '',
            notes            TEXT NOT NULL DEFAULT '',
            created_at       TEXT NOT NULL DEFAULT '',
            updated_at       TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_lead_presales_tasks (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            presales_id   INTEGER NOT NULL REFERENCES crm_lead_presales(id) ON DELETE CASCADE,
            stage         TEXT NOT NULL DEFAULT '',
            step_index    INTEGER NOT NULL DEFAULT 0,
            title         TEXT NOT NULL DEFAULT '',
            description   TEXT NOT NULL DEFAULT '',
            form_fields   TEXT NOT NULL DEFAULT '[]',
            form_data     TEXT NOT NULL DEFAULT '{}',
            ai_output     TEXT NOT NULL DEFAULT '',
            ai_prompt_key TEXT NOT NULL DEFAULT '',
            is_done       INTEGER NOT NULL DEFAULT 0,
            done_at       TEXT NOT NULL DEFAULT '',
            done_by       INTEGER REFERENCES crm_staff(id) ON DELETE SET NULL,
            notes         TEXT NOT NULL DEFAULT '',
            is_custom     INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL DEFAULT '',
            updated_at    TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_lead_presales_lead ON crm_lead_presales(lead_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_lead_presales_tasks "
        "ON crm_lead_presales_tasks(presales_id, stage)"
    )
    from crm_lead_presales_contract import ensure_contract_schema

    ensure_contract_schema(conn)
    _ps_cols = {r[1] for r in conn.execute("PRAGMA table_info(crm_lead_presales)")}
    if "draft_marketing_plan_id" not in _ps_cols:
        try:
            conn.execute(
                "ALTER TABLE crm_lead_presales ADD COLUMN draft_marketing_plan_id INTEGER"
            )
        except sqlite3.Error:
            pass
    if "l2_docs_json" not in _ps_cols:
        try:
            conn.execute(
                "ALTER TABLE crm_lead_presales ADD COLUMN l2_docs_json TEXT NOT NULL DEFAULT '{}'"
            )
        except sqlite3.Error:
            pass
    if "consult_entered_at" not in _ps_cols:
        try:
            conn.execute(
                "ALTER TABLE crm_lead_presales ADD COLUMN consult_entered_at TEXT NOT NULL DEFAULT ''"
            )
        except sqlite3.Error:
            pass
    if "proposal_entered_at" not in _ps_cols:
        try:
            conn.execute(
                "ALTER TABLE crm_lead_presales ADD COLUMN proposal_entered_at TEXT NOT NULL DEFAULT ''"
            )
        except sqlite3.Error:
            pass
    handoff_cols = {
        "handoff_status": "TEXT NOT NULL DEFAULT ''",
        "handed_off_at": "TEXT NOT NULL DEFAULT ''",
        "handed_off_by_staff_id": "INTEGER",
        "solution_owner_staff_id": "INTEGER",
        "solution_claimed_at": "TEXT NOT NULL DEFAULT ''",
        "solution_released_at": "TEXT NOT NULL DEFAULT ''",
    }
    for col, ddl in handoff_cols.items():
        if col not in _ps_cols:
            try:
                conn.execute(f"ALTER TABLE crm_lead_presales ADD COLUMN {col} {ddl}")
            except sqlite3.Error:
                pass
    conn.execute(
        """
        UPDATE crm_lead_presales
        SET handoff_status = 'with_solution',
            handed_off_at = CASE
              WHEN handed_off_at = '' OR handed_off_at IS NULL
              THEN COALESCE(NULLIF(consult_entered_at, ''), NULLIF(stage_entered_at, ''), datetime('now'))
              ELSE handed_off_at
            END
        WHERE stage = 'consult'
          AND status = 'active'
          AND (handoff_status = '' OR handoff_status IS NULL)
        """
    )
    conn.execute(
        """
        UPDATE crm_lead_presales
        SET consult_entered_at = stage_entered_at
        WHERE stage = 'consult'
          AND (consult_entered_at = '' OR consult_entered_at IS NULL)
          AND stage_entered_at != ''
        """
    )


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def get_by_lead(conn: sqlite3.Connection, lead_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM crm_lead_presales WHERE lead_id = ?", (int(lead_id),)
    ).fetchone()
    return _row_to_dict(row)


def get_presales(conn: sqlite3.Connection, presales_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT * FROM crm_lead_presales WHERE id = ?", (int(presales_id),)
    ).fetchone()
    return _row_to_dict(row)


def _lead_owner_staff_id(conn: sqlite3.Connection, lead_id: int) -> int | None:
    row = conn.execute(
        "SELECT owner_id FROM crm_leads WHERE id = ?", (int(lead_id),)
    ).fetchone()
    if row is None or row["owner_id"] is None:
        return None
    return int(row["owner_id"])


def require_presales_care_gate(conn: sqlite3.Connection, lead_id: int) -> None:
    """Chặn thao tác pre-sales khi chưa hoàn thành chăm sóc B2."""
    from crm_lead_care_pipeline import assert_presales_care_gate

    assert_presales_care_gate(conn, int(lead_id))


def ensure_presales(
    conn: sqlite3.Connection,
    lead_id: int,
    service_slug: str,
    *,
    suggested_by: str = "human",
) -> dict[str, Any]:
    """Lấy hoặc tạo pre-sales active cho lead. Trả về row dict."""
    slug = str(service_slug or "").strip()
    if slug:
        from crm_lead_catalog import validate_service_slug

        slug = validate_service_slug(conn, slug)

    existing = get_by_lead(conn, int(lead_id))
    if not existing:
        from crm_lead_care_pipeline import assert_presales_care_gate

        assert_presales_care_gate(conn, int(lead_id))
    if existing:
        if existing["status"] == "converted" and existing.get("lifecycle_id"):
            return existing
        if slug and str(existing.get("service_slug") or "") != slug:
            ts = _ts()
            conn.execute(
                """
                UPDATE crm_lead_presales
                SET service_slug = ?, updated_at = ?
                WHERE id = ?
                """,
                (slug, ts, int(existing["id"])),
            )
            conn.commit()
            existing = get_presales(conn, int(existing["id"]))
        assert existing is not None
        seed_presales_tasks(conn, int(existing["id"]), str(existing["service_slug"] or slug))
        return existing

    if not slug:
        raise ValueError("Cần service_slug để tạo pre-sales")

    lead_row = conn.execute(
        "SELECT id FROM crm_leads WHERE id = ?", (int(lead_id),)
    ).fetchone()
    if lead_row is None:
        raise ValueError("Không tìm thấy lead")

    ts = _ts()
    owner_id = _lead_owner_staff_id(conn, int(lead_id))
    cur = conn.execute(
        """
        INSERT INTO crm_lead_presales
            (lead_id, service_slug, stage, status, assigned_am,
             stage_entered_at, notes, created_at, updated_at)
        VALUES (?, ?, 'lead', 'active', ?, ?, ?, ?, ?)
        """,
        (
            int(lead_id),
            slug,
            owner_id,
            ts,
            f"Pre-sales tạo bởi {suggested_by}"[:4000],
            ts,
            ts,
        ),
    )
    presales_id = int(cur.lastrowid)
    seed_presales_tasks(conn, presales_id, slug)
    row = get_presales(conn, presales_id)
    assert row is not None
    return row


def _insert_presales_task(
    conn: sqlite3.Connection,
    *,
    presales_id: int,
    stage: str,
    step_index: int,
    step: dict[str, Any],
    ts: str,
) -> None:
    conn.execute(
        """
        INSERT INTO crm_lead_presales_tasks
            (presales_id, stage, step_index, title, description,
             ai_prompt_key, form_fields, form_data, is_done, is_custom,
             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 0, 0, ?, ?)
        """,
        (
            presales_id,
            stage,
            step_index,
            step["title"],
            step.get("description", ""),
            step.get("ai_prompt_key", ""),
            json.dumps(step.get("form_fields", []), ensure_ascii=False),
            ts,
            ts,
        ),
    )


def seed_presales_tasks(
    conn: sqlite3.Connection, presales_id: int, service_slug: str
) -> int:
    """Seed task Lead/Consult/Proposal từ crm_svc_workflow_steps."""
    from crm_svc_workflow_steps import SERVICE_WORKFLOW_STEPS

    existing = conn.execute(
        """
        SELECT COUNT(*) FROM crm_lead_presales_tasks
        WHERE presales_id = ? AND is_custom = 0
        """,
        (presales_id,),
    ).fetchone()[0]
    if int(existing or 0) > 0:
        return 0

    steps = SERVICE_WORKFLOW_STEPS.get(service_slug, {})
    ts = _ts()
    count = 0
    for stage in PRESALES_STAGES:
        for idx, step in enumerate(steps.get(stage) or []):
            _insert_presales_task(
                conn,
                presales_id=presales_id,
                stage=stage,
                step_index=idx,
                step=step,
                ts=ts,
            )
            count += 1
    conn.commit()
    return count


LEGACY_PRESALES_FIELD_MAP: dict[str, str] = {
    "need_summary": "need",
    "consult_notes": "current_status",
    "proposal_notes": "goal",
}


def _merge_legacy_form_data(
    old_tasks: list[dict[str, Any]], new_field_keys: list[str]
) -> tuple[dict[str, Any], bool]:
    merged: dict[str, Any] = {}
    any_done = False
    for task in old_tasks:
        if task.get("is_done"):
            any_done = True
        fd = task.get("form_data") or {}
        for key, value in fd.items():
            if value is None or str(value).strip() == "":
                continue
            target = LEGACY_PRESALES_FIELD_MAP.get(str(key), str(key))
            if target in new_field_keys and target not in merged:
                merged[target] = value
    return merged, any_done


def upgrade_presales_tasks_from_template(
    conn: sqlite3.Connection,
    presales_id: int,
    *,
    stages: tuple[str, ...] | None = None,
    dry_run: bool = False,
    prefill_consult: bool = True,
) -> dict[str, Any]:
    """Replace non-custom presales tasks with service template (pilot migration E6)."""
    from crm_svc_workflow_steps import SERVICE_WORKFLOW_STEPS

    ps = get_presales(conn, presales_id)
    if ps is None:
        raise ValueError("Không tìm thấy pre-sales")
    if ps.get("status") != "active":
        raise ValueError("Pre-sales không còn active")

    slug = str(ps.get("service_slug") or "").strip()
    steps = SERVICE_WORKFLOW_STEPS.get(slug, {})
    target_stages = stages or PRESALES_STAGES
    stage_results: list[dict[str, Any]] = []

    for stage in target_stages:
        rows = conn.execute(
            """
            SELECT id, form_data, is_done FROM crm_lead_presales_tasks
            WHERE presales_id = ? AND stage = ? AND is_custom = 0
            ORDER BY step_index, id
            """,
            (presales_id, stage),
        ).fetchall()
        old_tasks: list[dict[str, Any]] = []
        for row in rows:
            old_tasks.append(
                {
                    "id": int(row["id"]),
                    "form_data": json.loads(row["form_data"] or "{}"),
                    "is_done": bool(row["is_done"]),
                }
            )
        stage_steps = steps.get(stage) or []
        new_keys = [
            str(f.get("key") or "")
            for step in stage_steps
            for f in (step.get("form_fields") or [])
        ]
        form_data, is_done = _merge_legacy_form_data(old_tasks, new_keys)

        if not dry_run:
            conn.execute(
                """
                DELETE FROM crm_lead_presales_tasks
                WHERE presales_id = ? AND stage = ? AND is_custom = 0
                """,
                (presales_id, stage),
            )
            ts = _ts()
            inserted = 0
            for idx, step in enumerate(stage_steps):
                conn.execute(
                    """
                    INSERT INTO crm_lead_presales_tasks
                        (presales_id, stage, step_index, title, description,
                         ai_prompt_key, form_fields, form_data, is_done, is_custom,
                         created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                    """,
                    (
                        presales_id,
                        stage,
                        idx,
                        step["title"],
                        step.get("description", ""),
                        step.get("ai_prompt_key", ""),
                        json.dumps(step.get("form_fields", []), ensure_ascii=False),
                        json.dumps(form_data, ensure_ascii=False),
                        1 if is_done else 0,
                        ts,
                        ts,
                    ),
                )
                inserted += 1
            conn.commit()
        else:
            inserted = len(stage_steps)

        stage_results.append(
            {
                "stage": stage,
                "deleted": len(old_tasks),
                "inserted": inserted,
                "preserved_done": is_done,
                "mapped_fields": list(form_data.keys()),
            }
        )

    prefill: dict[str, Any] | None = None
    if not dry_run and prefill_consult and "consult" in target_stages:
        lead_id = int(ps["lead_id"])
        from crm_lead_presales_bridge import prefill_presales_consult_task

        prefill = prefill_presales_consult_task(conn, lead_id, overwrite=False)

    return {
        "ok": True,
        "dry_run": dry_run,
        "service_slug": slug,
        "stages": stage_results,
        "prefill": prefill,
    }


PRESALES_UPGRADE_CONSULT_FIELD_MIN = 4
PRESALES_BATCH_UPGRADE_MAX = 50


def upgrade_presales_workflow_template(
    conn: sqlite3.Connection,
    presales_id: int,
    *,
    stages: tuple[str, ...] | None = None,
    dry_run: bool = False,
    prefill_consult: bool = True,
) -> dict[str, Any]:
    """Nest parity alias for single presales template upgrade."""
    return upgrade_presales_tasks_from_template(
        conn,
        presales_id,
        stages=stages,
        dry_run=dry_run,
        prefill_consult=prefill_consult,
    )


def list_presales_workflow_upgrade_cohort(
    conn: sqlite3.Connection,
    *,
    lead_ids: list[int] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Active presales with generic consult form (<4 fields)."""
    row_limit = min(
        PRESALES_BATCH_UPGRADE_MAX,
        limit if limit and limit > 0 else PRESALES_BATCH_UPGRADE_MAX,
    )
    params: list[Any] = [PRESALES_UPGRADE_CONSULT_FIELD_MIN]
    lead_filter = ""
    if lead_ids:
        ids = list(dict.fromkeys(int(i) for i in lead_ids if int(i) > 0))[:row_limit]
        if not ids:
            return []
        placeholders = ",".join("?" for _ in ids)
        lead_filter = f" AND ps.lead_id IN ({placeholders})"
        params.extend(ids)
    params.append(row_limit)

    rows = conn.execute(
        f"""
        SELECT ps.lead_id, ps.id AS presales_id, ps.service_slug, ps.stage,
               (
                 SELECT t.form_fields FROM crm_lead_presales_tasks t
                 WHERE t.presales_id = ps.id AND t.stage = 'consult' AND t.is_custom = 0
                 ORDER BY t.step_index, t.id LIMIT 1
               ) AS consult_form_fields
        FROM crm_lead_presales ps
        WHERE ps.status = 'active'
          AND ps.stage IN ('lead', 'consult', 'proposal')
          AND EXISTS (
            SELECT 1 FROM crm_lead_presales_tasks t
            WHERE t.presales_id = ps.id
              AND t.stage = 'consult'
              AND t.is_custom = 0
              AND (
                SELECT COUNT(*) FROM json_each(COALESCE(t.form_fields, '[]'))
              ) < ?
          )
          {lead_filter}
        ORDER BY ps.updated_at DESC
        LIMIT ?
        """,
        params,
    ).fetchall()

    out: list[dict[str, Any]] = []
    for row in rows:
        keys: list[str] = []
        try:
            fields = json.loads(str(row["consult_form_fields"] or "[]"))
            keys = sorted(str(f.get("key") or "") for f in fields if f.get("key"))
        except (TypeError, json.JSONDecodeError):
            keys = []
        out.append(
            {
                "lead_id": int(row["lead_id"]),
                "presales_id": int(row["presales_id"]),
                "service_slug": str(row["service_slug"] or ""),
                "stage": str(row["stage"] or ""),
                "consult_field_keys": keys,
            }
        )
    return out


def batch_upgrade_presales_workflow_template(
    conn: sqlite3.Connection,
    *,
    dry_run: bool = False,
    prefill_consult: bool = True,
    stages: tuple[str, ...] | None = None,
    lead_ids: list[int] | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Batch migrate generic presales tasks → service template (max 50/run)."""
    cohort = list_presales_workflow_upgrade_cohort(conn, lead_ids=lead_ids, limit=limit)
    csv_rows = [
        "lead_id,service_slug,old_field_keys",
        *[
            f"{row['lead_id']},{row['service_slug']},{'|'.join(row['consult_field_keys'])}"
            for row in cohort
        ],
    ]
    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "cohort_size": len(cohort),
            "processed": len(cohort),
            "upgraded": 0,
            "skipped": 0,
            "results": [
                {"lead_id": row["lead_id"], "ok": True, "service_slug": row["service_slug"]}
                for row in cohort
            ],
            "csv_rows": csv_rows,
        }

    results: list[dict[str, Any]] = []
    upgraded = 0
    skipped = 0
    for row in cohort:
        try:
            out = upgrade_presales_workflow_template(
                conn,
                int(row["presales_id"]),
                stages=stages,
                dry_run=False,
                prefill_consult=prefill_consult,
            )
            upgraded += 1
            results.append(
                {
                    "lead_id": row["lead_id"],
                    "ok": True,
                    "service_slug": out.get("service_slug"),
                    "stages": out.get("stages"),
                }
            )
        except ValueError as exc:
            skipped += 1
            results.append(
                {"lead_id": row["lead_id"], "ok": False, "error": str(exc)}
            )

    return {
        "ok": skipped == 0,
        "dry_run": False,
        "cohort_size": len(cohort),
        "processed": len(cohort),
        "upgraded": upgraded,
        "skipped": skipped,
        "results": results,
        "csv_rows": csv_rows,
    }


def is_presales_stage_complete(
    conn: sqlite3.Connection, presales_id: int, stage: str
) -> bool:
    row = conn.execute(
        """
        SELECT COUNT(*) AS total, COALESCE(SUM(is_done), 0) AS done
        FROM crm_lead_presales_tasks
        WHERE presales_id = ? AND stage = ?
        """,
        (presales_id, stage),
    ).fetchone()
    total = int(row["total"] or 0)
    if total == 0:
        return True
    return int(row["done"] or 0) >= total


def list_presales_tasks(
    conn: sqlite3.Connection, presales_id: int
) -> dict[str, list[dict[str, Any]]]:
    rows = conn.execute(
        """
        SELECT * FROM crm_lead_presales_tasks
        WHERE presales_id = ?
        ORDER BY stage, step_index, id
        """,
        (presales_id,),
    ).fetchall()
    result: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        d = dict(row)
        d["form_data"] = json.loads(d.get("form_data") or "{}")
        d["form_fields"] = json.loads(d.get("form_fields") or "[]")
        result.setdefault(str(d["stage"]), []).append(d)
    return result


def get_presales_progress(
    conn: sqlite3.Connection, presales_id: int
) -> dict[str, dict[str, int]]:
    rows = conn.execute(
        """
        SELECT stage,
               COUNT(*) AS total,
               COALESCE(SUM(is_done), 0) AS done
        FROM crm_lead_presales_tasks
        WHERE presales_id = ?
        GROUP BY stage
        """,
        (presales_id,),
    ).fetchall()
    out: dict[str, dict[str, int]] = {}
    for row in rows:
        out[str(row["stage"])] = {
            "total": int(row["total"] or 0),
            "done": int(row["done"] or 0),
        }
    return out


def get_presales_advance_info(
    conn: sqlite3.Connection, presales_id: int
) -> dict[str, Any]:
    ps = get_presales(conn, presales_id)
    if ps is None:
        return {}
    current = str(ps.get("stage") or "lead")
    nxt = next_presales_stage(current)
    complete = is_presales_stage_complete(conn, presales_id, current)
    prog = get_presales_progress(conn, presales_id).get(current, {})
    block_reason = ""
    can_forward = False
    if ps.get("status") != "active":
        block_reason = "Pre-sales đã đóng hoặc đã chuyển lifecycle."
    elif nxt is None:
        block_reason = "Đã ở giai đoạn Proposal — chờ ký HĐ để tạo Lifecycle."
    elif not complete:
        block_reason = "Hoàn thành tất cả task giai đoạn hiện tại trước khi chuyển bước."
    elif nxt == "proposal" and current == "consult":
        try:
            from crm_lead_presales_marketing_plan import validate_presales_proposal_advance

            mp_gate = validate_presales_proposal_advance(conn, presales_id)
            if not mp_gate.get("ok"):
                block_reason = (mp_gate.get("messages") or ["KH MKT sơ bộ chưa đủ"])[0]
            else:
                can_forward = True
        except Exception as exc:
            block_reason = str(exc) or "Không kiểm tra được KH MKT sơ bộ."
    else:
        can_forward = True
    return {
        "current_stage": current,
        "next_stage": nxt,
        "can_advance_forward": can_forward,
        "block_reason": block_reason,
        "current_complete": complete,
        "current_done": prog.get("done", 0),
        "current_total": prog.get("total", 0),
        "status": ps.get("status"),
    }


def update_presales_task(
    conn: sqlite3.Connection,
    task_id: int,
    *,
    is_done: bool | None = None,
    notes: str | None = None,
    form_data: dict | None = None,
    done_by: int | None = None,
) -> None:
    if is_done is True:
        row = conn.execute(
            """
            SELECT t.stage, t.presales_id, p.service_slug, p.l2_docs_json,
                   t.form_fields, t.form_data, t.ai_prompt_key, t.ai_output
            FROM crm_lead_presales_tasks t
            JOIN crm_lead_presales p ON p.id = t.presales_id
            WHERE t.id = ?
            """,
            (int(task_id),),
        ).fetchone()
        if row is not None and str(row[0] or "") == "consult":
            from crm_lead_presales_l2 import assert_presales_l2_docs_complete, parse_presales_l2_docs_json

            slug = str(row[2] or "")
            try:
                stored = json.loads(str(row[3] or "{}"))
            except json.JSONDecodeError:
                stored = {}
            assert_presales_l2_docs_complete(slug, parse_presales_l2_docs_json(stored))

            try:
                fields = json.loads(str(row[4] or "[]"))
            except json.JSONDecodeError:
                fields = []
            try:
                merged_form = json.loads(str(row[5] or "{}"))
            except json.JSONDecodeError:
                merged_form = {}
            if form_data is not None:
                merged_form = {**merged_form, **form_data}
            from crm_lead_presales_consult_gate import assert_presales_consult_task_done

            assert_presales_consult_task_done(
                stage=str(row[0] or ""),
                ai_prompt_key=str(row[6] or ""),
                ai_output=str(row[7] or ""),
                form_fields=fields if isinstance(fields, list) else [],
                form_data=merged_form if isinstance(merged_form, dict) else {},
            )
    ts = _ts()
    sets = ["updated_at = ?"]
    params: list[Any] = [ts]
    if is_done is not None:
        sets.append("is_done = ?")
        params.append(1 if is_done else 0)
        if is_done:
            sets.append("done_at = ?")
            params.append(ts)
        else:
            sets.append("done_at = ''")
    if notes is not None:
        sets.append("notes = ?")
        params.append(notes[:4000])
    if form_data is not None:
        sets.append("form_data = ?")
        params.append(json.dumps(form_data, ensure_ascii=False))
    if done_by is not None:
        sets.append("done_by = ?")
        params.append(done_by)
    params.append(task_id)
    conn.execute(
        f"UPDATE crm_lead_presales_tasks SET {', '.join(sets)} WHERE id = ?",
        params,
    )
    conn.commit()


def advance_presales_stage(
    conn: sqlite3.Connection,
    presales_id: int,
    to_stage: str,
    *,
    notes: str = "",
    override_reason: str = "",
    allow_override: bool = False,
    confirm: bool = False,
) -> None:
    ps = get_presales(conn, presales_id)
    if ps is None:
        raise PresalesAdvanceError("Không tìm thấy pre-sales")
    if ps.get("status") != "active":
        raise PresalesAdvanceError("Pre-sales không còn active")

    if to_stage not in PRESALES_STAGES:
        raise PresalesAdvanceError(f"Stage không hợp lệ: {to_stage}")

    from_stage = str(ps.get("stage") or "lead")
    from_idx = presales_stage_index(from_stage)
    to_idx = presales_stage_index(to_stage)
    if to_idx == from_idx:
        return
    if to_idx < from_idx:
        ts = _ts()
        conn.execute(
            """
            UPDATE crm_lead_presales
            SET stage = ?, stage_entered_at = ?, updated_at = ?,
                notes = CASE WHEN ? != '' THEN TRIM(notes || char(10) || ?) ELSE notes END
            WHERE id = ?
            """,
            (to_stage, ts, ts, notes[:2000], notes[:2000], presales_id),
        )
        conn.commit()
        return
    if to_idx != from_idx + 1:
        raise PresalesAdvanceError(
            "Chỉ được chuyển sang bước kế tiếp trong pre-sales."
        )
    if not is_presales_stage_complete(conn, presales_id, from_stage):
        raise PresalesAdvanceError(
            "Hoàn thành tất cả task của giai đoạn hiện tại trước khi chuyển bước."
        )

    if to_stage == "consult" and from_stage == "lead":
        from crm_lead_presales_bridge import validate_presales_consult_advance

        gate = validate_presales_consult_advance(
            conn,
            presales_id,
            override_reason=override_reason,
            allow_override=allow_override,
        )
        if not gate.get("ok"):
            raise PresalesAdvanceError(
                (gate.get("messages") or ["Không thể chuyển Consult"])[0]
            )
        if gate.get("requires_confirm") and not confirm:
            raise PresalesAdvanceError(
                (gate.get("messages") or ["Cần xác nhận"])[0]
            )
        if override_reason:
            notes = f"{notes}\nDirector override: {override_reason}".strip()[:2000]

    if to_stage == "proposal" and from_stage == "consult":
        from crm_lead_presales_marketing_plan import validate_presales_proposal_advance

        mp_gate = validate_presales_proposal_advance(conn, presales_id)
        if not mp_gate.get("ok"):
            raise PresalesAdvanceError(
                (mp_gate.get("messages") or ["KH MKT sơ bộ chưa đủ"])[0]
            )

    ts = _ts()
    note_line = notes.strip()
    extra_sets: list[str] = []
    extra_params: list[Any] = []
    if to_stage == "consult":
        extra_sets.append(
            "consult_entered_at = CASE WHEN consult_entered_at = '' OR consult_entered_at IS NULL "
            "THEN ? ELSE consult_entered_at END"
        )
        extra_params.append(ts)
    if to_stage == "proposal":
        extra_sets.append("proposal_entered_at = ?")
        extra_params.append(ts)
        consult_at = str(ps.get("consult_entered_at") or "").strip()
        if not consult_at:
            fallback = str(ps.get("stage_entered_at") or ts).strip() or ts
            extra_sets.append("consult_entered_at = ?")
            extra_params.append(fallback)
    set_sql = f", {', '.join(extra_sets)}" if extra_sets else ""
    conn.execute(
        f"""
        UPDATE crm_lead_presales
        SET stage = ?, stage_entered_at = ?, updated_at = ?{set_sql},
            notes = CASE WHEN ? != '' THEN TRIM(notes || char(10) || ?) ELSE notes END
        WHERE id = ?
        """,
        (to_stage, ts, ts, *extra_params, note_line, note_line[:2000], presales_id),
    )
    conn.commit()

    if to_stage == "consult" and from_stage == "lead":
        lead_id = int(ps.get("lead_id") or 0)
        if lead_id:
            from crm_lead_presales_bridge import prefill_presales_consult_task

            prefill_presales_consult_task(conn, lead_id, overwrite=False)


def _copy_task_to_lifecycle(
    conn: sqlite3.Connection,
    lifecycle_id: int,
    src: dict[str, Any],
    ts: str,
) -> None:
    conn.execute(
        """
        INSERT INTO crm_svc_tasks
            (lifecycle_id, stage, step_index, title, description,
             ai_prompt_key, form_fields, form_data, ai_output,
             is_done, done_at, done_by, notes, is_custom, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            lifecycle_id,
            src["stage"],
            int(src.get("step_index") or 0),
            src.get("title") or "",
            src.get("description") or "",
            src.get("ai_prompt_key") or "",
            src.get("form_fields") if isinstance(src.get("form_fields"), str)
            else json.dumps(src.get("form_fields") or [], ensure_ascii=False),
            src.get("form_data") if isinstance(src.get("form_data"), str)
            else json.dumps(src.get("form_data") or {}, ensure_ascii=False),
            src.get("ai_output") or "",
            int(src.get("is_done") or 0),
            src.get("done_at") or "",
            src.get("done_by"),
            src.get("notes") or "",
            int(src.get("is_custom") or 0),
            ts,
            ts,
        ),
    )


def promote_presales_to_lifecycle(
    conn: sqlite3.Connection,
    presales_id: int,
    *,
    customer_id: int,
    contract_id: int,
    actor: str = "system",
) -> int:
    """
    Sau ký HĐ: copy pre-sales → lifecycle active @ onboard.
    Lead/Consult/Proposal tasks giữ trạng thái is_done từ pre-sales.
    """
    ps = get_presales(conn, presales_id)
    if ps is None:
        raise PresalesPromoteError("Không tìm thấy pre-sales")
    if ps.get("status") == "converted" and ps.get("lifecycle_id"):
        return int(ps["lifecycle_id"])
    if ps.get("status") != "active":
        raise PresalesPromoteError(f"Pre-sales status={ps.get('status')} — không promote được")

    lead_id = int(ps["lead_id"])
    service_slug = str(ps.get("service_slug") or "")
    if not service_slug:
        raise PresalesPromoteError("Thiếu service_slug trên pre-sales")

    for stage in PRESALES_STAGES:
        if not is_presales_stage_complete(conn, presales_id, stage):
            raise PresalesPromoteError(
                f"Chưa hoàn thành task giai đoạn {stage} — không thể ký HĐ promote"
            )

    ts = _ts()
    assigned_am = ps.get("assigned_am") or _lead_owner_staff_id(conn, lead_id)

    cur = conn.execute(
        """
        INSERT INTO crm_service_lifecycle
            (lead_id, customer_id, contract_id, service_slug, stage, status,
             assigned_am, stage_entered_at, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'onboard', 'active', ?, ?, ?, ?, ?)
        """,
        (
            lead_id,
            int(customer_id),
            int(contract_id),
            service_slug,
            assigned_am,
            ts,
            f"Promote từ pre-sales #{presales_id} — {actor}"[:4000],
            ts,
            ts,
        ),
    )
    lifecycle_id = int(cur.lastrowid)

    conn.execute(
        """
        INSERT INTO crm_service_lifecycle_events
            (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
        VALUES (?, 'proposal', 'onboard', 'system', ?, ?)
        """,
        (
            lifecycle_id,
            f"Ký HĐ #{contract_id} — pre-sales hoàn tất, bắt đầu Onboard",
            ts,
        ),
    )

    src_tasks = conn.execute(
        """
        SELECT * FROM crm_lead_presales_tasks
        WHERE presales_id = ?
        ORDER BY stage, step_index, id
        """,
        (presales_id,),
    ).fetchall()
    for row in src_tasks:
        d = dict(row)
        d["form_fields"] = d.get("form_fields") or "[]"
        d["form_data"] = d.get("form_data") or "{}"
        _copy_task_to_lifecycle(conn, lifecycle_id, d, ts)

    from crm_svc_tasks import seed_post_onboard_lifecycle_tasks

    seed_post_onboard_lifecycle_tasks(conn, lifecycle_id, service_slug)

    try:
        from crm_lead_presales_marketing_plan import clone_preliminary_to_official

        clone_preliminary_to_official(conn, presales_id, lifecycle_id)
    except ValueError as exc:
        raise PresalesPromoteError(str(exc)) from exc

    conn.execute(
        """
        UPDATE crm_lead_intake_sessions
        SET lifecycle_id = ?
        WHERE lead_id = ? AND (lifecycle_id IS NULL OR lifecycle_id = 0)
        """,
        (lifecycle_id, lead_id),
    )

    from crm_svc_presales import (
        merge_lifecycle_meta,
        parse_lifecycle_meta,
        _strip_lifecycle_meta,
    )

    ps_notes_row = conn.execute(
        "SELECT notes FROM crm_lead_presales WHERE id = ?", (presales_id,)
    ).fetchone()
    old_ps_notes = str(ps_notes_row[0] or "") if ps_notes_row else ""
    ps_meta = parse_lifecycle_meta(old_ps_notes)
    ps_base = _strip_lifecycle_meta(old_ps_notes).strip()
    promote_line = f"→ Lifecycle #{lifecycle_id} (Onboard)"[:500]
    ps_base = f"{ps_base}\n{promote_line}".strip() if ps_base else promote_line
    new_ps_notes = (
        merge_lifecycle_meta(ps_base, ps_meta) if ps_meta else ps_base
    )

    conn.execute(
        """
        UPDATE crm_lead_presales
        SET status = 'converted', lifecycle_id = ?, updated_at = ?,
            notes = ?
        WHERE id = ?
        """,
        (lifecycle_id, ts, new_ps_notes, presales_id),
    )

    try:
        from crm_svc_finance import link_presales_expenses_to_lifecycle

        linked = link_presales_expenses_to_lifecycle(conn, presales_id, lifecycle_id)
        if linked:
            logger.info(
                "Linked %s presales expenses presales=%s → lifecycle=%s",
                linked,
                presales_id,
                lifecycle_id,
            )
    except Exception as exc:
        logger.warning(
            "link_presales_expenses presales=%s lifecycle=%s: %s",
            presales_id,
            lifecycle_id,
            exc,
        )
    try:
        from crm_svc_presales import transfer_presales_cap_to_lifecycle

        transfer_presales_cap_to_lifecycle(conn, presales_id, lifecycle_id)
    except Exception as exc:
        logger.warning(
            "transfer_presales_cap presales=%s lifecycle=%s: %s",
            presales_id,
            lifecycle_id,
            exc,
        )
    try:
        from crm_service_lifecycle import sync_assigned_sp_from_tasks

        sync_assigned_sp_from_tasks(conn, lifecycle_id, overwrite=False)
    except Exception as exc:
        logger.warning(
            "sync_assigned_sp_from_tasks promote presales=%s lifecycle=%s: %s",
            presales_id,
            lifecycle_id,
            exc,
        )
    conn.commit()
    logger.info(
        "promote_presales_to_lifecycle presales=%s lifecycle=%s lead=%s",
        presales_id,
        lifecycle_id,
        lead_id,
    )
    return lifecycle_id


def presales_payload(
    conn: sqlite3.Connection, lead_id: int
) -> dict[str, Any] | None:
    """API payload: presales row + tasks + advance info + consult brief."""
    ps = get_by_lead(conn, int(lead_id))
    if ps is None:
        return None
    pid = int(ps["id"])
    payload: dict[str, Any] = {
        "presales": ps,
        "tasks_by_stage": list_presales_tasks(conn, pid),
        "progress": get_presales_progress(conn, pid),
        "advance": get_presales_advance_info(conn, pid),
        "stages": list(PRESALES_STAGES),
    }
    try:
        from crm_lead_presales_bridge import get_presales_brief

        payload["brief"] = get_presales_brief(conn, int(lead_id))
    except Exception as exc:
        logger.warning("get_presales_brief lỗi lead=%s: %s", lead_id, exc)
        payload["brief"] = None
    try:
        from crm_lead_presales_contract import get_contract_summary_for_lead

        payload["contract"] = get_contract_summary_for_lead(conn, int(lead_id))
    except Exception as exc:
        logger.warning("get_contract_summary lỗi lead=%s: %s", lead_id, exc)
        payload["contract"] = None
    try:
        from crm_lead_presales_marketing_plan import preliminary_plan_payload

        payload["marketing_plan"] = preliminary_plan_payload(conn, pid)
    except Exception as exc:
        logger.warning("preliminary_plan_payload lỗi presales=%s: %s", pid, exc)
        payload["marketing_plan"] = None
    try:
        from crm_svc_presales import get_presales_cost_summary_by_presales

        payload["cost_summary"] = get_presales_cost_summary_by_presales(conn, pid)
    except Exception as exc:
        logger.warning("presales cost_summary lỗi presales=%s: %s", pid, exc)
        payload["cost_summary"] = None
    return payload
