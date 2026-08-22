from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "scripts" / "fixtures"


def _transport_from_fixture():
    csv = (FIXTURES / "qualtrics-export.sample.csv").read_text(encoding="utf-8")

    def transport(*, method: str, url: str, headers: dict, body: bytes | None = None, binary: bool = False):
        if "/export-responses" in url and method == "POST":
            return {"status": 200, "body": json.dumps({"result": {"progressId": "ES_1"}}).encode()}
        if "/export-responses/ES_1" in url and method == "GET" and not url.endswith("/file"):
            return {
                "status": 200,
                "body": json.dumps({"result": {"status": "complete", "fileId": "FILE_1"}}).encode(),
            }
        if url.endswith("/file"):
            return {"status": 200, "body": csv.encode("utf-8")}
        return {"status": 404, "body": b"{}"}

    return transport


def test_fetch_qualtrics_export_csv_with_transport():
    from ptt_crm.market_research import qualtrics_collect

    out = qualtrics_collect.fetch_qualtrics_export_csv(
        survey_id="SV_test",
        api_key="k",
        datacenter="iad1",
        transport=_transport_from_fixture(),
    )
    assert "RSP_001" in out["csv_text"]
    assert out["progress_id"] == "ES_1"
    assert out["file_id"] == "FILE_1"


def test_collect_qualtrics_builds_drafts():
    from ptt_crm.market_research import qualtrics_collect

    column_map = json.loads((FIXTURES / "qualtrics-column-map.sample.json").read_text(encoding="utf-8"))
    out = qualtrics_collect.collect_qualtrics(
        survey_id="SV_test",
        api_key="k",
        datacenter="iad1",
        column_map=column_map,
        transport=_transport_from_fixture(),
    )
    assert len(out["drafts"]) >= 1
    assert out["drafts"][0]["locator"] == "Q-Q1"


@patch("ptt_jobs.handlers.research_qualtrics.mark_job_done")
@patch("ptt_crm.market_research.qualtrics_collect.process_research_qualtrics_payload")
def test_run_research_qualtrics_job_marks_done(process_mock, done_mock):
    from ptt_jobs.handlers.research_qualtrics import run_research_qualtrics_job

    process_mock.return_value = {"ok": True, "evidence_ids": [1]}
    run_research_qualtrics_job(
        {
            "id": "job-qx-1",
            "payload": {"project_id": 9, "study_id": 5, "run_id": 84},
        }
    )
    done_mock.assert_called_once_with("job-qx-1")
