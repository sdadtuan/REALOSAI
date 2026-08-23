# UX/UI hoàn chỉnh — CRM OS BĐS

**Ngày:** 2026-08-23  
**Trạng thái:** Chờ duyệt  
**Phạm vi:** Toàn **OS BĐS CĐT + sàn** trên ops-web (không viết lại Meta/SEO/B2B).  
**Không thay:** Q1–Q48.  
**Đọc cùng:**  
- UX nền (pattern cũ): [`2026-08-22-bds-ux-ui-design.md`](./2026-08-22-bds-ux-ui-design.md) — **file này thắng** khi mâu thuẫn (cổng HĐMB, nav, màn mới).  
- Chức vụ × sóng: [`2026-08-23-bds-role-feature-execution.md`](./2026-08-23-bds-role-feature-execution.md)  
- UC: [`../../use-cases/13-BDS-INDUSTRY-PACK.md`](../../use-cases/13-BDS-INDUSTRY-PACK.md) + [`../../use-cases/13-BDS-ROLE-JOURNEYS.md`](../../use-cases/13-BDS-ROLE-JOURNEYS.md)  
- Actions: [`../../use-cases/actions/13-BDS-ROLE-ACTIONS.md`](../../use-cases/actions/13-BDS-ROLE-ACTIONS.md)

**Sửa so với UX 2026-08-22:** Nút **Ký HĐMB** chỉ hiện với `bds_transactions.edit` (PC / CV HĐ). GĐKD **xem cổng**, không submit. Không «Ký anyway».

---

## 1. Hệ thống — nguyên tắc + vỏ

### 1.1. Nguyên tắc (toàn OS)

| # | Nguyên tắc | Hệ quả UI |
|---|------------|-----------|
| 1 | Một giá trị một nơi | Không nút duyệt HĐMB / phiếu thu trong chat |
| 2 | Ngoài scope = 404 | Sàn mở pool inhouse / room CĐT → trang «Không tìm thấy» |
| 3 | Cổng hiện trước khi bấm | Nút HĐMB disabled + 2 cột thiếu gì; API vẫn 400 |
| 4 | TTL nhìn thấy | Countdown trên hàng hold + drawer căn + war-room |
| 5 | Handoff có mặt | Mỗi cổng: ticket + card chat (flag ON) |
| 6 | Tiếng Việt nghiệp vụ | Giữ chỗ · cọc · VBTT · HĐMB · sổ hồng. Không Deal/SPA/Closing trên CĐT |
| 7 | Skin mode | CĐT hub · Sàn giỏ · Hybrid = CĐT + «Sàn nội bộ» |
| 8 | Một nhà / chức vụ | Sidebar **chỉ** mục có cap. Không hiện disabled hàng loạt |
| 9 | `re_buyer` | 404 Deal Room; board `flow=re_buyer` |
| 10 | Ẩn B2B | Tenant `developer`: không `/crm/sales`, không marketing-plan agency |

### 1.2. Shell

```
┌ Top bar: logo · tenant · badge CĐT|Sàn|Hybrid · [Dự án ▾] · chuông · user
├ Sidebar: nhóm BĐS (mục theo cap) · (CĐT: không nhóm Sales B2B)
└ Content
   ├ Page header: H1 + subtitle + primary CTA (ẩn nếu không cap)
   ├ Filter / project chip
   └ Body (list | board | stack | hub)
Drawer phải 480px: căn | hold | lead — TX / pháp lý / after = full page
```

**Chuông (3 loại, max 20):** hold TTL ≤2h · ticket `sla_breached` · mention. Click → màn nguồn + `?hold=` / `?ticket=`. Sàn không thấy chuông room/ticket CĐT.

**Project switcher:** CĐT/hybrid. Ghi `sessionStorage['bds-project-id']`. Mọi list Hold/TX/Lead/Thu đọc chip này. Sàn: ẩn switcher.

### 1.3. IA — Nav CĐT (đủ OS)

Cap ẩn mục. Thứ tự cố định:

