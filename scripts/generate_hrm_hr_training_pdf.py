#!/usr/bin/env python3
"""Generate PDF: Đào tạo HRM 30 phút cho HR/HCNS (WIN-4-D slide outline + demo script)."""
from __future__ import annotations

import argparse
from datetime import datetime
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "docs/exports/HRM_WIN4D_HR_Training_30min.pdf"

PRIMARY = "#17692f"
ACCENT = "#0f172a"

Slide = tuple[str, str, list[str], list[str]]  # timebox, title, outline, script


SLIDES: list[Slide] = [
    (
        "0:00 – 2:00",
        "Slide 1 — Mở đầu: HRM trên PTT CRM",
        [
            "WIN-4-D · HR self-service · rs.pttads.vn",
            "Thời lượng: 30 phút hands-on",
            "Đối tượng: HR, HCNS, trợ lý nhân sự",
            "Mục tiêu: NV tự xem payslip + gửi nghỉ; HR vận hành payroll lite",
        ],
        [
            "Trainer: Chào mừng buổi training HRM trên PTT CRM.",
            "Hôm nay thực hành payslip read-only, nghỉ phép lite, payroll back-office.",
            "Nhấn mạnh: CRM không thay MISA/FAST — chỉ export kế toán.",
        ],
    ),
    (
        "2:00 – 3:00",
        "Slide 2 — Phạm vi & giới hạn chuyên nghiệp",
        [
            "✅ HR Hub, roster, chấm công/lương lite, leave, KPI",
            "✅ Self-service: /crm/payroll/me, /crm/hr/leave",
            "❌ BHXH compliance, GPS field force, payslip PDF ký số",
            "Vai trò: NV · HR · Quản lý · Admin RBAC",
        ],
        [
            "Giải thích cap: crm_hr_leave.request / approve, crm_staff_roster, crm_payroll_salary.",
            "Footer HR Hub: «Attendance lite — không thay MISA».",
        ],
    ),
    (
        "3:00 – 5:00",
        "Slide 3 — DEMO: Đăng nhập Staff Console",
        [
            "URL: https://rs.pttads.vn/login",
            "SSO Keycloak (khuyến nghị) hoặc email + password (dual-auth)",
            "Kiểm tra topbar: tên + badge chức vụ",
        ],
        [
            "CLICK 1: Mở trình duyệt → rs.pttads.vn/login",
            "CLICK 2: Bấm «Đăng nhập SSO / Keycloak» → nhập email công ty (+ MFA nếu có)",
            "   (Hoặc: nhập Email + Mật khẩu → «Đăng nhập» nếu dual-auth)",
            "CLICK 3: Xác nhận góc phải hiển thị tên NV và badge RBAC",
            "Script: Nếu lỗi → IT kiểm tra Keycloak group map → chức vụ.",
        ],
    ),
    (
        "5:00 – 8:00",
        "Slide 4 — DEMO: Vào HR Hub (home HRM)",
        [
            "Sidebar → Nhân sự & Hiệu suất",
            "Mục: HR Hub → /crm/hr",
            "5 workspace: Hồ sơ · Quyền · Chấm công · KPI · Talent",
        ],
        [
            "CLICK 1: Bấm ☰ (topbar trái) mở sidebar nếu đang thu gọn",
            "CLICK 2: Cuộn nhóm «Nhân sự & Hiệu suất»",
            "CLICK 3: Bấm «HR Hub»",
            "CLICK 4: Chỉ tay từng section trên trang (5 workspace)",
            "CLICK 5: Bấm thẻ «Phiếu lương của tôi» (badge Self) → xem URL /crm/payroll/me → Back",
            "CLICK 6: Bấm thẻ «Nghỉ phép lite» (badge WIN-4-D) → /crm/hr/leave → Back",
            "Script: HR Hub là điểm vào trung tâm — mọi self-service bắt đầu từ đây.",
        ],
    ),
    (
        "8:00 – 11:00",
        "Slide 5 — DEMO: Phiếu lương của tôi (NV)",
        [
            "Đường dẫn: HR Hub → Phiếu lương của tôi",
            "URL: /crm/payroll/me",
            "Read-only · chỉ dữ liệu bản thân · tải Excel",
        ],
        [
            "CLICK 1: HR Hub → bấm thẻ «Phiếu lương của tôi»",
            "CLICK 2: Đọc bảng: Kỳ (tháng/năm), trạng thái, công, gross, khấu trừ, thực lĩnh",
            "CLICK 3: Cột «Tải» → bấm «Excel» trên 1 dòng có dữ liệu",
            "CLICK 4: Mở file payslip-YYYY-MM.xlsx vừa tải",
            "Script: NV không sửa được — chỉ xem & download. So khớp với email HR.",
        ],
    ),
    (
        "11:00 – 13:00",
        "Slide 6 — DEMO: Xử lý payslip trống / lỗi (HR)",
        [
            "403 → chưa map email login ↔ crm_staff",
            "Bảng trống → kỳ chưa tính lương",
            "Excel lỗi → không có payroll line kỳ đó",
        ],
        [
            "CLICK 1: Sidebar → «Nhân viên» (/crm/staff)",
            "CLICK 2: Tìm NV demo → bấm «Sửa» → kiểm tra email khớp tài khoản login → «Lưu»",
            "CLICK 3: Sidebar → «Chấm công & lương» (/crm/payroll)",
            "CLICK 4: Chọn Tháng/Năm đúng kỳ → tab «Lương»",
            "CLICK 5: Bấm «Tính / cập nhật lương»",
            "CLICK 6: Quay /crm/payroll/me (NV) → refresh → thấy dòng mới",
        ],
    ),
    (
        "13:00 – 16:00",
        "Slide 7 — DEMO: Gửi đơn nghỉ phép (NV)",
        [
            "URL: /crm/hr/leave",
            "Quyền: crm_hr_leave.request (hoặc roster view)",
            "Loại: phép năm · ốm · không lương · khác",
        ],
        [
            "CLICK 1: HR Hub → «Nghỉ phép lite»",
            "CLICK 2: Khối «Gửi đơn nghỉ» → Loại: chọn «Phép năm»",
            "CLICK 3: «Từ ngày» → chọn ngày bắt đầu (date picker)",
            "CLICK 4: «Đến ngày» → chọn ngày kết thúc",
            "CLICK 5: «Lý do» → gõ: Training WIN-4-D",
            "CLICK 6: Bấm «Gửi đơn»",
            "CLICK 7: Kiểm tra «Đơn của tôi» → trạng thái «Chờ duyệt»",
        ],
    ),
    (
        "16:00 – 18:00",
        "Slide 8 — DEMO: Duyệt đơn nghỉ (HR / Quản lý)",
        [
            "Quyền: crm_hr_leave.approve",
            "Section «Chờ duyệt» trên cùng trang",
            "Stub 1 cấp — audit log, chưa multi-level ERP",
        ],
        [
            "CLICK 1: Đăng nhập tài khoản HR có quyền approve",
            "CLICK 2: /crm/hr/leave → cuộn «Chờ duyệt»",
            "CLICK 3: Trên đơn vừa gửi → bấm «Duyệt»",
            "CLICK 4: Xác nhận trạng thái → «Đã duyệt»",
            "CLICK 5 (tuỳ chọn): Gửi đơn thứ 2 → bấm «Từ chối» demo",
            "Script: Leave lite — chưa thay phần mềm GPS / quy trình BHXH đầy đủ.",
        ],
    ),
    (
        "18:00 – 21:00",
        "Slide 9 — DEMO: Chấm công & lương HR (back-office)",
        [
            "URL: /crm/payroll",
            "Tabs: Dashboard · Chấm công · Lương · Chính sách",
            "Toolbar: Tháng · Năm · Tính lương · Xuất Excel",
        ],
        [
            "CLICK 1: Sidebar → «Chấm công & lương»",
            "CLICK 2: Toolbar → chọn Tháng và Năm kỳ cần demo",
            "CLICK 3: Tab «Dashboard» → chỉ tiles headcount / attendance / tổng lương",
            "CLICK 4: Tab «Chấm công» → scroll bảng theo ngày",
            "CLICK 5: Tab «Lương» → bấm «Tính / cập nhật lương»",
            "CLICK 6: Bấm «Xuất Excel» → gửi file cho kế toán / MISA",
            "Script: Sau bước này NV mới thấy payslip tại /crm/payroll/me.",
        ],
    ),
    (
        "21:00 – 23:00",
        "Slide 10 — DEMO: Chính sách ca & phạt trễ",
        [
            "Tab «Chính sách» trên /crm/payroll",
            "Fields: giờ ca, grace trễ, phạt/phút, giờ chuẩn, % thưởng",
        ],
        [
            "CLICK 1: /crm/payroll → tab «Chính sách»",
            "CLICK 2: Sửa «Grace trễ (phút)» (demo +1 phút)",
            "CLICK 3: Bấm «Lưu chính sách»",
            "CLICK 4: Tab «Lương» → tính lại nếu cần minh hoạ ảnh hưởng",
            "Script: Policy áp dụng toàn công ty — cân nhắc trước khi đổi prod.",
        ],
    ),
    (
        "23:00 – 25:00",
        "Slide 11 — DEMO: Roster & talent config",
        [
            "URL: /crm/staff",
            "Tabs: Roster · Import · Levels · Competency",
        ],
        [
            "CLICK 1: Sidebar → «Nhân viên»",
            "CLICK 2: Tab «Roster» → ô tìm kiếm → gõ tên → Enter",
            "CLICK 3: Bấm «Sửa» trên 1 dòng → drawer → «Lưu»",
            "CLICK 4: Tab «Import» → mở WinExcelImportWizard (preview, không import prod)",
            "CLICK 5: HR Hub → «Cấp bậc S/A/B/C» hoặc /crm/staff?tab=levels",
            "CLICK 6: Tab «Competency» → tick 1–2 ô → «Lưu»",
        ],
    ),
    (
        "25:00 – 27:00",
        "Slide 12 — DEMO: Onboard nhân viên mới (Admin)",
        [
            "URL: /admin/crm/org/users/new",
            "Wizard 4 bước · mục tiêu ≤15 phút",
        ],
        [
            "CLICK 1: Mở /admin/crm/org/users/new (tài khoản Admin)",
            "CLICK 2: Step «Hồ sơ» → tìm/link crm_staff → Next",
            "CLICK 3: Step «Quyền» → chọn Chức vụ + Job function → Next",
            "CLICK 4: Step «Tài khoản» → Copy mật khẩu tạm → Next",
            "CLICK 5: Step «UAT checklist» → tick 5 mục → «Hoàn tất»",
            "Script: Giao NV checklist: login SSO → /crm/payroll/me → /crm/hr/leave.",
        ],
    ),
    (
        "27:00 – 28:30",
        "Slide 13 — DEMO: Thông báo & @mention",
        [
            "Topbar 🔔 — staff notifications",
            "Lead activity @email → notify đồng nghiệp",
        ],
        [
            "CLICK 1: Topbar phải → bấm 🔔",
            "CLICK 2: Panel thông báo → bấm «Đã đọc» trên 1 mục",
            "CLICK 3: Sidebar → CRM → «Quản lý Lead» → mở 1 lead",
            "CLICK 4: Panel «Thêm hoạt động» → ô nội dung gõ @",
            "CLICK 5: Dropdown roster → chọn email đồng nghiệp",
            "CLICK 6: «Thêm hoạt động»",
            "CLICK 7: Đăng nhập user được @ → 🔔 badge unread",
        ],
    ),
    (
        "28:30 – 30:00",
        "Slide 14 — Q&A · Checklist UAT · Kết thúc",
        [
            "EC-W4-08 Payslip self · EC-W4-09 Leave · EC-W4-10 Notify",
            "Flags: NEXT_PUBLIC_WIN_PAYSLIP_PORTAL=1 · NEXT_PUBLIC_WIN_LEAVE_LITE=1",
            "Liên hệ: IT (SSO) · HR (policy) · Kế toán (MISA export)",
        ],
        [
            "Checklist HR sau training:",
            "☐ NV pilot xem /crm/payroll/me + tải Excel",
            "☐ HR duyệt leave end-to-end trên /crm/hr/leave",
            "☐ Tính lương 1 kỳ + xuất Excel kế toán",
            "☐ 1 @mention → thông báo in-app",
            "☐ IT xác nhận SSO group map",
            "Trainer: Mở Q&A. Cảm ơn — tài liệu: docs/runbooks/hrm-win4d-hr-training-30min.md",
        ],
    ),
]


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
            pdfmetrics.registerFont(TTFont("HrmTrain", path))
            return "HrmTrain"
    return "Helvetica"


