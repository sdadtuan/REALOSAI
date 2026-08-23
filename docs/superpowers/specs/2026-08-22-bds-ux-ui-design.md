# UX/UI — Industry Pack BĐS (CĐT + Sàn)

**Ngày:** 2026-08-22  
**Trạng thái:** Chờ duyệt cùng design spec  
**Design:** [2026-08-21-bds-industry-pack-design.md](./2026-08-21-bds-industry-pack-design.md) (Q1–Q29)  
**Use case:** [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md)  
**Actions:** [13-BDS-ACTIONS.md](../../use-cases/actions/13-BDS-ACTIONS.md)

Không implement cho đến khi design spec được duyệt. UI sống trên **ops-web** (cùng app, skin theo `tenant.mode`). Portal-web PTT **không** thêm console CĐT.

**Bản hoàn chỉnh (hệ + module + ban + 18 chức vụ, thắng khi mâu thuẫn):** [`2026-08-23-bds-ux-ui-complete.md`](./2026-08-23-bds-ux-ui-complete.md).

---

## 1. Nguyên tắc

1. **Một giá trị một nơi.** Trạng thái căn / tiền / cổng HĐMB chỉ đổi trên màn nghiệp vụ. Chat và ticket điều phối người — không có nút «duyệt HĐMB» trong chat.
2. **Ngoài scope = 404**, không 403 (BR-BDS-05). Sàn không thấy pool inhouse, không thấy room/ticket CĐT.
3. **Cổng hiện trước khi bấm.** Nút HĐMB disabled + tooltip thiếu gì (Sở XD / bảo lãnh / %) — không để 400 bất ngờ là UX chính (API vẫn 400).
4. **TTL nhìn thấy.** Hold và launch: countdown trên hàng và trên drawer căn.
5. **Handoff có mặt.** Mọi sự kiện §25.5: card chat + ticket (khi flag). User không phải nhớ «nhắn Collection».
6. **Tiếng Việt nghiệp vụ.** Giữ chỗ · cọc · VBTT · HĐMB · sổ hồng. Không dùng «Deal / SPA / Closing» trên UI CĐT.
7. **Skin mode.** CĐT: hub sell-through. Sàn: giỏ + hold của mình. Hybrid: nav CĐT + mục «Sàn nội bộ».
8. **Không Deal Room** trên lead `re_buyer` (route 404).

---

## 2. Information architecture

### 2.1. Nav CĐT / hybrid (`PTT_BDS_PACK=1`)

Nhóm trái (ops-web sidebar). Cap ẩn mục không có quyền — không hiện disabled hàng loạt.

```
BĐS
├── Tổng quan                 /crm/bds
├── Dự án                     /crm/re-projects
├── Tồn kho (lưới / stack)    /crm/re-projects/:id/units · /stack
├── Kinh doanh
│   ├── Lead khách mua        /crm/bds/leads
│   ├── Hold                  /crm/bds/holds
│   ├── Giao dịch             /crm/bds/transactions
│   └── Ra quân               /crm/bds/launches
├── Đại lý
│   ├── Mạng                  /crm/bds/agencies
│   ├── Hạng                  /crm/bds/tiers
│   └── Bảng xếp hạng         /crm/bds/leaderboard
├── Tài chính
│   ├── Công nợ               /crm/bds/collections
│   └── Hoa hồng              /crm/bds/commissions
├── Sau bán                   /crm/bds/aftersales
├── Việc của tôi              /crm/work
└── Chat                      /crm/chat
```

Trong dự án (`/crm/re-projects/:id`): tab **Tổng quan · Pháp lý · Cơ cấu · Đợt · Giá/CSBH · Stack · Tài liệu · Kế hoạch**.

Ẩn khỏi nav CĐT: Deal Room, proposal agency, `/crm/tickets` khách (trừ user còn cap agency).

### 2.2. Nav sàn / CTV

```
BĐS
├── Giỏ hàng     /crm/bds/basket
├── Lead         /crm/bds/leads
├── Hold         /crm/bds/holds
├── Hoa hồng     /crm/bds/commissions
└── Chat nội bộ  /crm/chat     (tenant broker — không room CĐT)
```

