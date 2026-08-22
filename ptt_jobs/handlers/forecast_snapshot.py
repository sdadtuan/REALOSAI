"""Job handler — daily revenue forecast snapshot via Nest AI API (RNOS-17)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.ai_score_api_client import forecast_snapshot_via_api
from ptt_jobs.store import mark_job_done, mark_job_failed

logger = logging.getLogger(__name__)


def process_forecast_snapshot_payload(
    payload: dict[str, Any],
    *,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    force = bool(payload.get("force"))
    snapshot_date = payload.get("snapshot_date")
    snapshot_date_str = str(snapshot_date).strip() if snapshot_date else None

    outcome = forecast_snapshot_via_api(
        force=force,
        snapshot_date=snapshot_date_str,
        correlation_id=correlation_id,
    )
    if outcome.get("ok"):
        return {"ok": True, "response": outcome.get("body")}

    if outcome.get("skipped"):
        return {"ok": True, "skipped": True, "reason": outcome.get("error")}

    return {"ok": False, "error": outcome.get("error") or "forecast_snapshot_failed", "detail": outcome.get("detail")}


def run_forecast_snapshot_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    correlation_id = str(job.get("correlation_id") or "") or None
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 3)

    outcome = process_forecast_snapshot_payload(payload, correlation_id=correlation_id)
    if outcome.get("ok"):
        mark_job_done(job_id)
        logger.info("forecast_snapshot done job_id=%s", job_id)
        return

    error = str(outcome.get("error") or "forecast_snapshot failed")
    mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    logger.warning("forecast_snapshot failed job_id=%s error=%s", job_id, error)
