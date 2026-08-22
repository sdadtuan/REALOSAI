"""Strategize step — pain ROI, urgency, competitive angle, red flags (S-LMP-3)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ptt_crm import lmp_llm_client
from ptt_crm.lead_meeting_prep import playbook_rag

PROMPT_VERSION = "lmp-strategize-v2"
ROOT = Path(__file__).resolve().parents[2]


def _load_system_prompt() -> str:
    path = ROOT / "docs" / "prompts" / "lmp" / "lmp-strategize-v2.system.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return (
        "Return JSON with pain_roi_estimate, urgency_signals, competitive_angle, red_flags "
        "for B2B sales close intelligence."
    )


def build_stub_strategize(
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    prep_stage: str,
    base_score: int,
) -> dict[str, Any]:
    company = inp.get("company_name") or "Doanh nghiệp"
    industry = inp.get("industry") or "chưa rõ ngành"
    problem = inp.get("problem") or "chưa mô tả pain cụ thể"
    return {
        "pain_roi_estimate": {
            "pain_vnd_low": None,
            "pain_vnd_high": None,
            "basis": f"Chưa đủ dữ liệu quant — pain mô tả: {problem[:200]}",
            "type": "inferred",
        },
        "urgency_signals": [
            {
                "signal": "Lead mới tạo — window first strike",
                "evidence": f"Công ty {company}, ngành {industry}",
                "type": "inferred",
            }
        ],
        "competitive_angle": {
            "vs_status_quo": "Tự làm hoặc chưa có hệ thống marketing đo lường được ROI.",
            "vs_generic_agency": "Agency nhỏ thường thiếu playbook ngành và dashboard KPI chuẩn.",
            "ptt_proof": [
                "PTT có catalog 21 DV chuẩn hóa + intake BANT",
                "Ops hub theo dõi delivery và KPI sau triển khai",
            ],
            "playbook_slug": None,
        },
        "red_flags": [],
        "close_readiness_score": base_score,
        "_stub": True,
        "_prep_stage": prep_stage,
    }


def build_user_prompt(
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    prep_stage: str,
    base_result: dict[str, Any] | None = None,
) -> str:
    return (
        f"prep_stage: {prep_stage}\n\n"
        f"## Lead\n{json.dumps(inp, ensure_ascii=False, indent=2)}\n\n"
        f"## BANT / intake hints\n"
        f"bant_total={inp.get('bant_total')}, intake_decision={inp.get('intake_decision')}\n\n"
        f"## Collect summary\n"
        f"sources={len(collect.get('company_sources') or [])}, "
        f"company_found={collect.get('company_found')}\n\n"
        f"## Base prep\n{json.dumps((base_result or {}).get('company_profile') or {}, ensure_ascii=False)}"
    )


def run_strategize(
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    prep_stage: str = "m1_first_strike",
    base_result: dict[str, Any] | None = None,
    base_score: int = 35,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    stub = build_stub_strategize(inp, collect, prep_stage=prep_stage, base_score=base_score)
    llm_out = lmp_llm_client.complete_synthesize(
        lead_id=int(inp.get("lead_id") or 0),
        client_id=str(inp.get("client_id") or "") or None,
        system_prompt=_load_system_prompt(),
        user_prompt=build_user_prompt(inp, collect, prep_stage=prep_stage, base_result=base_result),
        prompt_version=PROMPT_VERSION,
        prep_stage=prep_stage,
        stub_json=lambda: stub,
        correlation_id=correlation_id,
    )
    parsed = llm_out.get("parsed") if llm_out.get("ok") else stub
    if not isinstance(parsed, dict):
        parsed = stub
    parsed.setdefault("close_readiness_score", base_score)

    service_slug = None
    if base_result:
        services = base_result.get("recommended_services") or []
        if services and isinstance(services[0], dict):
            service_slug = services[0].get("service_slug") or services[0].get("dv_code")
    parsed = playbook_rag.inject_playbook_into_strategize(
        parsed,
        industry=inp.get("industry"),
        service_slug=str(service_slug) if service_slug else None,
    )
    return parsed
