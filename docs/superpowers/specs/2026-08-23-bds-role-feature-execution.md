# Ma trận chức vụ × tính năng — nền kế hoạch thực thi

**Ngày:** 2026-08-23  
**Trạng thái:** Chờ duyệt trước khi code  
**Loại:** Spec L3 theo **18 chức vụ** (không thay Q1–Q48).  
**Đọc cùng:**  
- Chu trình 12 cổng: [`2026-08-23-bds-crm-operating-cycle.md`](./2026-08-23-bds-crm-operating-cycle.md)  
- Thống nhất OS: [`2026-08-23-bds-crm-os-unification-design.md`](./2026-08-23-bds-crm-os-unification-design.md)  
- Pack: [`2026-08-21-bds-industry-pack-design.md`](./2026-08-21-bds-industry-pack-design.md) §25  
- Seed: `services/ptt-crm-api/src/bds/org/bds-org-seed.ts`  
- Canvas sơ đồ ban: `bds-dept-ops-diagrams.canvas.tsx`  
- Canvas chức vụ: `bds-role-feature-matrix.canvas.tsx`  
- UX/UI hoàn chỉnh: [`2026-08-23-bds-ux-ui-complete.md`](./2026-08-23-bds-ux-ui-complete.md)  
- UC hệ/ban/chức vụ: [`../../use-cases/13-BDS-ROLE-JOURNEYS.md`](../../use-cases/13-BDS-ROLE-JOURNEYS.md)

**Khóa:** Một chu trình căn. Mỗi chức vụ **một nhà** (module + cap). Dữ liệu đi qua cổng + ticket + sự kiện. Không Excel / Zalo làm sổ.

---

## 0. Quyết định thực thi (đã chốt trong tài liệu này)

Ba cách có thể làm. **Chọn A.**

| | Cách | Ưu | Nhược |
|-|------|----|-------|
| **A (chọn)** | **Tận dụng code:** tinh chỉnh + nối stub vào API + nâng hook/tab đã có | Không viết CRM/service song song; ship nhanh trên pack P0–P12b | Spine/CAPI/offboard = nâng chỗ đang stub đến W4+ |
| B | Spine-first (U0) rồi mới FE | Event thống nhất sớm | TVV/GĐKD/Collection vẫn không bấm được trên web |
| C | Cắt dọc theo chức vụ (xong TVV rồi CSKH…) | Demo từng persona | Đụng lại cùng file `api.ts` / page nhiều lần |

**Không làm trong kế hoạch này:** Ban Xây dựng, ERP tổng, eSign, marketplace, payroll map (U7, flag OFF), pipeline B2B.

**Mặc định sản phẩm (đã khóa spec thống nhất):** CAPI Purchase tại **cọc**; ẩn `/crm/sales` với tenant CĐT; `PTT_BDS_PAYROLL_MAP=0`.

---

## 1. Luật không đổi

| ID | Luật |
|----|------|
| BR-34 | Thiếu 5 A bắt buộc (`pm_du_an`, `gdkd`, `truong_pc`, `truong_collection`, `truong_sp`) → không activate / không mở ra quân |
| BR-35 | HĐMB cổng kép: PC `legal_gate` **và** Collection `paid_pct`. GĐKD / TGĐ không bypass |
| BR-26 | `one_price` — kênh không cộng phí |
| Hold | Hai hold mở một căn = 201 + **409** |
| Skin | `re_buyer` không Deal Room |
| After | Defect ≠ ticket khách SPA |
| HH | Sổ `bds_commission_*`, không `crm_b2b_commission_ledger` |
| Kiêm | CĐT 1 DA: đủ 5 A; **cấm** một user vừa `truong_pc` vừa `truong_collection` trên cùng dự án |
| Sàn | Broker không seed 12 ban; nhà = Giỏ + Lead + Hold + HH |

---

## 2. Bản đồ 12 ban → 18 chức vụ

