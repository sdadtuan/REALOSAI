"""Tests for P13 RAG re-embed backfill."""
from __future__ import annotations

from unittest.mock import patch

from ptt_crm.market_research import rag_reembed


@patch("ptt_crm.market_research.rag_reembed.repository.succeed_run")
@patch("ptt_crm.market_research.rag_reembed.fetch_openai_embedding")
@patch("ptt_crm.market_research.rag_reembed.repository.upsert_insight_embedding")
@patch("ptt_crm.market_research.rag_reembed.repository.list_reembed_candidates")
@patch("ptt_crm.market_research.rag_reembed.repository.count_reembed_stale")
@patch("ptt_crm.market_research.rag_reembed.repository.mark_run_running")
@patch("ptt_crm.market_research.rag_reembed.openai_embed_live", return_value=True)
def test_process_reembed_skips_pii_and_upserts_clean(
    _live,
    _mark,
    count_stale,
    list_candidates,
    upsert,
    fetch_embed,
    succeed,
) -> None:
    list_candidates.return_value = [
        {
            "insight_id": 1,
            "project_id": 9,
            "statement": "Giá sữa tăng",
            "observation": None,
        },
        {
            "insight_id": 2,
            "project_id": 9,
            "statement": "email test@example.com",
            "observation": None,
        },
    ]
    fetch_embed.return_value = {
        "embedding": [0.1, 0.2],
        "model": "text-embedding-3-small",
        "dims": 256,
    }
    count_stale.return_value = 1

    out = rag_reembed.process_research_rag_reembed_payload(
        {"project_id": 9, "run_id": 77, "limit": 10}
    )

    assert out["ok"] is True
    assert out["processed"] == 1
    assert out["skipped_pii"] == 1
    upsert.assert_called_once()
    fetch_embed.assert_called_once()
    succeed.assert_called_once()


@patch("ptt_crm.market_research.rag_reembed.repository.fail_run")
@patch("ptt_crm.market_research.rag_reembed.openai_embed_live", return_value=False)
def test_process_reembed_disabled(_live, fail_run) -> None:
    out = rag_reembed.process_research_rag_reembed_payload(
        {"project_id": 9, "run_id": 77, "limit": 10}
    )
    assert out["error"] == "rag_reembed_disabled"
    fail_run.assert_called_once_with(77, "rag_reembed_disabled")
