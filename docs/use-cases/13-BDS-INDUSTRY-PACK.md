# Use Case — Industry Pack BĐS (CĐT + Sàn)

> **Prefix:** BDS · **Phiên bản:** 1.0 · **Ngày:** 2026-08-22  
> **Design spec:** [`superpowers/specs/2026-08-21-bds-industry-pack-design.md`](../superpowers/specs/2026-08-21-bds-industry-pack-design.md)  
> **UX/UI:** [`superpowers/specs/2026-08-22-bds-ux-ui-design.md`](../superpowers/specs/2026-08-22-bds-ux-ui-design.md)  
> **Actions:** [`actions/13-BDS-ACTIONS.md`](actions/13-BDS-ACTIONS.md)  
> **Quyết định:** Q1–Q29 · Flag `PTT_BDS_PACK` (và CHAT / TICKETS khi liên quan)

Không trộn với CRM-UC-010 (RE Projects cũ, flag OFF) hay B2B project OS.

**Bổ sung 2026-08-23:** UC OS + phòng + chức vụ → [`13-BDS-ROLE-JOURNEYS.md`](13-BDS-ROLE-JOURNEYS.md). **Ký HĐMB** = `truong_pc` / `cv_hd` (`bds_transactions.edit`), không GĐKD — khớp UX complete.

---

## Ma trận traceability

| Nhóm | UC | Pha | Màn chính |
|------|-----|-----|-----------|
| Hub / điều hành | 001–003 | P8 | `/crm/bds` |
| Dự án + pháp lý + đợt | 004–009 | P1b, P3 | `/crm/re-projects/:id` |
| Tồn kho + hold | 010–016 | P1, P2 | units, stack, holds |
| Hành trình TX | 017–024 | P4, P4b | transactions |
| Đại lý + một giá | 025–030 | P5 | agencies, basket |
| Lead khách mua | 031–035 | P6 | leads |
| Collection + HH | 036–039, 048–049 | P4b, P7 | collections, commissions |
| After-sales | 041–043 | P9 | aftersales |
| Ra quân | 045–047 | P10 | launches |
| Chat | 051–054 | P11 | `/crm/chat` |
| Ticket việc | 055–059 | P12 | `/crm/work` |
| Sàn / PWA | 060–062 | P8 | basket, PWA |

**API CĐT:** `/api/v1/bds` · **Chat:** `/api/v1/staff-chat` · **Ticket:** `/api/v1/staff-tickets`

---

## Business rules (module) — tham chiếu

BR-BDS-01…46 trong design spec §13. UC dưới đây chỉ nhắc mã khi là cổng.

---

## BDS-UC-001 — Đọc hub điều hành CĐT

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TGĐ, GĐKD, PM |
| **Priority** | P0 |
| **Trigger** | Vào `/crm/bds` sau login tenant developer/hybrid |

**Preconditions:** `PTT_BDS_PACK=1`, cap `bds_*` view, tenant active.

**Main flow:**

1. Hệ thống load KPI đợt / GMV HĐMB / overdue / hold TTL.
2. Hàng việc: hold F1 pending, ticket P0, HĐMB kẹt cổng, launch open.
3. User bấm một hàng → đúng inbox (holds / work / transactions / launches).

**Extensions:**

- **E1 — Tenant broker:** redirect `/crm/bds/basket` (không hub CĐT).
- **E2 — Flag OFF:** nav BĐS pack không hiện; `/crm/re-projects` cũ.

**Postconditions:** Không đổi dữ liệu.

**Traceability:** SCR-BDS-001 · `GET /tenants/me` · hub report

---

## BDS-UC-002 — Chuông SLA / TTL

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Mọi staff CĐT |
| **Priority** | P0 |
| **Trigger** | Hold sắp hết, ticket `sla_breached`, mention chat |

**Main flow:** 1. Badge top bar. 2. Mở list. 3. Click → drawer/màn nguồn.