```
BĐS
├── Tổng quan                 /crm/bds                    bds_tenant.view | any hub
├── Dự án                     /crm/re-projects            crm_re_projects | bds_inventory | bds_project_os
├── Lead khách mua            /crm/bds/leads              bds_buyers.view
├── Hold                      /crm/bds/holds              bds_holds.view
├── Giao dịch                 /crm/bds/transactions       bds_transactions.view
├── Ra quân                   /crm/bds/launches           bds_launches.view
├── Chính sách giá            /crm/bds/policies           bds_policies.view
├── Mạng                      /crm/bds/agencies           bds_agencies.view
├── Hạng                      /crm/bds/tiers              bds_agency_tiers.view
├── Bảng xếp hạng             /crm/bds/leaderboard        bds_agency_tiers.view
├── Công nợ                   /crm/bds/collections        bds_collections.view
├── Tài chính BĐS             /crm/bds/finance            bds_collections.view | bds_commission.view | tgd
├── Hoa hồng                  /crm/bds/commissions        bds_commission.view
├── Sau bán                   /crm/bds/aftersales         bds_aftersales.view
├── Việc                      /crm/work                   staff_tickets.view
└── Chat                      /crm/chat                   staff_chat.view
```

Trong dự án `/crm/re-projects/:id` — tab:

`Tổng quan · Pháp lý · Tòa/khu · Đợt · Giá/CSBH · Tồn kho · Stack · Mốc · Kế hoạch · Nhân sự`

Nav sàn: Giỏ · Lead · Hold · Hoa hồng · Chat.  
Hybrid: nav CĐT + **Sàn nội bộ** `/crm/bds/basket`.

**Landing sau login**

| Mode / chức vụ | Redirect |
|----------------|----------|
| broker | `/crm/bds/basket` |
| developer + có hub | `/crm/bds` |
| developer + chỉ after | `/crm/bds/aftersales` |
| developer + chỉ collection | `/crm/bds/collections` |
| developer + chỉ buyers | `/crm/cskh-board?flow=re_buyer` (W5) tạm `/crm/bds/leads` |
| Flag UI=0 | UX cũ, không section BĐS |

### 1.4. Pattern toàn cục

**Trạng thái căn:** `Trống · Giữ · Giữ chỗ · Đã cọc/VBTT · HĐMB · Khóa` — luôn kèm chữ, không chỉ màu.

**Toast 201 hold:** «Đã giữ {mã} · hết hạn {HH:mm}» + link drawer.  
**409:** inline «Căn đã có giữ chỗ — chọn căn khác.»  
**400 cổng:** modal 2 cột (§1.5).  
**400 one_price:** «Giá phải khớp CSBH CĐT. Không được kê.»

**Entity chip:** `A-1204` · `Hold #` · `TX #` · `Lead`. Click mở drawer nếu có quyền; không → «Hồ sơ ẩn».

**SLA bar:** xanh <50% thời gian · vàng · đỏ breach. Ticket + hold F1 + first-touch dùng cùng component.

**Form lỗi:** field đỏ + câu tiếng Việt + `code` nhỏ (`paid_pct`).

### 1.5. Modal cổng kép HĐMB — SCR-BDS-061

Title: **Chưa đủ điều kiện ký HĐMB**  
Cột trái — Pháp chế: Sở XD · bảo lãnh/waive · giải chấp · mẫu HĐ.  
Cột phải — Công nợ: `paid_pct` / `hdmb_min_paid_pct` · link phiếu.  
CTA: **Đóng** · **Mở việc cổng** · **Chat x_pc_collection**. **Không** «Ký anyway».

Khi đủ 2 cột xanh: nút **Ký HĐMB** enable trên trang TX (chỉ `edit`).

### 1.6. Empty / first-run

| Tình huống | Copy | CTA |
|------------|------|-----|
| Chưa 5 A | «Thiếu {danh sách chức vụ}. HR gán trước khi ra quân.» | Org users |
| Chưa đợt | «Chưa mở đợt. PM tạo sau khi Pháp chế đủ hồ sơ.» | Tab Đợt |
| Giỏ trống | «CĐT chưa cấp căn. Liên hệ AM.» | — |
| Queue trống | «Không có việc inbound.» | — |
| Hold trống | «Chưa có giữ chỗ trên dự án này.» | **Giữ chỗ** nếu cap create |
| Aging trống | «Không có khoản quá hạn.» | — |

### 1.7. Responsive

| ≥1280 | Hub 4 hàng; stack đủ cột; drawer 480 |
| 768–1279 | KPI 2×2; stack scroll ngang |
| <768 / PWA v1 | Chỉ lead + hold + giỏ. Không war-room, không pháp lý, không collection |

### 1.8. A11y

Nhãn trạng thái bằng chữ. Focus ring trên CTA. Countdown có `aria-live="polite"`. Modal cổng focus trap.

