# Use Case — Toàn OS BĐS × module × phòng × chức vụ

> **Prefix:** BDS-UC (module, tiếp 063+) · BDS-D (phòng) · BDS-R (chức vụ)  
> **Ngày:** 2026-08-23 · **Priority** P0 = W1 / cổng · P1 = W2–W8  
> **UX:** [`../superpowers/specs/2026-08-23-bds-ux-ui-complete.md`](../superpowers/specs/2026-08-23-bds-ux-ui-complete.md)  
> **UC pack gốc (001–062):** [`13-BDS-INDUSTRY-PACK.md`](13-BDS-INDUSTRY-PACK.md) — **giữ**, không xóa  
> **Actions click:** [`actions/13-BDS-ROLE-ACTIONS.md`](actions/13-BDS-ROLE-ACTIONS.md)  
> **Chức vụ:** [`../superpowers/specs/2026-08-23-bds-role-feature-execution.md`](../superpowers/specs/2026-08-23-bds-role-feature-execution.md)

Format: Actor · Priority · Trigger · Preconditions · Main flow · Extensions · Postconditions · Rules · Trace (SCR / API / sóng).

---

## 0. Bản đồ coverage

| Lớp | ID | Số | Việc |
|-----|----|----|------|
| Module (đã có) | BDS-UC-001…062 | 40+ | Pack P0–P12 |
| Module (OS mới) | BDS-UC-063…074 | 12 | 360, board, ẩn B2B, finance, CAPI, cap, mốc UI… |
| Phòng ban | BDS-D-01…12 | 12 | Handoff + nhịp họp |
| Chức vụ | BDS-R-01…18 | 18 | Ngày điển hình trên UI |

**Không** viết UC Meta/SEO/B2B ở đây.

---

## A. Use case hệ thống / module mới

### BDS-UC-063 — Người mua 360 (`re_buyer`)

| | |
|--|--|
| **Actor** | CSKH, TVV, GĐKD (I), MKT (tab Ads) |
| **P** | P1 (W5) |
| **Trigger** | Mở `/crm/leads/:id` lead `flow=re_buyer` |

**Preconditions:** U1; lead thuộc tenant.

**Main flow:**

1. Skin 360: tabs Ads · Liên hệ · Visit · Hold · TX · Thu · Sổ.  
2. Không render Deal Room / proposal / `b2b_project_id`.  
3. CTA theo cap: Chạm, Hẹn xem, Giữ (nếu kiêm), mở TX.

**E1:** URL `/deal-room` → 404 (UC-003).  
**E2:** User chỉ cap agency → 404, không PII.

**Post:** Không đổi dữ liệu nếu chỉ xem.  
**Trace:** SCR-041 · U1.

---

### BDS-UC-064 — Board CSKH `flow=re_buyer`

| | |
|--|--|
| **Actor** | `cskh_lead`, `truong_inhouse` |
| **P** | P1 (W5) |
| **Trigger** | `/crm/cskh-board?flow=re_buyer` |

**Main:** Kanban 7 cột + căn + TTL + stage TX + SLA 15p. Kéo thả không đổi hold/TX (chỉ stage chăm). **Đã liên hệ** → `POST :id/touch`.

**E1:** `flow` mặc định/spa → 0 lead BĐS.  
**E2:** Breach → chuông + escalate trưởng.

**Trace:** SCR-042 · UC-031.

---

### BDS-UC-065 — Ẩn nav B2B tenant CĐT

| | |
|--|--|
| **Actor** | Mọi user tenant `developer` |
| **P** | P1 (W6) |
| **Trigger** | Login, `PTT_BDS_NAV_HIDE_B2B=1` |

**Main:** Sidebar không Sales / Deal Room / marketing-plan agency. `/crm/sales` → 403 hoặc redirect `/crm/bds`.

**E1:** `hybrid` — hiện «Sàn nội bộ», vẫn ẩn pipeline ads PTT.  
**E2:** Flag 0 — nav cũ (PTT).

