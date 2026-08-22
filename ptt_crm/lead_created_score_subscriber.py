"""LeadCreated domain_events → score_lead enqueue (RNOS-08 backup path)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _parse_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def fetch_recent_lead_created_events(*, limit: int = 50, since_hours: int = 72) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, since_hours))
    lim = max(1, min(int(limit), 200))
    try:
        from ptt_jobs.db import pg_connection

        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, payload, correlation_id, created_at
                    FROM domain_events
                    WHERE event_type = 'LeadCreated'
                      AND created_at >= %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (cutoff, lim),
                )
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as exc:
        logger.debug("fetch LeadCreated events for score: %s", exc)
        return []


def process_lead_created_score_outbox(
    *,
    batch_size: int = 50,
    since_hours: int = 72,
) -> dict[str, Any]:
    """
    Enqueue score_lead for LeadCreated outbox rows (backup when direct enqueue missed).

    Idempotency key score_lead:lead:{lead_id} prevents duplicate jobs.
    """
    from ptt_crm.ai_score_enqueue import enqueue_score_lead_job, score_lead_async_enabled

    if not score_lead_async_enabled():
        return {"ok": True, "skipped": True, "reason": "score_async_disabled"}

    events = fetch_recent_lead_created_events(limit=batch_size, since_hours=since_hours)
    enqueued = 0
    skipped = 0
    errors: list[str] = []

    for ev in events:
        payload = _parse_payload(ev.get("payload"))
        lead_id = payload.get("lead_id")
        if lead_id is None:
            skipped += 1
            continue
        client_id = str(payload.get("client_id") or "").strip() or None
        try:
            out = enqueue_score_lead_job(
                lead_id=int(lead_id),
                client_id=client_id,
                correlation_id=str(ev.get("correlation_id") or ev.get("id") or "") or None,
            )
            if out:
                enqueued += 1
            else:
                skipped += 1
        except Exception as exc:
            errors.append(f"lead_id={lead_id}:{exc}")
            logger.debug("LeadCreated score enqueue failed: %s", exc)

    return {
        "ok": len(errors) == 0,
        "scanned": len(events),
        "enqueued": enqueued,
        "skipped": skipped,
        "errors": errors[:5],
    }