---

## 2. Từng module — màn, layout, CTA, trạng thái

Mỗi module: **nhà** · **SCR** · **layout** · **CTA × cap** · **state** · **UC**.

---

### 2.1. Tổng quan — SCR-BDS-001 · `/crm/bds`

**Mục đích:** Điều hành ngày. Không dashboard ads.

**Layout 4 hàng (W6 đủ 6 ô; v1 = 4 ô API hiện có):**

1. KPI: tiêu thụ đợt · GMV **HĐMB** tháng · overdue >30n · hold hết hạn 2h.  
2. (W6) CSKH breach 15p · phiếu thu hôm nay.  
3. Inbox max 8: F1 pending · HĐMB kẹt cổng · launch open · ticket P0.  
4. Sell-through tòa (bar) + đại lý (5 dòng).  
5. Lối tắt: Ra quân · Hold · Công nợ · Huddle nếu launch open.

**CTA:** không «Tạo dự án». Click KPI → màn nguồn.

**State:** loading skeleton 4 ô · lỗi «Không tải được hub» + thử lại. Broker: không render — redirect giỏ.

**Ai:** TGĐ (A), GĐKD (A), PM (I). Ban khác I nếu có cap view.

**UC:** BDS-UC-001 · BDS-R-01 · BDS-R-05.

---

### 2.2. Dự án + Project OS — SCR-BDS-002…011

| SCR | URL | Việc |
|-----|-----|------|
| 002 | `/crm/re-projects` | List: tên, `legal_gate`, đợt, sell-through, PM |
| 003 | `/crm/re-projects/:id` | Tổng quan: gate, mốc, tòa, RACI |
| 004 | modal / form tạo | Mã, tên, CĐT, `one_price`, `hdmb_min_paid_pct` — **không** chỉ «tên» |
| 010 | tab Pháp lý | Kho docs + **Mở cổng đủ ĐK bán** |
| 011a | tab Tòa/khu | CRUD tower/zone/layout |
| 011b | tab Đợt | planned/active/closed · open/close |
| 011c | tab Mốc | list + **Đạt mốc** |
| 011d | tab Kế hoạch | revision + **Duyệt** |

**CTA × cap**

| Nút | Cap | Ai |
|-----|-----|-----|
| Dự án mới | project_os.edit / crm_re_projects | PM |
| Tải văn bản / Mở cổng | bds_legal.edit / approve | PC |
| Tòa / đợt | project_os.edit | PM |
| Đạt mốc | project_os.edit | PM |
| Duyệt plan | project_os.approve | PM |
| Mở đợt | launches.open + legal | PM; disabled + tooltip nếu G0/G1/G2 thiếu |

**Empty 002:** «Chưa có dự án.» + CTA nếu PM. Broker: «Dùng giỏ hàng» (BDS-19).

**UC:** 004–008, 022, 072 (mốc UI), D-02.

---

### 2.3. Tồn kho / stack — SCR-BDS-020 / 021

**020** tab Tồn kho: bảng unit, filter status/pool/tòa, **Import CSV**, khóa.  
**021** `/stack`: ma trận tầng × căn. Click → drawer.

**Drawer căn:** mã, pool, list/net (ẩn net CTV), hold + TTL, `row_version` ẩn.  
CTA: **Giữ chỗ** · **Khóa** · **Đổi pool** theo cap.

**Import:** báo cáo dòng lỗi, không partial silent. 409 `row_version`: «Người khác vừa sửa căn. Làm mới.»

**UC:** 010–013.

---

### 2.4. Chính sách giá — SCR-BDS-030 / 032 · `/crm/bds/policies`

**List:** draft / active / archived · dự án · người soạn.  
**Soạn (CV giá):** price list + items + CSBH. Nút **Gửi duyệt** (vẫn draft).  
**Activate** chỉ `bds_policies.approve` (GĐKD). Confirm: «Một giá khóa. Kênh không cộng phí.»  
**Quote thử:** nhập căn → `net_price_vnd`.

CV giá **không** thấy Activate. GĐKD không soạn (trừ kiêm).

**UC:** 009 · R-04 · R-05.

---

### 2.5. Lead + board + 360 — SCR-BDS-040 / 041 / 042

| SCR | URL | Khi |
|-----|-----|-----|
| 040 | `/crm/bds/leads` | W1: list + qualify/touch/visit |
| 042 | `/crm/cskh-board?flow=re_buyer` | W5: nhà CSKH |
| 041 | `/crm/leads/:id` skin `re_buyer` | W5: 360 ads→sổ |

