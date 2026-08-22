# App Store Review Notes — PTT Portal (RNOS-M3 Phase 2)

> **Paste vào App Store Connect → App Review Information → Notes**  
> **App:** PTT Portal · **Bundle:** `vn.pttads.portal` · **Type:** B2B enterprise client portal

---

## English (primary — App Review)

```
PTT Portal is a B2B enterprise app for existing PTT Agency advertising clients only.

AUTHENTICATION & ACCESS
- Users cannot self-register. Accounts are provisioned by PTT account managers.
- Login requires email + password issued by PTT for a specific client organization.
- There is no public signup, guest mode, or browse-without-login.

WEBVIEW BEHAVIOR (IMPORTANT)
- The app uses a secure Capacitor WebView that loads ONLY our fixed production URL:
  https://portal.pttads.vn
- The WebView does NOT allow arbitrary URL navigation or user-entered URLs.
- All content is our authenticated client portal (campaign KPIs, creative approval, email approval).
- This is equivalent to “Add to Home Screen” PWA, packaged for App Store distribution and native push.

TEST ACCOUNT (Internal Testing / Review)
Email:    [REVIEWER_EMAIL@client.test]
Password: [REVIEWER_PASSWORD — rotate after review]
Client:   [Pilot client name]
Notes:    Seeded pending creative available for approval demo.

NATIVE FEATURES
- Push notifications for pending creative/email approvals (optional in Settings).
- Deep link: pttads://approve/{id} opens the approval screen inside the portal.

CONTACT
support@pttads.vn
privacy@pttads.vn
```

---

## Tiếng Việt (internal AM reference)

```
PTT Portal là app B2B cho khách hàng doanh nghiệp hiện hữu của PTT Agency.

- Không có đăng ký công khai; AM cấp tài khoản.
- WebView chỉ tải https://portal.pttads.vn — không duyệt web tùy ý.
- Nội dung: dashboard KPI, duyệt creative, duyệt email campaign.
- Push native + deep link pttads://approve/{id} (tùy chọn trong Settings).
```

---

## Apple Guideline mapping

| Concern | Response |
|---------|----------|
| 4.2 Minimum functionality | Full approval workflows + push; not a thin website wrapper for general browsing |
| 5.1.1 Data collection | Privacy policy: https://portal.pttads.vn/privacy |
| Login required | Yes — B2B only; test account provided |
| Arbitrary URL loading | **No** — single allowed origin `portal.pttads.vn` via Capacitor server.url |

---

## Google Play (Release notes / App content)

Use the same English paragraph under **App access** → “All functionality requires login” and provide test credentials.

---

## Checklist before submit

| # | Item | OK |
|---|------|-----|
| 1 | Test account works on TestFlight build | ☐ |
| 2 | Reviewer can login → see dashboard | ☐ |
| 3 | Pending creative visible on `/creatives` | ☐ |
| 4 | Privacy URL live HTTPS | ☐ |
| 5 | Notes pasted in App Store Connect | ☐ |
| 6 | Demo video optional (30s approve flow) | ☐ |

**Legal/AM sign-off:** _______________ · **Date:** ___________
