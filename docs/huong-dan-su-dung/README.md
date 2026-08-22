# RNOSAI — Hướng dẫn sử dụng theo domain

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-08-10  
> **Đối tượng:** Nhân viên PTT (ops-web) và khách hàng (portal-web)  
> **URL staff:** https://rs.pttads.vn · **URL portal:** https://portal.pttads.vn

Tài liệu này mô tả **cách sử dụng từng chức năng** theo domain — gồm bước thao tác, vai trò, điều kiện và xử lý lỗi thường gặp.

## Mục lục

| # | Domain | File | Đối tượng chính |
|---|--------|------|-----------------|
| — | Bắt đầu | [00-tong-quan.md](./00-tong-quan.md) | Tất cả |
| 1 | Nền tảng & phân quyền | [01-nen-tang-platform.md](./01-nen-tang-platform.md) | Admin, HR |
| 2 | CRM Core | [02-crm-core.md](./02-crm-core.md) | CSKH, Sales, AM, GDKD |
| 3 | Agency & Triển khai DV | [03-agency-service-delivery.md](./03-agency-service-delivery.md) | AM, SP, Creative |
| 4 | Ops DV OS | [04-ops-dv.md](./04-ops-dv.md) | AM, Team Lead, SP, Exec |
| 5 | Meta / Facebook Ads | [05-meta-ads.md](./05-meta-ads.md) | Buyer, Tracking, AM |
| 5b | **Meta setup (tài khoản, App, Form, Token)** | [../huong-dan-meta-setup-tai-khoan-app-form-token.md](../huong-dan-meta-setup-tai-khoan-app-form-token.md) | IT, Tracking, AM |
| 6 | Zalo Ads | [06-zalo-ads.md](./06-zalo-ads.md) | Buyer, CSKH |
| 7 | Google Ads | [07-google-ads.md](./07-google-ads.md) | Buyer, AM |
| 8 | SEO / AEO | [08-seo-aeo.md](./08-seo-aeo.md) | SEO Strategist, Writer |
| 9 | Email Marketing | [09-email-marketing.md](./09-email-marketing.md) | Email Strategist, AM |
| 10 | Content Marketing OS (tóm tắt) | [10-content-marketing.md](./10-content-marketing.md) | SP Content, QA |
| 18 | **Content Marketing OS (đầy đủ — kênh, ảnh, video)** | [18-content-marketing-os.md](./18-content-marketing-os.md) | SP Content, QA, IT |
| 19 | **Video SOP Studio (Module 7 — tóm tắt S4)** | [19-video-sop.md](./19-video-sop.md) | AM, Copy, Art, Motion, Editor |
| 20 | **Video SOP Studio (đầy đủ — env, image/video, UI từng bước + wireframe)** | [20-video-sop-huong-dan-day-du.md](./20-video-sop-huong-dan-day-du.md) | AM, Copy, Art, Motion, Editor, IT |
| 21 | **Video SOP — Checklist onboarding (AM / Motion / IT)** | [21-video-sop-onboarding-checklist.md](./21-video-sop-onboarding-checklist.md) | AM, Motion, IT, Admin |
| 11 | Marketing AI Planner | [11-marketing-ai-planner.md](./11-marketing-ai-planner.md) | SP, MKT Lead |
| 12 | AI Revenue OS | [12-ai-revenue-os.md](./12-ai-revenue-os.md) | CSKH, Manager, GDKD |
| 13 | HR & Payroll | [13-hr-payroll.md](./13-hr-payroll.md) | HR, NV |
| 17 | **HR Employee File OS (P1–P8)** | [17-hr-employee-file-os.md](./17-hr-employee-file-os.md) | HR, NV, IT |
| 14 | Client Portal | [14-client-portal.md](./14-client-portal.md) | Khách hàng |
| 15 | Mobile (PWA / App) | [15-mobile.md](./15-mobile.md) | Khách hàng, AM |
| 16 | **SOP chốt deal Sales/Solution** | [16-sales-solution-chot-deal-sop.md](./16-sales-solution-chot-deal-sop.md) | Sales, AM, Solution, GDKD |

## Tài liệu liên quan

| Loại | Đường dẫn |
|------|-----------|
| Danh mục tính năng | [`docs/tong-ket-tinh-nang/`](../tong-ket-tinh-nang/README.md) |
| Use case chi tiết | [`docs/use-cases/`](../use-cases/README.md) |
| Bàn giao khách hàng | [`docs/handover/`](../handover/README.md) |
| Hướng dẫn ops chuyên sâu | [`huong-dan-meta-enterprise-ops.md`](../huong-dan-meta-enterprise-ops.md), SEO, Email, Zalo |

## Quy ước trong tài liệu

- **Route** = đường dẫn trên ops-web hoặc portal-web sau domain.
- **Cap** = quyền RBAC (section.action), ví dụ `crm_leads.view`.
- **Gate** = điều kiện bắt buộc trước khi thao tác tiếp theo.
- Menu ẩn nếu không có cap — **không phải lỗi hệ thống**.