**040 W1:** bảng tên, SĐT (view_pii), stage, `touched_at`, dự án. CTA **Chạm** · **Qualify** · **Đặt xem** · **Mất** (reason bắt buộc). Không tab Deal Room.

**042 W5 kanban:** Mới · Đã chạm · Qualify · Hẹn xem · Hold · Cọc · Lost. Cột thêm: căn, TTL hold, stage TX, SLA 15p (badge đỏ).

**041 360 tabs:** Ads/UTM · Liên hệ · Visit · Hold · TX · Thu · Sổ. **Không** Deal Room / proposal.

**UC:** 003, 031–033, 063, 064 · R-10.

---

### 2.6. Hold — SCR-BDS-050 · `/crm/bds/holds`

**Tabs:** Chờ duyệt F1 · Đang giữ · Hết hạn / hủy.  
Inhouse **không** vào tab F1.

**Hàng:** căn, lead, pool/đại lý, status, TTL, note.  
**Form tạo (create):** `product_id`, `lead_id`, `row_version`, `channel_partner_id` (AM), note.  
**Duyệt / Từ chối** (`approve`) trên `pending`. Từ chối: lý do ≥ 3 ký tự.  
**Hủy** (`cancel`) trên active/pending của mình hoặc trưởng.

`?hold=` highlight. Link **Việc** nếu tickets ON.

**UC:** 013–016 · R-07 · R-05 · R-09.

---

### 2.7. Giao dịch — SCR-BDS-060 · `/crm/bds/transactions`

**List:** stage, căn, `paid_pct`, `net_price_vnd`. Filter stage.  
**Chi tiết (chọn hàng hoặc `?tx=`):** timeline · lịch TT · phiếu · **cổng 2 cột** · file.

**CTA theo stage × cap**

| Stage | Nút | Cap |
|-------|-----|-----|
| hold active | **Cọc** / **Thu giữ chỗ** | transactions.create |
| deposit | **Ký VBTT** | transactions.edit |
| vbtt + gate xanh | **Ký HĐMB** | transactions.edit |
| mọi | **Hủy** + lý do | edit hoặc cancel policy |

GĐKD: thấy list + cổng (I), **không** Ký HĐMB.  
400 → modal 061 + `txGateCopy`.

**UC:** 017–021, 020 · R-13 · R-07.

---

### 2.8. Ra quân — SCR-BDS-070 · `/crm/bds/launches`

Trước mở: checklist giá khóa · giỏ F1 · pháp lý đợt · kit MKT · G0. Thiếu → **Mở** disabled + tooltip từng dòng.  
`open`: war-room 3 cột (giữ / hàng đợi / xung đột) poll 3s. TTL 180s trên hàng.  
W6: chip «đang xem nhà».

**UC:** 045–046 · R-02 · R-05.

---

### 2.9. Đại lý / hạng / giỏ — SCR-BDS-080…085, 200

| SCR | URL | Việc |
|-----|-----|------|
| 080 | `/crm/bds/agencies` | List mã, tên, hạng, AM, hold mở |
| 085 | `/crm/bds/agencies/:id` | KYC, HĐ, hạng, giỏ, quote, activate/suspend |
| 082 | `/crm/bds/tiers` | Bậc, quota, override + lý do |
| 083 | `/crm/bds/leaderboard` | Điểm kỳ |
| 200 | `/crm/bds/basket` | Giỏ tôi (sàn / hybrid) |

**085 CTA:** **Thêm HĐ** (PC C) · **Cấp căn** / **Thu hồi** · **Override hạng** (GĐKD) · **Tạm ngưng**.  
Cấp giỏ disabled nếu chưa HĐ. Exclusive disabled nếu hạng không đủ.  
Thu hồi: 400 `unit_in_flight` nếu đang hold/TX.

**UC:** 025–028, 060 · R-08 · R-09.

---

### 2.10. Công nợ + Tài chính — SCR-BDS-090 / 092

**090** `/crm/bds/collections`:  
Copy đầu trang: «Sổ thu căn — không phải hạch toán.»  
Form phiếu: TX, số tiền ≤ còn lại, ngày, note.  
Bảng aging buckets. **Xuất CSV** (`export`) — download blob.  
Việc `collection_schedule` deep-link `?tx=`.