**Extensions:** E1 — Sàn không thấy chuông ticket/room CĐT.

**Traceability:** Shell · SSE chat · job SLA

---

## BDS-UC-003 — Ẩn Deal Room trên khách mua

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Mọi user có cap BĐS |
| **Priority** | P0 |
| **Trigger** | Mở `/crm/leads/:id/deal-room` khi lead `re_buyer` |

**Main flow:** 404, không PII.

**Rules:** BR-BDS-06.

**Traceability:** UX §1.8

---

## BDS-UC-004 — Tạo / mở dự án CĐT

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | PM (`cdt_pm`) |
| **Priority** | P0 |
| **Trigger** | CTA Dự án mới |

**Preconditions:** 5 vị trí bắt buộc đã gán (BR-BDS-34) hoặc cảnh báo blocking.

**Main flow:**

1. PM nhập tên, mã, mode one_price mặc định true.
2. Hệ thống tạo `crm_re_projects` + `tenant_id`, `legal_gate=blocked`.
3. Redirect tổng quan dự án.

**Extensions:** E1 — Tenant broker POST project master → 400.

**Traceability:** SCR-BDS-002 · P0/P1b

---

## BDS-UC-005 — Xem tổng quan + RACI dự án

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | PM, TGĐ |
| **Priority** | P1 |
| **Trigger** | Mở `/crm/re-projects/:id` |

**Main flow:** Gate, đợt, mốc, sell-through, `bds_project_raci`.

**Traceability:** SCR-BDS-003

---

## BDS-UC-006 — Tải hồ sơ pháp lý

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Trưởng / CV Pháp chế |
| **Priority** | P0 |
| **Trigger** | Tab Pháp lý · Tải lên |

**Main flow:**

1. Chọn `doc_type` (Sở XD, bảo lãnh, giải chấp, …).
2. Upload file → object storage, `status=valid`, hạn.
3. Job nightly: hết hạn → `expired`, có thể `restricted` gate.

**Extensions:** E1 — Thiếu `so_xd` vẫn cho giữ chỗ nếu override 15 ngày (UC-007).

**Traceability:** SCR-BDS-010 · `POST /projects/:id/legal-docs` · BR-BDS-15

---

## BDS-UC-007 — Mở / đóng cổng đủ điều kiện bán

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Pháp chế (A) · PM (C) |
| **Priority** | P0 |
| **Trigger** | Đủ bộ `required_for_sale` hoặc override |

**Main flow:**

1. PC bấm **Mở cổng**. Hệ thống kiểm bộ valid.
2. `legal_gate=enough_to_sell`. Event → room `x_pm_ops` + ticket `legal_gate_phase` done.
3. PM được mở đợt (UC-008).

**Extensions:**

- **E1 — Thiếu hồ sơ:** nút disabled + list thiếu.
- **E2 — Override 15 ngày:** TGĐ + PC, lý do, **cấm** dùng cho HĐMB.
- **E3 — Đóng / hết hạn:** chặn đợt mới, hold sàn mới, POST HĐMB.

**Rules:** BR-BDS-16, 21, 27.

**Traceability:** SCR-BDS-010 · `POST /legal-gate`

---

## BDS-UC-008 — Mở đợt bán

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | PM (A) · GĐKD, SP, MKT (R/C) |
| **Priority** | P0 |
| **Trigger** | Go/no-go · `POST /phases/:id/open` |

**Preconditions:** Gate đủ (hoặc override mềm); giá draft có; giỏ materialize nếu mở kênh.

**Main flow:** Phase `active` (một active trừ setting parallel). Sàn hold được nếu `open_to_channel`.

**Extensions:** E1 — Gate blocked → 400 `legal_gate`, tooltip UX.

**Traceability:** SCR-BDS-030 · BDS-21

---

## BDS-UC-009 — Soạn và activate CSBH + bảng giá

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CV giá (soạn) · GĐKD (activate) |
| **Priority** | P0 |
| **Trigger** | Tab Giá/CSBH |