| Ban | Code | Chức vụ (code) | Báo cáo tới | 5 A bắt buộc |
|-----|------|----------------|-------------|--------------|
| Điều hành | `ban_tgd` | `tgd` | HĐQT | |
| Dự án | `ban_du_an` | `pm_du_an` | TGĐ | Có |
| SP – Giỏ – Giá | `ban_san_pham` | `truong_sp`, `cv_gia` | PM / Trưởng SP | `truong_sp` |
| KD Inhouse | `ban_kd` | `gdkd`, `truong_inhouse`, `tvv_inhouse` | TGĐ / GĐKD / Trưởng IH | `gdkd` |
| Kênh | `ban_kenh` | `truong_kenh`, `am_kenh` | GĐKD / Trưởng kênh | |
| CSKH trước bán | `ban_cskh_presales` | `cskh_lead` | GĐKD | |
| Marketing | `ban_mkt` | `truong_mkt` | TGĐ | |
| Pháp chế | `ban_phap_che` | `truong_pc`, `cv_hd` | TGĐ / Trưởng PC | `truong_pc` |
| Công nợ | `ban_tc_collection` | `truong_collection` | TGĐ | Có |
| Hoa hồng | `ban_tc_hh` | `cv_hh` | Trưởng collection | |
| CSKH sau bán | `ban_cskh_after` | `truong_after`, `cv_ban_giao` | TGĐ / Trưởng after | |
| Nhân sự | `ban_hr` | `hr_bp` | TGĐ | |

Cấp nhỏ (1 dự án): 5 A + TVV kiêm CSKH. Cổng HĐMB vẫn 2 người.

---

## 3. Catalog chức vụ (đầy đủ)

Mỗi mục: **owns / cấm** · **nhà** · **cổng** · **ngày điển hình** · **tính năng phải có** · **API / UI hôm nay** · **gap** · **sóng**.

Trạng thái UI: `sống` = thao tác được · `mỏng` = list/hub, thiếu form · `stub` = chữ + link · `thiếu` = chưa có màn.

---

### 3.1. `tgd` — Tổng giám đốc

**Owns:** đọc sức khỏe khối, go/no-go đợt lớn (48h), override hạng / độc quyền qua **Việc**.  
**Cấm:** phiếu thu, activate giá, cổng HĐMB, hold thay TVV.

**Nhà:** `/crm/bds` (Tổng quan). Đọc: Hold, Việc, Tài chính, Board.  
**Cổng A:** go/no-go đợt lớn cùng PM + PC.

**Ngày điển hình**

1. Mở Tổng quan — tiêu thụ, GMV **HĐMB** tháng, overdue >30n, hold hết hạn 2h.  
2. Widget → đúng module (không 5 tab Excel).  
3. Override: ticket queue TGĐ, không gọi điện.  
4. Cuối tháng: pack HĐQT = GMV HĐMB (không GMV cọc).

**Tính năng phải có**

| Mã | Tính năng | SLA / luật |
|----|-----------|------------|
| TGD-01 | Hub 4 KPI + drill | GMV = SUM `contracted` kỳ |
| TGD-02 | Inbox hold F1 + HDMB gate + launch | Click → Hold / Việc cùng id |
| TGD-03 | Widget CSKH breach + phiếu thu hôm nay | U8 |
| TGD-04 | Sell-through tòa / đại lý | Đã có API hub |
| TGD-05 | Queue override hạng / exclusive / hoãn đợt | staff_tickets |
| TGD-06 | Export pack HĐQT tháng | U4 finance hub |

**Hiện:** Hub API + UI 4 ô + inbox (sống, mỏng).  
**Gap:** thiếu widget CSKH/thu; export HĐQT; GĐKD/TGĐ vẫn thấy `/crm/sales`.  
**Sóng:** W6 (ẩn B2B + U8), W7 (export).

---

### 3.2. `pm_du_an` — Giám đốc / PM dự án

**Owns:** tòa/khu/layout, đợt, duyệt plan `business|marketing|sales`, mốc thi công, rủi ro DA.  
**Cấm:** import căn, activate CSBH, file Sở XD (PC giữ), phiếu thu.

**Nhà:** `/crm/re-projects/[id]` + `/crm/bds/launches`.  
**Cổng A:** mở/đóng đợt khi G0/G1/G2 đạt.

**Ngày điển hình**