**Trace:** U3 · U-04.

---

### BDS-UC-066 — Finance hub CFO

| | |
|--|--|
| **Actor** | TGĐ, `truong_collection`, `cv_hh` (I) |
| **P** | P1 (W7) |
| **Trigger** | `/crm/bds/finance` |

**Main:** 4 số: GMV HĐMB = SUM contracted kỳ · thu · overdue · HH accrue. Click → 090/091.

**E1:** Copy «không phải hạch toán».  
**Rule:** U-09.

**Trace:** SCR-092.

---

### BDS-UC-067 — CAPI Lead / Schedule / Purchase

| | |
|--|--|
| **Actor** | System + `truong_mkt` (cấu hình) |
| **P** | P1 (W7) |
| **Trigger** | Lead mới / visit / TX `deposit` |

**Main:** HTTP Meta. Purchase value = `net_price_vnd`. Retry + bảng `bds_capi_events`.

**E1:** CAPI off — TX vẫn OK, không HTTP.  
**E2:** Chưa map ad — không bật CAPI (UI chặn).  
**Rule:** U-05, U-06. PII hash SĐT.

**Trace:** U5.

---

### BDS-UC-068 — Seed cap theo chức vụ (first login)

| | |
|--|--|
| **Actor** | System / HR |
| **P** | P0 (W0) |
| **Trigger** | `seedForTenant` hoặc gán `crm_positions.code` |

**Main:** INSERT `staff_section_permissions` theo `BDS_POSITION_DEFAULT_CAPS`. User login thấy đúng nav §4 UX.

**E1:** `grants_customized` — không xóa tay Admin; chỉ thêm thiếu.  
**E2:** TVV không nhận `holds.approve` / `transactions.edit`.

**Trace:** W0 · SCR-130.

---

### BDS-UC-069 — Chặn ra quân khi thiếu G0/G1/G2

| | |
|--|--|
| **Actor** | PM, GĐKD |
| **P** | P0 |
| **Trigger** | Bấm **Mở ra quân** / **Mở đợt** |

**Main:** Checklist UI. Thiếu 5 A / legal / giá active / giỏ F1 → disabled + tooltip. API 400 `required_roles` / `legal_gate`.

**Trace:** BR-34 · SCR-070.

---

### BDS-UC-070 — Soạn draft + Activate CSBH (UI)

| | |
|--|--|
| **Actor** | `cv_gia` soạn; `gdkd` activate |
| **P** | P1 (W2) |
| **Trigger** | `/crm/bds/policies` |

**Main:** Khớp UC-009 trên màn 032. CV giá không thấy Activate (kể cả URL — 404/ẩn nút).

**Trace:** SCR-032.

---

### BDS-UC-071 — Hồ sơ đại lý + cấp giỏ (UI)

| | |
|--|--|
| **Actor** | `truong_kenh`, `truong_sp` (materialize), PC (C HĐ) |
| **P** | P1 (W2) |
| **Trigger** | `/crm/bds/agencies/:id` |

**Main:** Khớp UC-025/026. Chưa HĐ → không cấp giỏ. `unit_in_flight` → không thu hồi.

**Trace:** SCR-085.

---

### BDS-UC-072 — Đạt mốc thi công (UI)

| | |
|--|--|
| **Actor** | `pm_du_an` |
| **P** | P1 (W2) |
| **Trigger** | Tab Mốc · **Đạt mốc** |

**Main:** `POST milestones/:id/reach`. Ticket Collection + After. Unlock đợt thu.

**E1:** Mốc đã reached — nút ẩn.  
**Trace:** UC-022 · SCR-011c.

---

### BDS-UC-073 — After auto intake khi contracted

| | |
|--|--|
| **Actor** | System → `truong_after` |
| **P** | P1 (W5) |
| **Trigger** | TX `contracted` |