**Main flow:**

1. CV giá nhập list, chiết khấu cap, `vbtt_min_paid_pct`, `hdmb_min_paid_pct`.
2. GĐKD **Activate** — snapshot `price_list_id` đợt.
3. TVV/sàn thấy giá hiệu lực.

**Extensions:** E1 — CV giá bấm activate → 403/ẩn nút.

**Traceability:** SCR-BDS-031 · BR-BDS-26

---

## BDS-UC-010 — Import căn

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Trưởng SP |
| **Priority** | P0 |
| **Trigger** | Import CSV |

**Main flow:** Map tower/zone, `unit_code` bắt buộc. Trùng code → 409 dòng, không silent. Căn `sold` skip (BR-BDS-07).

**Traceability:** SCR-BDS-020 · BDS-16

---

## BDS-UC-011 — Đổi pool / khóa căn

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Trưởng SP · GĐKD (VIP/staff) |
| **Priority** | P0 |
| **Trigger** | Drawer căn |

**Main flow:** Gán `inhouse` \| `channel` \| `reserved_vip` \| `reserved_staff`. Khóa `locked` + lý do.

**Extensions:** E1 — F1 GET căn inhouse → 404 (BR-BDS-28).

**Traceability:** SCR-BDS-021

---

## BDS-UC-012 — Xem stacking

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | KD, SP, AM |
| **Priority** | P0 |
| **Trigger** | `/stack` |

**Main flow:** Ma trận tầng × căn, filter đợt/pool. Sàn chỉ ô trong giỏ.

**Traceability:** SCR-BDS-021 · `GET /stack`

---

## BDS-UC-013 — Hold inhouse (auto duyệt)

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TVV inhouse |
| **Priority** | P0 |
| **Trigger** | Drawer căn available, pool inhouse |

**Main flow:**

1. POST hold + `Idempotency-Key` + lead.
2. 201, căn `hold`, TTL CSBH (hoặc 180s nếu launch).
3. Toast countdown. Ticket/chat không bắt buộc (inhouse auto).

**Extensions:**

- **E1 — Hai TVV cùng căn:** 201 + 409 (BR-BDS-01, BDS-02).
- **E2 — `row_version` lệch:** 409 `unit_locked`.

**Traceability:** SCR-BDS-021 · BDS-UC actions

---

## BDS-UC-014 — Sàn xin hold (pending)

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Sale F1 |
| **Actor phụ** | AM, GĐKD |
| **Priority** | P0 |
| **Trigger** | Giỏ · giữ căn channel trong giỏ |

**Preconditions:** HĐ phân phối active, hạng còn quota, không exclusive người khác, gate đợt.

**Main flow:** Hold `pending`. Card `x_kenh_gdkd` + ticket `hold_f1_approve`.

**Extensions:**

- **E1 — Ngoài giỏ / inhouse:** 404.
- **E2 — Hết quota:** 409 `hold_quota`.
- **E3 — F2 ngoài giỏ cha:** 404 (BR-BDS-29).
- **E4 — Agency suspended:** 409.

**Traceability:** SCR-BDS-200 · BR-BDS-11

---

## BDS-UC-015 — Duyệt / từ chối hold F1

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | GĐKD (A) · AM (sàng) |
| **Priority** | P0 |
| **Trigger** | Inbox `/crm/bds/holds` tab Chờ duyệt |

**Main flow:** Duyệt → `active` + TTL. Từ chối + lý do → căn `available`. Ticket queue done.

**Extensions:** E1 — SLA 2h strategic / 8h khác; quá hạn escalate (BR-BDS-45 trên ticket).

**Traceability:** SCR-BDS-050

---

## BDS-UC-016 — TTL hết hạn hold

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System |
| **Priority** | P0 |
| **Trigger** | Job TTL / launch 180s |

**Main flow:** Hold `expired`, căn `available`. Nếu có phí giữ chỗ hết cửa sổ → hoàn (BR-BDS-30).

