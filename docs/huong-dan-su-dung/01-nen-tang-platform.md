# Hướng dẫn — Nền tảng & Phân quyền

> **Module:** MOD-PLAT · MOD-AUTH · MOD-ADMIN  
> **Đối tượng:** Super Admin, HR Admin, IT  
> **URL:** https://rs.pttads.vn/admin/*

---

## 1. Giới thiệu

Domain này quản lý **đăng nhập**, **phân quyền RBAC**, **org chart**, **webhook**, và **console AI admin**. End-user thường ngày chỉ cần đăng nhập; Admin dùng các màn `/admin/*`.

### 1.1 Truy cập Quản trị hệ thống (sidebar)

1. Đăng nhập ops-web với tài khoản có quyền Admin/HR/IT
2. Sidebar → mở rộng menu (nút **»**)
3. Nhóm **Quản trị hệ thống** — chọn mục cần:
   - **Người dùng** — onboard, offboard, gán quyền
   - **Ma trận chức vụ** / **Job function** — RBAC
   - **Custom fields**, **Pipeline**, **Nguồn & Kênh** — schema CRM
   - **AI Agents** — governance AI (nếu có cap `ai_admin`)
4. HR vận hành roster: **Nhân sự & Hiệu suất → Nhân viên** (`/crm/staff`) — khác với tài khoản login

Spec: [`docs/specs/2026-08-11-admin-control-plane-ia.md`](../specs/2026-08-11-admin-control-plane-ia.md)

---

## 2. Đăng nhập staff

### 2.1. Đăng nhập email/mật khẩu

1. Mở `/login`
2. Nhập email (ví dụ `ten.nhanvien@pttads.vn`) và mật khẩu
3. Bấm **Đăng nhập**
4. Hệ thống cấp JWT → redirect dashboard hoặc trang trước đó

**Khi lỗi:** Thông báo chung "Sai email hoặc mật khẩu" — không tiết lộ email có tồn tại hay không.

### 2.2. Đăng nhập SSO (Keycloak)

1. Tại `/login`, bấm **Đăng nhập SSO**
2. Redirect sang Keycloak → nhập credential công ty
3. Quay về `/login/callback` → vào ops-web
4. Caps có thể map từ **SSO group** (WIN-4)

### 2.3. MFA (nếu bật)

1. Sau login bước 1 → redirect `/login/mfa`
2. Nhập mã OTP từ app authenticator
3. Bấm **Xác nhận**

---

## 3. Quản lý phân quyền (RBAC)

### 3.1. Xem ma trận quyền

**Route:** `/admin/crm/permissions`

1. Sidebar → **Quản trị hệ thống** → **Ma trận chức vụ**
2. Bảng hiển thị **section × action** (view, create, edit, delete, export, …)
3. Mỗi role template có tick cap tương ứng

**Ví dụ cap:** `crm_leads.view`, `crm_leads.edit`, `meta_ads_ops.launch`, `email_campaigns.approve`

### 3.2. Permission Sets

**Route:** `/admin/crm/permission-sets/[code]`

1. Chọn template (ví dụ `AM_STANDARD`, `BUYER_META`)
2. Xem/chỉnh danh sách cap trong set
3. **Lưu** → áp dụng cho user gán set đó

### 3.3. Permission Simulator

**Route:** `/admin/crm/permissions/simulator`

Dùng khi **kiểm tra trước khi gán quyền**:

1. Chọn **user** hoặc **role template**
2. Bấm **Simulate**
3. Xem sidebar menu sẽ hiện/ẩn và API nào được phép
4. Điều chỉnh cap → simulate lại

### 3.4. Break-glass (truy cập khẩn cấp)

Khi cần truy cập tạm vượt cap (sự cố P1):

1. User có cap `staff.break_glass.request` gửi yêu cầu
2. Admin approve → session tạm thời mở rộng cap
3. Mọi hành động ghi **audit log** bắt buộc

---

## 4. Org chart

**Route:** `/admin/crm/org/*`

| Trang | Chức năng |
|-------|-----------|
| `/admin/crm/org/departments` | Phòng ban |
| `/admin/crm/org/teams` | Team trong phòng |
| `/admin/crm/org/positions` | Chức vụ |
| `/admin/crm/org/users` | Gán user → phòng/team/chức vụ |

### Thêm nhân viên vào org

1. Mở `/admin/crm/org/users`
2. Tìm user → **Sửa**
3. Chọn phòng ban, team, chức vụ
4. **Lưu** — dùng cho KPI, Ops Dashboard Team Lead, payroll

---

## 5. Cấu hình CRM

| Route | Mục đích |
|-------|----------|
| `/admin/crm/pipeline` | Stage pipeline sales |
| `/admin/crm/custom-fields` | Trường tùy chỉnh lead/customer |
| `/admin/crm/lead-lookups` | Danh mục lookup (nguồn, ngành, …) |

---

## 6. Admin AI Console

**Route:** `/admin/ai/*`

| Trang | Cách dùng |
|-------|-----------|
| `/admin/ai/agents` | Xem registry agent (lead score, renewal, …) |
| `/admin/ai/runs` | Tra cứu lịch sử chạy AI — filter theo agent, lifecycle, lead |
| `/admin/ai/tools` | Định nghĩa tool AI (function calling) |

**Khi debug AI:** Mở run failed → xem input/output, error, duration.

---

## 7. Client scope pilot

Giới hạn AM chỉ thấy client trong danh sách pilot:

- Env: `STAFF_SCOPE_PILOT=1`
- Gán client list per user qua API hoặc admin tool
- AM không thấy client ngoài scope trên hub/agency

---

## 8. Global search

1. Phím tắt hoặc ô search header (nếu bật)
2. Gõ tên lead, customer, client, campaign
3. Chọn kết quả → jump tới detail

API: `GET /api/v1/search?q=...`

---

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|-------------|-------------|-------|
| Menu thiếu mục | Không có cap | Admin gán permission set |
| API 403 | Cap thiếu action | Simulator kiểm tra |
| SSO loop | Keycloak misconfig | IT kiểm tra redirect URI |
| Break-glass hết hạn | Session TTL | Request lại |

---

## 10. Tài liệu tham chiếu

- Phân quyền chi tiết: [`docs/handover/05-PHAN-QUYEN-BAO-MAT-SLA.md`](../handover/05-PHAN-QUYEN-BAO-MAT-SLA.md)
- Use case: [`docs/use-cases/07-PLATFORM-AUTH-WEBHOOKS.md`](../use-cases/07-PLATFORM-AUTH-WEBHOOKS.md)
- Actions: [`docs/use-cases/actions/07-PLAT-ACTIONS.md`](../use-cases/actions/07-PLAT-ACTIONS.md)
