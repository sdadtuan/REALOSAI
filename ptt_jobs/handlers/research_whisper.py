"""Job handler — research Whisper ingest (P5 M1)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.market_research.whisper_ingest import process_research_whisper_payload, _unlink_quiet
from ptt_jobs.store import mark_job_done

logger = logging.getLogger(__name__)


def run_research_whisper_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    payload = payload if isinstance(payload, dict) else {}
    run_id = int(payload.get("run_id") or 0)
    temp_path = str(payload.get("temp_path") or "")

    try:
        outcome = process_research_whisper_payload(payload)
    except Exception as exc:
        logger.exception("research_whisper_ingest crashed job_id=%s", job_id)
        if run_id > 0:
            try:
                from ptt_crm.market_research import repository

                repository.fail_run(run_id, str(exc))
            except Exception:
                logger.exception("research_whisper fail_run skipped run_id=%s", run_id)
        mark_job_done(job_id)
        return
    finally:
        _unlink_quiet(temp_path)

    mark_job_done(job_id)
    if outcome.get("ok"):
        logger.info(
            "research_whisper_ingest done job_id=%s run_id=%s excerpts=%s",
            job_id,
            payload.get("run_id"),
            len(outcome.get("excerpt_ids") or []),
        )
        return

    error = str(outcome.get("error") or "research_whisper_ingest failed")
    logger.warning("research_whisper_ingest terminal job_id=%s error=%s", job_id, error)
