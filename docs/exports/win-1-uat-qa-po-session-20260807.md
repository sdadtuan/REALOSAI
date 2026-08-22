# WIN-1 UAT Session — QA/PO (2026-08-07)

> **Môi trường:** https://rs.pttads.vn (staff console) · VPS commit `9db91e5`  
> **Automated report:** [`win-1-uat-results-20260807-043124.md`](./win-1-uat-results-20260807-043124.md)  
> **Checklist gốc:** [`docs/runbooks/win-1-uat-checklist.md`](../runbooks/win-1-uat-checklist.md)

---

## 1. Kết quả automated (PASS)

| Gate | Kết quả |
|------|---------|
| Ops smoke (login, health, PG 8 fn / 19 grants) | PASS |
| VUX-08 PWA (manifest, SW v3) | PASS |
| RBAC API (job-functions, org/users) | PASS |
| VUX-05 SoD API (`PUT` → 409 sod_violation) | PASS |
| Excel API (lead template, export, CSKH export) | PASS |
| Admin/CRM routes (307 unauth) | PASS |
| Public rs.pttads.vn (manifest, SW, routes) | PASS |

**SKIP:** ~~Staff JWT login~~ — đã sync password admin + personas (UAT 19/19 PASS).

**Test accounts (VUX-04):** mật khẩu = `ADMIN_PASSWORD` trong VPS `.env`

| Email | Function | Persona |
|-------|----------|---------|
| `admin@pttads.vn` | SUPER-ADMIN | Admin configure |
| `win1-content@pttads.vn` | `content` | P1 Content |
| `win1-design@pttads.vn` | `design` | P2 Design |

**Deploy commit:** `b832276`

---

## 2. Manual checklist — cần QA/PO thực hiện

### Chuẩn bị persona (VUX-04)

| Bước | Hành động |
|------|-----------|
| 1 | Tạo hoặc dùng **2 NV** (P1 content, P2 design) — hiện VPS chỉ có `admin@pttads.vn` |
| 2 | Admin → `/admin/crm/permissions/users` → gán `content` cho P1, `design` cho P2 |
| 3 | Mỗi NV **đăng xuất / đăng nhập lại** |
| 4 | Kiểm tra badge header + menu khác nhau |

### VUX-02 — Mobile leads (390px)

- [ ] DevTools viewport **390px** → `/crm/leads`
- [ ] Card `.win-leads-mobile-list`, nút **Gọi** / **Chi tiết**
- [ ] Filter chips hiển thị và xóa được

### VUX-04 — Menu theo function

- [ ] P1 thấy menu SEO/email write
- [ ] P2 không thấy menu chỉ dành content
- [ ] Badge `position · functions` đúng

### VUX-05 — SoD UI

- [ ] `/admin/crm/permissions/functions` — SoD-01 → **Lưu disabled**
- [ ] `/admin/crm/permissions/users` — content + compliance → banner SoD-02, **Lưu disabled**
- [x] API PUT → 409 (đã verify automated)

### Excel wizards (UI)

- [ ] Leads: Mẫu → upload → import → export filter
- [ ] Roster: `/crm/staff?tab=import` wizard CSV/Excel

### RBAC admin live

- [ ] Ma trận chức vụ + diff chip + relogin toast
- [ ] 8 job functions + tag Add-on
- [ ] User assign + effective caps preview
- [ ] CSKH board Export Excel (UI)

### Sign-off

- [ ] PO + QA ký [`win-1-acceptance-checklist.md`](../specs/win-1-acceptance-checklist.md)
- [ ] PDF (optional): `docs/exports/signed/WIN-1-acceptance-YYYY-MM-DD.pdf`

---

## 3. Blockers / follow-up kỹ thuật

| # | Issue | Khuyến nghị |
|---|-------|-------------|
| 1 | ~~Staff login UAT~~ | ✅ Sync qua `seed_win1_uat_personas.sh` |
| 2 | StaffUser internal-key fix | ✅ Commit `6d772f3` |
| 3 | Playwright trên VPS | `npx playwright install` trước E2E |
| 4 | WIN-1 chưa đóng | Manual VUX-02/04/05 UI + PO sign-off |

---

## 4. Lệnh tái chạy

```bash
# Trên VPS — tạo lại personas
cd /var/www/rnosai && bash scripts/seed_win1_uat_personas.sh --apply

# UAT automated
bash scripts/run_win1_uat.sh
```

---

**Automated gates: PASS** · **WIN-1 exit: chờ manual QA/PO + sign-off**
