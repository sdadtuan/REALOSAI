"""Arm step — talk track, objections, offer ladder (S-LMP-3)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ptt_crm import lmp_llm_client
from ptt_crm.lead_meeting_prep import offer_ladder

PROMPT_VERSION = "lmp-arm-v2"
ROOT = Path(__file__).resolve().parents[2]


def _load_system_prompt() -> str:
    path = ROOT / "docs" / "prompts" / "lmp" / "lmp-arm-v2.system.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return (
        "Return JSON with talk_track, objection_playbook, stakeholder_hints, "
        "and optional deal_room_payload for sales arming."
    )


def build_stub_arm(
    inp: dict[str, Any],
    base_result: dict[str, Any],
    strategized: dict[str, Any],
    *,
    prep_stage: str,
) -> dict[str, Any]:
    company = inp.get("company_name") or "doanh nghiệp"
    script = base_result.get("consulting_script") or {}
    opening = str(script.get("opening") or f"Xin chào, em gọi từ PTT về hỗ trợ marketing cho {company}.")
    services = base_result.get("recommended_services") or []
    ladder = offer_ladder.build_offer_ladder(services, industry=inp.get("industry"))

    talk_track = {
        "framework": "SPIN",
        "total_minutes": 15,
        "phases": [
            {
                "phase_vi": "Situation — 3 phút",
                "script_vi": opening,
                "duration_min": 3,
            },
            {
                "phase_vi": "Problem — 5 phút",
                "script_vi": (
                    f"Hiện {company} đang gặp khó ở đâu trong việc tạo lead/chuyển đổi? "
                    f"Em thấy ghi nhận: {inp.get('problem') or 'chưa có pain chi tiết'}."
                ),
                "duration_min": 5,
            },
            {
                "phase_vi": "Implication — 4 phút",
                "script_vi": (
                    "Nếu không xử lý trong 90 ngày, chi phí cơ hội và lead rơi vào đối thủ sẽ tăng. "
                    "Anh/chị ước lượng mất bao nhiêu lead/tháng?"
                ),
                "duration_min": 4,
            },
            {
                "phase_vi": "Need-payoff — 3 phút",
                "script_vi": (
                    f"Nếu có gói {ladder[1]['label_vi']} chạy ổn trong 60 ngày, "
                    "anh/chị muốn đo KPI nào trước?"
                ),
                "duration_min": 3,
            },
        ],
    }

    objections = [
        {
            "objection_vi": "Em bận / gọi lại sau",
            "rebuttal_vi": "Dạ em hỏi đúng 3 câu SPIN, 5 phút — hoặc em gửi lịch qua Zalo?",
        },
        {
            "objection_vi": "Đắt quá / chưa có ngân sách",
            "rebuttal_vi": (
                "Em có 3 mức CB/TC/CS — mình bắt đầu gói entry để pilot ROI trước, "
                "không cần cam kết dài hạn ngay."
            ),
        },
        {
            "objection_vi": "Đã có agency rồi",
            "rebuttal_vi": (
                "PTT có playbook ngành + ops delivery minh bạch — "
                "em so sánh KPI 90 ngày, không chỉ báo cáo impression."
            ),
        },
    ]

    out: dict[str, Any] = {
        "close_readiness_score": int(strategized.get("close_readiness_score") or 50),
        "urgency_signals": strategized.get("urgency_signals") or [],
        "pain_roi_estimate": strategized.get("pain_roi_estimate") or {},
        "competitive_angle": strategized.get("competitive_angle") or {},
        "offer_ladder": ladder,
        "talk_track": talk_track,
        "objection_playbook": objections,
        "stakeholder_hints": [
            {
                "role_vi": "Chủ doanh nghiệp / GD",
                "likely_concern_vi": "ROI và rủi ro triển khai",
                "question_vi": "90 ngày tới anh/chị cần con số gì để coi là thành công?",
            },
            {
                "role_vi": "Marketing lead",
                "likely_concern_vi": "Workload team nội bộ",
                "question_vi": "Team hiện có bao nhiêu % capacity cho campaign mới?",
            },
        ],
        "red_flags": strategized.get("red_flags") or [],
    }

    if prep_stage == "m3_pre_close":
        primary = ladder[1] if len(ladder) > 1 else ladder[0]
        out["deal_room_payload"] = {
            "opening_narrative_vi": (
                f"Mở đầu buổi chốt: PTT đề xuất lộ trình 3 gói cho {company}, "
                f"ưu tiên {primary['label_vi']} vì cân bằng chi phí và kết quả đo được."
            ),
            "slide_bullets_vi": [
                f"Pain hiện tại: {inp.get('problem') or 'cần xác nhận thêm'}",
                f"Gói đề xuất: {primary['sku_code']} — {primary['headline_vi']}",
                "KPI 60–90 ngày: lead, CPL, chuyển đổi",
            ],
            "recommended_close_ask_vi": (
                f"Anh/chị duyệt pilot gói {primary['tier']} ({primary['sku_code']}) "
                "để team triển khai trong 2 tuần tới?"
            ),
            "primary_dv_code": primary["dv_code"],
            "recommended_tier": primary["tier"],
        }

    return out


def build_user_prompt(
    inp: dict[str, Any],
    base_result: dict[str, Any],
    strategized: dict[str, Any],
    *,
    prep_stage: str,
) -> str:
    ladder = offer_ladder.build_offer_ladder(
        base_result.get("recommended_services") or [],
        industry=inp.get("industry"),
    )
    return (
        f"prep_stage: {prep_stage}\n\n"
        f"## Strategize output\n{json.dumps(strategized, ensure_ascii=False, indent=2)}\n\n"
        f"## Offer ladder seed\n{json.dumps(ladder, ensure_ascii=False, indent=2)}\n\n"
        f"## Consulting script\n{json.dumps(base_result.get('consulting_script') or {}, ensure_ascii=False)}"
    )


def run_arm(
    inp: dict[str, Any],
    base_result: dict[str, Any],
    strategized: dict[str, Any],
    *,
    prep_stage: str = "m1_first_strike",
    correlation_id: str | None = None,
) -> dict[str, Any]:
    stub = build_stub_arm(inp, base_result, strategized, prep_stage=prep_stage)
    llm_out = lmp_llm_client.complete_synthesize(
        lead_id=int(inp.get("lead_id") or 0),
        client_id=str(inp.get("client_id") or "") or None,
        system_prompt=_load_system_prompt(),
        user_prompt=build_user_prompt(inp, base_result, strategized, prep_stage=prep_stage),
        prompt_version=PROMPT_VERSION,
        prep_stage=prep_stage,
        stub_json=lambda: stub,
        correlation_id=correlation_id,
    )
    parsed = llm_out.get("parsed") if llm_out.get("ok") else stub
    if not isinstance(parsed, dict):
        parsed = stub

    # Merge strategize fields if LLM arm omits them
    for key in ("urgency_signals", "pain_roi_estimate", "competitive_angle", "red_flags"):
        if key not in parsed or not parsed[key]:
            parsed[key] = strategized.get(key) or stub.get(key)

    if not parsed.get("offer_ladder"):
        parsed["offer_ladder"] = stub["offer_ladder"]
    if not parsed.get("talk_track"):
        parsed["talk_track"] = stub["talk_track"]
    if not parsed.get("objection_playbook"):
        parsed["objection_playbook"] = stub["objection_playbook"]

    return parsed