1. Mở dự án — tab Tổng quan / Tòa / Đợt / Mốc / Quy trình.  
2. Mốc Ban XD (ngoài pack) → `reached` **trong ngày** → Collection + After.  
3. Ra quân: Mở khi đủ G0 roster + G1 legal (nếu đợt yêu cầu) + G2 giá active + giỏ F1.  
4. Duyệt revision plan.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| PM-01 | Tạo/sửa DA: mã, CĐT, `legal_gate`, `one_price`, `hdmb_min_paid_pct` |
| PM-02 | CRUD tòa / khu / layout |
| PM-03 | Đợt open/close |
| PM-04 | Mốc `reached` → unlock thu + After |
| PM-05 | Hàng đợi duyệt plan |
| PM-06 | Mở/đóng ra quân (cùng GĐKD) |
| PM-07 | RACI dự án (`bds_project_raci`) |

**Hiện:** API Project OS + launches sống. UI DA = tab RE cũ (tạo «tên»).  
**Gap:** không tab Tòa/Đợt/Mốc/Pháp lý/Plan; form thiếu cổng.  
**Sóng:** W2.

---

### 3.3. `truong_sp` — Trưởng sản phẩm

**Owns:** SKU căn, pool `inhouse|channel`, stacking, khóa vận hành, materialize giỏ, gửi draft giá.  
**Cấm:** activate CSBH, exclusive, duyệt hold.

**Nhà:** Dự án → Tồn kho / Sản phẩm; giỏ từ tồn kho.

**Ngày điển hình**

1. Import / sửa căn. Hai người không đè: `row_version` + 409.  
2. Đổi pool theo đợt.  
3. Khóa căn vận hành.  
4. Job giỏ ≤ 15 phút sau rule hạng.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| SP-01 | Import CSV + list + sửa unit |
| SP-02 | Lưới stack tòa×tầng |
| SP-03 | Đổi pool + lock/unlock |
| SP-04 | Conflict 409 `row_version` trên FE |
| SP-05 | Materialize / thu hồi giỏ từ tồn kho |

**Hiện:** API inventory/stack/import/lock + basket units. UI tab RE cũ, không gọi stack BĐS.  
**Sóng:** W2.

---

### 3.4. `cv_gia` — Chuyên viên bảng giá

**Owns:** soạn price list + CSBH **nháp**.  
**Cấm:** `activate` (chỉ GĐKD).

**Nhà:** `/crm/bds/policies` (mới) hoặc tab CSBH trên DA.

**Ngày điển hình:** soạn list + CSBH → gửi GĐKD. Quote thử `one_price`.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| GI-01 | CRUD policy draft + price-list + items |
| GI-02 | Quote `net_price_vnd` (không lệch list) |
| GI-03 | Không hiện nút Activate (cap `approve` = GĐKD) |

**Hiện:** API policies/price-lists. UI không có.  
**Sóng:** W2.

---

### 3.5. `gdkd` — Giám đốc khối KD

**Owns:** war-room, duyệt hold F1, activate CSBH, exclusive, KPI đợt.  
**Cấm:** cổng HĐMB, phiếu thu, import, Sở XD.

**Nhà:** Tổng quan + Hold + Ra quân + Việc `hold_f1_approve`.

**Ngày điển hình**

1. 08:30 hub + Việc F1. Duyệt / từ chối (2h chiến lược / 8h thường).  
2. Ngày launch: war-room 3 cột + chip đang xem nhà.  
3. Activate giá khi SP + PC (C) xong draft.  
4. Không vào `/crm/sales`.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| KD-01 | Activate / archive CSBH |
| KD-02 | Inbox F1 trên Hold + Việc, SLA 2h/8h |
| KD-03 | Approve / reject hold + lý do |
| KD-04 | Open/close launch + war-room |
| KD-05 | Override hạng (audit) |
| KD-06 | Nav ẩn B2B; landing `/crm/bds` |

**Hiện:** API approve/activate/launch sống. UI launches sống. Hold stub. Nav B2B còn.  
**Sóng:** W1 (Hold), W2 (Activate), W6 (ẩn B2B).

---

### 3.6. `truong_inhouse` — Trưởng gallery / Inhouse

**Owns:** chia lead inhouse, ca gallery, hold pool `inhouse`, huddle với GĐKD.  
**Cấm:** giỏ exclusive F1, duyệt hold sàn, phiếu thu.

