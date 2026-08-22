"""RNOS-16 — Unified customer timeline (PostgreSQL customer_timeline_events)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

TIMELINE_EVENT_LEAD_INGESTED = "lead.ingested"
TIMELINE_EVENT_LEAD_MEETING_PREP_READY = "lead_meeting_prep_ready"
TIMELINE_ENTITY_LEAD = "lead"


def pg_customer_timeline_ready() -> bool:
    try:
        from ptt_jobs.db import pg_available, pg_connection

        if not pg_available():
            return False
        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'customer_timeline_events'
                    LIMIT 1
                    """
                )
                return cur.fetchone() is not None
    except Exception as exc:
        logger.debug("pg_customer_timeline_ready: %s", exc)
        return False


def _channel_to_event_source(channel: str | None) -> str:
    ch = (channel or "").strip().lower()
    if ch in {"meta", "facebook"}:
        return "meta"
    if ch == "zalo":
        return "zalo"
    if ch == "email":
        return "email"
    if ch == "seo":
        return "seo"
    return "crm"


def _normalize_uuid(value: str | None) -> str | None:
    text = str(value or "").strip()
    if not text or text.lower() == "unknown":
        return None
    if len(text) == 36 and text.count("-") == 4:
        return text.lower()
    return None


def _find_by_external_ref(cur, external_ref: str) -> str | None:
    cur.execute(
        """
        SELECT id::text FROM customer_timeline_events
        WHERE external_ref = %s
        LIMIT 1
        """,
        (external_ref,),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def insert_timeline_event(
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    event_source: str,
    client_id: str | None = None,
    title: str | None = None,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
    occurred_at: str | None = None,
    actor_id: str | None = None,
    external_ref: str | None = None,
) -> str | None:
    if not pg_customer_timeline_ready():
        return None
    try:
        from ptt_jobs.db import pg_connection

        ts = occurred_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        payload_json = json.dumps(payload or {})
        with pg_connection() as conn:
            with conn.cursor() as cur:
                if external_ref:
                    existing = _find_by_external_ref(cur, external_ref)
                    if existing:
                        return existing
                cur.execute(
                    """
                    INSERT INTO customer_timeline_events (
                        client_id, entity_type, entity_id, event_type, event_source,
                        title, body, payload, occurred_at, actor_id, external_ref
                    ) VALUES (
                        %s::uuid, %s, %s, %s, %s,
                        %s, %s, %s::jsonb, %s::timestamptz, %s, %s
                    )
                    RETURNING id::text
                    """,
                    (
                        _normalize_uuid(client_id),
                        entity_type,
                        entity_id,
                        event_type,
                        event_source,
                        title,
                        body,
                        payload_json,
                        ts,
                        actor_id,
                        external_ref,
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        return str(row[0]) if row else None
    except Exception as exc:
        logger.warning("insert_timeline_event failed: %s", exc)
        return None


def record_lead_ingested_timeline(
    *,
    lead_id: int,
    channel: str | None,
    client_id: str | None = None,
    external_lead_id: str | None = None,
    source: str | None = None,
    campaign_id: str | None = None,
    attribution: dict[str, Any] | None = None,
    correlation_id: str | None = None,
    occurred_at: str | None = None,
) -> str | None:
    ext = str(external_lead_id or "").strip()
    ch = (channel or "").strip().lower()
    external_ref = f"ingest:{ch}:{ext}" if ext and ch else f"ingest:lead:{lead_id}"
    event_source = _channel_to_event_source(channel)
    payload = {
        "entity_type": TIMELINE_ENTITY_LEAD,
        "entity_id": str(lead_id),
        "channel": channel,
        "source": source,
        "external_lead_id": external_lead_id,
        "campaign_id": campaign_id,
        "correlation_id": correlation_id,
        "attribution": attribution or {},
    }
    return insert_timeline_event(
        entity_type=TIMELINE_ENTITY_LEAD,
        entity_id=str(lead_id),
        event_type=TIMELINE_EVENT_LEAD_INGESTED,
        event_source=event_source,
        client_id=client_id,
        title=f"Lead ingest ({channel or 'unknown'})",
        payload=payload,
        occurred_at=occurred_at,
        actor_id="system",
        external_ref=external_ref,
    )


def record_lead_meeting_prep_ready_timeline(
    *,
    lead_id: int,
    client_id: str | None = None,
    dv_codes: list[str] | None = None,
    dv_names: list[str] | None = None,
    prep_version: int = 1,
) -> str | None:
    codes = [str(c) for c in (dv_codes or []) if c]
    names = [str(n) for n in (dv_names or []) if n]
    external_ref = f"lmp:ready:lead:{lead_id}:v{prep_version}"
    title = "AI chuẩn bị cuộc hẹn sẵn sàng"
    if names:
        body = f"Đề xuất: {', '.join(names[:3])}"
    elif codes:
        body = f"Đề xuất: {', '.join(codes[:3])}"
    else:
        body = "Prep result ready"
    payload = {
        "lead_id": lead_id,
        "dv_codes": codes,
        "dv_names": names,
        "prep_version": prep_version,
    }
    return insert_timeline_event(
        entity_type=TIMELINE_ENTITY_LEAD,
        entity_id=str(lead_id),
        event_type=TIMELINE_EVENT_LEAD_MEETING_PREP_READY,
        event_source="ai",
        client_id=client_id,
        title=title,
        body=body,
        payload=payload,
        actor_id="system",
        external_ref=external_ref,
    )


def build_attribution_from_legacy_item(item: dict[str, Any], channel: str) -> dict[str, Any]:
    meta = item.get("meta") if isinstance(item.get("meta"), dict) else {}
    return {
        "channel": channel,
        "source": item.get("source"),
        "external_lead_id": item.get("external_lead_id") or meta.get("facebook_leadgen_id") or meta.get("zalo_lead_id"),
        "campaign_id": item.get("campaign_id") or meta.get("campaign_id"),
        "form_id": meta.get("form_id") or meta.get("external_form_id"),
        "page_id": meta.get("page_id"),
        "utm_campaign": meta.get("utm_campaign") or item.get("utm_campaign"),
    }
