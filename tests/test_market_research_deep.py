"""M5 — Deep Research sources only: no insight insert, outline in output."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_collect_deep_credit_cap_does_not_call_tavily(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    monkeypatch.setenv("MAX_TAVILY_CREDITS_PER_RESEARCH", "12")
    from ptt_crm.market_research import deep_research

    def boom(*_args, **_kwargs):
        raise AssertionError("Tavily must not be called over credit cap")

    monkeypatch.setattr(deep_research, "_search_advanced", boom)

    out = deep_research.collect_deep(
        question_vi="Quy mô thị trường?",
        geo=["VN"],
        credits_already_used=12,
    )
    assert out["ok"] is False
    assert out["error"] == "tavily_credit_cap"


def test_process_deep_payload_records_credits_used_on_collect_fail(monkeypatch):
    from ptt_crm.market_research import deep_research

    repo = MagicMock()
    repo.load_desk_context.return_value = {"question_vi": "Quy mô?", "geo": ["VN"]}
    repo.sum_project_tavily_credits.return_value = 0
    monkeypatch.setattr(deep_research, "repository", repo)
    monkeypatch.setattr(
        deep_research,
        "collect_deep",
        lambda **_k: {
            "ok": False,
            "error": "tavily_search_failed: timeout",
            "credits_used": 2,
        },
    )

    out = deep_research.process_research_deep_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is False
    repo.fail_run.assert_called_once_with(
        3, "tavily_search_failed: timeout", credits_used=2
    )


def test_collect_deep_builds_sources_and_outline_without_insights(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    monkeypatch.setenv("RESEARCH_DEEP_PROVIDER", "openai")
    from ptt_crm.market_research import deep_research

    monkeypatch.setattr(
        deep_research,
        "_search_advanced",
        lambda *_a, **_k: (
            [
                {
                    "title": "Dairy VN 2026",
                    "url": "https://example.com/dairy",
                    "content": "public excerpt",
                    "sourceType": "search",
                }
            ],
            1,
        ),
    )

    out = deep_research.collect_deep(question_vi="Quy mô thị trường sữa 0909999999?", geo=["VN"])
    assert out["ok"] is True
    assert out["sources"][0]["url"] == "https://example.com/dairy"
    assert out["sources"][0]["ai_generated"] is True
    assert "outline" in out
    assert out["outline"]["sections"]
    assert "insight" not in out
    assert "insights" not in out
    assert "0909999999" not in (out.get("query") or "")
    assert out["provider"].endswith("_fallback_tavily")


def test_process_deep_payload_writes_sources_and_outline_never_insights(monkeypatch):
    from ptt_crm.market_research import deep_research

    repo = MagicMock()
    repo.load_desk_context.return_value = {"question_vi": "Quy mô?", "geo": ["VN"]}
    repo.insert_ai_sources.return_value = [101]
    monkeypatch.setattr(deep_research, "repository", repo)
    monkeypatch.setattr(
        deep_research,
        "collect_deep",
        lambda **_k: {
            "ok": True,
            "sources": [
                {
                    "title": "Dairy VN",
                    "url": "https://example.com/dairy",
                    "publisher": "example.com",
                    "excerpt": "public excerpt",
                    "source_type": "web",
                    "ai_generated": True,
                }
            ],
            "outline": {
                "kind": "source_outline",
                "sections": [{"heading": "Dairy VN", "source_url": "https://example.com/dairy"}],
            },
            "credits_used": 1,
            "provider": "openai_fallback_tavily",
            "query": "Quy mô?",
        },
    )

    out = deep_research.process_research_deep_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is True
    assert out["source_ids"] == [101]
    repo.insert_ai_sources.assert_called_once()
    repo.succeed_run.assert_called_once()
    output = repo.succeed_run.call_args.kwargs["output"]
    assert output["outline"]["kind"] == "source_outline"
    assert output["source_ids"] == [101]
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert not hasattr(repo.insert_insight, "assert_called") or repo.insert_insight.call_count == 0
    assert repo.insert_insights.call_count == 0


@patch("ptt_jobs.handlers.research_deep.mark_job_done")
@patch("ptt_jobs.handlers.research_deep.process_research_deep_payload")
def test_handler_marks_done_on_collect_fail(process_mock, done_mock):
    from ptt_jobs.handlers.research_deep import run_research_deep_job

    process_mock.return_value = {"ok": False, "error": "tavily_unconfigured"}
    run_research_deep_job(
        {
            "id": "job-deep-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
            "attempts": 1,
            "max_attempts": 2,
        }
    )
    done_mock.assert_called_once_with("job-deep-1")
