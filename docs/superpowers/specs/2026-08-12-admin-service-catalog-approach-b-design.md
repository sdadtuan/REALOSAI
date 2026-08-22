# Admin Service Catalog — Approach B Design

> **Document ID:** ADMIN-SVC-CAT-B-20260812  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-12  
> **Trạng thái:** Design — chờ PO / IT sign-off  
> **Quyết định:** **Hướng B** — giữ 2 catalog vận hành, mở rộng tab Admin trên catalog hiện có (không tạo workspace `/admin/services` riêng)  
> **Governance:** IT Admin toàn quyền cấu hình; PO/Ops xem + gửi yêu cầu thay đổi  
> **Parent:** [`2026-08-11-admin-control-plane-ia.md`](../../specs/2026-08-11-admin-control-plane-ia.md) · [`2026-08-10-ptt-ops-rnosai-integration-spec.md`](../../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md) §INT-M1-01

---

## 1. Executive summary

RNOSAI có **hai catalog** tách biệt (CRM slug vs Ops DV21). Thay vì gom workspace mới trong Control Plane (Hướng A), **Hướng B** mở rộng trang **`/crm/catalog`** thành **Catalog Admin 2 tab**, giữ **`/crm/ops/catalog`** read-only cho AM tra cứu nhanh, và thêm **entry point** từ Admin → Dữ liệu CRM.

**IT Admin** sửa profile vận hành (giá, weekly template, KPI, readiness overlay). **PO/Ops** chỉ xem + tạo **change request** (không publish trực tiếp).

**Pitch:**

> *Không đập lại IA — nâng cấp catalog CRM thành nơi IT quản lý dịch vụ end-to-end; AM vẫn có bảng tra DV21 riêng khi làm việc.*

---

## 2. Phạm vi & ngoài phạm vi

### In scope (P0 → P1)

| ID | Hạng mục |
|----|----------|
| B-01 | Tab **CRM Lead** + tab **DV vận hành (21)** trên `/crm/catalog` |
| B-02 | Link Admin Control Plane → `/admin/crm/catalog` (redirect hoặc alias) |
| B-03 | `GET/PUT /api/ops/catalog/:dvCode` — profile overlay (PG) |
| B-04 | Cap `ops_catalog.view` / `ops_catalog.configure` (IT) |
| B-05 | PO change request: `POST /api/ops/catalog/change-requests` + inbox IT |
| B-06 | Audit log mỗi PUT profile |
| B-07 | `/crm/ops/catalog` **giữ nguyên** read-only |

### Out of scope (Phase 2+)

- Workspace `/admin/services/*` (Hướng A)
- Sửa structural route map qua UI (slug primary, nest_api routes) — vẫn git/JSON
- Draft → publish workflow đa bước (chỉ request queue P1)
- Impact preview lifecycle (Phase 2)

---

## 3. Information Architecture (Hướng B)

### 3.1. Ba điểm vào — một SSoT backend

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Control Plane (/admin)                               │
│  Dữ liệu CRM → "Catalog dịch vụ" → /admin/crm/catalog       │
└───────────────────────────┬─────────────────────────────────┘
                            │ same page shell
┌───────────────────────────▼─────────────────────────────────┐
│  /crm/catalog  (Catalog Admin — 2 tabs)                       │
│  ┌─────────────────┬──────────────────────────────────────┐  │
│  │ Tab CRM Lead    │ Tab DV vận hành (21)                 │  │
│  │ slug, ngành,    │ list DV + detail drawer/editor       │  │
│  │ AM scope        │ pricing, weekly, KPI, readiness      │  │
│  └─────────────────┴──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  /crm/ops/catalog  (Ops reference — READ ONLY)              │
│  AM/SP tra cứu combo, giá, link báo giá                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2. Tab CRM Lead (migrate UX hiện tại)

- Nội dung hiện tại của `/crm/catalog`: services, industries, assign scopes
- **Refactor UX:** thay `window.prompt()` bằng modal/form trong `AdminPageShell` pattern
- Cap: `crm_leads.view` / `crm_leads.configure` (giữ)

