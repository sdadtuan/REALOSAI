"""Job handler — research deep research sources + outline (M5)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.market_research.deep_research import process_research_deep_payload
from ptt_jobs.store import mark_job_done

logger = logging.getLogger(__name__)


def run_research_deep_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    run_id = int((payload or {}).get("run_id") or 0)

    try:
        outcome = process_research_deep_payload(payload if isinstance(payload, dict) else {})
    except Exception as exc:
        logger.exception("research_deep_research crashed job_id=%s", job_id)
        if run_id > 0:
            try:
                from ptt_crm.market_research import repository

                repository.fail_run(run_id, str(exc))
            except Exception:
                logger.exception("research_deep fail_run skipped run_id=%s", run_id)
        mark_job_done(job_id)
        return

    mark_job_done(job_id)
    if outcome.get("ok"):
        logger.info(
            "research_deep_research done job_id=%s run_id=%s sources=%s",
            job_id,
            payload.get("run_id"),
            len(outcome.get("source_ids") or outcome.get("sources") or []),
        )
        return

    error = str(outcome.get("error") or "research_deep_research failed")
    logger.warning("research_deep_research terminal job_id=%s error=%s", job_id, error)