**Traceability:** BDS-03, BDS-37

---

## BDS-UC-017 — Thu giữ chỗ (reservation)

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TVV / F1 + Collection ghi tiền |
| **Priority** | P1 |
| **Trigger** | Hold active · KH nộp phí giữ chỗ |

**Main flow:** TX `reservation`, căn `reserved`.

**Extensions:** E1 — Không nộp hết cửa sổ launch → hoàn + available.

**Traceability:** SCR-BDS-060

---

## BDS-UC-018 — Đặt cọc

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TVV / F1 |
| **Actor phụ** | Collection |
| **Priority** | P0 |
| **Trigger** | Convert hold → cọc |

**Main flow:**

1. Kiểm `deposit_min`, chiết khấu ≤ cap (vượt → GĐKD).
2. TX `deposit`, căn `booked`.
3. 4h: Collection sinh lịch (UC-036). Card + ticket `collection_schedule`.

**Extensions:** E1 — Dưới min → 400. E2 — one_price lệch → 400.

**Rules:** BR-BDS-03, 26.

**Traceability:** SCR-BDS-060 · `POST /holds/:id/convert-deposit`

---

## BDS-UC-019 — Ký VBTT

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CV HĐ + TVV |
| **Priority** | P0 |
| **Trigger** | Đạt `vbtt_min_paid_pct` · mẫu PC |

**Main flow:** PC pre-sign check → KH ký file → TX `vbtt`. HH accrue nếu scheme mốc VBTT.

**Extensions:** E1 — Sai giá / sai mẫu → không cho in.

**Traceability:** SCR-BDS-060 · `POST .../vbtt`

---

## BDS-UC-020 — Ký HĐMB (cổng kép)

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CV HĐ / Trưởng PC bấm **Ký HĐMB** · PC + Collection (A cổng) · GĐKD chỉ xem |
| **Priority** | P0 |
| **Trigger** | `POST /transactions/:id/contract` |

**Preconditions:** Sở XD valid · bảo lãnh hoặc waive file · giải chấp · `paid_pct` ≥ ngưỡng · mẫu approved · căn không thế chấp.

**Main flow:**

1. UI hiện 2 cột cổng. Thiếu → modal SCR §3.4, không submit.
2. Đủ → 201, căn `sold`, TX `contracted`. GMV hub TGĐ.
3. Ticket `hdmb_gate_*` auto done. After intake + HH accrue. Card chat.

**Extensions:**

- **E1 — Thiếu Sở XD:** 400 `legal_gate_hdmb`.
- **E2 — Thiếu %:** 400 `paid_pct`.
- **E3 — GĐKD không có nút bypass** (BR-BDS-35).

**Traceability:** SCR-BDS-060 · BDS-31, 32

---

## BDS-UC-021 — Hủy cọc / TX

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | GĐKD + Collection |
| **Priority** | P0 |
| **Trigger** | CTA Hủy + reason |

**Main flow:** TX `cancelled`, căn `available`, clawback HH nếu chưa paid (BR-BDS-22).

**Traceability:** `POST .../cancel`

---

## BDS-UC-022 — Thu tiến độ theo mốc

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | PM (mốc) · Collection (thu) |
| **Priority** | P0 |
| **Trigger** | Milestone `reached` |

**Main flow:** PM ghi actual_date. Installment unlock / shift. Ticket `milestone_unlock`. After nhận tín hiệu hẹn BG.

**Traceability:** SCR-BDS-003 · BR-BDS-31

---

## BDS-UC-025 — Onboard đại lý

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Trưởng kênh · PC (HĐ) |
| **Priority** | P0 |
| **Trigger** | Tạo agency prospect |

**Main flow:** MST, HĐ, ngân hàng, AM → `onboarding` → duyệt → `active` + hạng `trial`. Thiếu HĐ active → không cấp giỏ/hold.