**Nhà:** Hold + Lead board + Chat `ban_kd` + HR ca (đọc).

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| IH-01 | Xem / gán lead inhouse trên board |
| IH-02 | Xem ca roster (v1 hiện; v1.1 chặn hold ngoài ca) |
| IH-03 | Giám sát hold IH + conflict 409 |
| IH-04 | Huddle chat `ban_kd` |

**Hiện:** Chat/ticket sống. Hold/lead stub. Ca không gắn BĐS.  
**Sóng:** W1 (hold/lead), W5 (board), W8 (roster KPI).

---

### 3.7. `tvv_inhouse` — TVV tự doanh

**Owns:** chăm lead gán, xem nhà, hold auto pool inhouse, tạo cọc, đưa ký.  
**Cấm:** giỏ F1 exclusive, duyệt hold sàn, thu ngoài phiếu Collection.

**Nhà:** Hold + Lead + Giao dịch (cọc) + Chat.

**Ngày điển hình**

1. Lead gán / board. Đặt visit.  
2. Hold (TTL). 409 → đổi căn, không «giữ miệng».  
3. Chốt → convert-deposit. Collection nhận lịch 4h.  
4. Đưa KH ký khi PC + Collection mở cổng.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| TV-01 | List lead gán + qualify (nếu kiêm CSKH) |
| TV-02 | Đặt visit |
| TV-03 | Tạo hold: `lead_id`, `row_version`, note; hiện 201/409 |
| TV-04 | Hủy hold của mình |
| TV-05 | Convert-deposit / reservation |
| TV-06 | Xem cổng HĐMB (không tự mở) |
| TV-07 | Chat `ban_kd` + ticket gắn hold/TX |

**Hiện:** API đủ. UI Hold/TX/Lead **stub** — TVV không bán được trên web.  
**Sóng:** W1 (ưu tiên số 1).

---

### 3.8. `truong_kenh` — Trưởng ban kênh

**Owns:** onboard đại lý, HĐ phân phối, cấp/thu hồi giỏ, hạng, AM, đào tạo.  
**Cấm:** activate giá, pool inhouse, cổng HĐMB, sửa ledger HH.

**Nhà:** `/crm/bds/agencies`, `/crm/bds/tiers`, `/crm/bds/leaderboard`, giỏ.

**Cổng:** chưa HĐ phân phối → không cấp giỏ.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| KN-01 | CRUD đại lý + activate / suspend |
| KN-02 | Gắn HĐ phân phối (PC = C) |
| KN-03 | Cấp / thu hồi unit giỏ |
| KN-04 | Cấu hình bậc + quota |
| KN-05 | Recalc hạng + BXH |
| KN-06 | Gán AM |

**Hiện:** API đủ. UI Mạng = list mã/tên; Hạng placeholder; BXH sống.  
**Sóng:** W2.

---

### 3.9. `am_kenh` — AM đại lý

**Owns:** đại lý được gán, inbox hold F1 của agency, nhắc TTL, đào tạo.  
**Cấm:** pool inhouse, sửa scheme HH, cổng HĐMB.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| AM-01 | Xem đại lý + giỏ được gán |
| AM-02 | Tạo hold F1 (`channel_partner_id`) → pending |
| AM-03 | Bổ sung hồ sơ hold trước GĐKD duyệt |
| AM-04 | Cảnh báo expire / hủy |
| AM-05 | Quote giá một giá (không cộng phí) |

**Hiện:** API create hold + basket. UI không form.  
**Sóng:** W1 (hold F1), W2 (chi tiết DL).

---

### 3.10. `cskh_lead` — CSKH trước bán

**Owns:** first-touch 15p, qualify, lịch xem, nhắc TTL, `lost_reason`.  
**Cấm:** hold (trừ kiêm TVV), thu, soạn HĐ. Deal Room cấm.

**Nhà:** board `flow=re_buyer` + Việc `cskh_first_touch` + Lead 360.

**Ngày điển hình**

