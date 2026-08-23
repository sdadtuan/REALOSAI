# Chi tiết hành động — OS BĐS theo chức vụ và module mới

> **UC:** [`../13-BDS-ROLE-JOURNEYS.md`](../13-BDS-ROLE-JOURNEYS.md)  
> **Pack actions (013–036 sẵn):** [`13-BDS-ACTIONS.md`](13-BDS-ACTIONS.md)  
> **UX:** [`../../superpowers/specs/2026-08-23-bds-ux-ui-complete.md`](../../superpowers/specs/2026-08-23-bds-ux-ui-complete.md)

Quy ước cột: [`README.md`](README.md). API `/api/v1/bds` trừ khi ghi khác.

---

### BDS-R-01 — TGĐ đọc khối

**Mục tiêu:** Một màn = sức khỏe khối.  
**Actors:** `tgd`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | TGĐ | Login | Đăng nhập | email/password | Redirect `/crm/bds` | ✓ cap hub |
| 2 | TGĐ | SCR-001 | Đọc 4 KPI | — | Số GMV = HĐMB | ✓ |
| 3 | TGĐ | KPI overdue | Click | — | `/crm/bds/collections` | ✓ |
| 4 | TGĐ | Inbox F1 | Click hàng | — | `/crm/bds/holds?hold=` | ✓ |
| 5 | TGĐ | Việc | Mở override | lý do | Ticket queue TGĐ | ○ |
| 6 | — | — | Không mở form phiếu / HĐMB | — | Nút không render | ✓ |

---

### BDS-R-02 — PM dự án

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | PM | `/crm/re-projects` | **+ Dự án** | mã, tên, one_price, % HĐMB | 003 | ✓ 068 đủ 5 A hoặc banner |
| 2 | PM | Tab Tòa | Thêm tòa/khu | code, name | 201 | ✓ |
| 3 | PM | Tab Mốc | **Đạt mốc** | — | POST `milestones/:id/reach` | ✓ 072 |
| 4 | PM | Tab Đợt / 070 | **Mở đợt** | — | Enable chỉ khi checklist xanh | ⚠ 069 |
| 5 | PM | Ra quân | **Mở ra quân** | — | War-room | ✓ giá + giỏ + G0 |

---

### BDS-R-03 — Trưởng SP

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Tab Tồn kho | **Import CSV** | file | Báo cáo dòng lỗi | ✓ 010 |
| 2 | SP | Hàng căn | **Đổi pool** | inhouse\|channel | 200 + row_version | ⚠ 409 làm mới |
| 3 | SP | Hàng | **Khóa** | — | `locked` | ✓ |
| 4 | SP | Stack | Click ô | — | Drawer | ✓ |
| 5 | SP | 085 | Cấp giỏ (W2) | unit ids | basket | ○ HĐ đã có |

---

### BDS-R-04 — CV giá

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CV giá | `/crm/bds/policies` | **Tạo nháp** | DA, CSBH | draft | ✓ |
| 2 | CV giá | Soạn | Thêm item giá | product, list | 200 | ✓ one_price |
| 3 | CV giá | Quote | Chọn căn | — | `net_price_vnd` | ✓ |
| 4 | CV giá | — | Tìm nút Activate | — | Không render | ✓ |

---

### BDS-R-05 — GĐKD

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | GĐKD | 001 | Click F1 | — | 050 tab Chờ duyệt | ✓ |
| 2 | GĐKD | Hàng pending | **Duyệt** | — | POST `holds/:id/approve` | ✓ 2h/8h |
| 3 | GĐKD | Hàng | **Từ chối** | reason ≥3 | available | ✓ |
| 4 | GĐKD | 032 | **Activate** | confirm một giá | policy active | ✓ 070 |
| 5 | GĐKD | 070 | **Mở ra quân** | — | war-room poll 3s | ✓ 069 |
| 6 | GĐKD | 060 | Xem cổng 2 cột | — | Không nút Ký HĐMB | ✓ BR-35 |
| 7 | GĐKD | Sidebar | Tìm Sales B2B | — | Không có (W6) | ✓ 065 |

---