CTV: không thấy net/floor; HH chỉ dòng mình.

### 2.3. PWA staff (v1)

Ba màn: danh sách lead `re_buyer` · chi tiết lead + nút hold · giỏ / căn đang xem. Không war-room, không pháp lý, không collection.

---

## 3. Pattern toàn cục

### 3.1. Shell

- Top bar: tenant name + mode badge (`CĐT` / `Sàn` / `Hybrid`) + project switcher (CĐT) + chuông (hold TTL, ticket SLA, mention chat).
- Sidebar theo §2.
- Content: page header (title + primary CTA) · filter bar · body.
- Drawer phải (480px): căn / hold / TX / lead — mở từ lưới, không full-page trừ hồ sơ TX.

### 3.2. Màu trạng thái căn (stack + list)

| Status | Nhãn UI | Ý nghĩa |
|--------|---------|---------|
| `available` | Trống | Hold được |
| `hold` | Giữ | TTL hiện |
| `reserved` | Giữ chỗ (có tiền) | |
| `booked` | Đã cọc / VBTT | |
| `sold` | HĐMB | |
| `locked` | Khóa vận hành | |

Không dùng xanh/đỏ thuần túy cho sold vs available — kèm nhãn chữ (a11y).

### 3.3. Toast / inline

| Tình huống | UI |
|------------|-----|
| 201 hold | Toast «Đã giữ A-1204 · hết hạn 14:02» + link drawer |
| 409 `unit_locked` | Inline trên căn: «Căn vừa được giữ. Làm mới.» |
| 400 `legal_gate_hdmb` | Modal cổng: checklist đỏ từng thiếu |
| 400 `paid_pct` | Cùng modal, dòng % hiện tại / ngưỡng |
| 400 `one_price` | «Giá phải khớp CSBH CĐT. Không được kê.» |
| 404 ngoài giỏ | Trang trống «Không tìm thấy căn» — không gợi ý id |

### 3.4. Modal cổng kép HĐMB

Title: **Chưa đủ điều kiện ký HĐMB**. Hai cột:

- Pháp chế: Sở XD · bảo lãnh/waive · giải chấp · mẫu HĐ — icon đạt/thiếu.
- Collection: `paid_pct` vs `hdmb_min_paid_pct` · link phiếu thu.

CTA: **Đóng** · **Mở ticket cổng** (tạo/focus `hdmb_gate_*`) · **Mở chat x_pc_collection**. Không có nút «Ký anyway» (BR-BDS-35).

### 3.5. Entity chip

Mọi chat card / ticket: chip `A-1204` · `Hold #` · `TX #` · `Lead`. Click mở drawer nếu có quyền; không quyền → chip «Hồ sơ ẩn».

### 3.6. Empty states

| Màn | Copy |
|-----|------|
| Chưa có đợt | «Chưa mở đợt. PM tạo đợt sau khi Pháp chế đủ hồ sơ.» |
| Giỏ sàn trống | «CĐT chưa cấp căn. Liên hệ AM.» |
| Queue ticket trống | «Không có việc inbound.» |
| Chat room mới | «Room ban. Việc bàn giao nằm ở Liên phòng.» |

---

## 4. Màn hình — CĐT

Mỗi màn: mục đích · layout · CTA · trạng thái · UC.

### 4.1. Hub `/crm/bds` — SCR-BDS-001

**Mục đích:** Điều hành ngày (TGĐ, GĐKD, PM). Không phải dashboard marketing.

**Layout (4 hàng):**

1. KPI: sell-through đợt · GMV HĐMB tháng · overdue >30n · hold hết hạn 2h.
2. Hàng cần xử lý (max 8): hold F1 pending · ticket P0 · HĐMB kẹt cổng · launch đang mở.
3. Sell-through theo tòa (bar) + theo đại lý (table 5 dòng).
4. Lối tắt: Ra quân · Hold · Công nợ · Chat huddle nếu launch open.

**CTA:** không «Tạo dự án» ở đây (vào hub dự án).

**UC:** BDS-UC-001.

### 4.2. Hub dự án `/crm/re-projects` — SCR-BDS-002

