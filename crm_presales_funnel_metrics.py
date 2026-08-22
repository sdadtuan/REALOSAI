"""Presales funnel metrics — parity with presales-funnel-metrics.util.ts."""
from __future__ import annotations

import json
import math
import sqlite3
from typing import Any

from crm_lead_presales_sla import is_consult_to_proposal_within_48h, hours_between

CONSULT_TO_PROPOSAL_AGENCY_HOURS = 168

PRESALES_FUNNEL_METRIC_LABELS: dict[str, str] = {
    "consult_to_proposal_7d": (
        "Consult → Báo giá ≤7 ngày (KPI agency) — mục tiêu ≥50% pilot / ≥60% 90 ngày"
    ),
    "consult_to_proposal_48h": (
        "Consult → Báo giá ≤48h (SLA vận hành) — mục tiêu theo gate P1"
    ),
    "go_to_handoff": "Go → Giao Solution (team Sales) — mục tiêu ≤24h sau Intake Go",
    "handoff_to_release": "Handoff → Trả Sales (team Solution) — thời gian xử lý Solution",
}


def _round1(n: float) -> float:
    return round(n * 10) / 10


def _pct(num: int, denom: int) -> float:
    return _round1(num / denom * 100) if denom > 0 else 0.0


def _percentile(sorted_vals: list[float], p: float) -> float | None:
    if not sorted_vals:
        return None
    rank = (p / 100) * (len(sorted_vals) - 1)
    lo = int(math.floor(rank))
    hi = int(math.ceil(rank))
    if lo == hi:
        return sorted_vals[lo]
    w = rank - lo
    return sorted_vals[lo] * (1 - w) + sorted_vals[hi] * w