### BDS-R-06 — Trưởng gallery

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Trưởng IH | 050 Đang giữ | Lọc pool inhouse | — | List TVV | ✓ |
| 2 | Trưởng IH | 040 | Gán lead | user | assignee | ✓ |
| 3 | Trưởng IH | `/crm/chat` | Room `ban_kd` | — | Huddle | ○ |
| 4 | Trưởng IH | 050 F1 | — | — | Không duyệt sàn | ✓ |

---

### BDS-R-07 — TVV tự doanh

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | TVV | 050 / stack | **Giữ chỗ** | lead_id, row_version | 201 + TTL toast | ✓ 013 |
| 2 | TVV | Cùng căn | Giữ lần 2 | — | «Căn đã có giữ chỗ» | ✓ 409 |
| 3 | TVV | 040 | **Đặt xem** | datetime | visit | ✓ 032 |
| 4 | TVV | Drawer hold active | **Cọc** | — | POST `convert-deposit` | ✓ 018 |
| 5 | TVV | 060 | Đọc cổng | — | Chờ PC+CL | ○ |
| 6 | TVV | 090 | — | — | 404 / không nav | ✓ |

---

### BDS-R-08 — Trưởng kênh

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Kênh | 080 | **Thêm đại lý** | mã, tên | 201 | ✓ 025 |
| 2 | Kênh | 085 | Chờ PC gắn HĐ | — | Chip HĐ | ✓ PC C |
| 3 | Kênh | 085 | **Cấp căn** | picker | basket | ⚠ chưa HĐ disabled |
| 4 | Kênh | 082 | Recalc | kỳ | điểm | ✓ 027 |
| 5 | Kênh | 083 | Đọc BXH | — | bảng | ✓ |

---

### BDS-R-09 — AM

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | 200 / 085 | Mở căn trong giỏ | — | Drawer | ✓ trong giỏ |
| 2 | AM | Drawer | **Xin giữ** | lead_id | 201 pending | ✓ 014 |
| 3 | AM | 050 F1 | Lọc agency mình | — | Hàng | ✓ |
| 4 | AM | Căn ngoài giỏ | Mở URL unit | — | 404 | ✓ |
| 5 | AM | Quote | Giá lệch CSBH | — | 400 one_price | ✓ 028 |

---

### BDS-R-10 — CSKH trước bán

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | 040 / 042 | Mở lead badge đỏ | — | Chi tiết; 0 Deal Room | ✓ 003 |
| 2 | CSKH | Chi tiết | **Đã liên hệ** | kênh | `touched_at`; ticket done | ✓ ≤15p |
| 3 | CSKH | | **Qualify** | nhu cầu, ngân sách | stage | ✓ |
| 4 | CSKH | | **Hẹn xem** | lịch | visit + (W7) CAPI Schedule | ✓ |
| 5 | CSKH | | **Mất** | lost_reason bắt buộc | lost | ✓ |
| 6 | CSKH | `/deal-room` | Mở | — | 404 | ✓ |

---

### BDS-R-11 — Trưởng MKT

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | MKT | Tab Kế hoạch | Gửi plan marketing | — | chờ PM duyệt | ✓ |
| 2 | MKT | Lead config | Map ad account | ad_id | lưu | ✓ trước CAPI |
| 3 | MKT | Ads | Bật form | — | lead `re_buyer` | ✓ 031 |
| 4 | System | — | CAPI Lead | — | 067 | ○ flag |
| 5 | MKT | Hold | — | — | không nav | ✓ |

---

### BDS-R-12 — Trưởng PC

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | PC | Tab Pháp lý | **Tải lên** | doc_type, file | hàng kho | ✓ 006 |
| 2 | PC | | **Mở cổng đủ ĐK bán** | confirm | `legal_gate` | ✓ 007 |
| 3 | PC | 085 | C HĐ phân phối | — | Kênh cấp giỏ được | ✓ |
| 4 | PC | 060 | Cột pháp lý xanh | — | — | ○ % CL |
| 5 | PC | 060 | **Ký HĐMB** khi đủ | contract_no | 201 sold | ⚠ 061 |

---

