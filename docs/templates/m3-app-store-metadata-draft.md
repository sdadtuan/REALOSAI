# App Store & Play Store — Metadata Draft (PTT Portal)

> **Owner:** Legal + AM · **App:** PTT Portal · **Bundle / Package:** `vn.pttads.portal`  
> **Phase:** RNOS-M3 Phase 0 · **Publish target:** Phase 2 Store prep

---

## 1. Identity

| Field | Value |
|-------|-------|
| App name (display) | PTT Portal |
| Subtitle (Apple, ≤30 chars) | Duyệt campaign & creative |
| Short description (Play, ≤80 chars) | Duyệt creative, email và xem KPI campaign cho khách PTT. |
| Category (primary) | Business |
| Category (secondary) | Productivity |
| Content rating | 4+ / Everyone (business) — **Legal confirm** |
| Price | Free |

---

## 2. Description — Tiếng Việt (full)

**PTT Portal** là ứng dụng dành cho khách hàng doanh nghiệp của PTT Agency.

**Tính năng chính:**
- Xem dashboard hiệu suất campaign (Meta, Google, Zalo)
- Nhận thông báo khi có creative hoặc email cần duyệt
- Duyệt / từ chối creative và email campaign trên mobile
- Xem lịch sử thông báo và trạng thái phê duyệt

**Yêu cầu:** Tài khoản do Account Manager PTT cấp. Không dành cho đăng ký công khai.

**Hỗ trợ:** support@pttads.vn

---

## 3. Description — English (App Store)

**PTT Portal** is the official mobile app for PTT Agency enterprise clients.

**Features:**
- Campaign performance dashboards
- Push alerts for pending creative and email approvals
- Approve or reject assets on the go
- Notification history and audit trail

**Requires** credentials issued by your PTT account manager. Not for public self-signup.

**Support:** support@pttads.vn

---

## 4. Keywords (Apple, ≤100 chars total)

```
portal,approval,campaign,marketing,agency,PTT,creative,email,ads
```

---

## 5. URLs (store listing)

| Type | URL |
|------|-----|
| Privacy Policy | `https://portal.pttads.vn/privacy` |
| Support | `https://pttads.vn/support` |
| Marketing | `https://pttads.vn` |

---

## 6. Screenshots brief (AM + Design — Phase 2)

| # | Screen | Caption VI | Device |
|---|--------|------------|--------|
| 1 | Dashboard KPI | Xem hiệu suất campaign | iPhone 6.7" + Pixel |
| 2 | Creative inbox | Duyệt creative một chạm | |
| 3 | Push notification | Nhận alert cần duyệt | |
| 4 | Email approval | Phê duyệt email campaign | |
| 5 | Settings push | Quản lý thông báo | |

**Kích thước:** Apple 1290×2796 · Google phone + 7" tablet (check current store specs)

---

## 7. Review notes (Apple — WebView / Capacitor)

> **Full template (Phase 2.4):** [`m3-app-store-review-notes.md`](./m3-app-store-review-notes.md)

Key line for App Review: **WebView loads authenticated client portal; no arbitrary URL.**

```
PTT Portal is a B2B enterprise app for existing PTT Agency clients only.
Login requires credentials provisioned by PTT account managers.
The app uses a secure HTTPS WebView to portal.pttads.vn only — no arbitrary URL navigation.
Native push for approval workflows. No public registration.
Test account: [see m3-app-store-review-notes.md — fill in App Store Connect]
```

---

## 8. Data safety (Google Play)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Account |
| Device IDs (push token) | Yes | No (FCM/APNs only) | Notifications |
| App activity (approvals) | Yes | No | Core functionality |
| Location | No | No | — |

**Encryption in transit:** Yes  
**Deletion request:** support@pttads.vn

---

## 9. Localization

| Locale | Status |
|--------|--------|
| vi | Primary |
| en-US | Secondary (App Store export) |

---

## 10. Phase 0 checklist (metadata draft)

| # | Deliverable | Owner | OK |
|---|-------------|-------|-----|
| 1 | Description VI + EN approved | AM + Legal | ☐ |
| 2 | Keywords + categories | AM | ☐ |
| 3 | Privacy URL live | Legal + DevOps | ☐ |
| 4 | Support email active | AM | ☐ |
| 5 | Review notes + test account plan | AM + Tech | ☐ |
| 6 | Screenshot storyboard | AM | ☐ (Phase 2 asset) |

**AM sign-off:** ___________________ · **Date:** ___________  
**Legal sign-off:** ___________________ · **Date:** ___________

---

## 11. Test account (App Store Connect — không public)

| Field | Value |
|-------|-------|
| Email | `[pilot-approver@test client]` |
| Password | `[rotate before submit]` |
| Client | `[pilot client name]` |
| Notes | Creative pending seeded for demo |

*(Tech seed data trên staging trước submit review)*
