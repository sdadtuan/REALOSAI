# CRM OS BĐS — Kế hoạch coding (tận dụng code hiện có)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.  
> **W0 TDD:** [`2026-08-23-bds-w0-caps.md`](./2026-08-23-bds-w0-caps.md). **W1 TDD:** [`2026-08-23-bds-w1-fe.md`](./2026-08-23-bds-w1-fe.md). **W2 TDD:** [`2026-08-23-bds-w2-project-channel.md`](./2026-08-23-bds-w2-project-channel.md) (Task 8–11). **W3 TDD:** [`2026-08-23-bds-w3-commission-ui.md`](./2026-08-23-bds-w3-commission-ui.md). **W4 TDD:** [`2026-08-23-bds-w4-spine.md`](./2026-08-23-bds-w4-spine.md) (Task 13). **W5 TDD:** [`2026-08-23-bds-w5-cskh-360.md`](./2026-08-23-bds-w5-cskh-360.md) (Task 14–15). **W6 TDD:** [`2026-08-23-bds-w6-nav-hub.md`](./2026-08-23-bds-w6-nav-hub.md) (Task 16–17 + U-11). **W7 TDD:** [`2026-08-23-bds-w7-capi-finance.md`](./2026-08-23-bds-w7-capi-finance.md) (Task 18–19 + U4/U5).

**Goal:** 18 chức vụ chạy một chu trình căn trên **code pack + ops-web đã ship** — tinh chỉnh, nối, nâng. Không viết CRM / service / trang mới khi file đã có.

**Architecture:** `src/bds/` (~153 file) + 12 trang `/crm/bds/*` + `api.ts` (`bdsFetch`/`bdsMutate`) + hub/launch/aftersales sống + CSKH board + lead 360 + staff-org offboard + Meta CAPI. Mọi task = **GIỮ domain** → **NỐI** stub vào API → **NÂNG** hook/tab/cap. Cấm rewrite `BdsHoldService` / `BdsTxService` / `BdsCollectionService`.

**Tech Stack:** NestJS + Jest (`ptt-crm-api`); Next.js + Vitest (`ops-web`); PG `rnosaidb`.

**Nguồn sự thật:** spec chức vụ · UX 2026-08-23 (thắng) · UC 001–074 · Q1–Q48 không sửa.

## Global Constraints

- Tận dụng trước. File đã có → sửa. Chỉ CREATE khi không có chỗ gắn (vd. `agencies/[id]`, map cap).
- Mẫu FE bắt buộc: `aftersales/page.tsx` + `useBdsPageAuth` + `lib/bds/api.ts`.
- Ký HĐMB chỉ `bds_transactions.edit`. Hai hold = 409. `re_buyer` Deal Room 404.
- Không import `ReProjectsModule` vào `BdsModule`. Không HH B2B. Không payroll.
- Flag mặc định code `0`. Staging PACK/UI giữ `1`. CAPI Purchase = `net_price_vnd` lúc cọc.
- Test: `jest <file> --runInBand` · `vitest run <file>`. Không commit trừ khi user yêu cầu.

### Luật 3 việc (mọi task)

| Việc | Được | Cấm |
|------|------|-----|
| **Tinh chỉnh** | Copy, cap, tooltip, ẩn nút, form đủ field | Đổi schema hold/TX/receipt |
| **Nối** | Stub page gọi controller đã có; tab DA gọi Project OS | Fetch song song API mới cùng nghĩa |
| **Nâng** | Hook vào `offboardUser`, `BdsCapiHookService`, hub KPI, board `flow` | Module Nest mới, CRM song song |

---

## 0. Kiểm kê code — đừng viết lại

### API pack (GIỮ nguyên service)

