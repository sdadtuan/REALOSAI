"""Outbox publisher — domain_events → RabbitMQ."""
from __future__ import annotations

import logging

from ptt_jobs.broker import publish_pending_events

logger = logging.getLogger(__name__)


def run_event_publisher(*, batch_size: int = 50) -> int:
    published = publish_pending_events(batch_size=batch_size)
    try:
        from ptt_meta.lead_created_subscriber import process_lead_created_outbox

        capi_out = process_lead_created_outbox(batch_size=batch_size)
        if capi_out.get("enqueued"):
            logger.info(
                "LeadCreated → CAPI enqueued=%s scanned=%s",
                capi_out.get("enqueued"),
                capi_out.get("scanned"),
            )
    except Exception as exc:
        logger.debug("LeadCreated subscriber: %s", exc)
    try:
        from ptt_crm.lead_created_score_subscriber import process_lead_created_score_outbox

        score_out = process_lead_created_score_outbox(batch_size=batch_size)
        if score_out.get("enqueued"):
            logger.info(
                "LeadCreated → score_lead enqueued=%s scanned=%s",
                score_out.get("enqueued"),
                score_out.get("scanned"),
            )
    except Exception as exc:
        logger.debug("LeadCreated score subscriber: %s", exc)
    return published
