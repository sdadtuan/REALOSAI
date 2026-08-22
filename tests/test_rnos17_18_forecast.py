"""Tests for RNOS-17/18 forecast snapshot job."""
from __future__ import annotations

import unittest
from unittest.mock import patch


class TestRnos1718Forecast(unittest.TestCase):
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_forecast_snapshot_missing_key(self, _key):
        from ptt_crm.ai_score_api_client import forecast_snapshot_via_api

        out = forecast_snapshot_via_api()
        self.assertFalse(out["ok"])
        self.assertTrue(out.get("skipped"))

    @patch("urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="test-key")
    def test_forecast_snapshot_via_api(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import forecast_snapshot_via_api

        class Resp:
            status = 200

            def read(self):
                return b'{"data":{"snapshot_id":"s1"}}'

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        urlopen_mock.return_value = Resp()
        out = forecast_snapshot_via_api(force=True, correlation_id="c-rnos17")
        self.assertTrue(out["ok"])

    @patch("ptt_jobs.handlers.forecast_snapshot.mark_job_done")
    @patch("ptt_jobs.handlers.forecast_snapshot.process_forecast_snapshot_payload")
    def test_run_forecast_snapshot_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.forecast_snapshot import run_forecast_snapshot_job

        process_mock.return_value = {"ok": True, "response": {}}
        run_forecast_snapshot_job({"id": "job-1", "payload": {"force": True}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")


if __name__ == "__main__":
    unittest.main()