| Đã có | Controller / service | Việc coding |
|-------|----------------------|-------------|
| Hold | `hold/bds-hold.controller.ts` create/approve/reject/cancel | Nối FE |
| TX + hdmb-gate | `transactions/bds-tx.controller.ts` | Nối FE; ẩn nút HĐMB theo cap |
| Lead buyer | `buyers/bds-buyer-lead.controller.ts` list/qualify/touch/visits | Nối `/crm/bds/leads` |
| Thu | `collection/bds-collection.controller.ts` receipts/aging/export | Nối collections |
| Policy | `policies/bds-policy.controller.ts` | Nâng trang mới **chỉ vì chưa có URL** |
| Project OS | `project-os/bds-project-os.controller.ts` | Nâng tab trên `re-projects/[id]` |
| Agency | `agencies/bds-agency.controller.ts` get/basket/contract | Nâng list → `[id]` |
| HH | `commission/bds-commission.controller.ts` | Nâng trang list đã fetch ledger |
| Hub | `reports/bds-hub.*` + `/crm/bds/page.tsx` | Nâng thêm 2 số vào **cùng** DTO |
| Launch | `launches/*` + `launches/page.tsx` war-room | GIỮ; nâng tooltip 069 |
| After | `aftersales/*` + `aftersales/page.tsx` **sống** | Nâng hook intake |
| Org seed | `org/bds-org-seed.ts` 12 ban / 18 chức vụ | Nâng INSERT cap |
| Cap catalog | `bds-cap-catalog.ts` | Nâng `rbac-admin-catalog.json` |
| CAPI stub | `commission/bds-capi-hook.service.ts` | Nâng: gọi **MetaCapiEventsService** sẵn |
| Ticket hook | `StaffTicketService` trong hold/tx/buyer | Nâng = spine v1 — **không** bus mới nếu ticket idempotent đủ U-12 |
| Offboard | `staff-org-users.repository.ts` `offboardUser` | Nâng: thêm bước hold |
| Flow lead | `lead-flow-kind.util.ts` + `lead-flow-list-filter.util.ts` | Nối `?flow=re_buyer` vào board |
| Deal Room | `shouldHideDealRoom` + `deal-room/page.tsx` | Nối banner `/crm/leads/[id]` |

### FE ops-web (NỐI / NÂNG, không xóa shell)

| File | Hiện | Việc |
|------|------|------|
| `lib/bds/api.ts` | tenant/hub/agency list/basket/HH list/after/launch | **Thêm hàm** cùng `bdsFetch`/`bdsMutate` |
| `lib/bds/use-bds-page-auth.ts` | auth + 404 | GIỮ |
| `lib/bds/nav.ts` | 12 link | Thêm policies (+ finance = cùng hub hoặc `/crm/bds` ô mới) |
| `holds/page.tsx` | stub + link Việc | Nối list/form như aftersales |
| `transactions/page.tsx` | stub | Nối wizard |
| `leads/page.tsx` | chữ placeholder | Nối GET `/leads` |
| `collections/page.tsx` | chữ placeholder | Nối aging/receipts |
| `agencies/page.tsx` | list mã/tên **đã fetch** | Link `[id]` + nâng |
| `tiers/page.tsx` | placeholder | Nối API tier |
| `commissions/page.tsx` | bảng ledger **đã fetch** | Nâng tab scheme/kỳ |
| `page.tsx` hub | 4 KPI **sống** | Nâng 2 ô |
| `launches/page.tsx` | war-room **sống** | Nâng checklist 069 |
| `aftersales/page.tsx` | **sống đủ** | GIỮ; API auto row |
| `re-projects/[id]/page.tsx` | tab RE cũ | **Thêm tab**, không thay KPI/budget |
| `cskh-board/CskhBoardContent.tsx` | board SPA | Nâng filter `flow` (util API đã có) |
| `leads/[id]/page.tsx` | 360 + Deal Room banner | Nối `shouldHideDealRoom` (hàm đã có) |

---

## 1. Sóng (không đổi thứ tự)

W0 cap → W1 nối 4 stub → W2 tab/giá/kênh → W3 nâng HH → W4 nâng hook ticket → W5 nối board/360 → W6 nâng nav+hub → W7 nâng CAPI+hub tài chính → W8 nâng offboard.

P0–P12b **không làm lại**.

---

## Phần A — W0–W1: tinh chỉnh cap + nối 4 stub

### Task 1–7

Làm đúng [`2026-08-23-bds-role-execution.md`](./2026-08-23-bds-role-execution.md).