1. Board cột: DA, căn, TTL, stage TX, SLA.  
2. Gọi ≤ 15p → `touch`.  
3. Qualify: nhu cầu, ngân sách, pháp lý KH.  
4. Đặt visit → Inhouse hoặc AM.  
5. Hold sắp hết → nhắc TVV/AM, không tự gia hạn.  
6. Lost: giá / pháp lý / vay / đối thủ / không liên hệ.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| CS-01 | Board `re_buyer` + cột căn/hold/TX |
| CS-02 | Ticket first-touch deep-link board ↔ Việc |
| CS-03 | Qualify + touch + lost_reason |
| CS-04 | Đặt visit + CAPI Schedule (W7) |
| CS-05 | Matches căn |
| CS-06 | 404 Deal Room |

**Hiện:** API buyer + hook ticket. UI `/crm/bds/leads` placeholder. Board CSKH không filter BĐS.  
**Sóng:** W1 (list/qualify/visit tạm), W5 (board + 360).

---

### 3.11. `truong_mkt` — Trưởng Marketing

**Owns:** plan MKT dự án, map ad account, ads/form, CAPI, kit `visibility=agency`, claim (PC duyệt).  
**Cấm:** giá, giỏ, hold, HĐ, thu.

**Nhà:** plan trên Dự án; Ads/lead config; hub ROAS (đọc).

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| MK-01 | Plan `marketing` + duyệt trên DA |
| MK-02 | Bắt map ad trước khi bật CAPI |
| MK-03 | Ingest lead `re_buyer` + UTM |
| MK-04 | CAPI Lead / Schedule / Purchase = `net_price_vnd` + retry |
| MK-05 | Kit agency trước launch 3 ngày |
| MK-06 | ROAS spend / GMV căn — không CPA HĐ agency |
| MK-07 | Ẩn `/crm/marketing-plan` agency với CĐT |

**Hiện:** ingest UTM + stub `bds_capi_events`. Không HTTP Meta. Plan API không UI.  
**Sóng:** W2 (plan UI), W7 (CAPI + ROAS).

---

### 3.12. `truong_pc` — Trưởng pháp chế

**Owns:** kho hồ sơ, `legal_gate`, mẫu VBTT/HĐMB, giải chấp, HĐ kênh (C), claim MKT.  
**Cấm:** mở đợt, phiếu thu, hold, HH.

**Nhà:** Dự án → Pháp lý; Giao dịch (cổng).

**Cổng A:** đủ điều kiện bán; **A pháp lý** trên HĐMB.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| PC-01 | Kho `legal-docs` theo `doc_type` |
| PC-02 | Bật `legal_gate` trong 1 ngày sau văn bản Sở |
| PC-03 | Mẫu VBTT/HĐMB |
| PC-04 | Check VBTT trên TX |
| PC-05 | Xem `hdmb-gate` (cột pháp lý) — không sửa `%` |
| PC-06 | C trên HĐ phân phối kênh |
| PC-07 | Duyệt claim kit MKT |

**Hiện:** API legal-docs/gate + vbtt/contract/hdmb-gate. UI kho không có; TX stub.  
**Sóng:** W1 (wizard TX + lý do 400), W2 (tab Pháp lý).

---

### 3.13. `cv_hd` — CV hợp đồng

**Owns:** soạn/check VBTT–HĐMB trước khi Trưởng PC chốt cổng.  
**Cấm:** `legal_gate` dự án (Trưởng PC), phiếu thu.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| HD-01 | List TX theo DA, lọc `reservation|deposit|vbtt` |
| HD-02 | POST vbtt + xem thiếu mẫu (400 rõ) |
| HD-03 | GET hdmb-gate 2 cột (PC / Collection) |
| HD-04 | POST contract khi cả hai cổng xanh — hoặc hiện 400 |

**Hiện:** API đủ. UI stub.  
**Sóng:** W1.

---

### 3.14. `truong_collection` — Trưởng công nợ

**Owns:** lịch TT, phiếu thu, aging, vay, `paid_pct`, hoàn giữ chỗ, export kỳ.  
**Cấm:** sổ ERP, trả HH, cổng pháp lý.

**Nhà:** `/crm/bds/collections` → sau này Tài chính BĐS hub.

