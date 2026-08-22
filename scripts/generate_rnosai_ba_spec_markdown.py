#!/usr/bin/env python3
"""Generate professional RNOSAI BA spec — master index + module annexes."""
from __future__ import annotations

from pathlib import Path

from build_ba_spec_workbook import _safe_sheet_name
from rnosai_ba_catalog_data import (
    BUSINESS_RULES,
    CODE_REGISTRY,
    MODULES,
    SCREENS,
    TEST_CASES,
    TODAY,
    TRACEABILITY,
    USE_CASES,
    VERSION,
    _uc_doc_link,
    get_all_screen_details,
    get_all_use_case_details,
    manual_screen_count,
    manual_use_case_count,
)

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "docs" / "specs"
MODULES_DIR = SPECS / "modules"
MASTER = SPECS / "RNOSAI-BA-Master-Spec.md"
LEGACY = SPECS / "RNOSAI-BA-Screen-UseCase-Spec.md"
AI_ANNEX = MODULES_DIR / "RNOSAI-BA-AI-UseCases.md"
CRM_ANNEX = MODULES_DIR / "RNOSAI-BA-CRM-UseCases.md"
META_ANNEX = MODULES_DIR / "RNOSAI-BA-META-UseCases.md"
SVC_ANNEX = MODULES_DIR / "RNOSAI-BA-SVC-UseCases.md"
SEO_ANNEX = MODULES_DIR / "RNOSAI-BA-SEO-UseCases.md"
PORTAL_ANNEX = MODULES_DIR / "RNOSAI-BA-PORTAL-UseCases.md"
SYS_ANNEX = MODULES_DIR / "RNOSAI-BA-SYS-UseCases.md"
EM_ANNEX = MODULES_DIR / "RNOSAI-BA-EM-UseCases.md"
PLAT_ANNEX = MODULES_DIR / "RNOSAI-BA-PLAT-UseCases.md"
MOB_ANNEX = MODULES_DIR / "RNOSAI-BA-MOB-UseCases.md"
ZALO_ANNEX = MODULES_DIR / "RNOSAI-BA-ZALO-UseCases.md"
XLSX = ROOT / "docs" / "samples" / "RNOSAI_BA_Spec.xlsx"


