# Hướng dẫn — Zalo Ads

> **Module:** MOD-ZALO  
> **Đối tượng:** Media Buyer, CSKH, Tracking, AM  
> **URL staff:** https://rs.pttads.vn/zalo/* · **Portal:** https://portal.pttads.vn/zalo

> **Tài liệu chuyên sâu:** [`docs/huong-dan-zalo-ads-ops.md`](../huong-dan-zalo-ads-ops.md)

---

## 1. Giới thiệu

Zalo Ads OS quản lý **quảng cáo Zalo + lead ingest** trong cùng nền tảng agency: hub insights, leads inbox, ads ops, đồng bộ CRM.

---

## 2. Zalo Ads Hub

**Route:** `/zalo/zalo-ads`

### Hàng ngày (Buyer — 10 phút)

1. Chọn **client**
2. Xem spend, impression, click, lead T-1
3. Map campaign Zalo ↔ CRM (nếu chưa map)
4. CPL = Spend ÷ Lead CRM cùng kỳ
5. Campaign lệch → điều chỉnh trên Zalo Ads Manager hoặc Ads Ops

---

## 3. Zalo Leads Inbox

**Route:** `/zalo/leads`

### CSKH xử lý lead Zalo

1. Filter **Mới** / **Chưa gán**
2. Mở lead — xem form fields, campaign source
3. **Assign** owner hoặc để auto-assign
4. **Push CRM** — lead xuất hiện `/crm/leads` với source=zalo
5. Dedup theo phone — merge nếu trùng

**Nguồn lead:**

- Webhook real-time (ưu tiên)
- Poll form API (backup cron)

---

## 4. Zalo Ads Ops

**Route:** `/zalo/ads-ops`

1. Tạo/sửa campaign draft (tùy wave triển khai)
2. Submit approval nội bộ
3. Triển khai lên Zalo (API hoặc manual + map ID)
4. Pause/update/stop campaign
5. Link `/crm/campaign-writes` nếu qua queue

**Trước go-live:** Launch QA pass (nhánh Zalo).

---

## 5. Onboard Zalo client

**Route:** `/agency/clients/[id]` — orchestrator Zalo

1. `zalo_account` — liên kết ads account
2. `zalo_token` — verify token
3. `zalo_form` — cấu hình lead form
4. `zalo_sync` — sync insights
5. `zalo_first_lead` — test lead vào CRM

---

## 6. Portal Zalo (khách hàng)

**Route portal:** `/zalo`

1. KPI performance read-only
2. Export CSV (nếu bật)
3. Duyệt creative/budget (nếu role approver + HĐ có)

Chi tiết: [14-client-portal.md](./14-client-portal.md)

---

## 7. Luồng lead → chốt sale

```
Zalo Ads → Lead webhook/poll → Zalo Inbox → CRM lead
    → CSKH B2 → Sales Won → Hub CPA refresh
```

---

## 8. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Lead không vào CRM | Webhook + poll backup; dedup log |
| CPL = 0 | Map campaign; kiểm tra lead count CRM |
| Sync insights fail | Token refresh trên agency channels |
| Duplicate lead | BR dedup — merge manual trên CRM |

---

## 9. Tài liệu tham chiếu

- [`huong-dan-zalo-ads-ops.md`](../huong-dan-zalo-ads-ops.md)
- Actions: [`docs/use-cases/actions/08-ZALO-ACTIONS.md`](../use-cases/actions/08-ZALO-ACTIONS.md)