**Traceability:** SCR-BDS-080

---

## BDS-UC-026 — Cấp / gỡ giỏ

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | GĐKD (A exclusive) · SP materialize · Kênh |
| **Priority** | P0 |
| **Trigger** | PUT basket rule |

**Main flow:** Rule zone/tower/units → job `basket_units`. Exclusive: một căn một đại lý.

**Extensions:** E1 — Hạng không `exclusive_allowed` → 400. E2 — Gỡ khi in-flight → 400 `unit_in_flight`.

**Traceability:** SCR-BDS-082 · BR-BDS-17

---

## BDS-UC-027 — Recalc / override hạng

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System (cron) · GĐKD override |
| **Priority** | P1 |
| **Trigger** | Ngày 1 kỳ / tờ trình |

**Main flow:** Điểm → lên/xuống một bậc. Override: lý do ≥10 ký tự + hạn. TX cũ giữ % cũ (BR-BDS-19). Hold mở không hủy (BR-BDS-20).

**Traceability:** SCR-BDS-081 · BDS-24, 25

---

## BDS-UC-028 — Sàn kê giá khác CSBH

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System |
| **Priority** | P0 |
| **Trigger** | API hold/TX net ≠ one_price |

**Main flow:** 400 `one_price`. UX copy §8.

**Rules:** BR-BDS-26.

---

## BDS-UC-031 — Lead ads → CSKH 15 phút

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System ingest · CSKH |
| **Priority** | P0 |
| **Trigger** | Form/webhook dự án BĐS |

**Main flow:** `re_buyer` + tenant + UTM. Board CSKH. Ticket `cskh_first_touch` + card `x_mkt_cskh`. CSKH touched_at ≤ 15p.

**Extensions:** E1 — Gắn `b2b_project_id` → 400. E2 — Trùng SĐT khác dự án → lead mới (BR-BDS-04).

**Traceability:** SCR-BDS-040 · BR-BDS-06

---

## BDS-UC-032 — Qualify + đặt lịch xem nhà

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CSKH |
| **Priority** | P0 |
| **Trigger** | Lead đã chạm |

**Main flow:** Qualify / nurture / lost. Đặt visit → gán Inhouse hoặc F1. Ticket `visit_book`.

**Extensions:** E1 — Lost: `lost_reason` bắt buộc.

**Traceability:** `POST /leads/:id/visits`

---

## BDS-UC-033 — Matching căn

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TVV / sale sàn |
| **Priority** | P1 |
| **Trigger** | `GET /leads/:id/matches` |

**Main flow:** Gợi ý `available` theo nhu cầu ∩ giỏ caller.

**Traceability:** SCR-BDS-040

---

## BDS-UC-036 — Sinh lịch + phiếu thu

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Collection |
| **Priority** | P0 |
| **Trigger** | TX deposit / cron aging |

**Main flow:** Sinh installment 4h. Ghi phiếu ≤ `net−paid`. Overdue → task. Ticket `collection_schedule` done khi có lịch.

**Extensions:** E1 — Vượt net → 400. E2 — Đóng ticket khi chưa có lịch → 400 `artifact` (BR-BDS-44).

**Traceability:** SCR-BDS-090

---

## BDS-UC-037 — Hồ sơ vay

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Collection |
| **Priority** | P1 |
| **Trigger** | KH vay NH |

**Main flow:** `bds_mortgages` status. Không phải module tín dụng NH.

**Traceability:** `POST .../mortgage`

---

## BDS-UC-038 — Export bảng kê ERP

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Collection |
| **Priority** | P1 |
| **Trigger** | Ngày N+2 kỳ |

**Main flow:** CSV/PDF. Không ghi sổ cái.

**Traceability:** SCR-BDS-090

---

## BDS-UC-041 — Hẹn và checklist bàn giao

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | After · Collection đợt cuối |
| **Priority** | P0 |
| **Trigger** | Mốc + 15 ngày |