### 3.3. Tab DV vận hành (21)

- Bảng 21 DV: code, tên, department, readiness, pilot badges
- Click row → **detail panel** (drawer hoặc `/crm/catalog/dv/[code]`)
- Tabs detail:
  - **Tổng quan** — route map fields (read-only): slugs, depends_on, gaps
  - **Giá gói** — editable nếu `ops_catalog.configure`
  - **Weekly template** — editable JSON/editor
  - **KPI defs** — editable
  - **Pilot** — read-only flags từ env + route map; IT sửa qua `/admin/environments` hoặc runtime.env (P1 không UI pilot)

### 3.4. Ops catalog AM (không đổi)

- `OpsCatalogPanel` @ `/crm/ops/catalog` — search, combo, quote link
- Banner: *"Chỉnh sửa catalog → IT Admin · Catalog dịch vụ"*

---

## 4. Data model & storage

### 4.1. Layers (unchanged principle)

| Layer | Store | Admin B sửa được? |
|-------|-------|-------------------|
| Structure | `ops-dv01-dv21-route-map.json` | ❌ Git only |
| Runtime profile | `ops_service_profile` (PG) | ✅ IT via PUT |
| CRM slugs | `crm_catalog_services` | ✅ Tab CRM Lead |
| Pilot flags | `deploy/runtime.env` | ❌ IT env (không UI P1) |

### 4.2. PUT payload scope

```typescript
interface OpsCatalogProfilePatch {
  readiness_override?: 'ready' | 'partial' | 'gap' | null;
  tier_pricing?: TierPricingJson;
  weekly_process_template?: WeeklyTemplateJson;
  kpi_definitions?: KpiDefJson[];
  notes_vi?: string;
}
```

Merge rule: PG overlay wins over JSON defaults; null `readiness_override` → dùng route map `readiness`.

### 4.3. Change requests (PO → IT)

Table mới `ops_catalog_change_request`:

| Column | Mô tả |
|--------|-------|
| id | PK |
| dv_code | DV02… |
| requested_by | staff email |
| field | `tier_pricing` \| `weekly_process_template` \| … |
| payload_json | proposed value |
| reason_vi | PO mô tả |
| status | `pending` \| `approved` \| `rejected` |
| resolved_by, resolved_at | IT |

IT approve → auto `PUT` profile + audit.

---

## 5. API

### 5.1. Existing (keep)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/ops/catalog` | List 21 |
| GET | `/api/ops/catalog/:dvCode` | Detail |
| GET/POST/PATCH | `/api/crm/catalog/*` | CRM tab |

### 5.2. New (P1)

| Method | Path | Cap | Mô tả |
|--------|------|-----|-------|
| PUT | `/api/ops/catalog/:dvCode/profile` | `ops_catalog.configure` | Upsert PG overlay |
| GET | `/api/ops/catalog/:dvCode/dependencies` | `ops_catalog.view` | Combo graph |
| POST | `/api/ops/catalog/change-requests` | `ops_catalog.view` | PO submit |
| GET | `/api/ops/catalog/change-requests` | `ops_catalog.configure` | IT inbox |
| PATCH | `/api/ops/catalog/change-requests/:id` | `ops_catalog.configure` | Approve/reject |

### 5.3. Guards

- `StaffOpsCatalogViewGuard` — `ops_catalog.view` OR `crm_board.view` (AM read tab DV)
- `StaffOpsCatalogConfigureGuard` — `ops_catalog.configure` only (IT)

Seed caps trong permission matrix: gán `ops_catalog.configure` cho IT Admin position; PO có `ops_catalog.view`.

---

## 6. RBAC matrix

| Persona | CRM tab | DV tab | PUT profile | Change request |
|---------|---------|--------|-------------|----------------|
| IT Admin | configure | view + edit | ✅ | approve |
| PO / Ops lead | view | view | ❌ | ✅ submit |
| AM / SP | view | view | ❌ | ❌ |
| Sales config | configure CRM only | view | ❌ | ❌ |

