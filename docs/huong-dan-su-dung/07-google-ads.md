# Hướng dẫn — Google Ads

> **Module:** Google Ads (cross-channel)  
> **Đối tượng:** Media Buyer, AM, Tracking  
> **URL staff:** https://rs.pttads.vn/google/google-ads · **Portal:** https://portal.pttads.vn/google

---

## 1. Giới thiệu

Google Ads module cung cấp **insights sync OAuth** và **KPI read-only** trên hub staff + portal. Phạm vi mỏng hơn Meta/Zalo — tập trung đo lường và báo cáo; campaign write có thể qua Google Ads Manager trực tiếp.

**Bật module:** `PTT_GOOGLE_INSIGHTS_SYNC=1`, `NEXT_PUBLIC_GOOGLE_ADS=1`

---

## 2. Kết nối Google Ads account

**Route:** `/agency/clients/[id]?tab=channels`

1. Section **Google Ads**
2. Bấm **Connect with Google** — OAuth flow
3. Chọn customer ID / MCC
4. **Save** — trigger sync insights
5. Verify badge xanh trên onboard orchestrator

---

## 3. Google Ads Hub (staff)

**Route:** `/google/google-ads`

### Hàng ngày (Buyer — 10 phút)

1. Chọn **client**
2. Xem KPI T-1: **Spend**, **Clicks**, **Conversions**, **CPL** (nếu map lead CRM)
3. Bảng campaign — sort spend / CPA
4. So sánh với Meta trên `/meta/ads-combined` (nếu cần)

### Không có nút launch

Thay đổi campaign thực hiện trên **Google Ads UI** — hub PTT chủ yếu **đọc + báo cáo**.

---

## 4. Map campaign ↔ CRM (nếu bật)

1. Trên hub, campaign **Unmapped** → bấm **Map**
2. Chọn CRM campaign / UTM convention
3. CPL closed-loop = Spend ÷ Lead CRM cùng kỳ

---

## 5. Portal Google (khách hàng)

**Route portal:** `/google`

1. Dashboard KPI aggregate
2. Chọn date range
3. Export CSV (self-serve, nếu bật)

Widget cũng xuất hiện trên `/dashboard` nếu client có Google trong HĐ.

Chi tiết: [14-client-portal.md](./14-client-portal.md)

---

## 6. Cross-channel view

**Route:** `/meta/ads-combined`

- So sánh CPL Meta vs Google cùng client
- Dùng trong họp review tuần AM + Buyer

---

## 7. Onboard checklist

1. OAuth connect (§2)
2. Sync T+1 OK
3. Hub hiển thị spend > 0
4. (Optional) Map campaign CRM
5. Portal widget visible cho client

---

## 8. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| OAuth fail | Re-connect; kiểm tra Google Cloud consent |
| Không có data T+1 | Jobs sync; `/agency/jobs` |
| Portal trống | Flag + client map + sync OK |
| CPL N/A | Chưa map lead CRM |

---

## 9. Tài liệu tham chiếu

- Tính năng: [`docs/tong-ket-tinh-nang/07-google-ads.md`](../tong-ket-tinh-nang/07-google-ads.md)
- Use case: [`docs/use-cases/03-META-ENTERPRISE.md`](../use-cases/03-META-ENTERPRISE.md) (cross-channel BC)