**Main flow:** Appointment. Ngày BG: checklist. Pass (hoặc waive aftersales) → `handed_over`. Thiếu checklist → 400 (BR-BDS-32).

**Traceability:** SCR-BDS-100 · BDS-38

---

## BDS-UC-042 — Ticket defect / BH

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CV bàn giao |
| **Priority** | P1 |
| **Trigger** | Sau BG |

**Main flow:** Ticket after-sales `defect` — **không** `crm_staff_tickets` (BR-BDS-46). Có thể mở work ticket trỏ tới defect nhờ PM.

**Traceability:** SCR-BDS-100

---

## BDS-UC-043 — Theo dõi sổ hồng

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | After · PC (C) |
| **Priority** | P1 |
| **Trigger** | Nộp cục (ngoài hệ) |

**Main flow:** `title_status` submitted → issued → handed_to_buyer. Không nộp cục trong app.

**Traceability:** `POST .../title`

---

## BDS-UC-045 — Mở ra quân / war-room

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | GĐKD · SP · AM · CSKH · MKT |
| **Priority** | P0 |
| **Trigger** | `POST /launches/:id/open` |

**Main flow:** Khóa giá, TTL 180s, queue FIFO. Huddle chat `launch_*`. War-room realtime.

**Extensions:** E1 — Đóng launch → TTL về CSBH, archive huddle.

**Rules:** BR-BDS-33.

**Traceability:** SCR-BDS-070

---

## BDS-UC-046 — Xung đột hold lúc ra quân

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System · GĐKD war-room |
| **Priority** | P0 |
| **Trigger** | Hai POST cùng căn |

**Main flow:** 201 + 409. Hàng war-room hiện xung đột. Queue promote khi TTL hết.

**Traceability:** BDS-02 trên launch

---

## BDS-UC-048 — Bảng kê hoa hồng kỳ

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | CV HH |
| **Priority** | P0 |
| **Trigger** | Chốt kỳ |

**Main flow:** Sum accrued = statement ±0đ. Duyệt → chi. Clawback cửa sổ HĐ.

**Traceability:** SCR-BDS-091 · BDS-27 · BR-BDS-21, 22

---

## BDS-UC-049 — Tạm ứng đại lý

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | HH · AM đề nghị |
| **Priority** | P1 |
| **Trigger** | Đề nghị tạm ứng |

**Main flow:** ≤ `advance_cap`. Trừ kỳ sau.

**Rules:** BR-BDS-21.

---

## BDS-UC-051 — Chat trong phòng

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Staff thuộc ban |
| **Priority** | P1 |
| **Trigger** | Mở room `dept` |

**Main flow:** Membership theo vị trí HR. Post text/@. Restricted: không forward.

**Extensions:** E1 — TVV vào `#ban-phap-che` → 404. E2 — Sàn → 404 (BR-BDS-36).

**Traceability:** SCR-BDS-110 · BDS-39, 40

---

## BDS-UC-052 — Chat liên phòng + system card

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System + 2 ban |
| **Priority** | P1 |
| **Trigger** | Handoff §25.5 |

**Main flow:** Card vào room `cross` đúng (BR-BDS-39). Click chip → drawer nếu có quyền; không → «Hồ sơ ẩn» (BR-BDS-38).

**Traceability:** §27.4

---

## BDS-UC-053 — Huddle war-room / cổng kép

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | GĐKD / PC |
| **Priority** | P1 |
| **Trigger** | Launch open hoặc HĐMB kẹt |

**Main flow:** Room huddle + `expires_at`. Archive khi xong.

**Traceability:** SCR-BDS-110

---

## BDS-UC-054 — Chuyển tin chat thành ticket

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Member room |
| **Priority** | P1 |
| **Trigger** | Menu tin · Chuyển thành ticket |

**Preconditions:** `PTT_STAFF_TICKETS=1`.

**Main flow:** Prefill body, `room_id`, chọn queue. Mở `/crm/work/:id`.

