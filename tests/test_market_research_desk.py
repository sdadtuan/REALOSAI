"""M4 — Desk Tavily collect: PII guard, missing key, credit cap."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_pii_guard_strips_phone_and_email():
    from ptt_crm.market_research.pii_guard import strip_pii

    out = strip_pii("Quy mô thị trường 0901234567 liên hệ a@b.com tại VN")
    assert "0901234567" not in out
    assert "a@b.com" not in out
    assert "Quy mô thị trường" in out
    assert "VN" in out


def test_collect_desk_no_key_returns_tavily_unconfigured(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    from ptt_crm.market_research.desk_collect import collect_desk

    out = collect_desk(question_vi="Quy mô thị trường sữa uống VN?", geo=["VN"])
    assert out["ok"] is False
    assert out["error"] == "tavily_unconfigured"
    assert out.get("sources") in (None, [])


def test_collect_desk_credit_cap_does_not_call_tavily(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    monkeypatch.setenv("MAX_TAVILY_CREDITS_PER_RESEARCH", "12")
    from ptt_crm.market_research import desk_collect

    def boom(*_args, **_kwargs):
        raise AssertionError("Tavily must not be called over credit cap")

    monkeypatch.setattr(desk_collect, "_search", boom)
    monkeypatch.setattr(desk_collect, "_extract", boom)

    out = desk_collect.collect_desk(
        question_vi="Quy mô thị trường?",
        geo=["VN"],
        credits_already_used=12,
    )
    assert out["ok"] is False
    assert out["error"] == "tavily_credit_cap"


def test_collect_desk_mocked_tavily_returns_sources(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    from ptt_crm.market_research import desk_collect

    monkeypatch.setattr(
        desk_collect,
        "_search",
        lambda *_a, **_k: (
            [{"title": "Dairy VN", "url": "https://example.com/dairy", "content": "c", "sourceType": "search"}],
            1,
        ),
    )
    monkeypatch.setattr(desk_collect, "_extract", lambda *_a, **_k: ([], 0))

    out = desk_collect.collect_desk(question_vi="Quy mô thị trường sữa 0909999999?", geo=["VN"])
    assert out["ok"] is True
    assert out["credits_used"] == 1
    assert out["sources"][0]["url"] == "https://example.com/dairy"
    assert "0909999999" not in (out.get("query") or "")


def test_process_desk_payload_records_credits_used_on_collect_fail(monkeypatch):
    from ptt_crm.market_research import desk_collect, repository

    fail = MagicMock()
    monkeypatch.setattr(
        repository, "load_desk_context", lambda *_a, **_k: {"question_vi": "Quy mô?", "geo": ["VN"]}
    )
    monkeypatch.setattr(repository, "sum_project_tavily_credits", lambda *_a, **_k: 0)
    monkeypatch.setattr(repository, "mark_run_running", lambda *_a, **_k: None)
    monkeypatch.setattr(repository, "fail_run", fail)
    monkeypatch.setattr(
        desk_collect,
        "collect_desk",
        lambda **_k: {
            "ok": False,
            "error": "tavily_search_failed: timeout",
            "credits_used": 1,
        },
    )

    out = desk_collect.process_research_desk_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is False
    fail.assert_called_once_with(3, "tavily_search_failed: timeout", credits_used=1)


@patch("ptt_jobs.handlers.research_desk.mark_job_done")
@patch("ptt_jobs.handlers.research_desk.process_research_desk_payload")
def test_handler_marks_done_when_tavily_unconfigured(process_mock, done_mock):
    from ptt_jobs.handlers.research_desk import run_research_desk_job

    process_mock.return_value = {"ok": False, "error": "tavily_unconfigured"}
    run_research_desk_job(
        {
            "id": "job-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
            "attempts": 1,
            "max_attempts": 2,
        }
    )
    done_mock.assert_called_once_with("job-1")


@patch("ptt_jobs.handlers.research_desk.mark_job_done")
@patch("ptt_jobs.handlers.research_desk.process_research_desk_payload")
def test_handler_marks_done_when_tavily_search_failed(process_mock, done_mock):
    """Collect fail is terminal for the queue; FE Thử lại is the only retry."""
    from ptt_jobs.handlers.research_desk import run_research_desk_job

    process_mock.return_value = {"ok": False, "error": "tavily_search_failed: timeout"}
    run_research_desk_job(
        {
            "id": "job-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
            "attempts": 1,
            "max_attempts": 2,
        }
    )
    done_mock.assert_called_once_with("job-1")
