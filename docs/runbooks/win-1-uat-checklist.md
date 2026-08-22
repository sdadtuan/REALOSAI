# WIN-1 — UAT checklist (Lane A closure)

> **Môi trường:** https://ops.pttads.vn (prod/staging)  
> **Commit tối thiểu:** `ce1d159` + Lane A (`staff/org` user assign)  
> **Người thực hiện:** QA + PO + HR Ops (2 persona)

---

## 1. Persona & tài khoản

| Persona | Position gợi ý | Job functions (test) | Mục đích |
|---------|------------------|--------------------|----------|
| **P1 Content** | MKT-02 | `content` | `win1-content@pttads.vn` |
| **P2 Design** | MKT-02 | `design` | `win1-design@pttads.vn` |
| **P3 Admin** | SUPER / IT | `crm_data_config.configure` | Ma trận + gán function |

**Chuẩn bị:** Admin gán function tại `/admin/crm/permissions/users` → NV **đăng xuất / đăng nhập lại**.

---

## 2. VUX gates (WIN-1 exit §5.4)

### VUX-02 — Mobile lead list (390px)

- [ ] Mở `/crm/leads` trên viewport 390px (DevTools)
- [ ] Thấy `.win-leads-mobile-list` card, không scroll ngang body
- [ ] Nút **Gọi** + **Chi tiết** hoạt động
- [ ] Filter chips hiển thị và xóa được

### VUX-04 — content vs design menu

- [ ] P1 thấy menu SEO write / email write (theo caps)
- [ ] P2 **không** thấy menu chỉ dành content (hoặc khác P1)
- [ ] Header badge: `position · functions` khớp gán

### VUX-05 — SoD banner blocks save

- [ ] `/admin/crm/permissions/functions` — tick SoD-01 (content write + approve) → nút Lưu disabled
- [ ] `/admin/crm/permissions/users` — chọn `content` + `compliance` → banner SoD-02, Lưu disabled
- [ ] API PUT trả `409 sod_violation` (Network tab)

### VUX-08 — PWA install

- [ ] Lighthouse PWA: installable
- [ ] Manifest name **PTT Revenue OS**
- [ ] Offline banner `.win-offline-banner` khi thử offline (optional)

### VUX-01 — HR hub (nếu bật)

- [ ] `/crm/hr` render workspace theo cap (không 403 nếu có quyền HR)

---

## 3. Excel round-trip

### Leads

- [ ] **Mẫu Excel** tải được
- [ ] **Import wizard** → template → upload → import → kết quả
- [ ] **Export Excel (filter)** tải file, mở được Excel

### Roster

- [ ] `/crm/staff?tab=import` → **Import wizard (CSV/Excel)**
- [ ] Template CSV tải được, import ít nhất 1 dòng test (staging)

---

## 4. RBAC admin live

- [ ] `/admin/crm/permissions` — ma trận chức vụ, diff chip, relogin toast sau Lưu
- [ ] `/admin/crm/permissions/functions` — 8 functions, tag Add-on
- [ ] `/admin/crm/permissions/users` — gán function, effective caps preview
- [ ] CSKH board — Export Excel

---

## 5. Ký acceptance

- [ ] PO + QA ký PDF: [`docs/exports/signed/WIN-1-acceptance-2026-08-07.pdf`](../exports/signed/WIN-1-acceptance-2026-08-07.pdf)

---

## 6. Lệnh smoke nhanh (ops)

```bash
curl -sf https://ops.pttads.vn/login -o /dev/null && echo ops_ok
curl -sf http://127.0.0.1:3000/health   # trên VPS
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM staff_job_functions;"
```

---

*Cập nhật: 2026-08-07 — Lane A WIN-1 closure.*
