"""RNOS-08 — enqueue score_lead jobs after LeadCreated."""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


def score_lead_idempotency_key(lead_id: int | str) -> str:
    return f"score_lead:lead:{int(lead_id)}"


def _normalize_client_uuid(client_id: str | None) -> str | None:
    text = str(client_id or "").strip()
    if not text or text in {"unknown", ""}:
        return None
    if _UUID_RE.match(text):
        return text.lower()
    return None


def score_lead_async_enabled() -> bool:
    from ptt_crm.config import ai_score_async_enabled
    from ptt_jobs.config import jobs_enabled

    return ai_score_async_enabled() and jobs_enabled()


def enqueue_score_lead_job(
    *,
    lead_id: int,
    client_id: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Enqueue score_lead job (idempotent per lead_id).

    Returns job record dict or None when disabled / invalid input.
    """
    if not score_lead_async_enabled():
        return None
    if lead_id <= 0:
        return None

    from ptt_jobs.store import enqueue_job_record

    try:
        job = enqueue_job_record(
            job_type="score_lead",
            payload={
                "lead_id": int(lead_id),
                "client_id": _normalize_client_uuid(client_id),
            },
            idempotency_key=score_lead_idempotency_key(lead_id),
            correlation_id=correlation_id,
            client_id=_normalize_client_uuid(client_id),
            max_attempts=3,
        )
        if job.get("created"):
            logger.info("score_lead enqueued lead_id=%s job_id=%s", lead_id, job.get("id"))
        return job
    except Exception as exc:
        logger.debug("score_lead enqueue skipped lead_id=%s: %s", lead_id, exc)
        return None