**Main:** Hàng after + ticket hẹn BG 15N. Không ticket SPA.

**Trace:** UC-041 · BR-BDS-46.

---

### BDS-UC-074 — Offboard an toàn (bổ sung UC-062)

| | |
|--|--|
| **Actor** | `hr_bp` |
| **P** | P1 (W8) |
| **Trigger** | Confirm offboard |

**Main:** Disable user. Hold **chưa cọc** → available. Hold **đã cọc** + TX → **không** mở căn. Ticket → trưởng. Chat cắt.

**E1:** U-07 / U-08 bắt buộc test.  
**Trace:** SCR-130 · U6.

---

## B. Use case từng phòng ban (handoff)

Mỗi D = «ban này xong việc nhà thì ban kia nhận gì».

### BDS-D-01 — Điều hành: war-room ngày

**Actor:** TGĐ chủ trì; GĐKD R. **Trigger:** 08:30 hoặc liên tục ngày launch.  
**Main:** Mở 001 → inbox F1 / breach / aging → bấm đúng module. Quyết định go/no-go đợt 48h trên Việc, không Zalo.  
**E1:** Không bấm Ký HĐMB hộ.  
**UC con:** 001, 002, 059.

### BDS-D-02 — Dự án: mốc → thu + after

**Actor:** PM. **Trigger:** Ban XD báo mốc.  
**Main:** 072 trong ngày → Collection mở đợt thu + After cập nhật hẹn.  
**SLA:** ngày `reached`.

### BDS-D-03 — Sản phẩm: hàng sẵn sàng

**Actor:** Trưởng SP + CV giá. **Trigger:** Trước ra quân.  
**Main:** Import + stack + draft giá → GĐKD activate → materialize giỏ ≥3 ngày.  
**Cổng:** không `available` đúng pool → D-05 chặn mở.

### BDS-D-04 — Inhouse: gallery khóa căn

**Actor:** Trưởng IH + TVV. **Trigger:** KH xem nhà.  
**Main:** Visit → hold 013 → 409 đổi căn → cọc 018 → D-09 nhận lịch.  
**Cấm:** thu miệng / Zalo.

### BDS-D-05 — Kênh: F1 vào war-room

**Actor:** Trưởng kênh + AM. **Trigger:** Sale sàn xin giữ.  
**Main:** 014 → ticket F1 → GĐKD 015 (2h/8h) → escalate D-01.  
**Cổng:** chưa HĐ → không giỏ.

### BDS-D-06 — CSKH trước bán: 15 phút

**Actor:** `cskh_lead`. **Trigger:** Lead ads (D-07).  
**Main:** 031/064 → qualify → visit (D-04 hoặc D-05). Lost có reason.  
**SLA:** 15p; miss → trưởng.

### BDS-D-07 — Marketing: ads vào board

**Actor:** Trưởng MKT. **Trigger:** Form/ads.  
**Main:** Map ad → ingest `re_buyer` → CAPI Lead (067) → D-06.  
**Cấm:** hold / giá.

### BDS-D-08 — Pháp chế: hai cổng

**Actor:** Trưởng PC + CV HĐ. **Trigger:** Hồ sơ Sở / TX vbtt.  
**Main:** 006–007 → 019 → A pháp lý trên 020. C HĐ kênh trước D-05 cấp giỏ.  
**Cấm:** mở đợt, phiếu.

### BDS-D-09 — Công nợ: lịch 4h + % HĐMB

**Actor:** Trưởng collection. **Trigger:** TX deposit.  
**Main:** 036 ≤4h → phiếu → `paid_pct` → `ready_for_hdmb` → D-08.  
**Cấm:** cổng pháp lý, chi HH.

### BDS-D-10 — Hoa hồng: T+0 và khóa kỳ

**Actor:** CV HH. **Trigger:** Mốc TX theo scheme.  
**Main:** Accrue → statement với Kênh ±0đ → 048/049. Clawback 021.  
**Cấm:** sửa GMV.