def _md_table(headers: list[str], rows: list[list]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        cells = [str(c).replace("|", "\\|").replace("\n", "<br>") for c in row]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _kv_block(pairs: list[tuple[str, str]]) -> str:
    return "\n".join(f"- **{k}:** {v}" for k, v in pairs)


def _badge_manual(is_manual: bool) -> str:
    return "🟢 Spec thủ công" if is_manual else "⚪ Spec auto"


def _uc_section(uc_id: str, detail: dict) -> str:
    is_manual = detail.get("_manual", False)
    parts = [
        f"### {uc_id} — {detail['meta'][1][1]}",
        "",
        f"> {_badge_manual(is_manual)}",
        "",
        _kv_block(detail["meta"]),
        "",
        "#### Luồng chính",
        "",
        _md_table(["Bước", "Mô tả"], detail["main_flow"]),
        "",
        "#### Luồng thay thế / ngoại lệ",
        "",
        _md_table(["Mã", "Mô tả"], detail["alt_flow"]),
        "",
        "#### Dữ liệu vào / ra",
        "",
        _md_table(["Loại", "Nội dung"], detail["io"]),
        "",
        "#### Quy tắc nghiệp vụ",
        "",
    ]
    br_rows = [[r, next((b[1] for b in BUSINESS_RULES if b[0] == r), "—")] for r in detail["rules"]]
    parts.append(_md_table(["Mã rule", "Mô tả"], br_rows))
    parts.append("")
    return "\n".join(parts)


def _screen_section(scr_id: str, detail: dict) -> str:
    is_manual = not detail.get("_auto", False)
    parts = [
        f"### {scr_id} — {detail['meta'][1][1]}",
        "",
        f"> {_badge_manual(is_manual)}",
        "",
        _kv_block(detail["meta"]),
        "",
        "#### Thành phần UI",
        "",
        _md_table(["STT", "Thành phần", "Loại", "Bắt buộc", "Mô tả"], detail["ui"]),
        "",
        "#### Quy tắc nghiệp vụ",
        "",
    ]
    br_rows = [[r, next((b[1] for b in BUSINESS_RULES if b[0] == r), "—")] for r in detail["rules"]]
    parts.append(_md_table(["Mã rule", "Mô tả"], br_rows))
    parts.append("")
    return "\n".join(parts)


def _module_ucs(prefix: str) -> list[list]:
    return [u for u in USE_CASES if str(u[0]).startswith(f"{prefix}-UC-")]


def _excel_sheet_maps() -> tuple[dict[str, str], dict[str, str]]:
    used: set[str] = set()
    scr = {sid: _safe_sheet_name(sid, used) for sid in sorted(get_all_screen_details())}
    uc = {uid: _safe_sheet_name(uid, used) for uid in sorted(get_all_use_case_details())}
    return scr, uc


def _build_module_annex(
    title: str,
    module_id: str,
    prefix: str,
    intro: str,
    related_screens: list[str],
) -> str:
    uc_details = get_all_use_case_details()
    screen_details = get_all_screen_details()
    ucs = _module_ucs(prefix)
    manual = sum(1 for u in ucs if uc_details[str(u[0])].get("_manual"))

    sections = [
        f"# {title}",
        "",
        "## Document control",
        "",
        _md_table(
            ["Thuộc tính", "Giá trị"],
            [
                ["Document ID", f"RNOSAI-BA-{prefix}-UC"],
                ["Phiên bản", VERSION],
                ["Ngày xuất", TODAY],
                ["Module", module_id],
                ["Số UC", str(len(ucs))],
                ["Spec thủ công", f"{manual}/{len(ucs)}"],
                ["Master index", "[RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md)"],
                ["Catalog gốc", f"[`{_uc_doc_link(f'{prefix}-UC-001')}`](../../use-cases/{Path(_uc_doc_link(f'{prefix}-UC-001')).name})"],
            ],
        ),
        "",
        "---",
        "",
        "## 1. Tóm tắt module",
        "",
        intro,
        "",
        "### 1.1. Màn hình liên quan",
        "",
    ]

    scr_rows = []
    for row in SCREENS:
        if row[0] in related_screens or row[2] in related_screens:
            scr_rows.append([row[0], row[1], row[3], row[5], row[6]])
    if scr_rows:
        sections.append(_md_table(["SCR", "Tên", "Route", "Status", "UC liên quan"], scr_rows))
    else:
        sections.append("_Không có màn hình riêng — UC gắn cross-module._")

    sections.extend([
        "",
        "### 1.2. Ma trận UC",
        "",
        _md_table(
            ["ID", "Tên", "Priority", "Status", "Spec"],
            [
                [
                    u[0],
                    u[1],
                    u[4],
                    u[5],
                    "Thủ công" if uc_details[str(u[0])].get("_manual") else "Auto",
                ]
                for u in ucs
            ],
        ),
        "",
        "---",
        "",
        "## 2. Chi tiết Use Case",
        "",
    ])

    for row in ucs:
        uc_id = str(row[0])
        sections.append(_uc_section(uc_id, uc_details[uc_id]))

    if related_screens:
        sections.extend([
            "---",
            "",
            "## 3. Chi tiết Màn hình module",
            "",
        ])
        for scr_id in related_screens:
            if scr_id in screen_details:
                sections.append(_screen_section(scr_id, screen_details[scr_id]))

    sections.extend([
        "---",
        "",
        "## 4. Business Rules module",
        "",
        _md_table(
            ["BR", "Mô tả", "Priority", "Status"],
            [[b[0], b[1], b[3], b[4]] for b in BUSINESS_RULES if str(b[0]).startswith(f"BR-{prefix}")],
        ),
        "",
    ])
    return "\n".join(sections)


def _build_master() -> str:
    screen_details = get_all_screen_details()
    uc_details = get_all_use_case_details()
    m_scr = manual_screen_count()
    m_uc = manual_use_case_count()
    ai_uc = _module_ucs("AI")
    crm_uc = _module_ucs("CRM")
    meta_uc = _module_ucs("META")
    svc_uc = _module_ucs("SVC")
    seo_uc = _module_ucs("SEO")
    portal_uc = _module_ucs("PORTAL")
    sys_uc = _module_ucs("SYS")
    em_uc = _module_ucs("EM")
    plat_uc = _module_ucs("PLAT")
    zalo_uc = _module_ucs("ZALO")
    mob_uc = _module_ucs("MOB")
    scr_sheets, uc_sheets = _excel_sheet_maps()

    toc = [
        "[Document control](#document-control)",
        "[1. Executive summary](#1-executive-summary)",
        "[2. Kiến trúc & phạm vi](#2-kiến-trúc--phạm-vi)",
        "[3. Quy ước mã](#3-quy-ước-mã)",
        "[4. Module catalog](#4-module-catalog)",
        "[5. Screen inventory](#5-screen-inventory)",
        "[6. Use case inventory](#6-use-case-inventory)",
        "[7. Module annexes (spec thủ công)](#7-module-annexes-spec-thủ-công)",
        "[8. Business rules](#8-business-rules)",
        "[9. Traceability matrix](#9-traceability-matrix)",
        "[10. Test cases](#10-test-cases)",
        "[11. Screen details (P0)](#11-screen-details-p0)",
        "[12. Change log](#12-change-log)",
    ]

    sections = [
        "# RNOSAI — Business Analysis Master Specification",
        "",
        "> **Document class:** Internal BA / QA / Engineering",
        f"> **Version:** {VERSION} · **Generated:** {TODAY}",
        "",
        "## Document control",
        "",
        _md_table(
            ["Field", "Value"],
            [
                ["Document ID", "RNOSAI-BA-MASTER"],
                ["Title", "RNOSAI BA Master Spec — Screens & Use Cases"],
                ["Version", VERSION],
                ["Status", "Approved for engineering reference"],
                ["Author", "BA / Revenue OS Team"],
                ["Source of truth", "`scripts/rnosai_ba_catalog_data.py`"],
                ["Excel mirror", f"[`RNOSAI_BA_Spec.xlsx`](../samples/RNOSAI_BA_Spec.xlsx)"],
                ["Staff app", "https://rs.pttads.vn (ops-web :3200 + API :3000)"],
                ["Client portal", "https://portal.pttads.vn"],
            ],
        ),
        "",
        "### Mục lục",
        "",
        "\n".join(f"- {line}" for line in toc),
        "",
        "---",
        "",
        "## 1. Executive summary",
        "",
        "Bộ tài liệu mô tả **toàn bộ màn hình (SCR)** và **use case (UC)** của RNOSAI — Revenue Operating System + AI cho agency PTT. "
        "Cấu trúc bám template PTTCOM «Cấu trúc file Excel đề xuất.docx» với 3 lớp:",
        "",
        "1. **Master Spec** (file này) — inventory, traceability, governance",
        "2. **Module Annexes** — spec thủ công chi tiết 11 module (CRM, Meta, SVC, SEO, Portal, SYS, EM, PLAT, AI, Zalo, Mobile)",
        "3. **Excel Workbook** — quản lý sprint, filter, validation trạng thái; **click mã SCR/UC hoặc cột «→ Sheet spec»** để mở sheet chi tiết",
        "",
        _md_table(
            ["Metric", "Count", "Manual spec"],
            [
                ["Màn hình (SCR)", str(len(SCREENS)), f"{m_scr} spec (15 P0 + {manual_screen_count() - 15} deep/enriched)"],
                ["Use case (UC)", str(len(USE_CASES)), f"{m_uc} thủ công — 100% catalog ({len(crm_uc)} CRM + {len(meta_uc)} Meta + {len(svc_uc)} SVC + {len(seo_uc)} SEO + {len(portal_uc)} Portal + {len(sys_uc)} SYS + {len(em_uc)} EM + {len(plat_uc)} PLAT + {len(ai_uc)} AI + {len(zalo_uc)} Zalo + {len(mob_uc)} MOB)"],
                ["Business rules (BR)", str(len(BUSINESS_RULES)), "—"],
                ["Test cases (TC)", str(len(TEST_CASES)), "—"],
                ["Traceability links", str(len(TRACEABILITY)), "—"],
            ],
        ),
        "",
        "---",
        "",
        "## 2. Kiến trúc & phạm vi",
        "",
        "```mermaid",
        "flowchart TB",
        "  subgraph Staff[\"rs.pttads.vn — ops-web\"]",
        "    CRM[CRM Core]",
        "    AI[AI Revenue OS]",
        "    META[Meta Ops]",
        "    ZALO[Zalo Ads OS]",
        "    SEO[SEO/AEO]",
        "    EM[Email Marketing]",
        "  end",
        "  subgraph Portal[\"portal.pttads.vn\"]",
        "    PD[Dashboard KPI]",
        "    PA[Approvals]",
        "  end",
        "  API[ptt-crm-api NestJS]",
        "  Staff --> API",
        "  Portal --> API",
        "  API --> PG[(PostgreSQL)]",
        "  API --> Worker[Job Queue / AI Workers]",
        "```",
        "",
        "---",
        "",
        "## 3. Quy ước mã",
        "",
        _md_table(["Loại", "Tiền tố", "Ví dụ", "Mô tả"], [list(r) for r in CODE_REGISTRY]),
        "",
        "**Priority UC:** P0 = go-live critical · P1 = enterprise depth · P2 = pilot optional",
        "",
        "---",
        "",
        "## 4. Module catalog",
        "",
        _md_table(["Mã", "Tên", "Phạm vi"], [[m[0], m[1], m[2]] for m in MODULES]),
        "",
        "---",
        "",
        "## 5. Screen inventory",
        "",
        "_Cột **Sheet Excel** = tên tab trong [`RNOSAI_BA_Spec.xlsx`](../samples/RNOSAI_BA_Spec.xlsx) (click mã SCR hoặc «→ Sheet spec» ở sheet `01_DanhSach_ManHinh`)._",
        "",
        _md_table(
            ["SCR", "Tên", "Module", "Route", "Roles", "Status", "UC", "Priority", "Sheet Excel"],
            [[s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[9], scr_sheets[str(s[0])]] for s in SCREENS],
        ),
        "",
        "---",
        "",
        "## 6. Use case inventory",
        "",
        "_Cột **Sheet Excel** = tên tab UC (click mã UC hoặc «→ Sheet spec» ở sheet `03_DanhSach_UseCase`)._",
        "",
        _md_table(
            ["UC", "Tên", "Screens", "Actor", "Pri", "Status", "Spec", "Sheet Excel"],
            [
                [
                    u[0],
                    u[1],
                    u[2],
                    u[3],
                    u[4],
                    u[5],
                    "🟢" if uc_details[str(u[0])].get("_manual") else "⚪",
                    uc_sheets[str(u[0])],
                ]
                for u in USE_CASES
            ],
        ),
        "",
        "---",
        "",
        "## 7. Module annexes (spec thủ công)",
        "",
        "| Module | File | UC | Mô tả |",
        "| --- | --- | --- | --- |",
        f"| **CRM Core** | [`modules/RNOSAI-BA-CRM-UseCases.md`](modules/RNOSAI-BA-CRM-UseCases.md) | {len(crm_uc)} | Lead lifecycle, CSKH, pipeline, import/export |",
        f"| **Meta Enterprise** | [`modules/RNOSAI-BA-META-UseCases.md`](modules/RNOSAI-BA-META-UseCases.md) | {len(meta_uc)} | Hub CPL, webhook, CAPI, ads-ops |",
        f"| **Service Delivery** | [`modules/RNOSAI-BA-SVC-UseCases.md`](modules/RNOSAI-BA-SVC-UseCases.md) | {len(svc_uc)} | Lifecycle 7-stage, Launch QA, campaign writes |",
        f"| **SEO/AEO** | [`modules/RNOSAI-BA-SEO-UseCases.md`](modules/RNOSAI-BA-SEO-UseCases.md) | {len(seo_uc)} | GSC/GA4, content pipeline, governance, AEO |",
        f"| **Client Portal** | [`modules/RNOSAI-BA-PORTAL-UseCases.md`](modules/RNOSAI-BA-PORTAL-UseCases.md) | {len(portal_uc)} | Login scoped, KPI, approvals, exports |",
        f"| **System Overview** | [`modules/RNOSAI-BA-SYS-UseCases.md`](modules/RNOSAI-BA-SYS-UseCases.md) | {len(sys_uc)} | Onboard E2E, closed-loop, hypercare, isolation |",
        f"| **Email Marketing** | [`modules/RNOSAI-BA-EM-UseCases.md`](modules/RNOSAI-BA-EM-UseCases.md) | {len(em_uc)} | Workspace, campaigns, journeys, deliverability |",
        f"| **Platform** | [`modules/RNOSAI-BA-PLAT-UseCases.md`](modules/RNOSAI-BA-PLAT-UseCases.md) | {len(plat_uc)} | Auth JWT, RBAC, webhooks, job queue, Temporal |",
        f"| **AI Revenue OS** | [`modules/RNOSAI-BA-AI-UseCases.md`](modules/RNOSAI-BA-AI-UseCases.md) | {len(ai_uc)} | Copilot, score, forecast, automation |",
        f"| **Zalo Ads OS** | [`modules/RNOSAI-BA-ZALO-UseCases.md`](modules/RNOSAI-BA-ZALO-UseCases.md) | {len(zalo_uc)} | Hub, ingest, portal, onboard |",
        f"| **Mobile Experience** | [`modules/RNOSAI-BA-MOB-UseCases.md`](modules/RNOSAI-BA-MOB-UseCases.md) | {len(mob_uc)} | PWA staff/portal, push, mobile SCR |",
        "",
        "---",
        "",
        "## 8. Business rules",
        "",
        _md_table(["BR", "Mô tả", "Module", "Priority", "Status"], BUSINESS_RULES),
        "",
        "---",
        "",
        "## 9. Traceability matrix",
        "",
        _md_table(["BR", "SCR", "UC", "TC", "Coverage"], TRACEABILITY),
        "",
        "---",
        "",
        "## 10. Test cases",
        "",
        _md_table(
            ["TC", "UC", "Tên", "Expected", "Status", "Priority", "Evidence"],
            [[t[0], t[1], t[2], t[4], t[6], t[7], t[8]] for t in TEST_CASES],
        ),
        "",
        "---",
        "",
        "## 11. Screen details (P0)",
        "",
        "_Chỉ liệt kê màn hình có spec thủ công trong catalog. Xem đầy đủ "
        f"{len(SCREENS)} SCR — mỗi SCR một sheet trong Excel (cột «→ Sheet spec» hoặc click mã ở `01_DanhSach_ManHinh`)._",
        "",
    ]

    for row in SCREENS:
        scr_id = str(row[0])
        if scr_id in screen_details and not screen_details[scr_id].get("_auto"):
            sections.append(_screen_section(scr_id, screen_details[scr_id]))

    sections.extend([
        "---",
        "",
        "## 12. Change log",
        "",
        _md_table(
            ["Date", "Version", "Change", "Author"],
            [
                [TODAY, VERSION, f"MOD-MOBILE — +10 SCR +10 UC ({len(SCREENS)} SCR / {len(USE_CASES)} UC total)", "BA"],
                ["2026-07-28", "2.2", f"Deep-spec Portal — 17 SCR ({len(SCREENS)-10} prior)", "BA"],
                ["2026-07-28", "1.7", f"Batch P1 catalog — +44 SCR, +5 PORTAL UC", "BA"],
                [TODAY, "1.6", f"Excel 1 SCR/UC = 1 sheet ({len(SCREENS)-44}+{len(USE_CASES)-5} detail sheets)", "BA"],
                [TODAY, "1.5", f"+SYS ({len(sys_uc)}) + EM ({len(em_uc)}) + PLAT ({len(plat_uc)}) — {m_uc}/{len(USE_CASES)} manual UC (100%)", "BA"],
                [TODAY, "1.4", f"+SVC ({len(svc_uc)}) + SEO ({len(seo_uc)}) + Portal ({len(portal_uc)}) annexes", "BA"],
                ["2026-07-27", "1.3", f"+CRM ({len(crm_uc)}) + Meta ({len(meta_uc)}) annexes", "BA"],
                ["2026-07-27", "1.1", f"Full catalog {len(SCREENS)} SCR / {len(USE_CASES)} UC", "BA"],
                ["2026-07-26", "1.0", "Initial BA workbook template", "BA"],
            ],
        ),
        "",
    ])
    return "\n".join(sections)


def main() -> None:
    MODULES_DIR.mkdir(parents=True, exist_ok=True)

    svc_content = _build_module_annex(
        "RNOSAI BA — Agency Service Delivery Use Cases",
        "MOD-AGENCY",
        "SVC",
        "Module Service Delivery quản lý lifecycle 7 giai đoạn (Prospect → Offboarding), onboard checklist, "
        "TMMT deliver, Launch QA, Creative Hub, Campaign Write governance, channel account mapping và offboarding SOP.",
        ["Agency", "SCR-SVC-001", "SCR-SVC-002", "SCR-SVC-003", "SCR-SVC-004"],
    )
    seo_content = _build_module_annex(
        "RNOSAI BA — SEO/AEO Enterprise Use Cases",
        "MOD-SEO",
        "SEO",
        "Module SEO/AEO: workspace onboard, GSC/GA4 OAuth sync, keyword research, content pipeline với governance, "
        "technical audit, AEO scan, rank tracker, client PDF và ClickHouse BI export.",
        ["SEO"],
    )
    portal_content = _build_module_annex(
        "RNOSAI BA — Client Portal Use Cases",
        "MOD-PORTAL",
        "PORTAL",
        "Client portal portal.pttads.vn: JWT scoped login, multi-module KPI dashboard, Meta/SEO/Email read-only views, "
        "approval inbox creative/content/email với reject comment, signed URL downloads.",
        ["Portal"],
    )
    sys_content = _build_module_annex(
        "RNOSAI BA — System Overview Use Cases",
        "MOD-SYS",
        "SYS",
        "Use case cross-module: onboard client E2E, closed-loop Spend→Lead→Revenue, launch governance, "
        "client approval, báo cáo định kỳ, offboard, executive drill-down, webhook incident, cutover flags, "
        "audit trail, tenant isolation, hypercare.",
        ["Agency", "Portal", "Meta", "CRM", "Admin"],
    )
    em_content = _build_module_annex(
        "RNOSAI BA — Email Marketing Use Cases",
        "MOD-EM",
        "EM",
        "Module Email Marketing Enterprise: workspace + domain wizard, capture/consent, CSV import, segment RFM, "
        "template preflight, broadcast F1 dual approval, ESP webhook, suppression, deliverability F3, "
        "journeys, governance rules, reports BI, preference center.",
        ["EM"],
    )
    plat_content = _build_module_annex(
        "RNOSAI BA — Platform Use Cases",
        "MOD-PLAT",
        "PLAT",
        "Platform layer: staff JWT login + RBAC caps, portal JWT scoped, webhook ingest Meta/Zalo/Google/ESP, "
        "BullMQ job workers, Temporal approval workflows, staff seed permissions, health check + soak gates.",
        ["Auth", "Agency", "Admin"],
    )
    crm_content = _build_module_annex(
        "RNOSAI BA — CRM Core Use Cases",
        "MOD-CRM",
        "CRM",
        "Module CRM Core quản lý vòng đời lead (ingest → B2 → proposal → customer), CSKH SLA board, "
        "pipeline sales, RE projects, executive dashboard và import/export Excel (P0-2 Getfly parity). "
        "Hub hợp đồng liên kết RNOS-25 orders/invoices.",
        ["CRM"],
    )
    meta_content = _build_module_annex(
        "RNOSAI BA — Meta Enterprise Ops Use Cases",
        "MOD-META",
        "META",
        "Module Meta Enterprise Ops: OAuth ad account, hub CPL/ROAS closed-loop, leadgen webhook, "
        "CAPI dedup, tracking health, ads-ops launch/edit governance, intelligence forecast/breakdown, "
        "emergency pause và weekly client PDF.",
        ["Meta"],
    )
    ai_content = _build_module_annex(
        "RNOSAI BA — AI Revenue OS Use Cases",
        "MOD-AI",
        "AI",
        "Module AI Revenue OS cung cấp Copilot trên lead/deal, lead scoring async, forecast commit, "
        "anomaly digest cross-channel, workflow AI nodes và audit đầy đủ qua `ai_agent_runs`. "
        "**BR-AI-01:** Không auto-send outbound — mọi draft phải được user duyệt trước khi copy/gửi thủ công.",
        ["SCR-CRM-002", "SCR-CRM-006", "SCR-CRM-007", "SCR-CRM-013", "SCR-AI-001", "SCR-AI-002", "SCR-AI-003", "SCR-AI-004", "SCR-AI-005", "SCR-ADMIN-001", "SCR-ADMIN-002", "SCR-ADMIN-003"],
    )
    zalo_content = _build_module_annex(
        "RNOSAI BA — Zalo Ads OS Use Cases",
        "MOD-ZALO",
        "ZALO",
        "Module Zalo Ads OS quản lý OAuth OA/Ads account, hub CPL staff, sync insights, "
        "webhook + form poll lead ingest, dedup CRM pipeline, portal performance và onboard orchestrator. "
        "Closed-loop với SYS-UC-002 (Spend → Lead → Revenue).",
        ["SCR-ZALO-001", "SCR-ZALO-002", "SCR-PORTAL-007"],
    )
    mob_content = _build_module_annex(
        "RNOSAI BA — Mobile Experience Use Cases",
        "MOD-MOB",
        "MOB",
        "Module Mobile Experience (cross-cutting): PWA staff lead care (M1), portal PWA + web push + bottom nav (M2), "
        "Capacitor native shell draft (M3). Không microservice riêng — logic trong ops-web, portal-web, ptt-crm-api.",
        ["Mobile", "SCR-MOB-001", "SCR-MOB-005", "SCR-MOB-010"],
    )
    master_content = _build_master()

    portal_uc_n = len(_module_ucs("PORTAL"))

    CRM_ANNEX.write_text(crm_content, encoding="utf-8")
    META_ANNEX.write_text(meta_content, encoding="utf-8")
    SVC_ANNEX.write_text(svc_content, encoding="utf-8")
    SEO_ANNEX.write_text(seo_content, encoding="utf-8")
    PORTAL_ANNEX.write_text(portal_content, encoding="utf-8")
    SYS_ANNEX.write_text(sys_content, encoding="utf-8")
    EM_ANNEX.write_text(em_content, encoding="utf-8")
    PLAT_ANNEX.write_text(plat_content, encoding="utf-8")
    AI_ANNEX.write_text(ai_content, encoding="utf-8")
    ZALO_ANNEX.write_text(zalo_content, encoding="utf-8")
    MOB_ANNEX.write_text(mob_content, encoding="utf-8")
    MASTER.write_text(master_content, encoding="utf-8")

    # Legacy monolith pointer (backward compat)
    LEGACY.write_text(
        "\n".join([
            "# RNOSAI BA Spec — Redirect",
            "",
            f"> File này đã được tách thành bộ tài liệu chuyên nghiệp v**{VERSION}**.",
            "",
            "## Module annexes (spec thủ công)",
            "",
            f"1. **[RNOSAI-BA-Master-Spec.md](RNOSAI-BA-Master-Spec.md)** — Master index",
            f"2. **[RNOSAI-BA-CRM-UseCases.md](modules/RNOSAI-BA-CRM-UseCases.md)** — 15 UC",
            f"3. **[RNOSAI-BA-META-UseCases.md](modules/RNOSAI-BA-META-UseCases.md)** — 14 UC",
            f"4. **[RNOSAI-BA-SVC-UseCases.md](modules/RNOSAI-BA-SVC-UseCases.md)** — 12 UC",
            f"5. **[RNOSAI-BA-SEO-UseCases.md](modules/RNOSAI-BA-SEO-UseCases.md)** — 14 UC",
            f"6. **[RNOSAI-BA-PORTAL-UseCases.md](modules/RNOSAI-BA-PORTAL-UseCases.md)** — {portal_uc_n} UC",
            f"7. **[RNOSAI-BA-SYS-UseCases.md](modules/RNOSAI-BA-SYS-UseCases.md)** — 12 UC",
            f"8. **[RNOSAI-BA-EM-UseCases.md](modules/RNOSAI-BA-EM-UseCases.md)** — 14 UC",
            f"9. **[RNOSAI-BA-PLAT-UseCases.md](modules/RNOSAI-BA-PLAT-UseCases.md)** — 10 UC",
            f"10. **[RNOSAI-BA-AI-UseCases.md](modules/RNOSAI-BA-AI-UseCases.md)** — 20 UC",
            f"11. **[RNOSAI-BA-ZALO-UseCases.md](modules/RNOSAI-BA-ZALO-UseCases.md)** — 21 UC",
            f"12. **[RNOSAI-BA-MOB-UseCases.md](modules/RNOSAI-BA-MOB-UseCases.md)** — {len(_module_ucs('MOB'))} UC",
            f"13. **[../samples/RNOSAI_BA_Spec.xlsx](../samples/RNOSAI_BA_Spec.xlsx)** — Excel workbook",
            "",
        ]),
        encoding="utf-8",
    )

    print(f"Wrote {MASTER} ({len(master_content):,} chars)")
    print(f"Wrote {CRM_ANNEX} ({len(crm_content):,} chars)")
    print(f"Wrote {META_ANNEX} ({len(meta_content):,} chars)")
    print(f"Wrote {SVC_ANNEX} ({len(svc_content):,} chars)")
    print(f"Wrote {SEO_ANNEX} ({len(seo_content):,} chars)")
    print(f"Wrote {PORTAL_ANNEX} ({len(portal_content):,} chars)")
    print(f"Wrote {SYS_ANNEX} ({len(sys_content):,} chars)")
    print(f"Wrote {EM_ANNEX} ({len(em_content):,} chars)")
    print(f"Wrote {PLAT_ANNEX} ({len(plat_content):,} chars)")
    print(f"Wrote {AI_ANNEX} ({len(ai_content):,} chars)")
    print(f"Wrote {ZALO_ANNEX} ({len(zalo_content):,} chars)")
    print(f"Wrote {MOB_ANNEX} ({len(mob_content):,} chars)")
    print(f"Updated {LEGACY} redirect (v{VERSION})")


if __name__ == "__main__":
    main()
