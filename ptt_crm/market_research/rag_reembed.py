"""RAG OpenAI re-embed backfill — corpus approved_client_facing | published only."""
from __future__ import annotations

import logging
from typing import Any

from ptt_crm.market_research import repository
from ptt_crm.market_research.openai_embed import (
    OPENAI_EMBED_DIMS,
    OPENAI_EMBED_MODEL,
    fetch_openai_embedding,
    openai_embed_live,
)
from ptt_crm.market_research.pii_guard import pii_hint

logger = logging.getLogger(__name__)


def process_research_rag_reembed_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    client_id = payload.get("client_id")
    client_id_str = str(client_id).strip() if client_id else None
    allowed = payload.get("allowed_client_ids")
    allowed_ids = [str(x) for x in allowed] if isinstance(allowed, list) else None
    try:
        limit = max(1, min(int(payload.get("limit") or 50), 200))
    except (TypeError, ValueError):
        limit = 50

    empty = {"ok": False, "processed": 0, "skipped_pii": 0, "failed": 0, "remaining": 0}
    if project_id <= 0 or run_id <= 0:
        return {**empty, "error": "invalid_payload"}

    if not openai_embed_live():
        repository.fail_run(run_id, "rag_reembed_disabled")
        return {**empty, "error": "rag_reembed_disabled", "ok": True, "skipped": True}

    repository.mark_run_running(run_id)
    candidates = repository.list_reembed_candidates(
        client_id=client_id_str,
        allowed_client_ids=allowed_ids,
        target_dims=OPENAI_EMBED_DIMS,
        target_model=OPENAI_EMBED_MODEL,
        limit=limit,
    )

    processed = 0
    skipped_pii = 0
    failed = 0
    for row in candidates:
        statement = str(row.get("statement") or "")
        observation = row.get("observation")
        obs = str(observation) if observation is not None else ""
        embed_text = " ".join(f"{statement} {obs}".split())
        if not embed_text.strip() or pii_hint(embed_text):
            skipped_pii += 1
            continue
        try:
            resolved = fetch_openai_embedding(embed_text)
            repository.upsert_insight_embedding(
                insight_id=int(row["insight_id"]),
                project_id=int(row["project_id"]),
                embedding=list(resolved["embedding"]),
                embed_text=embed_text,
                embed_model=str(resolved["model"]),
                embed_dims=int(resolved["dims"]),
            )
            processed += 1
        except Exception:
            logger.exception("rag_reembed insight_id=%s failed", row.get("insight_id"))
            failed += 1

    remaining = repository.count_reembed_stale(
        client_id=client_id_str,
        allowed_client_ids=allowed_ids,
        target_dims=OPENAI_EMBED_DIMS,
        target_model=OPENAI_EMBED_MODEL,
    )
    output = {
        "processed": processed,
        "skipped_pii": skipped_pii,
        "failed": failed,
        "remaining": remaining,
    }
    if failed > 0 and processed == 0:
        repository.fail_run(run_id, "rag_reembed_failed")
        return {**empty, **output, "error": "rag_reembed_failed"}

    repository.succeed_run(run_id, credits_used=processed, output=output)
    return {"ok": True, **output}