def build_hrm_training_pdf(*, stamp: str | None = None) -> tuple[BytesIO, str]:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise SystemExit("Cần cài reportlab: pip install reportlab") from exc

    font = _register_font()
    stamp = stamp or datetime.now().strftime("%Y-%m-%d")
    filename = f"HRM_WIN4D_HR_Training_30min_{stamp}.pdf"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"HRM Training 30min {stamp}",
    )
    styles = getSampleStyleSheet()
    primary = colors.HexColor(PRIMARY)
    accent = colors.HexColor(ACCENT)

    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontName=font,
        fontSize=20,
        textColor=primary,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        parent=styles["Normal"],
        fontName=font,
        fontSize=11,
        alignment=TA_CENTER,
        textColor=colors.grey,
    )
    slide_title = ParagraphStyle(
        "SlideTitle",
        parent=styles["Heading1"],
        fontName=font,
        fontSize=14,
        textColor=accent,
        spaceBefore=4,
        spaceAfter=4,
    )
    timebox = ParagraphStyle(
        "Timebox",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9,
        textColor=primary,
        spaceAfter=6,
    )
    h3 = ParagraphStyle(
        "H3Vi",
        parent=styles["Heading3"],
        fontName=font,
        fontSize=10,
        textColor=primary,
        spaceBefore=8,
        spaceAfter=4,
    )
    bullet = ParagraphStyle(
        "BulletVi",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9,
        leading=12,
        leftIndent=8,
        bulletIndent=0,
        spaceAfter=3,
    )
    script_line = ParagraphStyle(
        "ScriptVi",
        parent=styles["Normal"],
        fontName=font,
        fontSize=8.5,
        leading=11,
        leftIndent=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=2,
    )
    footer = ParagraphStyle(
        "FooterVi",
        parent=styles["Normal"],
        fontName=font,
        fontSize=7.5,
        textColor=colors.grey,
        alignment=TA_CENTER,
    )

    story: list = []
    story.append(Spacer(1, 35 * mm))
    story.append(Paragraph("Đào tạo HRM 30 phút", cover_title))
    story.append(Paragraph("HR / HCNS · PTT CRM · WIN-4-D", cover_sub))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Slide outline + script demo từng click", cover_sub))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"Môi trường: https://rs.pttads.vn · Ngày: {stamp}", cover_sub))
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            "Nội dung: HR Hub · Payslip self · Leave lite · Payroll HR · Roster · Onboard · Notify",
            cover_sub,
        )
    )
    story.append(PageBreak())

    # Agenda table as paragraphs
    story.append(Paragraph("Lịch trình 30 phút", slide_title))
    agenda = [
        ("0–3 phút", "Mở đầu, phạm vi HRM"),
        ("3–8 phút", "Đăng nhập + HR Hub"),
        ("8–13 phút", "Phiếu lương self-service"),
        ("13–18 phút", "Nghỉ phép lite"),
        ("18–23 phút", "Chấm công & lương HR"),
        ("23–27 phút", "Roster + Onboard"),
        ("27–30 phút", "Thông báo + Q&A"),
    ]
    for slot, topic in agenda:
        story.append(Paragraph(f"• <b>{slot}</b> — {topic}", bullet))
    story.append(PageBreak())

    for idx, (tb, title, outline, script) in enumerate(SLIDES, start=1):
        story.append(Paragraph(f"Slide {idx} · {tb}", timebox))
        story.append(Paragraph(title, slide_title))
        story.append(Paragraph("Outline (trên slide)", h3))
        for line in outline:
            safe = line.replace("&", "&amp;").replace("<", "&lt;")
            story.append(Paragraph(f"• {safe}", bullet))
        story.append(Paragraph("Script demo (trainer đọc + thao tác)", h3))
        for line in script:
            safe = line.replace("&", "&amp;").replace("<", "&lt;")
            story.append(Paragraph(safe, script_line))
        if idx < len(SLIDES):
            story.append(PageBreak())

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            "PTT CRM · RNOSAI WIN-4-D · regenerate: python3 scripts/generate_hrm_hr_training_pdf.py",
            footer,
        )
    )

    doc.build(story)
    buf.seek(0)
    return buf, filename


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HRM HR training PDF (30 min)")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output PDF path (default: {DEFAULT_OUT})",
    )
    parser.add_argument("--stamp", default=None, help="Date stamp YYYY-MM-DD")
    args = parser.parse_args()

    buf, name = build_hrm_training_pdf(stamp=args.stamp)
    out = args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(buf.getvalue())
    print(f"OK  {out} ({name})")


if __name__ == "__main__":
    main()
