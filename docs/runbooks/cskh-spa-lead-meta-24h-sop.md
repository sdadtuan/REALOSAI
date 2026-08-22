# SOP CSKH Spa — Lead Meta → Gọi → Won trong 24h

**Phiên bản:** 1.0 · **Ngày:** 2026-08-02  
**Phạm vi:** Lead **vận hành** từ Meta Lead Ads của client spa đã active (vd. Glow Beauty Spa — `GLOW-SPA`)  
**Bản in A4:** [`../forms/sop-cskh-spa-lead-meta-24h-a4.html`](../forms/sop-cskh-spa-lead-meta-24h-a4.html)

> **Không áp dụng** cho lead **bán HĐ agency mới** (prospect PTT) — luồng đó dùng funnel Pre-sales → Proposal → Convert Customer.  
> SOP song song: [sales-b2b-lead-client-onboard-sop.md](./sales-b2b-lead-client-onboard-sop.md) · [A4](../forms/sop-sales-b2b-lead-client-onboard-a4.html)

---

## SLA

| Mốc | Hạn | Bằng chứng trên CRM |
|-----|-----|---------------------|
| Gọi lần đầu | **≤ 15 phút** | Activity loại **Gọi điện** trên `/crm/leads/[id]` |
| Hoàn thành B2 | **≤ 4 giờ** | Panel **Funnel B2** →「✓ B2 đã hoàn thành」 |
| Won hoặc Lost | **≤ 24 giờ** | Status `chot` hoặc `lost` + audit note |

Quá **24h** chưa B2 → lead có thể vào **Review queue GDKD** (`/crm/leads/review-queue`).

---

## Luồng tóm tắt

```
/crm/leads (meta, moi)
  → /crm/leads/[id]
  → Gọi + Activity「Gọi điện」
  → Funnel: Gửi báo cáo Liên hệ OK → Hoàn thành B2
  → Trạng thái: da_lien_he → hen_gap | dang_tu_van → chot | lost
```

---

## Checklist theo UI `/crm/leads/[id]`

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **0** | `/crm/leads` — filter `source=meta`, `status=moi`, tab **Của tôi** |
| ☐ | **1** | Mở lead — kiểm chip **Meta** + client spa đúng |
| ☐ | **2** | Nút **Gọi** · **Thêm hoạt động** → Loại **Gọi điện** · ghi kết quả |
| ☐ | **3** | **Funnel B2 → Pre-sales** → **Gửi báo cáo Liên hệ OK** → **Hoàn thành B2** |
| ☐ | **4** | Form **Trạng thái** → `da_lien_he` → **Lưu trạng thái** |
| ☐ | **5** | Nếu hẹn lịch: `hen_gap` / `dang_tu_van` + activity ghi gói & giờ |
| ☐ | **6a Won** | `chot` + audit note giá VND (vd. 「Chốt gói Facial 2.500.000 VND」) |
| ☐ | **6b Lost** | `lost` + audit note lý do |
| ☐ | **7** | Kiểm timeline Hoạt động + audit đủ bước |
| ☐ | **8** | Cuối ca: zero lead `moi` của bạn > 24h |

---

## Trạng thái (dropdown Trạng thái)

| Code | Ý nghĩa spa |
|------|-------------|
| `moi` | Vừa ingest |
| `da_lien_he` | Đã gọi / liên hệ được |
| `dang_tu_van` | Đang tư vấn gói |
| `hen_gap` | Đã hẹn lịch đến spa |
| `chot` | **Won** — chốt gói / khách đến |
| `lost` | Không chốt |

---

## Lưu ý

- Panel **Hợp đồng → Service Delivery** trên cùng trang lead: chỉ dùng khi **ký HĐ agency mới**, không tick cho lead khách cuối spa.
- Banner **Phải tra soát (GDKD)**: dừng sửa — liên hệ GDKD.
- Closed-loop CPL: ghi **giá trị VND** trong audit khi `chot` để AM/hub tính ROAS.

---

## Tham chiếu

- [Hướng dẫn CSKH Enterprise — setup VPS & wave E0–E5](../huong-dan-cskh-enterprise-ops.md)
- [Runbook CSKH Enterprise (E0–E5)](./cskh-enterprise-ops-runbook.md) — shift handoff, alerts, 8 KPI GDKD, gate tuần 12
- [01-CRM-ACTIONS.md](../use-cases/actions/01-CRM-ACTIONS.md) — CRM-UC-001, UC-002  
- [product-model-v1.md](../product-model-v1.md) — B2 care gate  
- [00-SYSTEM-OVERVIEW.md](../use-cases/00-SYSTEM-OVERVIEW.md) — SYS-UC-002 closed-loop
