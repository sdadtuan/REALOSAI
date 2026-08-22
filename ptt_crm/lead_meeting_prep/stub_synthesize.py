"""Stub synthesize + optional Tavily collect — S-LMP-1 skeleton."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def load_spc_dv_codes(limit: int = 3) -> list[dict[str, str]]:
    try:
        from ptt_jobs.db import pg_connection, pg_available

        if not pg_available():
            return []
        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT dv_code, name_vi, department
                    FROM spc_family
                    WHERE active = true
                      AND readiness IN ('published', 'ga')
                    ORDER BY sort_order
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
                return [
                    {"dv_code": r[0], "name_vi": r[1], "department": r[2] or ""}
                    for r in rows
                ]
    except Exception:
        return []


def stub_collect(inp: dict[str, Any]) -> dict[str, Any]:
    """S-LMP-1 placeholder — real Tavily in S-LMP-1b."""
    return {
        "company_found": True,
        "company_sources": [],
        "credits_used": 0,
        "credits_limit": int(os.environ.get("MAX_TAVILY_CREDITS_PER_LEAD", "8") or 8),
        "researched_at": datetime.now(timezone.utc).isoformat(),
        "stub": True,
        "note": "Tavily collect not wired — stub mode S-LMP-1",
    }


def build_stub_result(inp: dict[str, Any], collect: dict[str, Any]) -> dict[str, Any]:
    dv_rows = load_spc_dv_codes(3)
    if not dv_rows:
        dv_rows = [
            {"dv_code": "DV02", "name_vi": "Quảng cáo Meta", "department": "MKT"},
            {"dv_code": "DV05", "name_vi": "SEO Website", "department": "MKT"},
            {"dv_code": "DV04", "name_vi": "Content Marketing", "department": "MKT"},
        ]

    recommended = []
    for idx, dv in enumerate(dv_rows[:3], start=1):
        recommended.append(
            {
                "dv_code": dv["dv_code"],
                "name_vi": dv["name_vi"],
                "department": dv["department"],
                "reason": f"Phù hợp ngành {inp.get('industry') or 'doanh nghiệp'} — stub S-LMP-1",
                "priority": idx,
            }
        )

    company = inp.get("company_name") or "Doanh nghiệp"
    return {
        "company_profile": {
            "summary": (
                f"{company} — bản prep skeleton (S-LMP-1). "
                "Bổ sung Tavily + LLM ở sprint tiếp theo."
            ),
            "facts": [
                {
                    "label": "Tên công ty",
                    "value": company,
                    "type": "inferred",
                },
            ],
        },
        "contact_profile": {
            "found": False,
            "summary": "Không research profile cá nhân liên hệ (policy).",
            "facts": [],
        },
        "social_channels": [],
        "recommended_services": recommended,
        "consulting_script": {
            "opening": (
                f"Anh/chị ơi, em gọi từ PTT — em thấy {company} đang [pain hook từ intake/notes]. "
                "Em muốn hỏi nhanh 2–3 phút về mục tiêu marketing hiện tại."
            ),
            "pain_points": [inp.get("problem") or "Chưa có thông tin pain — hỏi thêm khi gọi"],
            "key_questions": [
                "Hiện anh/chị đang chạy kênh marketing nào?",
                "Ngân sách marketing hàng tháng khoảng bao nhiêu?",
                "Mục tiêu 90 ngày tới là gì?",
            ],
            "objection_handling": [
                {
                    "objection": "Em bận / gọi lại sau",
                    "response": "Dạ em hỏi đúng 3 câu, 5 phút thôi ạ — hoặc em gửi lịch hẹn qua Zalo?",
                },
            ],
        },
        "meta": {
            "researched_at": datetime.now(timezone.utc).isoformat(),
            "sources_count": len(collect.get("company_sources") or []),
            "model": "stub",
            "prompt_version": "lmp-stub-v1",
            "prep_stage": "m1_first_strike",
            "tavily_credits_used": int(collect.get("credits_used") or 0),
            "partial_collect": bool(collect.get("stub")),
        },
    }


def compute_readiness_score(inp: dict[str, Any], collect: dict[str, Any]) -> int:
    from ptt_crm.lead_meeting_prep.readiness import compute_readiness_score as _score

    return _score(inp, collect)
