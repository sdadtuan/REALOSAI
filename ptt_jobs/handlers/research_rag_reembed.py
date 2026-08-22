"""Worker handler — research_rag_reembed job."""
from __future__ import annotations

import logging
from typing import Any

from ptt_crm.market_research.rag_reembed import process_research_rag_reembed_payload
from ptt_jobs.store import mark_job_done

logger = logging.getLogger(__name__)


def run_research_rag_reembed_job(job: dict[str, Any]) -> None:
    job_id = str(job.get("id") or "")
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
    run_id = int(payload.get("run_id") or 0)
    try:
        outcome = process_research_rag_reembed_payload(payload)
    except Exception:
        logger.exception("research_rag_reembed crashed job_id=%s", job_id)
        if run_id > 0:
            try:
                from ptt_crm.market_research import repository

                repository.fail_run(run_id, "rag_reembed_failed")
            except Exception:
                logger.exception("research_rag_reembed fail_run skipped run_id=%s", run_id)
        mark_job_done(job_id)
        return

    if outcome.get("ok"):
        logger.info(
            "research_rag_reembed done job_id=%s run_id=%s processed=%s remaining=%s",
            job_id,
            run_id,
            outcome.get("processed"),
            outcome.get("remaining"),
        )
    else:
        logger.warning(
            "research_rag_reembed terminal job_id=%s error=%s",
            job_id,
            outcome.get("error"),
        )
    mark_job_done(job_id)
