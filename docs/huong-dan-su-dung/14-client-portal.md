# Hướng dẫn — Client Portal

> **Module:** MOD-PORTAL  
> **Đối tượng:** Khách hàng agency (Viewer, Approver)  
> **URL:** https://portal.pttads.vn

> **Tài liệu bàn giao:** [`docs/handover/03-HUONG-DAN-PORTAL-KHACH-HANG.md`](../handover/03-HUONG-DAN-PORTAL-KHACH-HANG.md)

---

## 1. Giới thiệu

Portal là cổng **read-only + duyệt** cho khách — KPI đa kênh, approval creative/content/email, tiến độ triển khai DV. JWT **scoped theo client_id** — không thấy dữ liệu công ty khác.

---

## 2. Đăng nhập & tài khoản

### 2.1. Đăng nhập

1. Mở https://portal.pttads.vn/login
2. Nhập email + mật khẩu PTT cấp lúc bàn giao
3. Vào **Dashboard**

### 2.2. Vai trò

| Vai trò | Quyền |
|---------|-------|
| **Viewer** | Xem dashboard, báo cáo, export |
| **Approver** | Viewer + duyệt/từ chối inbox |

### 2.3. Quên / đổi mật khẩu

| Luồng | Route |
|-------|-------|
| Quên MK | `/forgot-password` → email link |
| Đặt MK mới | `/reset-password?token=…` |
| Đổi MK (đã login) | `/settings` |

AM reset từ ops: `/agency/clients/[id]?tab=portal` → **Reset MK**

**Lần đầu:** đổi MK tại Settings nếu PTT yêu cầu.

---

## 3. Dashboard

**Route:** `/dashboard`

Widget hiện theo **dịch vụ trong HĐ**:

| Widget | Nội dung |
|--------|----------|
| Meta | Spend, leads, CPL T-1 |
| Google / Zalo | KPI kênh tương ứng |
| SEO | GSC clicks, content status |
| Email | Campaign stats, pending approvals |
| MKT-AI / Content / Ops | Card tóm tắt module (nếu bật) |
| Pending approvals | Link nhanh inbox |

Dữ liệu **T-1** trừ KPI real-time stub.

---

## 4. Meta (`/meta`)

1. Chọn range 7 / 28 / 30 ngày
2. KPI cards — thuật ngữ client-safe (xem bảng trong handover §4.2)
3. Bảng campaign → **Export CSV**
4. Weekly PDF (HĐ enterprise) — email T2 08:00

Chi tiết staff: [05-meta-ads.md](./05-meta-ads.md)

---

## 5. Google & Zalo

| Route | Nội dung |
|-------|----------|
| `/google` | KPI Google Ads + export |
| `/zalo` | KPI Zalo Ads + export |

---

## 6. SEO (`/seo`, `/seo/content`, `/seo/reports`)

### Viewer

- Organic performance summary
- Trạng thái content (stage, không lộ note nội bộ)
- PDF báo cáo tháng

### Approver — duyệt content

1. `/seo/content` hoặc link email notification
2. Preview bài + meta SEO
3. **Approve** / **Reject** + comment
4. Staff publish sau approve

---

## 7. Email (`/email`, `/email/approvals`)

1. Dashboard — sent, open rate, click rate
2. `/email/approvals` — campaign chờ duyệt
3. Click campaign → preview desktop/mobile
4. **Approve** → staff schedule send  
   **Reject** → comment → strategist sửa

**SLA duyệt:** ≤ 24h giờ hành chính (khuyến nghị HĐ).

---

## 8. Creative (`/creatives`)

1. Inbox creative chờ duyệt (Meta / multi-channel)
2. Preview image/copy
3. Approve / Reject
4. Sync closed-loop — buyer launch sau approve

---

## 9. Service Delivery — Ops summary

**Route:** `/service-delivery`  
**Bật:** `PTT_OPS_PORTAL_SUMMARY=1`

1. Tiến độ triển khai DV (read-only)
2. KPI tháng — nhãn Đạt / Cần chú ý / Không đạt
3. Không hiện checklist nội bộ chi tiết

AM giải thích KPI cùng khách trong họp review.

---

## 10. Notifications & Settings

| Route | Chức năng |
|-------|-----------|
| `/notifications` | In-app notifications |
| `/settings` | Profile, đổi MK, branding logo, **push preferences** |

Push: bật trên mobile PWA ([15-mobile.md](./15-mobile.md)).

---

## 11. Quy trình duyệt chung

```
Staff submit → Portal inbox → Approver review
    → Approve: staff tiếp tục (launch/send/publish)
    → Reject: comment → staff sửa → submit lại
```

**Không chia sẻ tài khoản approver** — mỗi người một login để audit.

---

## 12. Lỗi thường gặp

| Vấn đề | Liên hệ |
|--------|---------|
| Widget trống | AM — kiểm tra onboard + map channel |
| Không thấy approval | Role approver; item chưa submit |
| Login fail | AM reset MK |
| Archived client | Redirect `/archived` — liên hệ AM |

---

## 13. Tài liệu tham chiếu

- [`03-HUONG-DAN-PORTAL-KHACH-HANG.md`](../handover/03-HUONG-DAN-PORTAL-KHACH-HANG.md)
- Actions: [`docs/use-cases/actions/06-PORTAL-ACTIONS.md`](../use-cases/actions/06-PORTAL-ACTIONS.md)
