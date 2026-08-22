# ADR-MOB-04 — Capacitor trước React Native cho M3

**Status:** Proposed → *chờ Tech lead sign-off Phase 0*  
**Date:** 2026-08-01  
**Deciders:** Tech lead · Product · DevOps  
**RNOS:** RNOS-M3 · **Wave:** Phase 5 Mobile Native  
**Related:** ADR-MOB-01 (PWA-first) · [`2026-08-01-rnosai-mobile-strategy-spec.md`](./2026-08-01-rnosai-mobile-strategy-spec.md) §5.3 · [`m3-phase0-discovery-adr-checklist.md`](../runbooks/m3-phase0-discovery-adr-checklist.md)

---

## Context

Sau M2 (Portal PWA + Web Push), khách **Approver** cần:

- Push **ổn định trên iOS** (Web Push Safari hạn chế)
- **App Store / Play Store** presence (hợp đồng enterprise)
- Deep link từ email/SMS (`pttads://approve/{id}`)

Hai phương án khả thi:

| Option | Effort | Reuse portal-web |
|--------|--------|------------------|
| **A — Capacitor** wrap `https://portal.pttads.vn` | 6–8 tuần build + 2 tuần store prep | ~100% |
| **B — React Native / Expo** greenfield | 3–6 tháng | API only; UI rebuild 4–6 màn |

M2 KPI review (Phase 0) sẽ xác nhận pain point iOS push và adoption PWA trước khi commit build native.

---

## Decision

1. **Chọn Option A — Capacitor** làm native shell M3 v1 (`services/mobile-shell/`, `appId: vn.pttads.portal`).
2. WebView load **production Portal URL**; JWT + approval flows giữ nguyên Nest REST.
3. **Native push** qua FCM/APNs device token (`portal_native_device_tokens`), fan-out song song Web Push M2.
4. **Không** khởi động React Native monorepo trừ khi pivot criteria (§ Consequences) đạt sau pilot Capacitor **8 tuần**.
5. **Không** tạo `services/mobile-api` — mở rộng Nest portal module (`/api/v1/mobile/*`).

---

## Rationale

| Tiêu chí | Capacitor A | RN B |
|----------|-------------|------|
| Time-to-store | ✅ Nhanh | ❌ Chậm |
| Duy trì 2 UI | ✅ Một codebase portal-web | ❌ Portal web + mobile UI |
| Push iOS | ✅ Plugin `@capacitor/push-notifications` | ✅ Tốt hơn về lâu dài |
| Store review WebView | ⚠️ Rủi ro — cần review notes | ✅ Thấp hơn |
| Pivot cost | Thấp (đã có API native push) | Cao (sunk cost UI) |

**Kết luận:** ROI cao nhất cho M3 v1 với persona Approver (4–6 màn chính). RN chỉ khi Capacitor fail KPI sau pilot có số liệu.

---

## Consequences

### Positive

- Ship TestFlight / Play Internal trong **Phase 2** (tuần 7–9) với code M2 đã prod.
- Gate `rnos_m3_capacitor_gate.sh` đã cover Nest + portal bridge.
- AM có story “app chính thức trên store” cho enterprise.

### Negative / Risks

| Rủi ro | Mitigation |
|--------|------------|
| Apple reject WebView-only | Review notes; sẵn sàng 1–2 màn native; MOB-UC-010 deep link demo |
| Dual push (web + native) | Dedupe sender; user ưu tiên một kênh trong Settings |
| JWT trong WebView | HTTPS only · SameSite · session timeout M2 |
| Perf gesture | P2 polish đã ship; monitor Sentry `client:capacitor-portal` |

### Pivot sang Option B (RN)

Chỉ khi **đồng thời** sau pilot Capacitor **8 tuần**:

- Approve completion iOS **<50%** vs desktop portal, **và**
- Store reject WebView **≥2 lần** (Apple hoặc Google)

→ Mở ADR-MOB-05 (RN greenfield); reuse `/api/v1/mobile/*` và FCM infra.

---

## Acceptance checklist (Tech lead)

| # | Tiêu chí | Sign-off |
|---|----------|----------|
| 1 | Đã đọc báo cáo M2 KPI Phase 0 (Product) | ☐ |
| 2 | Trigger kickoff ≥2/3 (§7.7 runbook) hoặc executive override | ☐ |
| 3 | DevOps xác nhận Apple + Google org accounts (hoặc timeline ≤4 tuần) | ☐ |
| 4 | Legal xác nhận privacy policy URL draft | ☐ |
| 5 | Không blocker bảo mật JWT/WebView (Security review nếu có) | ☐ |

**Accepted by:** ___________________ · **Date:** ___________

**Ghi file sign-off:** `.local-dev/m3-phase0-signoff.json` (gate Phase 0 tạo template)

---

## Implementation notes (post-accept)

- Code: `services/mobile-shell/`, `rnos_m3_capacitor_gate.sh` ✅
- Env VPS: `PTT_MOBILE_NATIVE_PUSH_ENABLED`, `PTT_FCM_SERVER_KEY`, `PTT_MOBILE_MIN_VERSION`
- Header analytics: `X-PTT-Client: capacitor-portal/1.0`

---

## References

- [`services/mobile-shell/README.md`](../../services/mobile-shell/README.md)
- [`rnosai-vps-operations-guide.md`](../runbooks/rnosai-vps-operations-guide.md) §7.7
- [`queries-m3-m2-kpi-review.sql`](./queries-m3-m2-kpi-review.sql)