**092** `/crm/bds/finance` (W7): 4 số GMV HĐMB · thu kỳ · overdue · HH accrue. Drill → 090 / 091.

**UC:** 036–038, 066 · R-14.

---

### 2.11. Hoa hồng — SCR-BDS-091 · `/crm/bds/commissions`

Tab: Scheme · Ledger · Kỳ · Tạm ứng.  
Scheme: wizard hạng × DA × đợt × split → **Activate** trước CSBH.  
Kỳ: **Khóa** · **Duyệt** · **Chi**. ±0đ với Kênh.  
CTV: chỉ `amount_vnd`, ẩn %.

**UC:** 048–049 · R-15.

---

### 2.12. Sau bán — SCR-BDS-100 · `/crm/bds/aftersales`

Hàng TX contracted (+ W5 auto). Cột: hẹn BG (đỏ nếu <15n), checklist 4/4, sổ, defect.  
CTA: pass/fail Nước Điện Nội thất Biên bản · **Bàn giao** · **Waive** (approve + lý do) · sổ Nộp/Cấp/Giao · **Defect** sau handover.

Không trộn `/crm/work` khách.

**UC:** 041–043 · R-16 · R-17.

---

### 2.13. Việc / Chat — SCR-BDS-120 / 110

**Việc:** Của tôi · Queue ban · Inbound · Outbound. Filter overdue. Artifact fail → toast cùng ngôn ngữ cổng.  
**Chat:** Phòng / Liên phòng / Dự án / Việc / Huddle / DM. Composer @user @ban + chip entity. Restricted: banner «Không chuyển tiếp».

**UC:** 051–059.

---

### 2.14. HR / Org — SCR-BDS-130

`/admin/crm/org/users` + Ma trận quyền.  
Banner G0 trên HR Hub và trên **Mở ra quân** nếu thiếu 5 A.  
Offboard confirm: «Hold chưa cọc sẽ mở. Hold đã cọc giữ. Ticket về trưởng.»

**UC:** 062, 068, 069 · R-18.

---

## 3. Từng phòng ban — workspace

Một ban = **landing + mục sidebar + việc không vào**. Chi tiết SOP: operating-cycle §5.

| Ban | Landing | Sidebar thấy | Không vào (trừ I) |
|-----|---------|--------------|-------------------|
| Điều hành | Tổng quan | Hub, Việc, đọc Hold/Thu/DA | Form phiếu, Activate, Ký HĐMB |
| Dự án | Dự án /:id | DA, Ra quân, Việc | Import, Activate, Thu |
| Sản phẩm | DA tab Tồn kho | DA, Policies (draft), Hạng đọc | Activate, duyệt F1 |
| KD Inhouse | Hold | Hold, Lead, TX (cọc), Chat, Việc | Giỏ F1 exclusive, phiếu thu |
| Kênh | Mạng | Mạng, Hạng, BXH, Hold F1, Giỏ | Pool IH, cổng HĐMB, sửa ledger |
| CSKH trước | Board / Lead | Lead, Việc inbound, Chat | Hold (trừ kiêm), Thu, HĐ |
| Marketing | DA tab Kế hoạch | DA plan, Lead đọc, Hub ROAS (W7) | Giá, giỏ, hold, HĐ, thu |
| Pháp chế | DA Pháp lý | Pháp lý, TX, Mạng (HĐ) | Mở đợt, phiếu, hold |
| Công nợ | Công nợ | Thu, TX đọc, Tài chính | Cổng pháp lý, chi HH |
| Hoa hồng | Hoa hồng | HH, Hạng đọc | Sửa GMV |
| CSKH sau | Sau bán | After, DA mốc đọc | Ký HĐMB, mốc XD |
| Nhân sự | Org / HR Hub | Org, KPI, (banner G0) | Hold, giá, HH |

Sàn (`broker`): landing Giỏ. Không Project OS.

---

## 4. Từng chức vụ — màn nhà (L3)

Cột **First paint** = 3 giây đầu sau login. **Primary CTA** = nút duy nhất màu primary trên nhà.

### 4.1. `tgd`

- First paint: SCR-001 KPI.  
- Primary: không — chỉ đọc + drill.  
- Vào: Hub, inbox, Việc override, DA đọc, pack HĐQT (W7).  
- Không: phiếu, Activate, Ký HĐMB, Import.  
- Empty hub: «Chưa có đợt mở. PM + GĐKD.»  
- UC: R-01, 001, 002.