### BDS-R-13 — CV HĐ

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CV HĐ | 060 | Lọc deposit | — | list | ✓ |
| 2 | CV HĐ | TX | **Ký VBTT** | — | POST vbtt | ⚠ mẫu |
| 3 | CV HĐ | Cổng | Đọc 2 cột | — | xanh/đỏ | ✓ |
| 4 | CV HĐ | | **Ký HĐMB** thiếu % | — | Modal «Chưa đạt %» | ✓ `paid_pct` |
| 5 | CV HĐ | | **Ký HĐMB** đủ | contract_no | contracted | ✓ 020 |

---

### BDS-R-14 — Trưởng công nợ

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CL | `/crm/work` | Queue `collection_schedule` | — | `?tx=` | ✓ ≤4h |
| 2 | CL | 090 | **Ghi phiếu thu** | tx, amount ≤ còn | 201; `paid_pct` | ✓ 036 |
| 3 | CL | Aging | Đọc bucket | — | >30n lên hub | ✓ |
| 4 | CL | TX đủ % | — | — | chip ready_for_hdmb | ✓ |
| 5 | CL | **Xuất CSV** | — | blob download | ✓ 038 |
| 6 | CL | 060 | Ký HĐMB | — | không nút | ✓ |

---

### BDS-R-15 — CV HH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | HH | 091 Scheme | Wizard + **Activate** | hạng, DA, mốc | active | ✓ trước CSBH |
| 2 | System | TX mốc | — | — | ledger T+0 | ✓ |
| 3 | HH | Tab Kỳ | **Khóa** | period | locked | ✓ |
| 4 | HH | | **Duyệt** / **Chi** | — | paid | ✓ 048 |
| 5 | HH | Tạm ứng | Tạo | agency, số | 049 | ○ |
| 6 | HH | TX hủy | — | — | clawback | ✓ |

---

### BDS-R-16 — Trưởng after

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | After | 100 | Thấy hàng contracted | — | auto 073 | ✓ W5 |
| 2 | After | | **Hẹn BG** | datetime ≥15n | appointment | ✓ mốc+thu C |
| 3 | After | | **Waive** | lý do, cap approve | check waive | ✓ |
| 4 | After | Sổ | Nộp → Cấp → Giao | — | title_status | ✓ 043 |

---

### BDS-R-17 — CV bàn giao

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CV BG | 100 | Pass 4 mục | water…minutes | 4/4 | ✓ |
| 2 | CV BG | | **Bàn giao** | — | handed_over | ⚠ checklist |
| 3 | CV BG | | **Defect** | title | 201 | ✓ sau BG |
| 4 | CV BG | Waive | — | — | không nút | ✓ |

---

### BDS-R-18 — HR BP

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | HR | Org users | Tạo user + chức vụ | `tvv_inhouse` | cap 068 + room | ✓ |
| 2 | HR | Cùng user | Gán PC + Collection | — | Cảnh báo chặn | ✓ |
| 3 | HR | Hub HR | Đọc banner G0 | — | list code thiếu | ○ |
| 4 | HR | Offboard | Confirm 2 câu | — | 074 | ✓ |
| 5 | QA | — | Hold chưa cọc / đã cọc | — | mở / giữ | ✓ U-07/08 |

---

### BDS-UC-063 — Mở 360

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | 042 | Click tên | — | `/crm/leads/:id` skin | ✓ re_buyer |
| 2 | CSKH | 041 | Đổi tab Ads…Sổ | — | đủ hành trình | ✓ |
| 3 | CSKH | Tab Deal | — | — | không có | ✓ |

---

### BDS-UC-069 — Chặn mở ra quân

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | PM | 070 | Hover **Mở** | thiếu G0 | Tooltip «Thiếu gdkd,…» | ✓ |
| 2 | PM | | Bấm khi thiếu | — | Disabled / 400 | ✓ |
| 3 | PM | | Bấm khi đủ | — | `open` | ✓ |

---

### BDS-UC-074 — Offboard click

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | HR | User | **Ngừng hoạt động** | — | Modal 2 câu | ✓ |
| 2 | HR | Confirm | Hold chưa cọc | — | căn available | ✓ |
| 3 | HR | Confirm | Hold + TX cọc | — | căn **không** available | ✓ |
| 4 | TVV | Login | — | — | từ chối | ✓ |
