# Báo cáo M2 KPI — Input cho quyết định M3 (RNOS-M3 Phase 0)

> **Owner:** Product · **Reviewer:** Tech lead · **Horizon review:** 30 ngày (điều chỉnh `KPI_DAYS`)  
> **Thu thập số liệu:** `bash scripts/m3_m2_kpi_collect.sh` → `.local-dev/m3-m2-kpi-snapshot.json`  
> **SQL tham chiếu:** [`queries-m3-m2-kpi-review.sql`](../specs/queries-m3-m2-kpi-review.sql)

---

## 1. Executive summary

| Câu hỏi | Kết luận (1–2 câu) |
|---------|-------------------|
| M2 PWA + push đủ cho iOS Approver? | |
| Có cần kickoff M3 Capacitor (Option A)? | |
| Trigger kickoff đạt mấy / 3? (§7.7 runbook) | ☐ T1 ☐ T2 ☐ T3 → **__/3** |

**Khuyến nghị Product:** ☐ Proceed M3 Phase 1 Build · ☐ Defer · ☐ Pivot strategy

---

## 2. Phạm vi & cohort

| Field | Giá trị |
|-------|---------|
| Kỳ đo | ____ / ____ – ____ / ____ |
| Pilot approver (AM roster) | ___ users |
| Clients trong pilot | ___ |
| M2 prod go-live date | ____ |
| Ngày soak ≥90 ngày | ____ (gate cứng §7.7) |

**Danh sách pilot (AM):**

| # | Client | Approver email | iOS / Android | PWA installed? | Push subscribed? |
|---|--------|----------------|---------------|----------------|------------------|
| 1 | | | | ☐ | ☐ |
| 2 | | | | ☐ | ☐ |
| 3 | | | | ☐ | ☐ |

---

## 3. KPI — Push (iOS vs Android)

> **Định nghĩa delivery %:** `(push received confirmed by user OR opened notification) / push sent to user` trong pilot test matrix.

### 3.1. Web Push subscriptions (PG auto)

| Platform | Subscriptions (30d) | Distinct users | Ghi chú |
|----------|---------------------|----------------|---------|
| iOS (UA heuristic) | | | Safari PWA |
| Android | | | Chrome PWA |
| Other | | | Desktop / unknown |

**Nguồn:** `portal_push_subscriptions` · snapshot JSON § `push_by_platform`

### 3.2. Push delivery pilot test (manual)

| Platform | Tests sent | Delivered / opened | Delivery % | Target M2 |
|----------|------------|--------------------|------------|-----------|
| **iOS Safari PWA** | | | **___%** | ≥80% (trigger T3 nếu <80%) |
| **Android Chrome PWA** | | | **___%** | ≥90% |

**Test procedure:**

1. Approver bật push Settings → Gửi test push
2. Ghi nhận: nhận trong 60s · tap mở đúng `/notifications` hoặc entity
3. Lặp 3 lần / user / platform

### 3.3. Phân tích iOS vs Android

| Insight | iOS | Android |
|---------|-----|---------|
| Push reliability | | |
| User complaint count | | |
| Fallback (in-app notifications only) | | |

**Kết luận push:** _______________________________________________

---

## 4. KPI — Median time-to-approve (mobile)

> **Định nghĩa:** `reviewed_at - submitted_at` trên `creative_submissions` (creative + email approval nếu có bảng riêng).

| Metric | All channels | Mobile (ước lượng*) | Desktop | Target M3 pilot |
|--------|--------------|----------------------|---------|-----------------|
| Median hours | | | | ≤ M2 PWA −20% |
| Avg hours | | | | |
| Approved count (30d) | | | | |

\* Mobile proxy: session `X-PTT-Client` / viewport pilot log nếu có; nếu chưa instrument → ghi **N/A** và dùng survey AM.

**Email approval (PORTAL-UC-008):**

| Metric | Value |
|--------|-------|
| Median approve time mobile | |
| Pending email campaigns avg age | |

**Kết luận approve time:** _______________________________________________

---

## 5. KPI — PWA install rate (Portal M2)

> **Định nghĩa:** `approvers_installed_pwa / approvers_invited_to_pilot` × 100%

| Metric | Value | Target M2 spec |
|--------|-------|----------------|
| Approvers invited | | |
| Installed PWA (Add to Home Screen) | | |
| **Install rate** | **___%** | ≥30% pilot |
| Push subscribed after install | | |

**Nguồn:**

- ☐ AM pilot roster (primary nếu chưa có analytics)
- ☐ Analytics `pwa_install_accepted` (portal-web — khi instrument)
- ☐ Settings push enabled count / invited

**iOS vs Android install:**

| Platform | Invited | Installed | Rate |
|----------|---------|-----------|------|
| iOS | | | |
| Android | | | |

**Kết luận PWA adoption:** _______________________________________________

---

## 6. Trigger kickoff M3 (§7.7)

| # | Trigger | Ngưỡng | Đạt? | Evidence |
|---|---------|--------|------|----------|
| T1 | PWA conversion duyệt <60% iOS Safari | 30 ngày | ☐ | §5 iOS install + approve funnel |
| T2 | Enterprise yêu cầu App Store / Play | Hợp đồng | ☐ | Legal / AM ticket # |
| T3 | Web Push iOS delivery <80% | Pilot test | ☐ | §3.2 |

**Cần ≥2/3 để kickoff M3 (trừ executive override):** ☐ Pass · ☐ Fail

---

## 7. Qualitative feedback (AM + Approver)

| Theme | Quote / summary | Severity |
|-------|-----------------|----------|
| iOS push | | H/M/L |
| UX duyệt mobile | | |
| Yêu cầu app store | | |

---

## 8. Recommendation & next steps

| Action | Owner | Due |
|--------|-------|-----|
| Tech lead accept ADR-MOB-04 | Tech lead | W2 D5 |
| Open Apple + Google org accounts | DevOps / Legal | W1–W2 |
| Publish privacy policy draft URL | Legal + AM | W2 |
| App Store metadata draft review | Legal + AM | W2 |
| Phase 0 gate sign-off | Tech lead | W2 D10 |

**Product sign-off:** ___________________ · **Date:** ___________

**Tech lead sign-off:** ___________________ · **Date:** ___________

---

## Phụ lục A — Snapshot JSON

Paste hoặc link: `.local-dev/m3-m2-kpi-snapshot.json`

## Phụ lục B — Raw SQL output

```bash
psql "$DATABASE_URL" -f docs/specs/queries-m3-m2-kpi-review.sql
```
