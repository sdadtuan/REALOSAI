# Runbook — HR · Org · Job Function · RBAC

> **Audience:** HR, trưởng phòng, System Admin  
> **Spec:** [`../specs/2026-08-07-rbac-hr-org-job-function-design.md`](../specs/2026-08-07-rbac-hr-org-job-function-design.md)  
> **Chương trình tổ chức:** [`../specs/2026-08-07-hr-competitive-organization-program.md`](../specs/2026-08-07-hr-competitive-organization-program.md)  
> **Master win spec:** [`../specs/2026-08-07-rnosai-competitive-win-master-spec.md`](../specs/2026-08-07-rnosai-competitive-win-master-spec.md)  
> **Prod:** https://rs.pttads.vn · **HR Hub:** `/crm/hr`

---

## 0. HR Hub — điểm vào chính

**URL:** `/crm/hr` — 5 workspace: Hồ sơ · Quyền · Chấm công · KPI · Talent config.

Sidebar: **Nhân sự & Hiệu suất** → **HR Hub** → module con.

---

## 1. Khái niệm (1 phút)

| Khái niệm | Ví dụ | Ai nhập |
|-----------|-------|---------|
| Phòng ban | Sales, Solution, CSKH | HR |
| Team | TEAM-MKT-CONTENT | HR |
| **Chức vụ** | KD-01, MKT-02 | PO/Admin (ma trận gốc) |
| **Job function** | content, design, leader | Admin gắn **từng người** |
| Login | email @pttads.vn | IT/Admin |

**Quyền thực tế** = chức vụ + job function (cộng dồn).

---

## 2. Onboard nhân viên mới

### Phase hiện tại (R1 — thủ công một phần)

| Bước | Việc | Công cụ |
|------|------|---------|
| 1 | Tạo hồ sơ HR | `/crm/staff` → Import JSON hoặc IT SQL |
| 2 | Chốt chức vụ với trưởng phòng | Email / sheet PO |
| 3 | IT tạo login | SQL `staff_users` |
| 4 | Admin kiểm tra ma trận chức vụ | `/admin/crm/permissions` |
| 5 | Gửi link login | `/login` |

### Phase R1.5+ (target)

| Bước | Việc | URL |
|------|------|-----|
| 1 | HR tạo phòng ban / team | `/admin/crm/org/departments`, `/teams` |
| 2 | HR tạo user | `/admin/crm/org/users` |
| 3 | Chọn **chức vụ** + **job functions** | Cùng trang user |
| 4 | NV login + UAT | Checklist T-HR-03 |

---

## 3. Gán job function (R1.5)

1. Login **Admin** (`crm_data_config.configure`)
2. **Admin → Cấu hình CRM → Người dùng & quyền** (`/admin/crm/org/users`)
3. Tìm email nhân viên
4. **Chức vụ:** chọn `MKT-02`, `KD-01`, …
5. **Job functions:** tick tối đa 3 (vd. `content`, `design`)
6. Nếu banner đỏ SoD → bỏ tick conflict
7. **Lưu** → yêu cầu NV **đăng xuất / đăng nhập lại**

---

## 4. Sửa ma trận chức vụ (ảnh hưởng mọi NV cùng chức vụ)

1. `/admin/crm/permissions`
2. Chọn chức vụ (vd. `MKT-01`)
3. Tick/bỏ tick section × action
4. **Lưu ma trận** → audit ghi nhận
5. **Xuất MD** lưu snapshot trước/sau
6. Thông báo **tất cả** NV thuộc chức vụ re-login

> Chỉ sửa ma trận chức vụ khi PO duyệt — không dùng để phân biệt content vs design (dùng **job function**).

---

## 5. Sửa ma trận job function (R1.5)

1. `/admin/crm/permissions/functions`
2. Chọn function (vd. `content`)
3. Tick caps add-on
4. **Lưu** → mọi user gắn `content` đổi quyền sau re-login

---

## 6. Persona tham chiếu

| NV | Chức vụ | Functions | Không được thấy |
|----|---------|-----------|-----------------|
| Copywriter | MKT-02 | content | FB Ads hub (design) |
| Designer | MKT-02 | design | SEO approve |
| AM | KD-01 | sales | Solution claim |
| Head Solution | MKT-01 | leader | — (full solution) |
| CSKH | CSKH-01 | ops | Solution queue claim |

---

## 7. Escalation

| Vấn đề | Liên hệ |
|--------|---------|
| Không login được | IT (staff_users.active) |
| 403 API / thiếu menu | Admin (caps) + PO |
| SoD conflict | PO quyết policy |
| Sửa ma trận khẩn cấp | SUPER-ADMIN + audit review |

---

## 8. Checklist NV sau onboard

- [ ] Login OK
- [ ] Badge đúng chức vụ + function
- [ ] Menu đúng phòng (không thấy module lạ)
- [ ] Thử 1 thao tác chính (lead / solution / board)
- [ ] Không 403 trên thao tác được phép

---

*Runbook v1.0 — 2026-08-07. Cập nhật khi R2-HR Org UI live.*
