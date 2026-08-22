"""RNOSAI — enqueue lead_meeting_prep jobs after LeadCreated (AI-UC-021)."""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def lead_meeting_prep_idempotency_key(lead_id: int | str) -> str:
    return f"lead_meeting_prep:lead:{int(lead_id)}"


def _normalize_client_uuid(client_id: str | None) -> str | None:
    text = str(client_id or "").strip()
    if not text or text in {"unknown", ""}:
        return None
    if _UUID_RE.match(text):
        return text.lower()
    return None


def lead_meeting_prep_enabled() -> bool:
    from ptt_crm.config import lead_meeting_prep_enabled as cfg_enabled
    from ptt_jobs.config import jobs_enabled

    return cfg_enabled() and jobs_enabled()


def enqueue_lead_meeting_prep_job(
    *,
    lead_id: int,
    client_id: str | None = None,
    correlation_id: str | None = None,
    prep_stage: str = "m1_first_strike",
    mode: str = "full",
    selected_entity_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any] | None:
    if not lead_meeting_prep_enabled():
        return None
    if lead_id <= 0:
        return None

    from ptt_jobs.store import enqueue_job_record

    idem = idempotency_key or lead_meeting_prep_idempotency_key(lead_id)
    try:
        job = enqueue_job_record(
            job_type="lead_meeting_prep",
            payload={
                "lead_id": int(lead_id),
                "client_id": _normalize_client_uuid(client_id),
                "prep_stage": prep_stage,
                "mode": mode,
                "selected_entity_id": selected_entity_id,
            },
            idempotency_key=idem,
            correlation_id=correlation_id,
            client_id=_normalize_client_uuid(client_id),
            max_attempts=3,
        )
        if job.get("created"):
            logger.info(
                "lead_meeting_prep enqueued lead_id=%s job_id=%s",
                lead_id,
                job.get("id"),
            )
        return job
    except Exception as exc:
        logger.debug("lead_meeting_prep enqueue skipped lead_id=%s: %s", lead_id, exc)
        return None