**Cổng A:** `%` trên HĐMB. SLA lịch **≤ 4h** sau cọc.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| CL-01 | Việc `collection_schedule` sau cọc |
| CL-02 | Sinh / xác nhận lịch installment |
| CL-03 | POST phiếu thu → aging + `paid_pct` |
| CL-04 | Aging + overdue >30n lên hub |
| CL-05 | Báo `ready_for_hdmb` khi đủ % |
| CL-06 | Export CSV / webhook ERP (không hạch toán) |
| CL-07 | Finance hub: GMV + thu + overdue + HH (đọc HH) |

**Hiện:** API receipts/aging/export. UI placeholder.  
**Sóng:** W1 (phiếu + aging + export), W7 (hub CFO).

---

### 3.15. `cv_hh` — CV hoa hồng

**Owns:** scheme × hạng × DA × đợt, accrue T+0, statement, tạm ứng, chi, clawback.  
**Cấm:** sửa GMV căn, lương cứng (trừ flag).

**Nhà:** `/crm/bds/commissions`.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| HH-01 | Wizard scheme + tier + split + activate **trước** CSBH |
| HH-02 | Ledger tự sinh theo mốc TX |
| HH-03 | Lock / approve / pay statement |
| HH-04 | Tạm ứng + clawback khi hủy/hạ tầng |
| HH-05 | Recalc hạng (phối hợp Kênh) |
| HH-06 | Ẩn % scheme với CTV (chỉ `amount_vnd`) |

**Hiện:** API đủ. UI chỉ bảng ledger.  
**Sóng:** W3. Payroll map = ngoài (U7).

---

### 3.16. `truong_after` — Trưởng CSKH sau bán

**Owns:** intake `contracted`, hẹn BG 15N, waive checklist, sổ hồng, SLA after.  
**Cấm:** ký HĐMB, mốc XD, đợt thu.

**Nhà:** `/crm/bds/aftersales`.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| AF-01 | Board after + auto row khi TX contracted |
| AF-02 | Hẹn BG 15 ngày trước (phụ thuộc mốc PM + đợt thu cuối) |
| AF-03 | Waive checklist + lý do + cap approve |
| AF-04 | Sổ: Nộp → Cấp → Giao KH |
| AF-05 | Giám sát defect (không SPA) |

**Hiện:** Board UI sống (checklist / handover / title / defect).  
**Gap:** chưa auto intake + hẹn 15N.  
**Sóng:** W5 (hook intake), phần còn lại đã dùng được.

---

### 3.17. `cv_ban_giao` — CV bàn giao

**Owns:** checklist 4 mục, biên bản, tạo defect sau handover.  
**Cấm:** waive (trừ được cấp), đổi `title_status` nếu policy chỉ Trưởng.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| BG-01 | Pass/fail Nước / Điện / Nội thất / Biên bản |
| BG-02 | Bàn giao khi 4 pass (hoặc trưởng waive) |
| BG-03 | Defect sau `handed_over` |
| BG-04 | Cập nhật sổ theo bước được phép |

**Hiện:** UI aftersales sống.  
**Sóng:** giữ; W5 chỉ auto row.

---

### 3.18. `hr_bp` — HR BP

**Owns:** user, chức vụ, cap, phép, ca, `acting_for`, offboard.  
**Cấm:** logic giá / hold / HH.

**Nhà:** `/admin/crm/org/users`, HR Hub, Ma trận quyền.

**Cổng G0:** thiếu 5 A → banner + chặn ra quân.

**Tính năng phải có**

| Mã | Tính năng |
|----|-----------|
| HR-01 | Tạo user + ban + chức vụ → cap + room + queue |
| HR-02 | Seed / hiện 12 ban · 18 chức vụ (`pack=bds`) |
| HR-03 | Banner thiếu 5 A |
| HR-04 | Roster ca `ban_kd` |
| HR-05 | Offboard: disable; hold **chưa cọc** mở; hold **đã cọc** giữ; ticket về trưởng; chat cắt |
| HR-06 | KPI pack `bds`: GMV HĐMB, hold→cọc, first-touch |
| HR-07 | Cấm gán một user `truong_pc` + `truong_collection` cùng DA |

**Hiện:** seed org + org UI generic. Offboard không mở hold.  
**Sóng:** W0 (cap mặc định theo chức vụ), W8 (offboard + KPI + banner G0).