### 4.2. `pm_du_an`

- First paint: list DA hoặc DA đang chọn.  
- Primary: **Đạt mốc** (tab Mốc) hoặc **Mở đợt** khi checklist xanh.  
- Vào: 002–011, 070.  
- Tooltip Mở đợt: liệt kê G0/G1/G2 thiếu.  
- UC: R-02, 004–008, 022, 045.

### 4.3. `truong_sp`

- First paint: tab Tồn kho DA đang chọn.  
- Primary: **Import CSV** / **Khóa căn**.  
- Drawer: Đổi pool. Không Activate.  
- 409: banner «Làm mới lưới».  
- UC: R-03, 010–012, 026.

### 4.4. `cv_gia`

- First paint: `/crm/bds/policies` draft.  
- Primary: **Lưu nháp**. Secondary: **Gửi duyệt**.  
- Không render nút Activate (kể cả biết URL).  
- UC: R-04, 009.

### 4.5. `gdkd`

- First paint: Hub + badge F1.  
- Primary trên Hold tab F1: **Duyệt**.  
- Vào: 001, 050, 070, 032 Activate, 082 override.  
- TX: cổng 2 cột **chỉ đọc**. Không Ký HĐMB.  
- Nav: không Sales B2B (W6).  
- UC: R-05, 015, 009, 045.

### 4.6. `truong_inhouse`

- First paint: Hold tab Đang giữ + filter pool inhouse.  
- Primary: không duyệt F1.  
- Vào: Hold, Lead gán, Chat `ban_kd`, ca (đọc).  
- UC: R-06, 013.

### 4.7. `tvv_inhouse`

- First paint: Hold (dự án chip).  
- Primary: **Giữ chỗ**. Trên drawer hold active: **Cọc**.  
- 409 copy cố định. Không tab F1. Không phiếu thu.  
- PWA: lead → căn → Giữ.  
- UC: R-07, 013, 018, 061.

### 4.8. `truong_kenh`

- First paint: Mạng.  
- Primary: **Thêm đại lý** / mở 085.  
- 085: cấp giỏ disabled «Chưa có HĐ phân phối».  
- UC: R-08, 025–027.

### 4.9. `am_kenh`

- First paint: Hold tab F1 lọc agency mình **hoặc** 085 đại lý gán.  
- Primary: **Xin giữ** (pending). Không Duyệt (trừ được ủy).  
- Giỏ: 404 ngoài unit được cấp.  
- UC: R-09, 014.

### 4.10. `cskh_lead`

- First paint: W1 Lead list badge đỏ; W5 board `re_buyer`.  
- Primary: **Đã liên hệ** (15p).  
- **Mất:** radio giá / pháp lý / vay / đối thủ / không liên hệ.  
- 404 Deal Room.  
- UC: R-10, 031–032, 064.

### 4.11. `truong_mkt`

- First paint: tab Kế hoạch DA / lead config.  
- Primary: **Bật form** chỉ khi ad account đã map (W7).  
- Không Hold/Thu. ROAS trên hub (W7) đọc.  
- UC: R-11, 031, 067.

### 4.12. `truong_pc`

- First paint: tab Pháp lý DA.  
- Primary: **Tải văn bản** / **Mở cổng đủ ĐK bán**.  
- TX: cổng trái + **Ký HĐMB** khi đủ (cùng Collection %).  
- Confirm cổng bán: audit. Override 15n: banner đỏ «Không dùng cho HĐMB».  
- UC: R-12, 006–007, 020.

### 4.13. `cv_hd`

- First paint: TX filter `deposit|vbtt`.  
- Primary: **Ký VBTT**. Khi gate xanh: **Ký HĐMB**.  
- 400 → modal 061, không toast chung.  
- UC: R-13, 019–020.

### 4.14. `truong_collection`

- First paint: Công nợ + Việc lịch 4h.  
- Primary: **Ghi phiếu thu**.  
- Copy ERP. Không nút cổng pháp lý.  
- Đủ %: chip `ready_for_hdmb` trên TX.  
- UC: R-14, 036–038, 066.

### 4.15. `cv_hh`

- First paint: tab Ledger / Kỳ.  
- Primary: **Khóa kỳ** (khi đối soát xong).  
- Scheme: không activate sau khi đã có cọc kỳ (warn).  
- UC: R-15, 048–049.

### 4.16. `truong_after`