List dự án tenant: tên, `legal_gate` badge, đợt active, sell-through, PM.

CTA: **Dự án mới** (`cdt_pm`). Tenant broker: list rỗng + copy «Dùng giỏ hàng» (BDS-19).

**UC:** BDS-UC-004.

### 4.3. Dự án tổng quan `/crm/re-projects/:id` — SCR-BDS-003

Header: tên · gate · đợt · one_price badge.  
Body: cổng pháp lý tóm tắt · tiến độ mốc · sell-through tòa · RACI dự án.

**UC:** BDS-UC-005.

### 4.4. Pháp lý `/crm/re-projects/:id/legal` — SCR-BDS-010

Kho `bds_legal_documents`: bảng loại / status / hạn / file.  
CTA **Tải lên** (`cdt_legal`). Hàng `so_xd_du_dieu_kien_ban` nổi.  
Nút **Mở cổng đủ ĐK bán** — confirm + audit. Override 15 ngày: modal lý do, banner đỏ «Không dùng cho HĐMB».

**UC:** BDS-UC-006, 007.

### 4.5. Cơ cấu + stack — SCR-BDS-020 / 021

**Cơ cấu:** cây Phân khu → Tòa → Tầng.  
**Stack** `/stack`: ma trận tầng × căn, màu status, filter pool / đợt / đại lý. Click căn → drawer.

Drawer căn: mã, pool, giá list/net (ẩn net nếu CTV), hold hiện tại + TTL, CTA **Giữ chỗ** / **Khóa** / **Đổi pool** theo cap.

Import: `/units` nút **Import CSV** — báo cáo dòng lỗi, không partial silent.

**UC:** BDS-UC-010…013.

### 4.6. Đợt + CSBH — SCR-BDS-030 / 031

Đợt: planned/active/closed, `opens_at`, open_to_channel. CTA **Mở đợt** disabled nếu `legal_gate` blocked + tooltip.

CSBH: draft vs active. CV giá soạn; **Activate** chỉ GĐKD. Snapshot giá đợt khóa sau activate.

**UC:** BDS-UC-008, 009.

### 4.7. Lead `/crm/bds/leads` — SCR-BDS-040

Board/kanban: Mới · Đã chạm · Qualify · Hẹn xem · Hold · Cọc · Lost. Filter dự án. SLA 15p badge đỏ.

Chi tiết: cấm tab Deal Room. CTA **Đặt lịch xem** · **Giữ căn** · **Mất** (reason bắt buộc).

**UC:** BDS-UC-031…033.

### 4.8. Hold `/crm/bds/holds` — SCR-BDS-050

Tab: **Chờ duyệt F1** (GĐKD/AM) · **Đang giữ** · **Hết hạn**.  
Hàng: căn, đại lý, hạng, TTL, nút Duyệt / Từ chối (lý do). Strategic: badge SLA 2h.

Inhouse hold không vào tab chờ duyệt.

**UC:** BDS-UC-014, 015.

### 4.9. Giao dịch `/crm/bds/transactions` — SCR-BDS-060

Filter stage: reservation · deposit · vbtt · contracted · handed_over.  
Chi tiết TX (full page): timeline hành trình, lịch TT, phiếu thu, cổng HĐMB (2 cột), file VBTT/HĐMB.

CTA theo stage: **Thu giữ chỗ** · **Cọc** · **Ký VBTT** · **Ký HĐMB** (mở modal cổng nếu thiếu) · **Hủy**.

**UC:** BDS-UC-017…024.

### 4.10. Ra quân `/crm/bds/launches` — SCR-BDS-070

Trước mở: checklist (giá khóa, giỏ, pháp lý đợt, kit MKT).  
Khi `open`: war-room 3 cột — queue căn · hold/cọc realtime · xung đột 409. TTL 180s trên từng hàng. Không reload full page (poll/SSE).

**UC:** BDS-UC-045, 046.

### 4.11. Đại lý — SCR-BDS-080…083

List: hạng, status, AM, hold đang mở.  
Hồ sơ: KYC, HĐ, hạng + override, giỏ (rule + số căn), bảng kê.  
Giỏ: picker tower/zone/units + exclusive toggle (disabled nếu hạng không đủ).  
Leaderboard kỳ.