**Traceability:** BDS-UC-055

---

## BDS-UC-055 — Tạo ticket trong ban

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Staff CĐT |
| **Priority** | P1 |
| **Trigger** | `/crm/work` · Tạo · kind `dept` |

**Main flow:** Queue `dept_backlog` hoặc queue ban. Unassigned → queue trưởng.

**Traceability:** SCR-BDS-120

---

## BDS-UC-056 — Tạo ticket liên phòng

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Staff ban nhờ |
| **Priority** | P0 |
| **Trigger** | Tạo `cross` hoặc auto handoff |

**Main flow:** `assignee_dept` ≠ requester (BR-BDS-42). SLA từ queue. Inbound ban nhận.

**Extensions:** E1 — Cùng ban → 400. E2 — Gán user sàn → 400 (BR-BDS-43).

**Traceability:** BDS-45, 46

---

## BDS-UC-057 — Claim / gán / chuyển trạng thái ticket

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Assignee · trưởng ban nhận |
| **Priority** | P0 |
| **Trigger** | Inbox queue / inbound |

**Main flow:** Claim → `in_progress`. Blocked + lý do. Waiting pause SLA nếu queue cho phép.

**Traceability:** `POST .../assign` · `transition`

---

## BDS-UC-058 — Đóng ticket (artifact)

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Assignee hoặc System |
| **Priority** | P0 |
| **Trigger** | `done` hoặc domain event |

**Main flow:** Kiểm `close_requires`. Collection schedule: phải có installment. `hdmb_gate_*`: chỉ auto khi TX contracted — không done tay (BR-BDS-44).

**Extensions:** E1 — Thiếu artifact → 400, toast UX §3.3.

**Traceability:** BDS-47

---

## BDS-UC-059 — Escalate quá SLA

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | System |
| **Priority** | P0 |
| **Trigger** | `sla_due_at` quá |

**Main flow:** `sla_breached`, watcher trưởng → GĐ khối/PM → TGĐ. Chuông UC-002.

**Rules:** BR-BDS-45.

---

## BDS-UC-060 — Workspace sàn: giỏ + hold + HH

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | Sale / CTV / broker_admin |
| **Priority** | P0 |
| **Trigger** | Login tenant broker hoặc user `org_kind=broker` |

**Main flow:** Nav §2.2. GET project master → `{ projects: [] }`. Giỏ qua `/me/basket`. CTV ẩn net.

**Extensions:** E1 — GET room/ticket CĐT → 404.

**Traceability:** SCR-BDS-200…202 · BDS-19

---

## BDS-UC-061 — PWA xin hold

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | TVV / sale sàn |
| **Priority** | P1 |
| **Trigger** | PWA list lead → căn → Giữ |

**Main flow:** Cùng API hold. Countdown TTL. Không war-room.

**Traceability:** UX §2.3

---

## BDS-UC-062 — Offboard nhân sự

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | HR |
| **Priority** | P1 |
| **Trigger** | Disable user |

**Main flow:** Revoke chat. Ticket mở → queue trưởng ban. Hold đang mở chuyển owner (không mất căn).

**Traceability:** §8.4 · §29

---

## Actor × UC (tóm tắt)

| Actor | UC chính |
|-------|----------|
| TGĐ | 001, 002, 007-E2, 059 |
| PM | 004–008, 022, 045 |
| SP / giá | 009–012, 026 |
| GĐKD | 001, 009, 015, 020, 026, 027, 045 |
| TVV inhouse | 013, 017–019, 032, 061 |
| Kênh / AM | 014, 025–027 |
| CSKH presales | 031, 032 |
| MKT | 031 (ads), claim → 056 `claim_review` |
| Pháp chế | 006, 007, 019, 020 |
| Collection | 018, 020, 036–038 |
| HH | 048, 049 |
| After | 041–043 |
| Sale sàn | 014, 060, 061 |
| System | 016, 031, 052, 059 |
