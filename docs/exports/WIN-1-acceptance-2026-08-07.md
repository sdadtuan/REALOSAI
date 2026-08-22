# WIN-1 Acceptance — Competitive Win Wave 1

**Document ID:** WIN-1-ACCEPT-20260807  
**Phiên bản:** 1.0 (hướng B strict VUX-04)  
**Ngày phát hành:** 2026-08-07  
**Môi trường UAT:** https://rs.pttads.vn  
**Deploy VPS:** `eac00e0` (matrix + FE gating) · docs `dd3b171`

---

## 1. Phạm vi chấp nhận

| Hạng mục | Mô tả |
|----------|--------|
| WIN-1-A | PWA / mobile leads (VUX-02, VUX-08) |
| WIN-1-B | Filter chips, CSKH export Excel |
| WIN-1-C | Excel import/export wizard + R1.5 RBAC UI |
| Lane A | Gán job function trên user (`/admin/crm/permissions/users`) |

**Tham chiếu:** `docs/specs/2026-08-07-rnosai-competitive-win-implementation-plan.md` §5.4

---

## 2. Tóm tắt kết quả QA (đề xuất Pass)

| Khu vực | QA | Ghi chú |
|---------|-----|---------|
| Design tokens + WIN components | **Pass** | `components/win/*` |
| PWA + mobile leads | **Pass** | VUX-02 Playwright; VUX-08 automated |
| Excel import/export wizards | **Pass** | API template/export PASS; UI PO spot-check khuyến nghị |
| RBAC matrix chức vụ + function | **Pass** | 8 functions, admin routes live |
| User job function assign (R1.5-S3) | **Pass** | `/permissions/users` + effective caps |
| Persona menu isolation (VUX-04) | **Pass** | Hướng B: MKT-02 trim + content/design caps |
| SoD client + API (VUX-05) | **Pass** | UI disabled + API 409 |

**Automated UAT (VPS):** 19/19 PASS (`scripts/run_win1_uat.sh`)  
**Playwright VUX-02/04/05:** 3/3 PASS (`e2e/win-1-manual-uat-vux.spec.ts`)

---

## 3. VUX gates — bằng chứng

| Gate | Kết quả | Bằng chứng |
|------|---------|------------|
| VUX-02 Mobile 390px | PASS | `.win-leads-mobile-list`, không scroll ngang |
| VUX-04 Badge | PASS | `MKT-02 · content` vs `MKT-02 · design` |
| VUX-04 Menu khác biệt | PASS | Content: SEO Content, Segments, Templates, Campaigns, Reports · Design: Meta Ads |
| VUX-05 SoD UI | PASS | Lưu disabled (functions + users) |
| VUX-05 SoD API | PASS | PUT → 409 `sod_violation` |
| VUX-08 PWA | PASS | Manifest **PTT Revenue OS**, SW v3 |

**Quyết định PO (VUX-04):** Hướng B — sidebar phải khác; trim MKT-02 base + caps qua job function.

---

## 4. Tài khoản UAT (không in mật khẩu)

| Persona | Email | Position | Job function |
|---------|-------|----------|--------------|
| Admin | admin@pttads.vn | SUPER-ADMIN | — |
| P1 Content | win1-content@pttads.vn | MKT-02 | content |
| P2 Design | win1-design@pttads.vn | MKT-02 | design |

Mật khẩu: `ADMIN_PASSWORD` trên VPS `.env` (quản lý bởi IT).

---

## 5. Quyết định chấp nhận (PO ký)

| Vai trò | Họ tên | Ngày | Chữ ký |
|---------|--------|------|--------|
| Product Owner | | | |
| QA Lead | | | |
| HR Ops | | | |
| Tech Lead | | | |

**Quyết định:**

- [ ] Chấp nhận — mở WIN-2 kickoff  
- [ ] Chấp nhận có điều kiện  
- [ ] Từ chối  

**Điều kiện / follow-up (nếu có):**

1. _______________________________________________
2. _______________________________________________

---

## 6. Liên kết bằng chứng

- UAT runbook: `docs/runbooks/win-1-uat-checklist.md`
- Manual VUX report: `docs/exports/win-1-manual-uat-vux-20260807.md`
- Automated results: `docs/exports/win-1-uat-results-20260807-043124.md`
- Checklist template: `docs/specs/win-1-acceptance-checklist.md`

---

*Bản PDF ký lưu tại `docs/exports/signed/WIN-1-acceptance-2026-08-07.pdf`*