---

## 4. Ma trận cap mặc định (W0 seed)

Gán khi user nhận chức vụ. Super-admin vẫn tick tay được. Không gán `bds_transactions.edit` cho TVV trên cổng HĐMB — TVV `create` (cọc); PC/CV HĐ `edit` (vbtt/contract).

| Chức vụ | Cap ghi (ngoài `view` tương ứng) |
|---------|----------------------------------|
| `tgd` | `bds_tenant.view`; view: hub, holds, launches, tx, collections, project_os, aftersales; `staff_tickets.view` |
| `gdkd` | `bds_holds.approve/cancel`; `bds_policies.approve`; `bds_launches.open`; `bds_agency_tiers.override`; `bds_transactions.view`; `bds_buyers.view` |
| `pm_du_an` | `bds_project_os.edit/approve`; `bds_launches.create/open`; `bds_legal.view`; `bds_inventory.view` |
| `truong_sp` | `bds_inventory.*`; `bds_policies.create/edit`; `bds_baskets.create/edit` |
| `cv_gia` | `bds_policies.create/edit`; `bds_inventory.view` |
| `truong_inhouse` | `bds_holds.create/cancel`; `bds_buyers.edit`; `bds_transactions.create`; chat + tickets |
| `tvv_inhouse` | `bds_holds.create`; `bds_buyers.view`; `bds_transactions.create`; `staff_chat.view` |
| `truong_kenh` | `bds_agencies.*`; `bds_baskets.*`; `bds_agency_tiers.configure`; `bds_holds.create`; `bds_commission.view` |
| `am_kenh` | `bds_agencies.edit`; `bds_baskets.view`; `bds_holds.create`; `bds_buyers.view` |
| `cskh_lead` | `bds_buyers.edit/view_pii`; tickets + chat |
| `truong_mkt` | `bds_buyers.view`; `bds_project_os.view`; `bds_launches.view` |
| `truong_pc` | `bds_legal.*`; `bds_transactions.edit`; `bds_agencies.view` |
| `cv_hd` | `bds_legal.view`; `bds_transactions.edit` |
| `truong_collection` | `bds_collections.*`; `bds_transactions.view` |
| `cv_hh` | `bds_commission.*` |
| `truong_after` | `bds_aftersales.*` |
| `cv_ban_giao` | `bds_aftersales.view/edit` |
| `hr_bp` | cap HR nền + `bds_tenant.view` (banner G0) |

W0 chỉ ghi cap `bds_*` (khớp `BDS_CAP_CATALOG`). `staff_chat` / `staff_tickets` giữ seed P11/P12 khi flag bật — không trộn vào bảng trên.

Mọi chức vụ CĐT: không `crm_sales` / Deal Room khi `PTT_BDS_NAV_HIDE_B2B=1`.

---

## 5. Handoff chức vụ × SLA

| Từ | Tới | Việc | SLA | Ticket / sự kiện |
|----|-----|------|-----|------------------|
| `hr_bp` | 5 A | Roster G0 | Trước ra quân | Banner + chặn open |
| `truong_pc` | `pm_du_an`, `gdkd` | `legal_gate` | 1 ngày sau văn bản | `legal_gate` |
| `cv_gia` | `gdkd` | Draft giá | Trước launch | policy draft |
| `truong_sp` | `truong_kenh` | Giỏ materialize | ≥ 3 ngày trước launch | basket job |
| `truong_mkt` | `cskh_lead` | Lead mới | **15 phút** | `cskh_first_touch` |
| `cskh_lead` | `tvv_inhouse` / `am_kenh` | Visit + lead qualified | Trong ca | visit |
| `tvv_inhouse` | — | Hold IH | TTL đợt | hold active |
| `am_kenh` | `gdkd` | Hold F1 | **2h / 8h** | `hold_f1_approve` |
| `tvv_inhouse` / AM | `truong_collection` | Cọc | **4h** lịch | `collection_schedule` |
| `cv_hd` | `truong_pc` | VBTT check | Trước ký | tx vbtt |
| `truong_collection` | `truong_pc` + `gdkd` | Đủ % | 1 ngày | `ready_for_hdmb` |
| `truong_pc` + CL | After + `cv_hh` | HĐMB | 1 ngày | `contracted` |
| `pm_du_an` | CL + After | Mốc `reached` | Ngày reached | milestone |
| `truong_after` | KH + CL | Hẹn BG | 15 ngày trước | appointment |
| `hr_bp` | `truong_inhouse` | Offboard TVV | Ngay | `staff.offboarded` |

