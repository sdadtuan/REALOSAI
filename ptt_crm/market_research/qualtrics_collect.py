"""Qualtrics survey export → codebook evidence (P10 M3). Never create insights."""
from __future__ import annotations

import io
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from typing import Any, Callable

from ptt_crm.market_research import repository
from ptt_crm.market_research.pii_guard import pii_hint

logger = logging.getLogger(__name__)

QUALTRICS_LIMITATION_NOTE = (
    "Mẫu convenience Qualtrics — không MOE/95%. Không suy đại diện dân số."
)
QUALTRICS_SURVEY_ID_RE = __import__("re").compile(r"^SV_[A-Za-z0-9]+$")
MAX_DATA_ROWS = 500
CODEBOOK_COLUMNS = [
    "respondent_id",
    "question_code",
    "value",
    "unit",
    "value_base",
    "period_note",
    "geography",
]


def _flag_on() -> bool:
    return (os.environ.get("RESEARCH_QUALTRICS_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _api_key() -> str:
    return (os.environ.get("QUALTRICS_API_KEY") or "").strip()


def _datacenter() -> str:
    return (os.environ.get("QUALTRICS_DATACENTER") or "").strip()


def _poll_ms() -> int:
    try:
        return max(500, int(os.environ.get("QUALTRICS_EXPORT_POLL_MS") or 3000))
    except ValueError:
        return 3000


def _timeout_ms() -> int:
    try:
        return max(5000, int(os.environ.get("QUALTRICS_EXPORT_TIMEOUT_MS") or 120000))
    except ValueError:
        return 120000


def decode_qualtrics_export_bytes(raw: bytes) -> str:
    if len(raw) >= 2 and raw[0:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for name in zf.namelist():
                if name.lower().endswith(".csv"):
                    return zf.read(name).decode("utf-8")
        raise RuntimeError("qualtrics_zip_no_csv")
    return raw.decode("utf-8")


def fetch_qualtrics_export_csv(
    *,
    survey_id: str,
    api_key: str,
    datacenter: str,
    transport: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, str]:
    send = transport or _default_transport
    base = f"https://{datacenter}.qualtrics.com/API/v3/surveys/{urllib.parse.quote(survey_id, safe='')}"
    started = send(
        method="POST",
        url=f"{base}/export-responses",
        headers={"X-API-TOKEN": api_key, "Content-Type": "application/json"},
        body=json.dumps({"format": "csv"}).encode("utf-8"),
    )
    if started.get("status", 0) < 200 or started.get("status", 0) >= 300:
        raise RuntimeError(f"qualtrics_export_start_{started.get('status')}")
    start_body = json.loads(started.get("body") or b"{}")
    progress_id = str((start_body.get("result") or {}).get("progressId") or "").strip()
    if not progress_id:
        raise RuntimeError("qualtrics_missing_progress_id")

    deadline = time.time() + (_timeout_ms() / 1000.0)
    file_id = ""
    while time.time() < deadline:
        prog = send(
            method="GET",
            url=f"{base}/export-responses/{urllib.parse.quote(progress_id, safe='')}",
            headers={"X-API-TOKEN": api_key},
        )
        if prog.get("status", 0) < 200 or prog.get("status", 0) >= 300:
            raise RuntimeError(f"qualtrics_export_poll_{prog.get('status')}")
        body = json.loads(prog.get("body") or b"{}")
        result = body.get("result") or {}
        if result.get("status") == "complete":
            file_id = str(result.get("fileId") or "").strip()
            break
        if result.get("status") == "failed":
            raise RuntimeError("qualtrics_export_failed")
        time.sleep(_poll_ms() / 1000.0)
    if not file_id:
        raise RuntimeError("qualtrics_export_timeout")

    file_resp = send(
        method="GET",
        url=f"{base}/export-responses/{urllib.parse.quote(file_id, safe='')}/file",
        headers={"X-API-TOKEN": api_key},
        binary=True,
    )
    if file_resp.get("status", 0) < 200 or file_resp.get("status", 0) >= 300:
        raise RuntimeError(f"qualtrics_export_download_{file_resp.get('status')}")
    csv_text = decode_qualtrics_export_bytes(file_resp.get("body") or b"")
    return {"csv_text": csv_text, "progress_id": progress_id, "file_id": file_id}


def _default_transport(
    *,
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes | None = None,
    binary: bool = False,
) -> dict[str, Any]:
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return {"status": resp.status, "body": raw}
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        return {"status": exc.code, "body": payload}


def parse_csv(text: str) -> list[list[str]]:
    raw = str(text or "").lstrip("\ufeff")
    rows: list[list[str]] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        if '"' in line:
            raise RuntimeError("codebook_csv_invalid")
        rows.append([cell.strip() for cell in line.split(",")])
    return rows


def wide_csv_to_codebook_csv(wide_csv: str, column_map: dict[str, Any]) -> str:
    rows = parse_csv(wide_csv)
    if not rows:
        return ",".join(CODEBOOK_COLUMNS)
    header = rows[0]
    resp_idx = next(
        (i for i, col in enumerate(header) if col.strip().lower() == "responseid"),
        0,
    )
    out = [",".join(CODEBOOK_COLUMNS)]
    data_rows = 0
    for cells in rows[1:]:
        if data_rows >= MAX_DATA_ROWS:
            break
        respondent = str(cells[resp_idx] if resp_idx < len(cells) else "").strip()
        if not respondent:
            continue
        for col, qid in enumerate(header):
            if col == resp_idx:
                continue
            qid = str(qid or "").strip()
            if not qid:
                continue
            mapping = column_map.get(qid)
            if not isinstance(mapping, dict):
                continue
            raw = str(cells[col] if col < len(cells) else "").strip()
            if not raw:
                continue
            try:
                value = float(raw)
            except ValueError:
                continue
            if value != value:  # NaN
                continue
            period = str(mapping.get("period_note") or "").strip()
            geo = str(mapping.get("geography") or "").strip()
            out.append(
                ",".join(
                    [
                        respondent,
                        str(mapping.get("question_code") or ""),
                        str(value).rstrip("0").rstrip(".") if "." in str(value) else str(int(value) if value == int(value) else value),
                        str(mapping.get("unit") or ""),
                        str(mapping.get("value_base") or ""),
                        period,
                        geo,
                    ]
                )
            )
            data_rows += 1
            if data_rows >= MAX_DATA_ROWS:
                break
    return "\n".join(out)


def parse_codebook_csv(text: str) -> list[dict[str, Any]]:
    rows = parse_csv(text)
    if not rows:
        raise RuntimeError("codebook_csv_invalid")
    header = [cell.lower() for cell in rows[0]]
    if header != CODEBOOK_COLUMNS:
        raise RuntimeError("codebook_csv_invalid")
    data = rows[1:]
    if len(data) > MAX_DATA_ROWS:
        raise RuntimeError("codebook_row_cap")
    drafts: list[dict[str, Any]] = []
    for cells in data:
        if len(cells) != len(CODEBOOK_COLUMNS):
            raise RuntimeError("codebook_csv_invalid")
        rec = dict(zip(CODEBOOK_COLUMNS, cells))
        for cell in rec.values():
            if pii_hint(str(cell or "")):
                raise RuntimeError("survey_pii_forbidden")
        try:
            value_num = float(rec["value"])
        except ValueError:
            continue
        if value_num != value_num:
            continue
        drafts.append(
            {
                "locator": f"Q-{rec['question_code']}",
                "value_num": value_num,
                "unit": rec["unit"],
                "value_base": rec["value_base"],
                "period_note": rec.get("period_note") or "",
                "geography": rec.get("geography") or "",
                "respondent_id": rec["respondent_id"],
            }
        )
    return drafts


def resolve_qualtrics_column_map(study: dict[str, Any], body_map: dict[str, Any] | None) -> dict[str, Any] | None:
    if body_map and len(body_map) > 0:
        return body_map
    note = str(study.get("weighting_note") or "").strip()
    if not note:
        return None
    try:
        parsed = json.loads(note)
        mapped = parsed.get("qualtrics_column_map") if isinstance(parsed, dict) else None
        if isinstance(mapped, dict) and len(mapped) > 0:
            return mapped
    except json.JSONDecodeError:
        return None
    return None


def collect_qualtrics(
    *,
    survey_id: str,
    api_key: str,
    datacenter: str,
    column_map: dict[str, Any],
    transport: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    exported = fetch_qualtrics_export_csv(
        survey_id=survey_id,
        api_key=api_key,
        datacenter=datacenter,
        transport=transport,
    )
    codebook_csv = wide_csv_to_codebook_csv(exported["csv_text"], column_map)
    drafts = parse_codebook_csv(codebook_csv)
    return {
        "drafts": drafts,
        "progress_id": exported["progress_id"],
        "file_id": exported["file_id"],
    }


def process_research_qualtrics_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    study_id = int(payload.get("study_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    column_map = payload.get("column_map") if isinstance(payload.get("column_map"), dict) else {}
    empty: dict[str, Any] = {"ok": False, "evidence_ids": []}
    if project_id <= 0 or study_id <= 0 or run_id <= 0:
        return {**empty, "error": "invalid_payload"}

    if not _flag_on() or not _api_key() or not _datacenter():
        repository.fail_run(run_id, "qualtrics_disabled")
        return {**empty, "ok": True, "skipped": True, "error": "qualtrics_disabled"}

    study = repository.load_study_for_project(study_id, project_id)
    if not study or str(study.get("method") or "") != "survey":
        repository.fail_run(run_id, "not_found")
        return {**empty, "error": "not_found"}

    survey_id = str(study.get("instrument_version") or "").strip()
    if not QUALTRICS_SURVEY_ID_RE.match(survey_id):
        repository.fail_run(run_id, "qualtrics_survey_id_required")
        return {**empty, "error": "qualtrics_survey_id_required"}

    resolved_map = resolve_qualtrics_column_map(study, column_map) or column_map
    if not resolved_map:
        repository.fail_run(run_id, "qualtrics_map_required")
        return {**empty, "error": "qualtrics_map_required"}

    repository.mark_run_running(run_id)
    try:
        collected = collect_qualtrics(
            survey_id=survey_id,
            api_key=_api_key(),
            datacenter=_datacenter(),
            column_map=resolved_map,
        )
    except RuntimeError as exc:
        code = str(exc)
        if code == "survey_pii_forbidden":
            repository.fail_run(run_id, "survey_pii_forbidden")
            return {**empty, "ok": True, "skipped": True, "error": code}
        repository.fail_run(run_id, "qualtrics_failed")
        return {**empty, "error": "qualtrics_failed"}

    drafts = list(collected.get("drafts") or [])
    if not drafts:
        repository.fail_run(run_id, "qualtrics_failed")
        return {**empty, "error": "qualtrics_failed"}

    try:
        outcome = repository.insert_qualtrics_codebook_evidence(
            project_id=project_id,
            study_id=study_id,
            study_name=str(study.get("name") or "Qualtrics survey"),
            drafts=drafts,
        )
    except RuntimeError as exc:
        if str(exc) == "survey_pii_forbidden":
            repository.fail_run(run_id, "survey_pii_forbidden")
            return {**empty, "ok": True, "skipped": True, "error": "survey_pii_forbidden"}
        repository.fail_run(run_id, "qualtrics_failed")
        return {**empty, "error": "qualtrics_failed"}

    repository.succeed_run(
        run_id,
        credits_used=0,
        output={
            "evidence_ids": outcome["evidence_ids"],
            "source_id": outcome["source_id"],
            "n": outcome["n"],
            "progress_id": collected.get("progress_id"),
            "file_id": collected.get("file_id"),
            "survey_id": survey_id,
        },
    )
    return {**outcome, "ok": True}