- [ ] W0: **Nâng** `bds-org-seed.ts` (đã insert position) + catalog Admin. Không bảng quyền mới.
- [ ] Client: **Nâng** `api.ts` — thêm hold/tx/lead/collection. Không client thứ hai.
- [ ] Hold / TX / Lead / Thu: **Nối** 4 page stub. Copy layout aftersales. Không `app/crm/bds-v2/`.
- [ ] Gate W2: 201+409, F1 duyệt, phiếu, modal `%`. GĐKD không nút HĐMB.

---

## Phần B — W2: nâng trang DA / giá / kênh đã có API

### Task 8: Tab Project OS trên DA hiện có

**GIỮ:** `project-os/bds-project-os.controller.ts` (towers, legal-docs, phases, milestones, plan-revisions).  
**NÂNG:** `re-projects/[id]/page.tsx` — thêm `DetailTab`: `legal` \| `towers` \| `phases` \| `milestones` \| `plans`.  
**NÂNG:** form `re-projects/page.tsx` — field `one_price`, `hdmb_min_paid_pct` (API tạo DA đã nhận tenant).  
**NỐI:** `api.ts` + `bdsMutate` → đúng path controller.  
**CẤM:** trang `/crm/bds/projects` mới; xóa tab KPI/budget.

**Interfaces:** dùng đúng path hiện có: `GET/POST .../projects/:id/legal-docs`, `POST .../legal-gate`, `POST .../milestones/:id/reach`, `POST .../phases/:id/open`.

- [ ] **Step 1:** Test `postMilestoneReach` URL chứa `/milestones/m1/reach`
- [ ] **Step 2:** `vitest run src/lib/bds/project-os-api.spec.ts` FAIL
- [ ] **Step 3:** Tab + nút theo cap `bds_project_os.edit` / `bds_legal.approve`. 400 `legal_gate` / `required_roles` → tooltip UX §6 (API đã 400).
- [ ] **Step 4:** PASS. Tab cũ còn.
- [ ] **Step 5:** Commit khi user yêu cầu — `feat(bds): wire Project OS APIs into existing project tabs`

---

### Task 9: Policies — trang mỏng gọi API đã có

**GIỮ:** `BdsPolicyController` activate/quote/price-lists.  
**CREATE chỉ URL:** `app/crm/bds/policies/page.tsx` (chưa có file).  
**NÂNG:** `nav.ts` + `nav.spec.ts` + `rbac-routes.ts`.

- [ ] **Step 1:** nav.spec — `bds_policies.view` có `/crm/bds/policies`
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** List/soạn/quote. **Activate** chỉ `bds_policies.approve`. Không service mới.
- [ ] **Step 4:** PASS
- [ ] **Step 5:** `feat(bds): connect policy API to ops-web page`

---

### Task 10: Nâng list đại lý + tiers placeholder

**GIỮ:** `fetchBdsAgencies` + `agencies/page.tsx` bảng mã/tên.  
**NÂNG:** hàng → `Link` `/crm/bds/agencies/[id]`.  
**CREATE:** chỉ `[id]/page.tsx` (chưa có). Gọi `GET agencies/:id`, `POST .../contracts`, `.../basket/units`, `.../tier/override` **đã có**.  
**NỐI:** `tiers/page.tsx` placeholder → `POST /tiers/recalc` + list nếu API list tiers nằm trên agency (không invent endpoint).

- [ ] **Step 1:** Test `GET /api/v1/bds/agencies/${id}`
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** 085 trên API cũ. Cấp giỏ disabled khi 400 chưa HĐ.
- [ ] **Step 4:** PASS
- [ ] **Step 5:** `feat(bds): extend agency list with detail and basket actions`

---

### Task 11: Nối tồn kho RE → inventory pack

**GIỮ:** tab `products` / `inventory` trên `re-projects/[id]`; `BdsInventoryController` stack/import/lock.  
**NÂNG:** khi `isBdsUiFeEnabled()` tab gọi API BĐS thay (hoặc kèm) `fetchReProjectProducts`.  
**CẤM:** xóa dual-write / `re-projects` khi PACK=0.

- [ ] **Step 1:** Test path import pack
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** 409 `row_version` copy UX. Import hiện `errors[]` (util CSV đã có).
- [ ] **Step 4:** PASS
- [ ] **Step 5:** `feat(bds): point project inventory tabs at existing pack APIs`

