# WIN-1 Manual UAT — VUX-02/04/05 (2026-08-07)

> **Môi trường:** https://rs.pttads.vn  
> **Commit:** `eac00e0` (hướng B strict VUX-04) + `b2d58ae` (Playwright sidebar selector)  
> **Thực hiện:** Playwright headless + API verify  
> **Thời gian:** ~45 ph QA scope

---

## Tài khoản test

| Persona | Email | Job function | Mật khẩu |
|---------|-------|--------------|----------|
| Admin | `admin@pttads.vn` | SUPER-ADMIN | `ADMIN_PASSWORD` (VPS `.env`) |
| P1 Content | `win1-content@pttads.vn` | `content` · MKT-02 | cùng password |
| P2 Design | `win1-design@pttads.vn` | `design` · MKT-02 | cùng password |

---

## Hướng B (PO) — menu sidebar phải khác

| Thay đổi | Chi tiết |
|----------|----------|
| MKT-02 base | Bỏ SEO write + email write khỏi position; giữ `crm_email_mkt.view` |
| Job function `content` | `crm_seo_aeo*`, `crm_email_mkt` write/reports |
| Job function `design` | `crm_facebook_ads` view+edit, `meta_campaign_write.view` |
| FE gating | `canViewSeoContent` → `canWriteSeo`; Meta Ads nav khi `view` **hoặc** `edit` |
| PG sync | `migrate_staff_permissions_pg.py --position MKT-02 --sync --apply` |

**Menu diff (sidebar mở rộng):**

| Chỉ content | Chỉ design |
|-------------|------------|
| SEO Content, Segments, Templates, Campaigns, Reports | Meta Ads (+ Meta Migration) |

---

## Kết quả

| Gate | Kết quả | Ghi chú |
|------|---------|---------|
| **VUX-02** Mobile leads 390px | **PASS** | `.win-leads-mobile-list` visible; no body horizontal scroll |
| **VUX-04** Badge content vs design | **PASS** | Badge `MKT-02 · content` vs `MKT-02 · design` |
| **VUX-04** Menu sidebar khác nhau | **PASS** | Sau hướng B: content có SEO/email write links; design có Meta Ads |
| **VUX-05** SoD UI users (content+compliance) | **PASS** | Banner SoD-02 + nút **Lưu job functions** disabled |
| **VUX-05** SoD UI functions (write+approve) | **PASS** | Nút **Lưu ma trận function** disabled khi SoD-01 |
| **VUX-05** SoD API 409 | **PASS** | (automated trước đó) |

**Playwright:** `e2e/win-1-manual-uat-vux.spec.ts` — **3/3 passed** (~9s, 2026-08-07 re-run)

---

## Bug đã sửa trong phiên UAT

| Bug | Triệu chứng | Fix |
|-----|-------------|-----|
| Login thiếu caps trong session | Mọi NV → **403** trên `/crm/leads` ngay sau login | `login/page.tsx` gọi `staffMe()` + `updateStoredUser()` (`933a670`) |
| MKT-02 matrix quá rộng | Content/design sidebar giống nhau | Hướng B: trim MKT-02 + job function grants + FE gating (`eac00e0`) |
| Playwright đọc sai DOM | VUX-04 fail dù caps đúng | So sánh `.ops-nav-link--button` sau **Mở rộng menu** (`b2d58ae`) |

---

## Follow-up PO / Product

1. **PO sign-off:** cập nhật [`win-1-acceptance-checklist.md`](../specs/win-1-acceptance-checklist.md).
2. **Screenshot archive (optional):** `docs/exports/win-ux-screenshots/WIN-1/`.

---

## Tái chạy QA (~5 ph)

```bash
cd services/ops-web
export OPS_E2E_SKIP_SERVER=1
export OPS_E2E_URL=https://rs.pttads.vn
export OPS_E2E_STAFF_PASSWORD='…'   # ADMIN_PASSWORD từ VPS .env
npx playwright test e2e/win-1-manual-uat-vux.spec.ts
```

---

## Manual checklist (PO tick)

- [x] VUX-02 mobile 390px — card, Gọi/Chi tiết, filter chips
- [x] VUX-04 badge `position · functions`
- [x] VUX-04 menu SEO/email vs Meta Ads **khác biệt rõ** (hướng B)
- [x] VUX-05 SoD UI (functions + users)
- [x] VUX-05 API 409
- [ ] PO ký acceptance PDF → [`docs/exports/signed/WIN-1-acceptance-2026-08-07.pdf`](./signed/WIN-1-acceptance-2026-08-07.pdf)

**Trạng thái WIN-1:** Automated + UI gates **PASS** — chờ PO sign-off.
