"""SLA Consult → Proposal ≤48h — presales-on-lead."""
from __future__ import annotations

from datetime import datetime
from typing import Any

CONSULT_PROPOSAL_SLA_HOURS = 48
CONSULT_PROPOSAL_WARN_HOURS_BEFORE = 12


def _parse_ts(raw: str | None) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    normalized = text.replace(" ", "T")
    if not normalized.endswith("Z"):
        normalized = f"{normalized}Z"
    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        return None


def resolve_consult_started_at(
    *,
    consult_entered_at: str | None,
    stage_entered_at: str | None,
) -> str | None:
    consult = str(consult_entered_at or "").strip()
    if consult:
        return consult
    stage = str(stage_entered_at or "").strip()
    return stage or None


def _format_hours_remaining(hours: float) -> str:
    if hours <= 0:
        return "0h"
    if hours >= 48:
        return f"{round(hours)}h"
    h = int(hours)
    m = round((hours - h) * 60)
    return f"{h}h{m}p" if m > 0 else f"{h}h"


def build_presales_consult_proposal_sla(
    *,
    presales_stage: str,
    consult_entered_at: str | None = None,
    stage_entered_at: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "tier": "consult_proposal_48h",
        "sla_state": "na",
        "started_at": None,
        "deadline_at": None,
        "hours_elapsed": None,
        "hours_remaining": None,
        "minutes_remaining": None,
        "message": "SLA Consult → Báo giá áp dụng khi đang ở giai đoạn Tư vấn.",
        "reminder_cta": "Tạo nhắc SLA Consult → Báo giá",
    }
    if str(presales_stage or "").strip() != "consult":
        return base

    started_at = resolve_consult_started_at(
        consult_entered_at=consult_entered_at,
        stage_entered_at=stage_entered_at,
    )
    started = _parse_ts(started_at)
    if started is None:
        return {
            **base,
            "message": "Chưa ghi thời điểm vào Consult — SLA 48h bắt đầu khi chuyển → Tư vấn.",
        }

    now_dt = now or datetime.utcnow()
    deadline = started.timestamp() + CONSULT_PROPOSAL_SLA_HOURS * 3600
    elapsed_h = max(0.0, (now_dt.timestamp() - started.timestamp()) / 3600)
    remaining_h = (deadline - now_dt.timestamp()) / 3600
    minutes_remaining = round(remaining_h * 60)

    sla_state = "ok"
    message = (
        f"Còn {_format_hours_remaining(remaining_h)} để chuyển → Báo giá "
        f"(SLA ≤48h sau Consult)."
    )
    if remaining_h <= 0:
        sla_state = "breach"
        message = (
            f"Quá hạn SLA 48h ({_format_hours_remaining(elapsed_h)} kể từ vào Consult) "
            "— chuyển → Báo giá ngay."
        )
    elif remaining_h <= CONSULT_PROPOSAL_WARN_HOURS_BEFORE:
        sla_state = "warning"
        message = (
            f"Sắp hết SLA 48h — còn {_format_hours_remaining(remaining_h)} "
            "để chuyển → Báo giá."
        )

    return {
        "tier": "consult_proposal_48h",
        "sla_state": sla_state,
        "started_at": started_at,
        "deadline_at": datetime.utcfromtimestamp(deadline).strftime("%Y-%m-%d %H:%M:%S"),
        "hours_elapsed": round(elapsed_h, 1),
        "hours_remaining": round(max(0.0, remaining_h), 1),
        "minutes_remaining": minutes_remaining,
        "message": message,
        "reminder_cta": "Tạo nhắc SLA Consult → Báo giá",
    }


def hours_between(start_raw: str | None, end_raw: str | None) -> float | None:
    start = _parse_ts(start_raw)
    end = _parse_ts(end_raw)
    if start is None or end is None:
        return None
    return (end.timestamp() - start.timestamp()) / 3600


def is_consult_to_proposal_within_48h(
    consult_entered_at: str | None,
    proposal_entered_at: str | None,
) -> bool:
    hrs = hours_between(consult_entered_at, proposal_entered_at)
    if hrs is None or hrs < 0:
        return False
    return hrs <= CONSULT_PROPOSAL_SLA_HOURS


def get_presales_consult_sla_summary(
    conn,
    *,
    am_id: int | None = None,
) -> dict[str, Any]:
    """Aggregate SLA dashboard — mirrors Nest getPresalesConsultSlaSummary."""
    params: list[Any] = []
    am_filter = ""
    if am_id is not None:
        am_filter = " AND COALESCE(ps.assigned_am, l.owner_id) = ?"
        params.append(int(am_id))

    active_rows = conn.execute(
        f"""
        SELECT ps.consult_entered_at, ps.stage_entered_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        WHERE ps.status = 'active' AND ps.stage = 'consult'{am_filter}
        """,
        params,
    ).fetchall()

    sla_ok = sla_warning = sla_breach = 0
    for row in active_rows:
        sla = build_presales_consult_proposal_sla(
            presales_stage="consult",
            consult_entered_at=row[0],
            stage_entered_at=row[1],
        )
        state = str(sla.get("sla_state") or "")
        if state == "breach":
            sla_breach += 1
        elif state == "warning":
            sla_warning += 1
        elif state == "ok":
            sla_ok += 1

    completed_rows = conn.execute(
        f"""
        SELECT ps.consult_entered_at, ps.proposal_entered_at
        FROM crm_lead_presales ps
        INNER JOIN crm_leads l ON l.id = ps.lead_id
        WHERE ps.consult_entered_at != '' AND ps.proposal_entered_at != ''{am_filter}
        """,
        params,
    ).fetchall()

    within48 = sum(
        1
        for row in completed_rows
        if is_consult_to_proposal_within_48h(str(row[0] or ""), str(row[1] or ""))
    )
    denom = len(completed_rows)
    return {
        "active_consult": len(active_rows),
        "sla_ok": sla_ok,
        "sla_warning": sla_warning,
        "sla_breach": sla_breach,
        "consult_to_proposal_48h_pct": round(within48 / denom * 100, 1) if denom > 0 else 0.0,
        "consult_to_proposal_48h_num": within48,
        "consult_to_proposal_48h_denom": denom,
    }
