"""M6 — Dual Tavily triangulation: overlap, PII, credit cap, no insights."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_overlap_urls_normalizes_slash_and_case():
    from ptt_crm.market_research.triangulate import overlap_urls

    out = overlap_urls(["http://A/"], ["http://a"])
    assert out == {"http://a"}


def test_collect_triangulate_phone_does_not_enter_query(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    from ptt_crm.market_research import triangulate

    monkeypatch.setattr(
        triangulate,
        "_search_basic",
        lambda *_a, **_k: (
            [{"title": "A", "url": "https://example.com/a", "content": "c", "sourceType": "search"}],
            1,
        ),
    )
    monkeypatch.setattr(
        triangulate,
        "_search_advanced",
        lambda *_a, **_k: (
            [{"title": "B", "url": "https://example.com/b", "content": "c", "sourceType": "search"}],
            1,
        ),
    )

    out = triangulate.collect_triangulate(
        question_vi="Quy mô thị trường sữa 0909999999?",
        geo=["VN"],
        credits_already_used=0,
    )
    assert out["ok"] is True
    assert "0909999999" not in (out.get("query") or "")
    assert "insight" not in out
    assert "insights" not in out


def test_collect_triangulate_credit_cap_does_not_call_tavily(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    monkeypatch.setenv("MAX_TAVILY_CREDITS_PER_RESEARCH", "12")
    from ptt_crm.market_research import triangulate

    def boom(*_args, **_kwargs):
        raise AssertionError("Tavily must not be called over credit cap")

    monkeypatch.setattr(triangulate, "_search_basic", boom)
    monkeypatch.setattr(triangulate, "_search_advanced", boom)

    out = triangulate.collect_triangulate(
        question_vi="Quy mô thị trường?",
        geo=["VN"],
        credits_already_used=12,
    )
    assert out["ok"] is False
    assert out["error"] == "tavily_credit_cap"


def test_process_triangulate_writes_sources_never_insights(monkeypatch):
    from ptt_crm.market_research import triangulate

    repo = MagicMock()
    repo.load_desk_context.return_value = {"question_vi": "Quy mô?", "geo": ["VN"]}
    repo.insert_ai_sources.return_value = [201, 202]
    monkeypatch.setattr(triangulate, "repository", repo)
    monkeypatch.setattr(
        triangulate,
        "collect_triangulate",
        lambda **_k: {
            "ok": True,
            "sources": [
                {
                    "title": "A",
                    "url": "https://example.com/a",
                    "publisher": "example.com",
                    "excerpt": "a",
                    "source_type": "web",
                    "provider": "provider_a",
                },
                {
                    "title": "A2",
                    "url": "https://example.com/a/",
                    "publisher": "example.com",
                    "excerpt": "a2",
                    "source_type": "web",
                    "provider": "provider_b",
                },
            ],
            "overlap_urls": {"https://example.com/a"},
            "credits_used": 2,
            "query": "Quy mô?",
        },
    )

    out = triangulate.process_research_triangulate_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is True
    repo.insert_ai_sources.assert_called_once()
    inserted = repo.insert_ai_sources.call_args.kwargs["sources"]
    assert all(src.get("triangulated") is True for src in inserted)
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert repo.insert_insights.call_count == 0
    repo.succeed_run.assert_called_once()


@patch("ptt_jobs.handlers.research_triangulate.mark_job_done")
@patch("ptt_jobs.handlers.research_triangulate.process_research_triangulate_payload")
def test_handler_marks_done_on_collect_fail(process_mock, done_mock):
    from ptt_jobs.handlers.research_triangulate import run_research_triangulate_job

    process_mock.return_value = {"ok": False, "error": "tavily_unconfigured"}
    run_research_triangulate_job(
        {
            "id": "job-tri-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
            "attempts": 1,
            "max_attempts": 2,
        }
    )
    done_mock.assert_called_once_with("job-tri-1")