---

## Phần C — W3: nâng trang HH đã có

### Task 12

**GIỮ:** `commissions/page.tsx` + `fetchBdsCommissions`.  
**NÂNG:** thêm tab Scheme / Kỳ / Tạm ứng — nút gọi `POST commission-schemes`, `.../activate`, `commission-statements/lock|approve|pay`, `commission-advances` **đã có trên controller**.  
**CẤM:** ledger mới.

- [ ] Test lock path hiện có → implement tab → PASS → `feat(bds): extend commission page with existing scheme endpoints`

---

## Phần D — W4: nâng hook ticket (spine v1)

### Task 13

**GIỮ:** `StaffTicketService` + hook trong `BdsHoldService` / TX / buyer (P12b).  
**NÂNG:** một helper `bds/spine/bds-existing-hook-replay.ts` (tên) bọc **đúng** `enqueue` ticket đã gọi — idempotency_key = entity+queue (ticket đã có unique open-by-entity).  
**CẤM:** bus Kafka, bảng `bds_spine_events` **trừ khi** test U-12 fail trên ticket (khi đó mới ADD cột/bảng — ghi rõ trong PR).

- [ ] **Step 1:** Test «hold create 2 lần không nhân ticket `hold_f1_approve` / first_touch» — kỳ vọng **đã pass** trên spec P12; nếu FAIL thì sửa hook hiện có.
- [ ] **Step 2–4:** Chỉ vá service hiện tại.
- [ ] **Step 5:** `fix(bds): harden existing ticket hooks for idempotent handoff`

Plan đầy đủ: [`2026-08-23-bds-w4-spine.md`](./2026-08-23-bds-w4-spine.md).

---

## Phần E — W5: nối board + 360 đã có

Chi tiết TDD: [2026-08-23-bds-w5-cskh-360.md](./2026-08-23-bds-w5-cskh-360.md).

### Task 14: Deal Room

**GIỮ:** `shouldHideDealRoom` (đã true với `re_buyer`) + `deal-room/page.tsx`.  
**NỐI:** `leads/[id]/page.tsx` banner Deal Room — bọc `shouldHideDealRoom` (hiện **chưa** dùng ở page 360).  
**CẤM:** helper hide thứ hai.

- [ ] Test hide đã xanh trong `deal-room-hide.spec.ts`
- [ ] Nâng page 360: `if (shouldHideDealRoom(...))` không render Link
- [ ] `fix(bds): use existing Deal Room hide on lead 360`

### Task 15: Board + after intake

**GIỮ:** `CskhBoardContent` + `fetchCskhBoard` + `lead-flow-list-filter.util.ts`.  
**NÂNG:** query `flow=re_buyer` → truyền filter đã có xuống API list lead (tìm chỗ `fetchCskhBoard` build query, thêm param — **không** board component mới).  
**GIỮ:** `BdsAftersalesService` list board.  
**NÂNG:** `BdsTxService` sau `contract` gọi method after **nếu chưa có** (đọc service — nếu đã hook thì chỉ test).

- [ ] Test filter SQL util đã có — FE gửi `flow`
- [ ] `feat(bds): filter CSKH board with existing re_buyer flow util`

---

## Phần F — W6: nâng nav + hub sống

### Task 16: Ẩn B2B

**GIỮ:** `buildBdsNavSections`, `OpsNav`.  
**NÂNG:** filter link `/crm/sales` khi `tenant.mode === 'developer'` + flag FE. Redirect page sales → `/crm/bds`.  
**CẤM:** nav tree mới.

- [ ] Test `shouldHideB2bNav('developer', true)`
- [ ] `feat(bds): hide B2B links on existing OpsNav for CĐT`

### Task 17: Hub +2 số

**GIỮ:** `HubKpi` + `bds-hub.repository.ts` + `page.tsx` 4 ô.  
**NÂNG:** thêm `cskh_breach_15m`, `receipts_today_count` vào **cùng type** (default 0). Click ô → URL board/collections **đã có**.  
**CẤM:** `/crm/bds/finance` nếu 4 số CFO = cùng hub (ưu tiên **một** `/crm/bds`). Trang finance chỉ tạo khi CFO không được cấp `bds_tenant.view`.

