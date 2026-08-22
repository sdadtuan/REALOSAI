"""Job handler — async lead score via Nest AI API (RNOS-08)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.ai_score_api_client import score_lead_via_api
from ptt_jobs.store import mark_job_done, mark_job_failed

logger = logging.getLogger(__name__)


def process_score_lead_payload(payload: dict[str, Any], *, correlation_id: str | None = None) -> dict[str, Any]:
    lead_id = int(payload.get("lead_id") or 0)
    if lead_id <= 0:
        return {"ok": False, "error": "invalid_lead_id"}

    outcome = score_lead_via_api(lead_id=lead_id, correlation_id=correlation_id)
    if outcome.get("ok"):
        return {"ok": True, "lead_id": lead_id, "response": outcome.get("body")}

    if outcome.get("skipped"):
        return {"ok": True, "skipped": True, "reason": outcome.get("error")}

    return {"ok": False, "error": outcome.get("error") or "score_failed", "detail": outcome.get("detail")}


def run_score_lead_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    correlation_id = str(job.get("correlation_id") or "") or None
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 3)

    outcome = process_score_lead_payload(payload, correlation_id=correlation_id)
    if outcome.get("ok"):
        mark_job_done(job_id)
        logger.info("score_lead done job_id=%s lead_id=%s", job_id, payload.get("lead_id"))
        return

    error = str(outcome.get("error") or "score_lead failed")
    mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    logger.warning("score_lead failed job_id=%s error=%s", job_id, error)