### BDS-D-11 — After: HĐMB → sổ

**Actor:** Trưởng after + CV BG. **Trigger:** 073.  
**Main:** Hẹn 15N (C mốc + đợt cuối) → 041–043.  
**Cấm:** ký HĐMB.

### BDS-D-12 — Nhân sự: G0 + offboard

**Actor:** HR BP. **Trigger:** Onboard / nghỉ.  
**Main:** 068 + banner 5 A. 074 khi nghỉ.  
**Cấm:** một user PC+Collection cùng DA.

---

## C. Use case từng chức vụ (ngày điển hình)

Mỗi R = persona P0 trên **màn nhà**. Extensions = sự cố §8 operating-cycle.

### BDS-R-01 — TGĐ đọc khối

**P0.** Login → 001. Đọc 4 KPI. Click overdue → 090. Click F1 → 050. Không phiếu / không HĐMB. Cuối tháng: GMV HĐMB (066).  
**E1:** Override hạng → Việc, không điện thoại.

### BDS-R-02 — PM chạy dự án

**P0.** 002 → 003. Gắn/đạt mốc 072. Checklist 069 rồi mở đợt/launch. Duyệt plan 011d.  
**E1:** Thiếu G1 — Mở disabled.

### BDS-R-03 — Trưởng SP tồn kho

**P0.** Tab tồn kho. Import 010. Đổi pool / lock 011. Stack 012. Đổ giỏ 026 (W2).  
**E1:** 409 row_version → Làm mới.

### BDS-R-04 — CV giá nháp

**P1.** 032 soạn list + CSBH. Quote one_price. Gửi GĐKD. Không Activate.  
**E1:** Mở URL activate → không nút / 403.

### BDS-R-05 — GĐKD war-room

**P0.** 001 → 050 tab F1. Duyệt/từ chối 015 (2h/8h). Ngày launch 045. Activate 070. TX: xem cổng, không ký.  
**E1:** Nav B2B ẩn (065).  
**E2:** Không bypass 020.

### BDS-R-06 — Trưởng gallery

**P0.** Hold inhouse + chia lead. Chat `ban_kd`. Không tab F1 người khác.  
**E1:** TVV nghỉ → 074 về queue mình.

### BDS-R-07 — TVV bán căn

**P0.** 050 **Giữ chỗ** 013. 409 → đổi căn. Visit 032. **Cọc** 018. Đưa ký khi cổng xanh (I). Chat.  
**E1:** 409 copy UX §6.  
**E2:** Không thấy phiếu thu / giỏ exclusive.

### BDS-R-08 — Trưởng kênh

**P1.** 080 → 085. Onboard 025. HĐ (chờ PC). Cấp giỏ 071. Hạng 027. BXH.  
**E1:** Chưa HĐ — cấp giỏ disabled.

### BDS-R-09 — AM đại lý

**P0.** Giỏ / 085. Xin F1 014. Inbox agency. Nhắc TTL. Quote một giá 028 (400 nếu kê).  
**E1:** 404 căn ngoài giỏ.

### BDS-R-10 — CSKH trước bán

**P0.** 040/042. 15p 031. Qualify + hẹn 032. Lost reason. 003 Deal Room 404.  
**E1:** Breach → trưởng.  
**E2:** Không tự gia hạn hold.

### BDS-R-11 — Trưởng MKT

**P1.** Plan DA. Map ad. Bật form. 067. Kit agency (PC claim). Không hold.  
**E1:** Chưa map ad — CAPI tắt.

### BDS-R-12 — Trưởng pháp chế

**P0.** 010 kho. 007 cổng bán. 020 A pháp lý. C HĐ kênh. Không phiếu.  
**E1:** Override 15n không mở HĐMB.

### BDS-R-13 — CV hợp đồng

**P0.** 060. VBTT 019. Gate 2 cột. HĐMB 020 hoặc modal 061.  
**E1:** `paid_pct` / `legal_gate_hdmb` — không ký.

