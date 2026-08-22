# Hướng dẫn — HR & Payroll

> **Chương trình:** WIN · **Đối tượng:** HR Admin, Manager, Nhân viên  
> **URL:** https://rs.pttads.vn/crm/hr/* · `/crm/payroll/*`

---

## 1. Giới thiệu

Module HR/Payroll lite tích hợp CRM: **xin nghỉ**, **quản lý bảng lương**, **payslip self-service**, liên kết org chart và staff roster.

**Flags:** `NEXT_PUBLIC_WIN_LEAVE_LITE=1`, `PTT_PAYROLL_ENABLED=1`

---

## 2. HR Hub

**Route:** `/crm/hr`

1. Trang tổng quan HR
2. Quick link: Leave, Staff roster, Payroll
3. Widget pending leave approvals (manager)

---

## 3. Leave (xin nghỉ)

**Route:** `/crm/hr/leave`

### Nhân viên — tạo đơn

1. **+ Xin nghỉ**
2. Chọn loại: phép năm / không lương / …
3. Chọn **Từ ngày — Đến ngày**
4. Ghi lý do
5. **Submit** → status **Pending**

### Manager — duyệt

1. Filter **Pending** team mình
2. Mở đơn — xem conflict lịch
3. **Approve** hoặc **Reject** + comment
4. NV nhận notification

### HR — báo cáo

Export danh sách leave tháng — dùng cho payroll attendance.

---

## 4. Staff Roster

**Route:** `/crm/staff`, `/crm/staff/[id]`

1. Danh sách nhân viên CRM
2. Detail: role, caps, org assignment, KPI link
3. HR sync với org chart (`/admin/crm/org/users`)

---

## 5. Payroll Admin

**Route:** `/crm/payroll`

**Đối tượng:** HR / Finance

1. Chọn **kỳ lương** (tháng)
2. Import hoặc tính từ attendance + KPI (tùy cấu hình)
3. Review từng dòng — base, phụ cấp, khấu trừ
4. **Lock kỳ** — không sửa sau lock
5. **Publish payslip** — NV thấy trên self-service

---

## 6. Payslip self-service

**Route:** `/crm/payroll/me`

### Nhân viên

1. Đăng nhập ops-web
2. Mở **Phiếu lương của tôi**
3. Chọn tháng — xem breakdown
4. Download PDF (nếu bật)

**Lưu ý bảo mật:** Chỉ thấy payslip của bản thân — API scope theo staff_id.

---

## 7. Liên kết Org chart (WIN)

Org chart Admin → `/admin/crm/org/*`:

- Phòng ban / team ảnh hưởng **Ops Dashboard Team Lead**
- Chức vụ ảnh hưởng permission set template

---

## 8. Luồng tháng HR

| Tuần | Việc |
|------|------|
| 1 | Lock leave tháng trước |
| 2 | Tính payroll draft |
| 3 | HR review + lock |
| 4 | Publish payslip — NV xem `/payroll/me` |

---

## 9. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Không thấy menu HR | Cap `hr.*` / flag WIN |
| Payslip trống | Kỳ chưa publish |
| Leave overlap | Manager reject + NV sửa ngày |

---

## 10. Tài liệu tham chiếu

- WIN spec: [`docs/specs/2026-08-07-rnosai-competitive-win-master-spec.md`](../specs/2026-08-07-rnosai-competitive-win-master-spec.md)
- Phân quyền: [`docs/handover/05-PHAN-QUYEN-BAO-MAT-SLA.md`](../handover/05-PHAN-QUYEN-BAO-MAT-SLA.md)
