"""Pulse collect — snapshot fact diffs + optional Tavily. Never inserts insights."""
from __future__ import annotations

import logging
import urllib.error
from typing import Any

from ptt_crm.market_research import repository
from ptt_crm.market_research.desk_collect import (
    _credits_limit,
    _search,
    _tavily_key,
    build_desk_query,
)

logger = logging.getLogger(__name__)

FACT_KEYS = ["price", "message", "promo"]


def snapshot_fact_diff(
    prev: dict[str, Any] | None,
    nxt: dict[str, Any] | None,
    keys: list[str] | None = None,
) -> dict[str, Any]:
    a = prev or {}
    b = nxt or {}
    use = keys or FACT_KEYS
    changed = [k for k in use if str(a.get(k) or "") != str(b.get(k) or "")]
    return {"changed": changed, "topic": changed[0] if changed else None}


def velocity(baseline: float | None, current: float | None) -> float | None:
    if baseline is None or current is None:
        return None
    if baseline == 0:
        return 0.0 if current == 0 else None
    return (current - baseline) / abs(baseline)


def lifecycle_from_velocity(v: float | None) -> str:
    if v is None:
        return "new"
    if v > 0.15:
        return "rising"
    if v < -0.15:
        return "fading"
    return "stable"


def _as_num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def collect_pulse(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    credits_already_used: int = 0,
) -> dict[str, Any]:
    """Optional Tavily search. Query = question_vi + geo after strip_pii (BR-RES-11)."""
    limit = _credits_limit()
    remaining = limit - max(0, int(credits_already_used or 0))
    query = build_desk_query(question_vi, geo)
    empty: dict[str, Any] = {
        "ok": True,
        "skipped": True,
        "sources": [],
        "credits_used": 0,
        "credits_limit": limit,
        "query": query,
    }

    if remaining <= 0:
        return {**empty, "error": "tavily_credit_cap"}

    api_key = _tavily_key()
    if not api_key:
        return {**empty, "error": "tavily_unconfigured"}

    if len(query) < 2:
        return {**empty, "error": "missing_question"}

    try:
        _docs, cost = _search(query, api_key=api_key)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.warning("Tavily pulse search failed query=%s: %s", query[:80], exc)
        return {**empty, "error": f"tavily_search_failed: {exc}"}

    return {
        "ok": True,
        "skipped": False,
        "sources": [],
        "credits_used": cost,
        "credits_limit": limit,
        "query": query,
    }


def _wants_tavily(product_type: str, question_vi: str) -> bool:
    pt = str(product_type or "").strip().upper()
    q = str(question_vi or "").lower()
    return pt == "TREND_SCAN" or "trend" in q


def process_research_pulse_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    question_id = int(payload.get("question_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    empty = {"ok": False, "signals": [], "credits_used": 0, "insight_ids": []}
    if project_id <= 0 or run_id <= 0:
        return {**empty, "error": "invalid_payload"}

    try:
        lifecycle_id = int(payload.get("lifecycle_id") or 0)
    except (TypeError, ValueError):
        lifecycle_id = 0

    ctx = repository.load_pulse_context(project_id, question_id if question_id > 0 else None)
    if not ctx:
        repository.fail_run(run_id, "not_found")
        return {**empty, "error": "not_found"}

    repository.mark_run_running(run_id)

    signals: list[dict[str, Any]] = []
    for pair in repository.list_competitor_snapshot_pairs(project_id):
        prev = pair.get("prev") if isinstance(pair.get("prev"), dict) else {}
        nxt = pair.get("next") if isinstance(pair.get("next"), dict) else {}
        diff = snapshot_fact_diff(prev, nxt)
        topic = diff.get("topic")
        if not topic:
            continue
        baseline = _as_num(prev.get(topic))
        current = _as_num(nxt.get(topic))
        vel = velocity(baseline, current)
        row = repository.insert_trend_signal(
            project_id=project_id,
            topic=str(topic),
            metric=str(topic),
            baseline=baseline,
            current=current,
            velocity=vel,
            lifecycle=lifecycle_from_velocity(vel),
        )
        if row:
            signals.append(row)
            if lifecycle_id > 0:
                try:
                    repository.upsert_ops_alert(
                        lifecycle_id=lifecycle_id,
                        dv_code="DV12",
                        alert_type="research_pulse",
                        severity="warning",
                        title=f"Pulse: {topic}",
                        message=f"Đối thủ đổi {topic} trên project {project_id}",
                        source_key=f"research_pulse:{project_id}:{row.get('id')}",
                    )
                except Exception as exc:
                    logger.warning(
                        "ops_alert_log insert failed project_id=%s signal_id=%s: %s",
                        project_id,
                        row.get("id"),
                        exc,
                    )

    credits_used = 0
    question_vi = str(ctx.get("question_vi") or "")
    tavily_out: dict[str, Any] | None = None
    if _wants_tavily(str(ctx.get("product_type") or ""), question_vi):
        already = repository.sum_project_tavily_credits(project_id, exclude_run_id=run_id)
        tavily_out = collect_pulse(
            question_vi=question_vi,
            geo=list(ctx.get("geo") or []),
            credits_already_used=already,
        )
        if tavily_out.get("ok") is False:
            repository.fail_run(
                run_id,
                str(tavily_out.get("error") or "pulse_failed"),
                credits_used=int(tavily_out.get("credits_used") or 0),
            )
            return {**tavily_out, "signals": signals, "insight_ids": []}
        credits_used = int(tavily_out.get("credits_used") or 0)

    repository.succeed_run(
        run_id,
        credits_used=credits_used,
        output={
            "signal_ids": [s.get("id") for s in signals if s.get("id")],
            "credits_used": credits_used,
            "query": (tavily_out or {}).get("query"),
            "insight_ids": [],
        },
    )
    return {
        "ok": True,
        "signals": signals,
        "credits_used": credits_used,
        "insight_ids": [],
    }