**UC:** BDS-UC-025…028.

### 4.12. Collection `/crm/bds/collections` — SCR-BDS-090

Aging buckets. CTA **Phiếu thu** (TX + số tiền ≤ còn lại). Hồ sơ vay trên TX. Export kỳ.

**UC:** BDS-UC-036…038.

### 4.13. Hoa hồng `/crm/bds/commissions` — SCR-BDS-091

Scheme · ledger · statement kỳ. Duyệt / chi. Sàn chỉ thấy số mình.

**UC:** BDS-UC-048, 049.

### 4.14. After-sales `/crm/bds/aftersales` — SCR-BDS-100

Hàng TX contracted: hẹn BG, checklist, defect, `title_status`. Không nhầm với `/crm/work`.

**UC:** BDS-UC-041…043.

### 4.15. Chat `/crm/chat` — SCR-BDS-110

3 cột: danh sách room (nhóm Phòng / Liên phòng / Dự án / Việc / Huddle / DM) · thread · panel entity.

Composer: @user @ban, đính file, chip entity. Restricted room: banner «Không chuyển tiếp».

**UC:** BDS-UC-051…054.

### 4.16. Việc `/crm/work` — SCR-BDS-120

4 inbox (Của tôi / Queue ban / Inbound / Outbound) + filter overdue.  
Chi tiết ticket: status machine, SLA bar, entity chip, comments, **Mở chat**.  
`done` fail → toast artifact thiếu (cùng ngôn ngữ modal cổng).

**UC:** BDS-UC-055…059.

---

## 5. Màn hình — Sàn

### 5.1. Giỏ `/crm/bds/basket` — SCR-BDS-200

Lưới căn được cấp. Không filter «inhouse». Hold → pending. 404 nếu mở unit_id ngoài giỏ.

### 5.2. Hold sàn — SCR-BDS-201

List hold của agency. Không tab duyệt F1 người khác.

### 5.3. Hoa hồng sàn — SCR-BDS-202

Ledger + statement của mình. Ẩn scheme CĐT đầy đủ với CTV.

---

## 6. Quyền × nút (tóm tắt)

| Nút | Ai thấy |
|-----|---------|
| Import căn / đổi pool | `cdt_inventory` |
| Activate CSBH | `cdt_sales_dir` |
| Mở đợt | `cdt_pm` (cổng PC) |
| Duyệt hold F1 | `cdt_sales_dir` + AM inbox |
| Hold inhouse | sale inhouse |
| Phiếu thu | `cdt_finance` / collection |
| Ký HĐMB | PC + Collection cổng; GĐKD bấm submit vận hành |
| Override hạng | GĐKD tờ trình; TGĐ nếu chính sách |
| Moderate chat | Trưởng ban / admin |
| Assign ticket | Trưởng ban nhận |

---

## 7. Responsive

| Breakpoint | Hành vi |
|------------|---------|
| ≥1280 | Hub 4 hàng, stack đủ cột |
| 768–1279 | KPI 2×2; stack scroll ngang |
| PWA <768 | Chỉ lead + hold + basket; chat/work list đơn |

---

## 8. Copy lỗi (chuẩn)

Dùng mã API trong `code` nhỏ dưới toast, câu chính tiếng Việt:

- `legal_gate` — «Chưa đủ điều kiện mở đợt / hold sàn.»
- `legal_gate_hdmb` — «Chưa đủ điều kiện ký HĐMB.»
- `paid_pct` — «Chưa đạt % thanh toán tối thiểu để ký HĐMB.»
- `one_price` — «Giá không khớp chính sách một giá.»
- `hold_quota` — «Đại lý hết suất giữ chỗ theo hạng.»
- `unit_in_flight` — «Không gỡ giỏ — căn đang hold hoặc giao dịch.»

---

## 9. Traceability màn ↔ UC

Xem [13-BDS-INDUSTRY-PACK.md](../../use-cases/13-BDS-INDUSTRY-PACK.md) cột Traceability. Canvas IA: `bds-ux-usecases.canvas.tsx`.
