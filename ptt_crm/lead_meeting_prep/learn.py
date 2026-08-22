"""M4 learn step — enrich win_outcome_json after debrief (S-LMP-6)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from ptt_crm.lead_meeting_prep import repository

logger = logging.getLogger(__name__)


def _pick(meta: dict[str, Any], *keys: str) -> str:
    for key in keys:
        val = meta.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def process_learn(lead_id: int, *, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if not repository.table_ready():
        return {"ok": False, "error": "crm_lead_meeting_prep_table_missing", "lead_id": lead_id}

    row = repository.get_prep_row(lead_id)
    win = (row or {}).get("win_outcome_json") or {}
    if isinstance(win, str):
        try:
            win = json.loads(win)
        except json.JSONDecodeError:
            win = {}

    submitted_at = str(win.get("submitted_at") or "").strip()
    if not submitted_at:
        logger.debug("M4 learn skipped lead=%s — debrief not submitted yet", lead_id)
        return {"ok": True, "lead_id": lead_id, "skipped": True, "reason": "debrief_pending"}

    lead_ctx = repository.get_lead_context(lead_id) or {}
    meta = lead_ctx.get("meta_json") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            meta = {}

    result = repository.get_result_json(lead_id) or {}
    services = result.get("recommended_services") or []
    dv_codes = [
        str(s.get("dv_code") or "")
        for s in services
        if isinstance(s, dict) and s.get("dv_code")
    ]

    enriched = dict(win)
    enriched["learn_processed_at"] = datetime.now(timezone.utc).isoformat()
    enriched["recommended_dv_codes"] = dv_codes
    enriched["industry_slug"] = _pick(meta, "industry", "industry_slug") or None
    if payload and payload.get("terminal_status"):
        enriched["terminal_status"] = payload["terminal_status"]

    repository.update_win_outcome_json(lead_id, enriched)
    logger.info("M4 learn processed lead_id=%s tier=%s", lead_id, enriched.get("closed_tier"))
    return {"ok": True, "lead_id": lead_id, "status": "learn_done", "win_outcome": enriched}
