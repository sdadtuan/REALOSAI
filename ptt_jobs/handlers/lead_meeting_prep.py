"""Job handler — lead meeting prep (AI-UC-021 / S-LMP-1)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.lead_meeting_prep.pipeline import process_lead_meeting_prep_payload
from ptt_jobs.store import mark_job_done, mark_job_failed

logger = logging.getLogger(__name__)


def run_lead_meeting_prep_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    correlation_id = str(job.get("correlation_id") or "") or None
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 3)

    outcome = process_lead_meeting_prep_payload(payload, correlation_id=correlation_id)
    if outcome.get("ok"):
        mark_job_done(job_id)
        logger.info(
            "lead_meeting_prep done job_id=%s lead_id=%s status=%s",
            job_id,
            payload.get("lead_id"),
            outcome.get("status") or outcome.get("reason") or "ok",
        )
        return

    error = str(outcome.get("error") or "lead_meeting_prep failed")
    mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    logger.warning("lead_meeting_prep failed job_id=%s error=%s", job_id, error)
