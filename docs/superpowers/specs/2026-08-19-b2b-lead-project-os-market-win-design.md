# Design: B2B Lead Project OS — Market Win (v2–v3)

**Ngày:** 2026-08-19  
**Trạng thái:** Chờ duyệt  
**Module:** B2B Lead Project OS  
**Nền:** P1–P6 đã deploy (`0b881b6d`). Flag `PTT_B2B_PROJECT_OS` vẫn **OFF** trên prod.

---

## 1. Mục tiêu

Biến module dự án PTT (visibility + gán AI + SLA hop + mock gọi + PWA) thành **hệ inside-sales B2B thắng thị trường VN**: tốc độ first-touch đo được, gọi thật, báo realtime, intelligence closed-loop, hoa hồng gắn HĐ, omnichannel, compliance PDPA.

**Thắng =** Hot lead p95 first-touch **< 60s**, alert **< 5s**, NV không mất lead vì chậm, GDKD điều phối bằng số liệu, routing cải thiện theo won/lost.

---

## 2. Sáu trụ nâng cấp (đã khóa từ audit P1–P6)

| # | Trụ | Gap hiện tại | Kết quả thắng |
|---|-----|--------------|---------------|
| 1 | Realtime + mobile | Poll 15s, push no-op, `tel:` | SSE + FCM/Web Push + deep link, chuông Hot ≤30s |
| 2 | CPaaS + softphone | Adapter mock | 1 vendor (Stringee ưu tiên VN) + WebRTC + `answered` = first-touch |
| 3 | Intelligence closed-loop | Route 800ms, chưa học từ HĐ | Explain score, NBA, A/B routing, retrain từ won/lost |
| 4 | Revenue + commission | Split 30/70 trên hop, chưa payout | Ledger khi HĐ Active; đổi owner tay bắt buộc chọn split |
| 5 | Omnichannel ingest | FB/Zalo/web/API | Unmatched workbench + LinkedIn/TikTok/Google + offline conversion |
| 6 | Quality + compliance | Unit-heavy, staff.active hardcode | E2E B2B-01…18, SLO, PDPA/DNC, `crm_staff.active` thật |

---

## 3. Bốn trụ bổ sung để thắng nhất

| # | Trụ | Vì sao đối thủ thua |
|---|-----|---------------------|
| 7 | **Speed-to-lead OS** | HubSpot/Freshsales đo; CRM VN thường chỉ “có SLA”. Public p50/p95 theo dự án + NV. |
| 8 | **Conversation inbox** | Sales sống trên Zalo. Lead không chỉ form — thread OA 2 chiều gắn lead. |
| 9 | **Project manager role** | Enterprise hỏi “trưởng dự án thấy hết, sales chỉ lead mình”. Out-of-scope v1 → blocker deal. |
| 10 | **Ads closed-loop** | Lead vào → call → won → upload conversion Meta/Google. CPL thật, không đoán. |

Ngoài phạm vi chương trình này: đa công ty vận hành, barge/nghe lén, SMS báo NV, native iOS/Android store app (PWA + push đủ).

---

## 4. Kiến trúc

Tái sử dụng, không viết stack mới:

- **SSE** — copy pattern `SlaAlertService` / `GET …/sla-alerts/stream` (`cskh-board`).
- **Push** — reuse `PortalPushSenderService` (web-push) + `PortalNativePushSenderService` (FCM) cho **staff**, không portal khách.
- **CPaaS** — mở rộng `B2bCpaasAdapter` (`b2b-cpaas.adapter.ts`); mock giữ cho test.
- **Visibility C** — mọi list/stream/push/export gọi `canSeeB2bLead` / `B2bLeadScopeService`.
- **Flag** — `PTT_B2B_PROJECT_OS` vẫn master. Feature flags con: `PTT_B2B_SSE`, `PTT_B2B_PUSH`, `PTT_B2B_CPAAS`, `PTT_B2B_ADS_CAPI`.

```
Kênh → ingest → first assign → alert (DB)
                    ↓
         SSE fanout + FCM/Web Push (scope C)
                    ↓
         Softphone / AI call (CPaaS)
                    ↓
         answered → stop hop → first-touch clock
                    ↓
         won/lost → commission ledger + ads CAPI + routing feedback
```

---

## 5. Sóng triển khai

| Sóng | Tuần | Ship | Flag prod |
|------|------|------|-----------|
| **W0** | 1 | UAT B2B-01…18, `isActivePttStaff` thật, runbook bật flag | Staging ON |
| **W1** | 2–4 | SSE alerts, staff push, unmatched UI, list cột B2B, Gọi = resolve alert | Prod ON + push |
| **W2** | 5–8 | Stringee adapter, WebRTC widget, call log, Speed-to-lead dashboard | CPaaS ON 1 dự án |
| **W3** | 9–12 | Manual split, commission ledger, GDKD command center, E2E Playwright | — |
| **W4** | 13–18 | Explain score, NBA card, A/B routing, win/loss retrain | — |
| **W5** | 19–24 | Inbox Zalo 2 chiều, project-manager role, ads CAPI, DNC/PDPA | — |

W0 **chặn** W1 trên prod. Không bật CPaaS trước khi SSE+push ổn.

---

## 6. Quyết định khóa

| # | Quyết định | Chọn |
|---|------------|------|
| M1 | Realtime transport | **SSE** (đã có pattern), không WebSocket v2 |
| M2 | CPaaS v2 | **Stringee** (adapter). Tel4VN/Twilio cắm sau cùng interface |
| M3 | Push staff | Web Push PWA + FCM nếu device token; deep link `/crm/leads/{id}` |
| M4 | Project manager | Cap mới `crm_b2b_projects.manage_leads` trên **một** dự án (roster), không Director toàn hệ |
| M5 | Ads CAPI | Meta CAPI + Google Enhanced Conversions, **opt-in / dự án** |
| M6 | Conversation inbox | Zalo OA **trước**; WhatsApp Business sau (chưa phổ biến B2B VN) |

---

## 7. SLO (đo từ W2)

| Metric | Mục tiêu | Nguồn |
|--------|----------|--------|
| Hot first-touch p95 | < 60s trong giờ làm | `crm_b2b_lead_hops` + call `answered` |
| Alert persist → SSE | < 2s | server timestamp |
| Alert persist → push | < 5s | FCM/web-push receipt |
| Ingest webhook → lead row | < 3s p95 | webhook log |
| CPaaS startCall | < 1.5s hoặc `tel:` fallback | `crm_b2b_call_sessions` |

---

## 8. Tài liệu liên quan

- Spec v1: `docs/superpowers/specs/2026-08-18-b2b-lead-project-os-design.md`
- Plan v1: `docs/superpowers/plans/2026-08-18-b2b-lead-project-os.md`
- SSE: `services/ptt-crm-api/src/cskh-board/sla-alert.service.ts`
- Push: `services/ptt-crm-api/src/portal/portal-push-sender.service.ts`
- CPaaS: `services/ptt-crm-api/src/b2b-projects/b2b-cpaas.adapter.ts`