Escalate: AM → Trưởng → GĐKD → TGĐ. Không Zalo duyệt.

---

## 6. Sóng thực thi — ai được mở khóa

| Sóng | Tên | Chức vụ dùng được việc nhà | Phụ thuộc |
|------|-----|----------------------------|-----------|
| **W0** | Cap mặc định theo chức vụ | Mọi user: menu đúng §4 | Seed org |
| **W1** | FE lõi chu trình bán | `tvv_inhouse`, `gdkd` (F1), `am_kenh`, `cskh_lead` (tạm), `cv_hd`, `truong_collection` | API P2/P4/P4b/P6 |
| **W2** | FE dự án / giá / kênh / pháp lý | `pm_du_an`, `truong_sp`, `cv_gia`, `truong_kenh`, `truong_pc`, `gdkd` (activate) | API P1/P1b/P3/P5 |
| **W3** | FE hoa hồng | `cv_hh` | API P7 |
| **W4** | U0 spine outbox | Nền cho W5–W8 | PACK |
| **W5** | U1+U2 người mua 360 + board `re_buyer` + after intake | `cskh_lead`, `truong_after` đủ SOP | W4 |
| **W6** | U3 ẩn B2B + U8 war-room 4 widget | `tgd`, `gdkd` sạch KPI | W5 |
| **W7** | U4 finance hub + U5 CAPI | `truong_collection` CFO, `truong_mkt` | W1, ad map |
| **W8** | U6 HR offboard + KPI 3 mã + banner G0 | `hr_bp` | W4, tickets, chat |

Thứ tự bắt buộc: W0 → W1 → W2/W3 song song → W4 → W5 → W6 → W7 → W8.  
U7 payroll **không** vào các sóng này.

**Thắng demo 90 phút** (sau W5+W1): khớp unification §16 — ads→board, 409 hold, F1 trên Việc, cọc+thu, 360, offboard (W8).

---

## 7. Tiêu chí «xong» từng sóng

| Sóng | Xong khi |
|------|----------|
| W0 | User `tvv_inhouse` login chỉ thấy Hold/Lead/Chat; `truong_pc` không thấy nút phiếu thu |
| W1 | TVV tạo hold + 409; GĐKD duyệt F1 trên `/crm/bds/holds`; Collection ghi phiếu; CV HĐ thấy lý do 400 cổng |
| W2 | PM `reached` mốc trên UI; SP import+stack; CV giá draft; GĐKD activate; Kênh cấp giỏ; PC gắn văn bản |
| W3 | CV HH lock/approve/pay một kỳ trên UI |
| W4 | Event hold/tx replay, idempotent |
| W5 | Board `re_buyer` 15p; Deal Room 404; after auto row |
| W6 | Tenant CĐT: `/crm/sales` 403; hub có CSKH breach + thu hôm nay |
| W7 | Purchase value = `net_price_vnd`; finance hub 4 số khớp |
| W8 | Offboard TVV: hold trống mở, hold đã cọc giữ (U-07/U-08) |

---

## 8. Ngoài phạm vi (nhắc lại)

- U7 payroll map.  
- PWA 3 màn.  
- ERP / Ban XD / BQL tòa / eSign.  
- Viết lại hold/TX/collection API (đã production-ready).

---

*Duyệt spec này rồi coding theo [`../plans/2026-08-23-bds-os-coding.md`](../plans/2026-08-23-bds-os-coding.md). **W0:** [`../plans/2026-08-23-bds-w0-caps.md`](../plans/2026-08-23-bds-w0-caps.md). **W1:** [`../plans/2026-08-23-bds-w1-fe.md`](../plans/2026-08-23-bds-w1-fe.md). Đổi RACI / cap / thứ tự sóng = sửa spec trước khi sửa code.*
