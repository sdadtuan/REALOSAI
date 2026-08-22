"""P5 M1 — Whisper ingest: excerpts only, temp file gone, no raw transcript."""
from __future__ import annotations

import json
import tempfile
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch


def _whisper_temp(suffix: str = ".mp3") -> Path:
    path = Path(tempfile.gettempdir()) / f"research-whisper-{uuid.uuid4()}{suffix}"
    path.write_bytes(b"fake-audio")
    return path


def test_process_unlinks_temp_and_caps_excerpts(monkeypatch):
    from ptt_crm.market_research import whisper_ingest

    audio = _whisper_temp(".wav")

    repo = MagicMock()
    ids = {"n": 100}

    def insert_evidence(**kwargs):
        excerpt = kwargs["excerpt"]
        assert len(excerpt) <= 500
        ids["n"] += 1
        return {"id": ids["n"], "excerpt": excerpt, "locator": kwargs["locator"]}

    repo.insert_evidence.side_effect = insert_evidence
    monkeypatch.setattr(whisper_ingest, "repository", repo)
    monkeypatch.setattr(
        whisper_ingest,
        "transcribe_audio",
        lambda _path, _mime=None: "One short line. Two short line. " + ("x" * 20_000),
    )

    out = whisper_ingest.process_research_whisper_payload(
        {
            "project_id": 1,
            "study_id": 2,
            "run_id": 3,
            "temp_path": str(audio),
            "mime": "audio/wav",
        }
    )

    assert out["ok"] is True
    assert audio.exists() is False
    assert repo.insert_evidence.call_count >= 1
    for call in repo.insert_evidence.call_args_list:
        excerpt = call.kwargs["excerpt"]
        assert len(excerpt) <= 500
    repo.succeed_run.assert_called_once()
    output = repo.succeed_run.call_args.kwargs["output"]
    assert list(output.keys()) == ["excerpt_ids"]
    assert "transcript" not in output
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert "report" not in called


@patch("ptt_jobs.handlers.research_whisper.mark_job_done")
@patch("ptt_jobs.handlers.research_whisper.process_research_whisper_payload")
def test_handler_unlinks_even_when_process_raises(process_mock, done_mock):
    from ptt_jobs.handlers.research_whisper import run_research_whisper_job

    audio = _whisper_temp(".wav")
    process_mock.side_effect = RuntimeError("boom")

    run_research_whisper_job(
        {
            "id": "job-whisper-1",
            "payload": {
                "project_id": 1,
                "study_id": 2,
                "run_id": 3,
                "temp_path": str(audio),
                "mime": "audio/wav",
            },
        }
    )

    done_mock.assert_called_once_with("job-whisper-1")
    assert audio.exists() is False


def test_transcribe_sends_audio_filename_and_mime(monkeypatch):
    from ptt_crm.market_research import whisper_ingest

    audio = _whisper_temp(".mp3")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    captured: dict[str, bytes] = {}

    class FakeResp:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps({"text": "hello"}).encode()

    def fake_urlopen(req, timeout=None):
        captured["data"] = req.data
        return FakeResp()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    try:
        text = whisper_ingest.transcribe_audio(str(audio), "audio/mpeg")
        assert text == "hello"
        body = captured["data"]
        assert f'filename="{audio.name}"'.encode() in body
        assert b"Content-Type: audio/mpeg" in body
        assert b"application/octet-stream" not in body
        assert not audio.name.endswith(".")
        assert audio.name.endswith(".mp3")
    finally:
        audio.unlink(missing_ok=True)


def test_evidence_pii_class_mirrors_nest_resolve():
    from ptt_crm.market_research.pii_guard import evidence_pii_class

    assert evidence_pii_class("quoted line about brand") == "none"
    assert evidence_pii_class("Gọi 0909123456 sau buổi IDI") == "internal"
    assert evidence_pii_class("Contact analyst@ptt.vn for the raw table") == "internal"


def test_unlink_refuses_path_outside_temp_or_without_prefix(tmp_path):
    from ptt_crm.market_research.whisper_ingest import _unlink_quiet

    victim = tmp_path / "important.wav"
    victim.write_bytes(b"keep")
    _unlink_quiet(str(victim))
    assert victim.exists() is True

    other = Path(tempfile.gettempdir()) / f"not-whisper-{uuid.uuid4()}.mp3"
    other.write_bytes(b"keep")
    try:
        _unlink_quiet(str(other))
        assert other.exists() is True
    finally:
        other.unlink(missing_ok=True)
