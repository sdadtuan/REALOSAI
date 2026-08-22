# SOP Sales B2B — Lead → Customer → Agency Client onboard

**Phiên bản:** 1.0 · **Ngày:** 2026-08-02  
**Phạm vi:** Lead **bán HĐ agency mới** — doanh nghiệp prospect muốn thuê PTT (Meta, SEO, Email, Zalo…)  
**Bản in A4:** [`../forms/sop-sales-b2b-lead-client-onboard-a4.html`](../forms/sop-sales-b2b-lead-client-onboard-a4.html)

> **Không áp dụng** cho lead **vận hành spa/Meta** (khách cuối của client đã active) — luồng đó dùng [cskh-spa-lead-meta-24h-sop.md](./cskh-spa-lead-meta-24h-sop.md).

---

## Mục tiêu

Chốt HĐ dịch v agency → **Customer CRM** → **Agency Client active** → client sẵn sàng nhận lead ads (spa/Meta…) trong **≤ 14 ngày** (SYS-UC-001).

---

## Milestone (SLA gợi ý B2B)

| Giai đoạn | Hạn gợi ý | Bằng chứng CRM |
|-----------|-----------|----------------|
| Liên hệ + qualify | **≤ 2 ngày làm việc** | Activity + status `da_lien_he` |
| Pre-sales / KH MKT sơ bộ | **≤ 5 ngày** sau qualify | Pre-sales record + draft plan (`CRM-UC-005`) |
| Proposal gửi khách | **≤ 3 ngày** sau pre-sales OK | `/crm/proposals` · version PDF |
| HĐ ký | Theo deal | **LeadContractPanel** · HĐ `active` |
| Convert Customer | **Trong 1 ngày** sau ký | Lead `won` · `/crm/customers` |
| Client onboard active | **≤ 14 ngày** sau ký | `/agency/clients/[id]` checklist 100% · status `active` |

Deal **> ngưỡng GDKD** → bắt buộc review queue trước proposal (`/crm/leads/review-queue`, BR-CRM-003).

---

## Luồng tóm tắt

```
Lead B2B (referral / web / event / tạo tay)
  → /crm/leads/[id] — qualify · KHÔNG dùng funnel B2 spa 24h
  → /crm/intake + LeadFunnel Pre-sales (CRM-UC-005)
  → /crm/proposals → client accept (CRM-UC-006)
  → LeadContractPanel: HĐ draft → submit → active
  → Promote → Customer + lifecycle (CRM-UC-007)
  → /agency/clients/new → onboarding checklist (SYS-UC-001)
  → Client active → Meta/Zalo webhook → lead vận hành (SOP spa)
```

---

## Checklist theo giai đoạn

### A — Qualify lead B2B

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **A0** | Tạo/mở lead: `/crm/leads/new` hoặc list · **không** gắn nhầm `agency_client_id` client đang vận hành |
| ☐ | **A1** | Ghi `source` (referral, website, event…) · Activity discovery |
| ☐ | **A2** | Xác nhận **đối tượng là DN prospect** (không phải khách đặt lịch spa) |
| ☐ | **A3** | Status → `da_lien_he` · BANT sơ bộ trong activity |
| ☐ | **A4** | Nếu deal lớn: GDKD review queue trước khi báo giá |

### B — Pre-sales (CRM-UC-005)

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **B1** | `/crm/intake?lead_id=…` — phiên discovery |
| ☐ | **B2** | **LeadFunnelPanel → Pre-sales** — tạo record · advance stage |
| ☐ | **B3** | KH MKT sơ bộ (draft scope) · catalog ngành/dịch vụ |
| ☐ | **B4** | Gate BR-CRM-005: pre-sales OK trước proposal |

### C — Proposal (CRM-UC-006)

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **C1** | `/crm/proposals` — tạo từ template + catalog SKU |
| ☐ | **C2** | Gửi PDF / email khách · ghi version |
| ☐ | **C3** | Client accept · audit accept |
| ☐ | **C4** | Status lead → `proposal` / negotiation nếu cần |

### D — Hợp đồng trên lead

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **D1** | `/crm/leads/[id]` — panel **Hợp đồng / Service Delivery** |
| ☐ | **D2** | Tạo HĐ draft · amount VND · service slug |
| ☐ | **D3** | Submit → approval (GDKD/Legal nếu cấu hình) |
| ☐ | **D4** | HĐ **active** · signed_on |

### E — Convert Customer (CRM-UC-007)

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **E1** | Promote HĐ → lead status **`won`** |
| ☐ | **E2** | Xác nhận **Customer** trên `/crm/customers` |
| ☐ | **E3** | Service lifecycle → stage **Onboard** (`/crm/service-delivery`) |

### F — Agency Client onboard (SYS-UC-001)

| ☐ | Bước | Thao tác |
|---|------|----------|
| ☐ | **F1** | `/agency/clients/new` — code, tên, ngành, **Owner AM** |
| ☐ | **F2** | Link customer · status `onboarding` |
| ☐ | **F3** | Tab **Channels** — Meta/Zalo token · form IDs |
| ☐ | **F4** | Tab **Checklist** — legal, billing, brief → **100%** |
| ☐ | **F5** | Map campaign hub · tracking preflight (`/meta/tracking`) |
| ☐ | **F6** | Tab **Portal users** — tạo viewer (optional) |
| ☐ | **F7** | Lifecycle → **Deliver** · client status → **`active`** |
| ☐ | **F8** | Handover AM → bắt đầu nhận lead vận hành (SOP spa Meta 24h) |

---

## Trạng thái lead (B2B sales)

| Code | Khi nào dùng |
|------|----------------|
| `moi` | Lead prospect mới |
| `da_lien_he` | Đã discovery / qualify |
| `dang_tu_van` | Đang làm pre-sales |
| `proposal` | Đã / đang gửi báo giá |
| `won` | HĐ ký + promote — **không dùng `chot`** |
| `lost` | Không chốt HĐ |

> **`chot`** = Won lead **spa end-user**. **`won`** = Won deal **bán agency**.

---

## Phân vai

| Vai trò | Giai đoạn chính |
|---------|------------------|
| Sales / AM | A → C · F1–F2 |
| Pre-sales | B |
| GDKD | Review queue · approval HĐ lớn |
| Tracking/Tech | F3 · F5 |
| Legal/Finance | D3–D4 |

---

## Tham chiếu

- [sales-b2b-lead-client-onboard-a4.html](../forms/sop-sales-b2b-lead-client-onboard-a4.html) — bản in  
- [cskh-spa-lead-meta-24h-sop.md](./cskh-spa-lead-meta-24h-sop.md) — SOP song song (lead vận hành)  
- [RNOSAI-BA-CRM-UseCases.md](../specs/modules/RNOSAI-BA-CRM-UseCases.md) — CRM-UC-005 → 007  
- [RNOSAI-BA-SYS-UseCases.md](../specs/modules/RNOSAI-BA-SYS-UseCases.md) — SYS-UC-001  
- [01-CRM-ACTIONS.md](../use-cases/actions/01-CRM-ACTIONS.md) · [00-SYSTEM-ACTIONS.md](../use-cases/actions/00-SYSTEM-ACTIONS.md)