- [ ] Test hub JSON thêm 2 field
- [ ] `feat(bds): extend existing hub KPI with CSKH and receipt counts`

---

## Phần G — W7: nâng CAPI stub + số hub

### Task 18: Tài chính trên hub / collections

**Plan TDD:** [`2026-08-23-bds-w7-capi-finance.md`](./2026-08-23-bds-w7-capi-finance.md) Task 1 + 3.

**GIỮ:** `GET /hub` + `GET collections/aging` + HH list.  
**NÂNG:** hoặc 4 số trên hub (Task 17+), hoặc section trên `collections/page.tsx` sau khi đã nối W1.  
**CẤM:** `BdsFinanceHubController` trừ khi query không nhét được hub (khi đó thêm **một** method trong `bds-hub.service.ts` — cùng module reports).

- [ ] Test GMV = SUM contracted (query trong hub repo)
- [ ] `feat(bds): add CFO totals to existing hub or collections page`

### Task 19: CAPI HTTP

**Plan TDD:** [`2026-08-23-bds-w7-capi-finance.md`](./2026-08-23-bds-w7-capi-finance.md) Task 2.

**GIỮ:** `BdsCapiHookService.onPurchase` (đã `net_price_vnd` + `insertCapiEvent`).  
**GIỮ:** `MetaCapiEventsService` / `graph.facebook.com` trong `meta-tracking/`.  
**NÂNG:** `onPurchase` / ingest Lead / visit Schedule **gọi client Meta đã có**; flag `PTT_BDS_CAPI=0` giữ no HTTP (test hiện có).  
**CẤM:** `bds-capi-http.client.ts` copy Graph API.

- [ ] Test CAPI=0 không HTTP; value = `net_price_vnd`
- [ ] `feat(bds): send pack CAPI events through existing Meta tracking`

---

## Phần H — W8: nâng offboard hiện có

### Task 20

**GIỮ:** `offboardUser` (disable + reassign `crm_leads` + `auth_token_version`).  
**NÂNG:** sau COMMIT (hoặc cùng transaction): gọi `BdsHoldService.cancel` cho hold chưa cọc của `requested_by_staff_id`; **không** cancel nếu đã có TX deposit. Ticket → queue trưởng (StaffTicket đã có assign).  
**CẤM:** `POST /bds/staff/offboard` mới.

- [ ] Test: hold trống mở; hold + deposit giữ (dùng `BdsHoldService` + tx repo **thật**)
- [ ] `feat(bds): release undeposited holds inside existing staff offboard`

### Task 21

- [ ] `jest src/bds --runInBand` + `vitest run src/lib/bds`
- [ ] UAT 10 case `13-BDS-ROLE-JOURNEYS` §E trên staging
- [ ] Không payroll. Không claim module mới.

---

## 2. Cấm trong PR

- `app/crm/bds-v2`, `Bds2Module`, copy controller
- Xóa `re-projects/` 
- Đổi contract hold/TX/receipt
- Deal Room hide thứ hai
- Graph CAPI thứ hai
- Offboard endpoint thứ hai

---

## 3. Coverage

| Nhu cầu | Code tận dụng | Task |
|---------|---------------|------|
| Menu 18 chức vụ | seed + catalog | 1 |
| TVV/GĐKD/CL/CV HĐ | 4 stub + API pack | 2–7 |
| PM/PC tab | `re-projects/[id]` + Project OS | 8 |
| Giá | Policy controller | 9 |
| Kênh | agencies page + API | 10 |
| SP | tab inventory + pack | 11 |
| HH | commissions page | 12 |
| Handoff | ticket hook | 13 |
| 360 / board | hide + flow filter | 14–15 |
| Nav/hub | OpsNav + hub | 16–17 |
| CAPI / CFO | Meta + hub | 18–19 |
| Offboard | staff-org | 20 |

---

*Bắt đầu W0 trên seed/catalog. Mọi PR ghi: GIỮ / NỐI / NÂNG — không «thêm module».*
