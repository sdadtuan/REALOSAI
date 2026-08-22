"""P5 M3 — SparkToro source candidates only; no insights."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_map_sparktoro_response_has_no_statement():
    from ptt_crm.market_research.sparktoro_collect import (
        SPARKTORO_LIMITATION_NOTE,
        map_sparktoro_response,
    )

    out = map_sparktoro_response(
        {
            "results": [
                {
                    "url": "https://sparktoro.com/audience/sua-uong",
                    "title": "Audience overlap sữa uống",
                    "snippet": "Ước lượng overlap audience ngành sữa uống tại VN.",
                    "statement": "must not leak",
                }
            ]
        }
    )
    assert len(out) == 1
    assert out[0]["publisher"] == "SparkToro"
    assert out[0]["reliability_tier"] in {"low", "medium"}
    assert out[0]["limitation_note"].strip()
    assert out[0]["limitation_note"] == SPARKTORO_LIMITATION_NOTE
    assert "statement" not in out[0]
    assert "insight" not in out[0]


def test_map_drops_pii_snippet():
    from ptt_crm.market_research.sparktoro_collect import map_sparktoro_response

    out = map_sparktoro_response(
        {
            "results": [
                {"url": "https://sparktoro.com/ok", "title": "Clean", "snippet": "No PII"},
                {
                    "url": "https://sparktoro.com/pii",
                    "title": "Leak",
                    "snippet": "Contact analyst@ptt.vn",
                },
            ]
        }
    )
    assert len(out) == 1
    assert out[0]["url"] == "https://sparktoro.com/ok"


def test_collect_flag_or_key_off_is_disabled(monkeypatch):
    from ptt_crm.market_research import sparktoro_collect

    monkeypatch.delenv("RESEARCH_SPARKTORO_ENABLED", raising=False)
    monkeypatch.delenv("SPARKTORO_API_KEY", raising=False)
    fetch = MagicMock()
    out = sparktoro_collect.collect_sparktoro(
        question_vi="Ai overlap?",
        geo=["VN"],
        fetch=fetch,
    )
    assert out["ok"] is True
    assert out["error"] == "sparktoro_disabled"
    assert out["sources"] == []
    fetch.assert_not_called()


def test_process_inserts_sparktoro_sources_not_insight(monkeypatch):
    from ptt_crm.market_research import sparktoro_collect

    repo = MagicMock()
    repo.load_desk_context.return_value = {
        "question_vi": "Ai overlap audience sữa uống?",
        "geo": ["VN"],
    }
    inserted = []

    def insert_sparktoro_sources(**kwargs):
        for src in kwargs["sources"]:
            assert src["publisher"] == "SparkToro"
            assert src["reliability_tier"] in {"low", "medium"}
            assert str(src.get("limitation_note") or "").strip()
            assert src.get("ai_generated") is True
            assert src.get("keep") is True
            assert "statement" not in src
        inserted.extend(kwargs["sources"])
        return [44]

    repo.insert_sparktoro_sources.side_effect = insert_sparktoro_sources
    monkeypatch.setattr(sparktoro_collect, "repository", repo)
    monkeypatch.setenv("RESEARCH_SPARKTORO_ENABLED", "1")
    monkeypatch.setenv("SPARKTORO_API_KEY", "st-test")
    monkeypatch.setattr(
        sparktoro_collect,
        "collect_sparktoro",
        lambda **_k: {
            "ok": True,
            "sources": [
                {
                    "title": "Audience overlap sữa uống",
                    "url": "https://sparktoro.com/audience/sua-uong",
                    "publisher": "SparkToro",
                    "reliability_tier": "medium",
                    "limitation_note": "Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”.",
                    "snippet": "overlap",
                    "source_type": "web",
                    "ai_generated": True,
                    "keep": True,
                }
            ],
            "query": "Ai overlap audience sữa uống? VN",
        },
    )

    out = sparktoro_collect.process_research_sparktoro_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is True
    assert out["source_ids"] == [44]
    assert inserted
    repo.succeed_run.assert_called_once()
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert "report" not in called
    assert "create_insight" not in called


def test_fetch_sparktoro_normalizes_websites(monkeypatch):
    from ptt_crm.market_research import sparktoro_collect

    def fake_create(_q, _k, _loc):
        return {"report_id": "rpt-9", "status": "ready"}

    def fake_websites(_rid, _k, _limit):
        return {
            "data": [{"domain": "a.com", "affinity": 10, "category": "Biz", "meta_description": "A"}],
            "meta": {"credits_charged": 2},
        }

    monkeypatch.setattr(sparktoro_collect, "_create_report", fake_create)
    monkeypatch.setattr(sparktoro_collect, "_get_websites", fake_websites)
    raw = sparktoro_collect._fetch_sparktoro("query", "key", ["VN"])
    assert raw["results"][0]["url"] == "https://a.com"
    assert raw["credits_used"] == 12
    assert raw["report_id"] == "rpt-9"


def test_collect_sparktoro_http_error(monkeypatch):
    from ptt_crm.market_research import sparktoro_collect

    monkeypatch.setenv("RESEARCH_SPARKTORO_ENABLED", "1")
    monkeypatch.setenv("SPARKTORO_API_KEY", "st-test")

    def boom(_q, _k, _geo):
        raise RuntimeError("sparktoro_create_http_401")

    out = sparktoro_collect.collect_sparktoro(
        question_vi="Ai overlap?",
        geo=["VN"],
        fetch=boom,
    )
    assert out["ok"] is False
    assert out["error"] == "sparktoro_create_http_401"
    assert out["sources"] == []


@patch("ptt_jobs.handlers.research_sparktoro.mark_job_done")
@patch("ptt_jobs.handlers.research_sparktoro.process_research_sparktoro_payload")
def test_handler_marks_done(process_mock, done_mock):
    from ptt_jobs.handlers.research_sparktoro import run_research_sparktoro_job

    process_mock.return_value = {"ok": True, "source_ids": [44]}
    run_research_sparktoro_job(
        {
            "id": "job-st-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
        }
    )
    done_mock.assert_called_once_with("job-st-1")
