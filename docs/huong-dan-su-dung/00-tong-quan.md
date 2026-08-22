# Hướng dẫn — Tổng quan & bắt đầu

> **Đối tượng:** Mọi nhân viên PTT và khách hàng portal  
> **URL staff:** https://rs.pttads.vn · **URL portal:** https://portal.pttads.vn

---

## 1. Hai ứng dụng chính

| Ứng dụng | Ai dùng | Mục đích |
|----------|---------|----------|
| **ops-web** (rs.pttads.vn) | Nhân viên PTT | CRM, triển khai DV, ads, SEO, email, AI, HR |
| **portal-web** (portal.pttads.vn) | Khách hàng agency | Xem KPI, duyệt creative/content/campaign |

Dữ liệu hai app dùng chung backend **ptt-crm-api** — thay đổi trên ops-web (ví dụ duyệt creative) phản ánh ngay trên portal.

---

## 2. Đăng nhập staff (ops-web)

### Bước thực hiện

1. Mở https://rs.pttads.vn/login
2. Nhập **email** và **mật khẩu** do Admin HR cấp
3. (Nếu bật SSO) chọn **Đăng nhập SSO** → redirect Keycloak → quay về ops-web
4. (Nếu bật MFA) nhập mã OTP tại `/login/mfa`
5. Sau đăng nhập, sidebar **OpsNav** hiển thị menu theo **quyền của bạn**

### Lưu ý

- Dev/staging có tài khoản demo — **không dùng production**
- Session tự refresh — không cần đăng nhập lại mỗi giờ
- Hết phiên → redirect về `/login`

Chi tiết phân quyền: [01-nen-tang-platform.md](./01-nen-tang-platform.md)

---

## 3. Cấu trúc menu ops-web

| Nhóm sidebar | Domain | Ví dụ route |
|--------------|--------|-------------|
| Tổng quan | CRM CSKH | `/crm/cskh-board` |
| Chăm sóc KH | CRM | `/crm/leads`, `/crm/customers` |
| Marketing | Agency, SVC | `/crm/service-delivery`, `/crm/launch-qa` |
| Kinh doanh | CRM Sales | `/crm/sales`, `/crm/proposals` |
| Nhân sự | HR | `/crm/hr`, `/crm/payroll` |
| Tài chính | CRM Finance | `/crm/financials`, `/crm/business-dashboard` |
| Agency & Hub | Meta, SEO, Email, Zalo | `/meta/facebook-ads`, `/seo/hub` |
| Ops DV | MOD-OPS | `/crm/ops/dashboard`, `/crm/ops/alerts` |
| Admin | Platform | `/admin/crm/org`, `/admin/ai/agents` |

Menu chỉ hiện module bạn **có quyền**. Nếu không thấy mục cần dùng → liên hệ Admin gán cap.

---

## 4. Luồng nghiệp vụ end-to-end (tóm tắt)

```
Lead (webhook/form) → CSKH chăm sóc → Pre-sales / Proposal
    → Ký HĐ → Service Lifecycle (Onboard → Deliver → Handover → Retain)
    → Triển khai kênh (Meta/Zalo/SEO/Email/Content)
    → Launch QA → Campaign go-live
    → KPI T+1 → Báo cáo portal khách
    → Duyệt creative/content/email trên portal
```

Mỗi bước có hướng dẫn chi tiết trong file domain tương ứng.

---

## 5. Chọn tài liệu theo vai trò

| Vai trò | Đọc trước |
|---------|-----------|
| CSKH / Sales | [02-crm-core.md](./02-crm-core.md), [12-ai-revenue-os.md](./12-ai-revenue-os.md) |
| Account Manager | [02-crm-core.md](./02-crm-core.md), [03-agency-service-delivery.md](./03-agency-service-delivery.md), [04-ops-dv.md](./04-ops-dv.md) |
| Media Buyer | [05-meta-ads.md](./05-meta-ads.md), [06-zalo-ads.md](./06-zalo-ads.md), [07-google-ads.md](./07-google-ads.md) |
| SEO team | [08-seo-aeo.md](./08-seo-aeo.md) |
| Email team | [09-email-marketing.md](./09-email-marketing.md) |
| Content / SP | [10-content-marketing.md](./10-content-marketing.md), [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) |
| Admin / HR | [01-nen-tang-platform.md](./01-nen-tang-platform.md), [13-hr-payroll.md](./13-hr-payroll.md) |
| Khách hàng | [14-client-portal.md](./14-client-portal.md), [15-mobile.md](./15-mobile.md) |

---

## 6. Thao tác chung

### 6.1. Lọc theo client

Hầu hết màn Meta, SEO, Email, Agency có **dropdown chọn client** hoặc query `?client_id=`. Luôn chọn đúng client trước khi thao tác.

### 6.2. Export & báo cáo

- Meta: CSV trên hub hoặc portal `/meta`
- SEO: PDF tại `/seo/reports`
- Email: scheduled report tại `/email/reports`
- CRM CSKH: Excel export trên `/crm/cskh-board`

### 6.3. Thiết bị khuyến nghị

- **Desktop** — thao tác chính (wizard, bảng lớn)
- **Tablet** — review campaign, duyệt portal OK
- **Mobile** — portal PWA xem KPI và duyệt nhanh ([15-mobile.md](./15-mobile.md))

---

## 7. Hỗ trợ & escalation

| Vấn đề | Liên hệ |
|--------|---------|
| Không đăng nhập được | Admin HR / IT |
| Thiếu menu / quyền | Admin RBAC |
| Lead không vào CRM | Tracking / DevOps (webhook) |
| Portal khách không thấy KPI | AM kiểm tra onboard + map channel |
| Sự cố P1 (webhook down) | Runbook VPS + on-call |

Runbook: [`docs/runbooks/rnosai-vps-operations-guide.md`](../runbooks/rnosai-vps-operations-guide.md)