Fail-closed: không cap → tab ẩn hoặc read-only banner.

---

## 7. Frontend components

| File | Mô tả |
|------|-------|
| `app/crm/catalog/page.tsx` | Tab shell CRM \| DV |
| `app/admin/crm/catalog/page.tsx` | Re-export hoặc redirect → `/crm/catalog?admin=1` |
| `components/catalog/CrmCatalogLeadTab.tsx` | Extract từ page hiện tại + form upgrade |
| `components/catalog/OpsDvCatalogAdminTab.tsx` | List 21 + detail |
| `components/catalog/OpsDvProfileEditor.tsx` | Pricing / weekly / KPI editors |
| `components/catalog/OpsCatalogChangeRequestForm.tsx` | PO request |
| `components/catalog/OpsCatalogChangeRequestInbox.tsx` | IT inbox (link từ Admin Data) |
| `lib/admin/admin-nav.ts` | Thêm link "Catalog dịch vụ" trong group **Dữ liệu CRM** |

Reuse read-only: `OpsCatalogPanel` logic cho cột/badges (shared util).

---

## 8. UX patterns

- Shell: `AdminPageShell` khi `?admin=1` hoặc route `/admin/crm/catalog`
- IT edit: inline save + toast; destructive fields confirm
- PO: nút **"Yêu cầu thay đổi"** mở form; không thấy Save trực tiếp
- Readiness badge colors đồng bộ `OpsCatalogPanel`
- Acceptance INT-M1-01: sửa profile **không mutate** lifecycle đã tạo — chỉ ảnh hưởng spawn/KPI tương lai

---

## 9. Implementation phases

### P0 — IA bridge (≈3–5 ngày)

- [ ] Tab shell `/crm/catalog`
- [ ] `/admin/crm/catalog` entry + admin-nav link
- [ ] Refactor CRM tab forms (no prompt)
- [ ] DV tab read-only (reuse GET catalog)

### P1 — IT configure + requests (≈1–2 tuần)

- [ ] `PUT /api/ops/catalog/:dvCode/profile`
- [ ] PG upsert + audit
- [ ] Profile editors (IT)
- [ ] Change request table + API + inbox UI
- [ ] Caps seed + guards
- [ ] E2E: IT edit pricing; PO request; IT approve

### P2 — Polish (optional)

- [ ] Dependencies visual on DV detail
- [ ] Export profile JSON
- [ ] Diff vs route map defaults

---

## 10. Testing & acceptance

| Case | Expected |
|------|----------|
| AM mở `/crm/ops/catalog` | Read-only, 21 rows |
| PO mở tab DV | View, request button, no Save |
| IT PUT pricing DV04 | PG updated, audit row, AM thấy giá mới trên ops catalog |
| PO request → IT reject | Status rejected, PG unchanged |
| Sửa profile | Lifecycle cũ không đổi `dv_code`/tier đã gán |
| No cap | Tab DV hidden or 403 |

Smoke extension: `scripts/smoke_ops_catalog_admin.sh` — GET catalog, PUT dry-run với internal key (staging).

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Vẫn 2 URL catalog gây confusion | Banner chéo + Admin entry duy nhất cho IT |
| JSON vs PG drift | Overview tab show "source: route map" vs "override: PG" |
| PO bypass edit | Backend enforce cap; UI hide Save |
| Breaking AM workflow | Không đổi `/crm/ops/catalog` |

---

## 12. Sign-off

| Role | Decision | Date |
|------|----------|------|
| PO | Hướng B approved | 2026-08-12 |
| IT Admin | Caps + audit OK | |
| Engineering | Estimate P0+P1 | |

---

## 13. Next step

Sau sign-off spec → invoke **writing-plans** skill → `docs/superpowers/plans/2026-08-12-admin-service-catalog-approach-b-plan.md`