### BDS-R-14 — Trưởng công nợ

**P0.** Việc 4h. 090 phiếu 036. Aging. Export 038. Chip đủ % → PC.  
**E1:** HĐMB thiếu % — 400, không «ký trước».

### BDS-R-15 — CV hoa hồng

**P1.** Scheme trước CSBH. Ledger T+0. Khóa/duyệt/chi 048. Tạm ứng 049. Clawback hủy.  
**E1:** Không sửa GMV tay.

### BDS-R-16 — Trưởng after

**P0.** 100. 073. Hẹn 15N. Waive. Sổ 043.  
**E1:** Chưa handover — không defect.

### BDS-R-17 — CV bàn giao

**P0.** Checklist 4. Bàn giao 041. Defect 042.  
**E1:** Không waive.

### BDS-R-18 — HR BP

**P0.** Org + 068. Banner 5 A. Cấm PC+CL cùng user. Offboard 074.  
**E1:** Offboard nhầm — U-07 giữ căn đã cọc.

---

## D. Ma trận Actor × UC (đủ)

| Chức vụ | UC module (chính) | D | R |
|---------|-------------------|---|---|
| `tgd` | 001, 002, 066, 065 | D-01 | R-01 |
| `pm_du_an` | 004–008, 045, 069, 072 | D-02 | R-02 |
| `truong_sp` | 010–012, 026 | D-03 | R-03 |
| `cv_gia` | 009, 070 | D-03 | R-04 |
| `gdkd` | 001, 009, 015, 045, 065, 070 | D-01, D-05 | R-05 |
| `truong_inhouse` | 013, 064 | D-04 | R-06 |
| `tvv_inhouse` | 013, 017–018, 032, 061 | D-04 | R-07 |
| `truong_kenh` | 025–027, 071 | D-05 | R-08 |
| `am_kenh` | 014, 028 | D-05 | R-09 |
| `cskh_lead` | 003, 031–033, 063, 064 | D-06 | R-10 |
| `truong_mkt` | 031, 067 | D-07 | R-11 |
| `truong_pc` | 006–007, 019–020 | D-08 | R-12 |
| `cv_hd` | 019–020 | D-08 | R-13 |
| `truong_collection` | 018, 020, 036–038, 066 | D-09 | R-14 |
| `cv_hh` | 048–049 | D-10 | R-15 |
| `truong_after` | 041–043, 073 | D-11 | R-16 |
| `cv_ban_giao` | 041–042 | D-11 | R-17 |
| `hr_bp` | 062, 068, 074 | D-12 | R-18 |
| Sale sàn | 014, 060–061 | — | — |
| System | 016, 031, 052, 059, 067, 073 | — | — |

---

## E. UAT tối thiểu (toàn OS)

Chạy theo thứ tự. Chi tiết click: actions role file.

| # | Persona | UC | Pass |
|---|---------|-----|------|
| 1 | HR | R-18, 068 | TVV không thấy Duyệt F1 |
| 2 | PM+PC+SP+GĐKD | 069, 070, 007 | Mở ra quân |
| 3 | MKT→CSKH | 031, R-10 | Touch <15p; 404 Deal Room |
| 4 | TVV | R-07 | Hold 201 + 409 |
| 5 | AM+GĐKD | 014–015 | F1 duyệt |
| 6 | TVV+CL | 018, 036 | Lịch 4h + phiếu |
| 7 | CV HĐ | 020 | 400 rồi 201 khi đủ cổng |
| 8 | After | 041, 073 | Checklist + sổ |
| 9 | HH | 048 | Khóa kỳ |
| 10 | HR | 074 | Hold trống mở; đã cọc giữ |

---

*UC 001–062 không sửa trừ chỗ **Ký HĐMB** = `cv_hd` / `truong_pc` (không GĐKD) — khớp UX 2026-08-23.*