def _parse_json_array(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _parse_form_data(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw or "{}")
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _field_completion(task: dict[str, Any]) -> float:
    fields = task.get("form_fields") or []
    if not isinstance(fields, list) or not fields:
        return 100.0 if task.get("is_done") else 0.0
    filled = 0
    for field in fields:
        if not isinstance(field, dict):
            continue
        key = str(field.get("key") or "").strip()
        if not key:
            continue
        val = (task.get("form_data") or {}).get(key)
        if val is not None and str(val).strip() != "":
            filled += 1
    return (filled / len(fields)) * 100 if fields else 0.0


def compute_presales_funnel_metrics(input_data: dict[str, Any]) -> dict[str, Any]:
    go_hours: list[float] = []
    for row in input_data.get("go_to_consult") or []:
        hrs = hours_between(
            str(row.get("intake_go_completed_at") or ""),
            str(row.get("consult_entered_at") or ""),
        )
        if hrs is not None and hrs >= 0:
            go_hours.append(hrs)
    go_hours.sort()

    handoff_hours: list[float] = []
    for row in input_data.get("go_to_handoff") or []:
        hrs = hours_between(
            str(row.get("intake_go_completed_at") or ""),
            str(row.get("handed_off_at") or ""),
        )
        if hrs is not None and hrs >= 0:
            handoff_hours.append(hrs)
    handoff_hours.sort()

    release_hours: list[float] = []
    for row in input_data.get("handoff_to_release") or []:
        hrs = hours_between(
            str(row.get("handed_off_at") or ""),
            str(row.get("solution_released_at") or ""),
        )
        if hrs is not None and hrs >= 0:
            release_hours.append(hrs)
    release_hours.sort()

    within7 = 0
    within48 = 0
    cp_rows = input_data.get("consult_to_proposal") or []
    cp_denom = len(cp_rows)
    for row in cp_rows:
        consult = str(row.get("consult_entered_at") or "")
        proposal = str(row.get("proposal_entered_at") or "")
        hrs = hours_between(consult, proposal)
        if hrs is None or hrs < 0:
            continue
        if hrs <= CONSULT_TO_PROPOSAL_AGENCY_HOURS:
            within7 += 1
        if is_consult_to_proposal_within_48h(consult, proposal):
            within48 += 1

    consult_tasks = input_data.get("consult_tasks") or []
    task_total = len(consult_tasks)
    task_done = sum(1 for t in consult_tasks if t.get("is_done"))
    completion_samples = [_field_completion(t) for t in consult_tasks]
    avg_completion = (
        sum(completion_samples) / len(completion_samples) if completion_samples else 0.0
    )

    med = _percentile(go_hours, 50)
    p90 = _percentile(go_hours, 90)
    handoff_med = _percentile(handoff_hours, 50)
    handoff_p90 = _percentile(handoff_hours, 90)
    release_med = _percentile(release_hours, 50)
    release_p90 = _percentile(release_hours, 90)
    return {
        "go_to_consult_median_hours": _round1(med) if med is not None else None,
        "go_to_consult_p90_hours": _round1(p90) if p90 is not None else None,
        "go_to_consult_sample": len(go_hours),
        "go_to_handoff_median_hours": _round1(handoff_med) if handoff_med is not None else None,
        "go_to_handoff_p90_hours": _round1(handoff_p90) if handoff_p90 is not None else None,
        "go_to_handoff_sample": len(handoff_hours),
        "handoff_to_release_median_hours": _round1(release_med) if release_med is not None else None,
        "handoff_to_release_p90_hours": _round1(release_p90) if release_p90 is not None else None,
        "handoff_to_release_sample": len(release_hours),
        "consult_to_proposal_7d_pct": _pct(within7, cp_denom),
        "consult_to_proposal_7d_num": within7,
        "consult_to_proposal_7d_denom": cp_denom,
        "consult_to_proposal_48h_pct": _pct(within48, cp_denom),
        "consult_to_proposal_48h_num": within48,
        "consult_to_proposal_48h_denom": cp_denom,
        "consult_form_completion_pct": _round1(avg_completion),
        "consult_task_done_rate": _pct(task_done, task_total),
        "consult_tasks_total": task_total,
        "consult_tasks_done": task_done,
    }


def _sqlite_period(column: str, period_start: str | None, period_end: str | None) -> str:
    clause = ""
    if period_start:
        safe = period_start.replace("'", "''")
        clause += f" AND datetime(replace({column}, 'T', ' ')) >= datetime('{safe}')"
    if period_end:
        safe = period_end.replace("'", "''")
        clause += f" AND datetime(replace({column}, 'T', ' ')) < datetime('{safe}', '+1 day')"
    return clause


def get_presales_funnel_metrics(
    conn: sqlite3.Connection,
    *,
    period_start: str | None = None,
    period_end: str | None = None,
    am_id: int | None = None,
) -> dict[str, Any]:
    """Load cohort from SQLite and compute funnel metrics."""
    params: list[Any] = []
    am_filter = ""
    if am_id is not None:
        am_filter = " AND COALESCE(ps.assigned_am, l.owner_id) = ?"
        params.append(int(am_id))

    go_period = _sqlite_period("ps.consult_entered_at", period_start, period_end)
    go_rows = conn.execute(
        f"""
        SELECT s.completed_at AS intake_go_completed_at, ps.consult_entered_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        INNER JOIN (
          SELECT lead_id, MIN(completed_at) AS completed_at
          FROM crm_lead_intake_sessions
          WHERE status = 'completed' AND decision = 'go'
            AND completed_at != ''
          GROUP BY lead_id
        ) s ON s.lead_id = ps.lead_id
        WHERE ps.consult_entered_at != ''{am_filter}{go_period}
        """,
        params,
    ).fetchall()

    handoff_period = _sqlite_period("ps.handed_off_at", period_start, period_end)
    handoff_rows = conn.execute(
        f"""
        SELECT s.completed_at AS intake_go_completed_at, ps.handed_off_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        INNER JOIN (
          SELECT lead_id, MIN(completed_at) AS completed_at
          FROM crm_lead_intake_sessions
          WHERE status = 'completed' AND decision = 'go'
            AND completed_at != ''
          GROUP BY lead_id
        ) s ON s.lead_id = ps.lead_id
        WHERE ps.handed_off_at != ''{am_filter}{handoff_period}
        """,
        params,
    ).fetchall()

    release_period = _sqlite_period("ps.solution_released_at", period_start, period_end)
    release_rows = conn.execute(
        f"""
        SELECT ps.handed_off_at, ps.solution_released_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        WHERE ps.handed_off_at != ''
          AND ps.solution_released_at != ''{am_filter}{release_period}
        """,
        params,
    ).fetchall()

    cp_period = _sqlite_period("ps.proposal_entered_at", period_start, period_end)
    cp_rows = conn.execute(
        f"""
        SELECT ps.consult_entered_at, ps.proposal_entered_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        WHERE ps.consult_entered_at != ''
          AND ps.proposal_entered_at != ''{am_filter}{cp_period}
        """,
        params,
    ).fetchall()

    task_period = _sqlite_period("ps.consult_entered_at", period_start, period_end)
    task_rows = conn.execute(
        f"""
        SELECT t.form_fields, t.form_data, t.is_done
        FROM crm_lead_presales_tasks t
        INNER JOIN crm_lead_presales ps ON ps.id = t.presales_id
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        WHERE t.stage = 'consult'
          AND t.is_custom = 0{am_filter}{task_period}
        """,
        params,
    ).fetchall()

    input_data = {
        "go_to_consult": [
            {
                "intake_go_completed_at": str(r[0] or ""),
                "consult_entered_at": str(r[1] or ""),
            }
            for r in go_rows
        ],
        "go_to_handoff": [
            {
                "intake_go_completed_at": str(r[0] or ""),
                "handed_off_at": str(r[1] or ""),
            }
            for r in handoff_rows
        ],
        "handoff_to_release": [
            {
                "handed_off_at": str(r[0] or ""),
                "solution_released_at": str(r[1] or ""),
            }
            for r in release_rows
        ],
        "consult_to_proposal": [
            {
                "consult_entered_at": str(r[0] or ""),
                "proposal_entered_at": str(r[1] or ""),
            }
            for r in cp_rows
        ],
        "consult_tasks": [
            {
                "form_fields": _parse_json_array(r[0]),
                "form_data": _parse_form_data(r[1]),
                "is_done": bool(r[2]),
            }
            for r in task_rows
        ],
    }
    return {
        "period_start": period_start,
        "period_end": period_end,
        "am_id": am_id,
        "metrics": compute_presales_funnel_metrics(input_data),
        "labels": dict(PRESALES_FUNNEL_METRIC_LABELS),
    }