- First paint: After, filter hẹn <15n.  
- Primary: **Hẹn bàn giao** / **Waive**.  
- UC: R-16, 041–043.

### 4.17. `cv_ban_giao`

- First paint: cùng board, hàng được gán.  
- Primary: tick checklist. **Bàn giao** khi 4 pass. **Defect** sau handover.  
- Không Waive nếu không cap approve.  
- UC: R-17, 041–042.

### 4.18. `hr_bp`

- First paint: Org users + banner G0 nếu thiếu.  
- Primary: **Gán chức vụ**. Offboard: modal 2 câu (cọc / chưa cọc).  
- Cảnh báo nếu gán cùng user `truong_pc` + `truong_collection`.  
- UC: R-18, 062, 068.

---

## 5. Ma trận nút × chức vụ

`●` thấy và bấm · `○` thấy disabled / chỉ đọc · `—` không render.

| Nút | TGD | PM | SP | Giá | GĐKD | IH | TVV | Kênh | AM | CSKH | MKT | PC | HĐ | CL | HH | After | BG | HR |
|-----|-----|----|----|-----|------|----|-----|------|----|------|-----|----|----|----|----|-------|----|-----|
| Drill hub | ● | ● | ○ | — | ● | ○ | — | ○ | — | — | ○ | ○ | — | ● | ○ | ○ | — | — |
| Tạo DA / mốc | — | ● | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Import / lock | — | ○ | ● | ○ | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Draft giá | — | — | ○ | ● | ○ | — | — | — | — | — | — | ○ | — | — | — | — | — | — |
| Activate CSBH | — | — | — | — | ● | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Giữ chỗ IH | — | — | — | — | — | ● | ● | — | — | — | — | — | — | — | — | — | — | — |
| Xin F1 | — | — | — | — | — | — | — | ● | ● | — | — | — | — | — | — | — | — | — |
| Duyệt F1 | — | — | — | — | ● | — | — | ○ | ○ | — | — | — | — | — | — | — | — | — |
| Cọc | — | — | — | — | ○ | ● | ● | ○ | ● | — | — | — | — | — | — | — | — | — |
| VBTT / HĐMB | — | — | — | — | ○ | — | ○ | — | — | — | — | ● | ● | ○ | — | — | — | — |
| Phiếu thu | — | — | — | — | — | — | — | — | — | — | — | — | — | ● | — | — | — | — |
| Cấp giỏ | — | — | ● | — | ● | — | — | ● | ○ | — | — | ○ | — | — | — | — | — | — |
| Khóa kỳ HH | — | — | — | — | — | — | — | ○ | — | — | — | — | — | ○ | ● | — | — | — |
| Checklist BG | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ● | ● | — |
| Waive BG | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ● | — | — |
| Offboard | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | ● |

---

## 6. Copy lỗi (chuẩn — toàn OS)

| `code` | Câu UI |
|--------|--------|
| `legal_gate` | «Chưa đủ điều kiện mở đợt / giữ chỗ sàn.» |
| `legal_gate_hdmb` | «Chưa đủ điều kiện ký HĐMB.» |
| `paid_pct` | «Chưa đạt % thanh toán tối thiểu để ký HĐMB.» |
| `one_price` | «Giá không khớp chính sách một giá.» |
| `hold_conflict` / 409 | «Căn đã có giữ chỗ — chọn căn khác.» |
| `hold_quota` | «Đại lý hết suất giữ chỗ theo hạng.» |
| `unit_in_flight` | «Không gỡ giỏ — căn đang giữ chỗ hoặc giao dịch.» |
| `handover_checklist` | «Thiếu checklist bàn giao (4 mục pass hoặc waive).» |
| `required_roles` | «Thiếu vị trí bắt buộc: {codes}.» |

---

## 7. Traceability màn ↔ sóng

| SCR | Sóng FE tối thiểu | Ghi chú |
|-----|-------------------|---------|
| 001 v1 | Đã sống | W6 thêm 2 widget |
| 050, 060, 040, 090 | **W1** | Stub → sống |
| 032, 010–011, 085, 082 | W2 | |
| 091 wizard | W3 | List đã sống |
| 042, 041 | W5 | |
| 001 v2, ẩn B2B | W6 | |
| 092, CAPI | W7 | |
| 130 offboard | W8 | |

---

*Duyệt file này cùng 13-BDS-ROLE-JOURNEYS. Đổi nút HĐMB / landing / copy = sửa spec này trước code.*
