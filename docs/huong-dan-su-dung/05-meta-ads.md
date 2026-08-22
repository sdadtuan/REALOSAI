# Hướng dẫn — Meta / Facebook Ads

> **Module:** MOD-META  
> **Đối tượng:** Media Buyer, Tracking/Tech, AM, GDKD  
> **URL staff:** https://rs.pttads.vn/meta/* · **Portal:** https://portal.pttads.vn/meta

> **Tài liệu chuyên sâu (900+ dòng):** [`docs/huong-dan-meta-enterprise-ops.md`](../huong-dan-meta-enterprise-ops.md)

---

## 1. Giới thiệu

Meta Enterprise Ops quản lý **quảng cáo Facebook/Instagram đa client**: sync insights, map campaign CRM, CPL/ROAS, tracking CAPI, launch campaign có governance, intelligence cảnh báo.

**Luồng closed-loop:** Spend → Lead webhook → CRM → CAPI → ROAS → Launch QA → Client report

---

## 2. Meta Ads Hub

**Route:** `/meta/facebook-ads`

### Hàng ngày (AM / Buyer — 15 phút)

1. Chọn **client** từ dropdown
2. Xem KPI T-1: **Spend**, **Lead CRM**, **CPL**, **ROAS**
3. Bảng campaign — sort CPL cao / spend spike
4. Campaign **chưa map** CRM → bấm **Map** — giảm % unmapped spend
5. Campaign underperform → drill Ads Ops hoặc Intelligence

### Export

- Nút **Export CSV** trên bảng campaign
- Dùng cho báo cáo nội bộ / đính kèm email khách

---

## 3. Tracking / Pixel / CAPI

**Route:** `/meta/tracking`

**Đối tượng:** Tracking/Tech

1. Chọn client
2. Tab **CAPI health** — xem event pending/failed
3. Tab **Pixel test** — gửi test event → verify received
4. Tab **Event rules** — cấu hình conversion mapping
5. Xử lý backlog CAPI pending trước Launch QA

**Trước go-live bắt buộc:** Pixel test pass + CAPI event flow OK.

---

## 4. Ads Ops — Launch / Edit campaign

**Route:** `/meta/ads-ops`

**Điều kiện:** Launch QA **passed** + creative **approved** + cap `meta_ads_ops.launch`

### Launch wizard

1. **+ Launch campaign**
2. Bước 1: Chọn client, objective (Lead, Traffic, …)
3. Bước 2: Creative + audience + placement
4. Bước 3: Budget daily/lifetime, schedule
5. Bước 4: Review → **Submit**
6. Nếu governance bật → queue approval Temporal
7. Sau approve → worker launch lên Meta API
8. Verify spend T+1 trên Hub

### Edit campaign

1. Chọn campaign existing
2. Thay đổi budget/status/targeting
3. Submit → approval queue (nếu bật)
4. Theo dõi `/crm/campaign-writes`

---

## 5. Meta Intelligence

**Route:** `/meta/intelligence`

1. **Anomaly** — spend spike, CPL drift so với 7d median
2. **Forecast** — ROAS/spend dự báo
3. **Recommendations** — gợi ý pause/scale (human decision)
4. GDKD: owner weekly digest (nếu schedule bật)

---

## 6. Các màn bổ sung

| Route | Cách dùng |
|-------|-----------|
| `/meta/ads-combined` | CPL Meta + Google cùng view |
| `/meta/alerts` | Inbox cảnh báo spend/CPL |
| `/meta/compliance` | Kiểm policy creative/copy |
| `/meta/creatives` | Registry creative ↔ campaign |
| `/meta/migration` | Signoff migrate Graph API version |

---

## 7. Creative & Launch QA (cross-module)

| Bước | Màn hình |
|------|----------|
| Upload creative | `/crm/creatives` |
| Client duyệt | Portal `/creatives` |
| Launch QA | `/crm/launch-qa` |
| Launch campaign | `/meta/ads-ops` |

---

## 8. Portal Meta (khách hàng)

**Route portal:** `/meta`

1. Chọn khoảng thời gian 7/28/30 ngày
2. Xem KPI cards (client-safe terminology)
3. Export CSV self-serve
4. Weekly PDF (nếu HĐ enterprise) — email T2 08:00

Chi tiết: [14-client-portal.md](./14-client-portal.md)

---

## 9. Onboard Meta client mới

1. `/agency/clients/[id]?tab=channels` — map ad account + token
2. Trigger sync insights
3. `/meta/tracking` — pixel + CAPI
4. Webhook lead Meta → verify lead vào `/crm/leads`
5. Hub map campaign → CPL sane T+1

---

## 10. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| CPL lệch | Map campaign; kiểm tra lead dedup CRM |
| CAPI failed | Tracking tab — fix token/event |
| Launch blocked | Launch QA chưa pass |
| Hub không có data T+1 | Jobs sync — `/agency/jobs` |
| Token expired | Re-auth trên agency client channels |

---

## 11. Setup Meta từ đầu (tài khoản, App, Form, ID, Token)

Quy trình đầy đủ trên nền Meta (Business Portfolio, Ad Account, Pixel, Lead Form, Developer App, webhook):

→ **[huong-dan-meta-setup-tai-khoan-app-form-token.md](../huong-dan-meta-setup-tai-khoan-app-form-token.md)**

---

## 12. Tài liệu tham chiếu

- Ops guide đầy đủ: [`huong-dan-meta-enterprise-ops.md`](../huong-dan-meta-enterprise-ops.md)
- Actions: [`docs/use-cases/actions/03-META-ACTIONS.md`](../use-cases/actions/03-META-ACTIONS.md)
