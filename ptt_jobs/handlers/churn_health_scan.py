"""Job handler — churn health score via Nest AI API (RNOS-19)."""

from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.ai_score_api_client import churn_score_via_api
from ptt_jobs.store import mark_job_done, mark_job_failed

logger = logging.getLogger(__name__)


def process_churn_health_scan_payload(
    payload: dict[str, Any],
    *,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    force = bool(payload.get("force"))
    limit_raw = payload.get("limit")
    limit = int(limit_raw) if limit_raw is not None else None
    client_id = payload.get("client_id")
    client_id_str = str(client_id).strip() if client_id else None

    outcome = churn_score_via_api(
        client_id=client_id_str,
        force=force,
        limit=limit,
        correlation_id=correlation_id,
    )
    if outcome.get("ok"):
        return {"ok": True, "response": outcome.get("body")}

    if outcome.get("skipped"):
        return {"ok": True, "skipped": True, "reason": outcome.get("error")}

    return {"ok": False, "error": outcome.get("error") or "churn_score_failed", "detail": outcome.get("detail")}


def run_churn_health_scan_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    correlation_id = str(job.get("correlation_id") or "") or None
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 3)

    outcome = process_churn_health_scan_payload(payload, correlation_id=correlation_id)
    if outcome.get("ok"):
        mark_job_done(job_id)
        logger.info("churn_health_scan done job_id=%s", job_id)
        return

    error = str(outcome.get("error") or "churn_health_scan failed")
    mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    logger.warning("churn_health_scan failed job_id=%s error=%s", job_id, error)
