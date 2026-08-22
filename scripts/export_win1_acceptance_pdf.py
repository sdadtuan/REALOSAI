#!/usr/bin/env python3
"""Export WIN-1 acceptance document to PDF for PO sign-off."""
from __future__ import annotations

import argparse
from datetime import datetime
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "docs/exports/signed/WIN-1-acceptance-2026-08-07.pdf"

PRIMARY = "#17692f"
VPS_COMMIT = "eac00e0"
DOCS_COMMIT = "dd3b171"


def _register_font() -> str:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            pdfmetrics.registerFont(TTFont("WinAccept", path))
            return "WinAccept"
    return "Helvetica"


def build_win1_acceptance_pdf(*, stamp: str | None = None) -> tuple[BytesIO, str]:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise SystemExit("Cần cài reportlab: pip install reportlab") from exc

    font = _register_font()
    stamp = stamp or datetime.now().strftime("%Y-%m-%d")
    filename = f"WIN-1-acceptance-{stamp}.pdf"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"WIN-1 Acceptance {stamp}",
    )
    styles = getSampleStyleSheet()
    primary = colors.HexColor(PRIMARY)

    title_style = ParagraphStyle(
        "TitleVi",
        parent=styles["Title"],
        fontName=font,
        fontSize=18,
        textColor=primary,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    h2 = ParagraphStyle("H2Vi", parent=styles["Heading2"], fontName=font, fontSize=12, textColor=primary)
    body = ParagraphStyle("BodyVi", parent=styles["Normal"], fontName=font, fontSize=9, leading=12)
    small = ParagraphStyle("SmallVi", parent=body, fontSize=8, textColor=colors.grey)
    cell = ParagraphStyle("CellVi", parent=body, fontSize=8, leading=10)

    story: list = []
    story.append(Paragraph("WIN-1 Acceptance", title_style))
    story.append(Paragraph("Competitive Win — Wave 1", ParagraphStyle("Sub", parent=body, alignment=TA_CENTER)))
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            f"Document ID: WIN-1-ACCEPT-{stamp.replace('-', '')} · Phát hành: {stamp}<br/>"
            f"Môi trường: https://rs.pttads.vn · Deploy: {VPS_COMMIT} · Docs: {DOCS_COMMIT}",
            small,
        )
    )
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Phạm vi chấp nhận", h2))
    scope_rows = [
        ["Hạng mục", "Mô tả"],
        ["WIN-1-A", "PWA / mobile leads (VUX-02, VUX-08)"],
        ["WIN-1-B", "Filter chips, CSKH export Excel"],
        ["WIN-1-C", "Excel wizard + R1.5 RBAC UI"],
        ["Lane A", "Gán job function user (/admin/crm/permissions/users)"],
    ]
    story.append(_table(scope_rows, primary, font, [42 * mm, 118 * mm]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Tóm tắt kết quả QA (đề xuất Pass)", h2))
    summary_rows = [
        ["Khu vực", "QA", "Ghi chú"],
        ["Design tokens + WIN components", "Pass", "components/win/*"],
        ["PWA + mobile leads", "Pass", "VUX-02 Playwright; VUX-08 automated"],
        ["Excel import/export wizards", "Pass", "API PASS; UI spot-check khuyến nghị"],
        ["RBAC matrix chức vụ + function", "Pass", "8 functions, admin routes live"],
        ["User job function assign", "Pass", "/permissions/users + effective caps"],
        ["Persona menu isolation (VUX-04)", "Pass", "Hướng B: MKT-02 trim + content/design"],
        ["SoD client + API (VUX-05)", "Pass", "UI disabled + API 409"],
    ]
    story.append(_table(summary_rows, primary, font, [52 * mm, 16 * mm, 92 * mm]))
    story.append(Paragraph("Automated UAT VPS: 19/19 PASS · Playwright VUX: 3/3 PASS", body))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. VUX gates — bằng chứng", h2))
    vux_rows = [
        ["Gate", "Kết quả", "Ghi chú"],
        ["VUX-02 Mobile 390px", "PASS", "win-leads-mobile-list, không scroll ngang"],
        ["VUX-04 Badge", "PASS", "MKT-02 · content vs design"],
        ["VUX-04 Menu khác biệt", "PASS", "Content: SEO/email write · Design: Meta Ads"],
        ["VUX-05 SoD UI", "PASS", "Lưu disabled (functions + users)"],
        ["VUX-05 SoD API", "PASS", "PUT → 409 sod_violation"],
        ["VUX-08 PWA", "PASS", "Manifest PTT Revenue OS, SW v3"],
    ]
    story.append(_table(vux_rows, primary, font, [38 * mm, 18 * mm, 104 * mm]))
    story.append(
        Paragraph(
            "<b>Quyết định PO (VUX-04):</b> Hướng B — sidebar phải khác; "
            "trim MKT-02 base + caps qua job function content/design.",
            body,
        )
    )
    story.append(Spacer(1, 8))

    story.append(Paragraph("4. Tài khoản UAT (không in mật khẩu)", h2))
    acct_rows = [
        ["Persona", "Email", "Position", "Function"],
        ["Admin", "admin@pttads.vn", "SUPER-ADMIN", "—"],
        ["P1 Content", "win1-content@pttads.vn", "MKT-02", "content"],
        ["P2 Design", "win1-design@pttads.vn", "MKT-02", "design"],
    ]
    story.append(_table(acct_rows, primary, font, [24 * mm, 48 * mm, 28 * mm, 60 * mm]))
    story.append(Paragraph("Mật khẩu: ADMIN_PASSWORD trên VPS .env (IT quản lý).", small))
    story.append(Spacer(1, 10))

    story.append(Paragraph("5. Quyết định chấp nhận (PO ký)", h2))
    sign_rows = [
        ["Vai trò", "Họ tên", "Ngày", "Chữ ký"],
        ["Product Owner", "", "", ""],
        ["QA Lead", "", "", ""],
        ["HR Ops", "", "", ""],
        ["Tech Lead", "", "", ""],
    ]
    tbl = _table(sign_rows, primary, font, [32 * mm, 48 * mm, 28 * mm, 52 * mm], row_heights=[8 * mm] * 5)
    story.append(tbl)
    story.append(Spacer(1, 6))
    story.append(Paragraph("Quyết định: ☐ Chấp nhận (WIN-2 kickoff) ☐ Có điều kiện ☐ Từ chối", body))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Điều kiện / follow-up:", body))
    story.append(Paragraph("1. _______________________________________________________________", body))
    story.append(Paragraph("2. _______________________________________________________________", body))
    story.append(Spacer(1, 10))

    story.append(Paragraph("6. Liên kết bằng chứng", h2))
    for line in [
        "docs/runbooks/win-1-uat-checklist.md",
        "docs/exports/win-1-manual-uat-vux-20260807.md",
        "docs/exports/win-1-uat-results-20260807-043124.md",
        "docs/specs/win-1-acceptance-checklist.md",
    ]:
        story.append(Paragraph(f"• {line}", small))
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} · RNOSAI WIN-1 · Confidential",
            small,
        )
    )

    doc.build(story)
    buf.seek(0)
    return buf, filename


def _table(
    rows: list[list[str]],
    primary,
    font: str,
    col_widths: list,
    *,
    row_heights: list | None = None,
):
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle

    tbl = Table(rows, colWidths=col_widths, rowHeights=row_heights)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    tbl.setStyle(TableStyle(style))
    return tbl


def main() -> int:
    parser = argparse.ArgumentParser(description="Export WIN-1 acceptance PDF for PO sign-off")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output PDF path (default: {DEFAULT_OUT.relative_to(ROOT)})",
    )
    parser.add_argument("--stamp", default="2026-08-07", help="Date stamp YYYY-MM-DD")
    args = parser.parse_args()

    buf, name = build_win1_acceptance_pdf(stamp=args.stamp)
    out = args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(buf.read())
    print(f"OK  {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
