"""RNOS-23 — pipeline risk scan API client + job handler tests."""
from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock, patch


class TestPipelineRiskScan(unittest.TestCase):
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_pipeline_risk_scan_missing_key(self, _key):
        from ptt_crm.ai_score_api_client import pipeline_risk_scan_via_api

        out = pipeline_risk_scan_via_api()
        self.assertFalse(out.get("ok"))
        self.assertTrue(out.get("skipped"))

    @patch("ptt_crm.ai_score_api_client.urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="secret")
    def test_pipeline_risk_scan_via_api(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import pipeline_risk_scan_via_api

        resp = MagicMock()
        resp.status = 200
        resp.read.return_value = json.dumps({"data": {"scanned": 3, "alerts_created": 1}}).encode("utf-8")
        urlopen_mock.return_value.__enter__.return_value = resp

        out = pipeline_risk_scan_via_api(limit=50, correlation_id="c-rnos23")
        self.assertTrue(out.get("ok"))
        self.assertEqual(out["body"]["data"]["scanned"], 3)

    @patch("ptt_jobs.handlers.pipeline_risk_scan.mark_job_done")
    @patch("ptt_jobs.handlers.pipeline_risk_scan.process_pipeline_risk_scan_payload")
    def test_run_pipeline_risk_scan_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.pipeline_risk_scan import run_pipeline_risk_scan_job

        process_mock.return_value = {"ok": True}
        run_pipeline_risk_scan_job({"id": "job-1", "payload": {"limit": 100}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")


if __name__ == "__main__":
    unittest.main()
