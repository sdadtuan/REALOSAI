# Đào tạo HRM 30 phút — HR / HCNS (WIN-4-D)

> **Thời lượng:** 30 phút · **Đối tượng:** HR, HCNS, trợ lý nhân sự  
> **Môi trường demo:** https://rs.pttads.vn  
> **PDF:** `docs/exports/HRM_WIN4D_HR_Training_30min.pdf` (generate: `python3 scripts/generate_hrm_hr_training_pdf.py`)

---

## Lịch trình

| Phút | Slide | Nội dung |
|------|-------|----------|
| 0–3 | 1–2 | Mở đầu, phạm vi HRM, vai trò |
| 3–8 | 3–4 | Đăng nhập, sidebar, HR Hub |
| 8–13 | 5–6 | Phiếu lương self-service |
| 13–18 | 7–8 | Nghỉ phép lite (gửi + duyệt) |
| 18–23 | 9–10 | Chấm công & lương HR |
| 23–27 | 11–12 | Roster NV, onboard |
| 27–30 | 13–14 | Thông báo, Q&A, checklist |

---

## Slide 1 — Tiêu đề (0:00)

**Outline:** WIN-4-D · HR self-service · rs.pttads.vn · 30 phút hands-on

**Script trainer:**  
「Chào mừng buổi training HRM trên PTT CRM. Hôm nay chúng ta thực hành payslip read-only, nghỉ phép lite, và quy trình HR back-office. CRM không thay MISA — chỉ export kế toán.」

---

## Slide 2 — Phạm vi & vai trò (2:00)

**Outline:**
- ✅ HR Hub, roster, payroll lite, leave, KPI link
- ❌ BHXH compliance, GPS field, ký số payslip PDF
- Vai trò: NV / HR / Quản lý / Admin RBAC

**Script:** Giải thích bảng quyền `crm_hr_leave.request|approve`, `crm_staff_roster.*`, `crm_payroll_salary.view`.

---

## Slide 3 — Đăng nhập (3:00)

**Demo clicks:**
1. Mở `https://rs.pttads.vn/login`
2. Bấm **Đăng nhập SSO Keycloak** (hoặc email + password dual-auth)
3. Xác nhận topbar: tên NV + badge chức vụ

**Script:** 「Nếu không vào được, kiểm tra IT đã map Keycloak group → chức vụ chưa.」

---

## Slide 4 — HR Hub (5:00)

**Demo clicks:**
1. Sidebar ☰ → **Nhân sự & Hiệu suất**
2. Bấm **HR Hub** → `/crm/hr`
3. Chỉ tay 5 workspace: Hồ sơ · Quyền · Chấm công · KPI · Talent
4. Bấm thẻ **Phiếu lương của tôi** (badge Self)
5. Back → bấm **Nghỉ phép lite** (badge WIN-4-D)

**Script:** 「HR Hub là home — mọi self-service bắt đầu từ đây.」

---

## Slide 5 — Payslip self (8:00)

**Demo clicks (tài khoản NV demo):**
1. `/crm/payroll/me`
2. Đọc bảng kỳ: tháng/năm, gross, khấu trừ, thực lĩnh
3. Bấm **Excel** trên 1 dòng → file tải về
4. Mở Excel — nhấn mạnh read-only

**Script:** 「NV chỉ thấy bản thân. Nếu trống → HR chưa tính lương kỳ đó.」

---

## Slide 6 — Payslip troubleshooting (11:00)

**Outline:** 403 = chưa link crm_staff · Trống = chưa compute · Excel lỗi = không có line

**Demo clicks (HR account):**
1. `/crm/staff` → tìm NV demo → Sửa → kiểm tra email khớp login
2. `/crm/payroll` → tab Lương → **Tính / cập nhật lương**
3. Quay `/crm/payroll/me` refresh

---

## Slide 7 — Leave: gửi đơn (13:00)

**Demo clicks (NV):**
1. `/crm/hr/leave`
2. Loại: **Phép năm**
3. Từ ngày / Đến ngày
4. Lý do: 「Training WIN-4-D」
5. **Gửi đơn** → thấy dòng **Chờ duyệt**

---

## Slide 8 — Leave: duyệt (16:00)

**Demo clicks (HR/manager có approve):**
1. Cùng trang — section **Chờ duyệt**
2. Bấm **Duyệt** trên đơn vừa gửi
3. Trạng thái → **Đã duyệt**
4. (Tuỳ chọn) gửi đơn thứ 2 → **Từ chối**

**Script:** 「Stub 1 cấp — chưa multi-level workflow ERP.」

---

## Slide 9 — Payroll HR dashboard (18:00)

**Demo clicks:**
1. `/crm/payroll`
2. Chọn **Tháng / Năm** toolbar
3. Tab **Dashboard** → tiles headcount
4. Tab **Chấm công** → scroll bảng
5. Tab **Lương** → **Tính lương** → **Xuất Excel**

**Script:** Footer — không thay MISA; export cho kế toán.

---

## Slide 10 — Chính sách ca (21:00)

**Demo clicks:**
1. Tab **Chính sách**
2. Sửa grace trễ / phạt trễ (demo nhỏ)
3. **Lưu chính sách**
4. Tab Lương → tính lại nếu cần

---

## Slide 11 — Roster (23:00)

**Demo clicks:**
1. `/crm/staff` tab **Roster**
2. Tìm kiếm tên
3. **Sửa** → drawer → Lưu
4. Tab **Import** → mở wizard (không import thật nếu prod)
5. HR Hub → **Cấp bậc S/A/B/C** (`?tab=levels`)

---

## Slide 12 — Onboard NV mới (25:00)

**Demo clicks (Admin):**
1. `/admin/crm/org/users/new`
2. Step 1: link crm_staff
3. Step 2: chọn chức vụ + job function
4. Step 3: copy mật khẩu tạm
5. **Hoàn tất**

**Script:** Mục tiêu ≤15 phút onboard — giao checklist cho NV.

---

## Slide 13 — Thông báo & @mention (27:00)

**Demo clicks:**
1. Topbar **🔔** → panel thông báo → **Đã đọc**
2. `/crm/leads/[id]` → **Thêm hoạt động**
3. Gõ `@` → chọn email roster → **Thêm hoạt động**
4. Đăng nhập user được mention → 🔔 unread

---

## Slide 14 — Q&A & checklist UAT (28:00)

**Checklist HR sau training:**
- [ ] NV pilot xem được `/crm/payroll/me`
- [ ] HR duyệt leave trên `/crm/hr/leave`
- [ ] Tính lương + export Excel 1 kỳ
- [ ] 1 đơn nghỉ end-to-end
- [ ] IT xác nhận SSO group map

**Script kết:** 「Liên hệ IT flags `NEXT_PUBLIC_WIN_PAYSLIP_PORTAL=1`, `NEXT_PUBLIC_WIN_LEAVE_LITE=1`.」

---

*Generated companion for `scripts/generate_hrm_hr_training_pdf.py`*
