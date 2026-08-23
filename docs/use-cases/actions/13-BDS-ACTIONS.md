# Chi tiết hành động — Pack BĐS

> **Prefix:** BDS · **Ngày:** 2026-08-22  
> **UC:** [`../13-BDS-INDUSTRY-PACK.md`](../13-BDS-INDUSTRY-PACK.md)  
> **UX:** [`../../superpowers/specs/2026-08-22-bds-ux-ui-design.md`](../../superpowers/specs/2026-08-22-bds-ux-ui-design.md)

Quy ước cột: [`README.md`](README.md). API base `/api/v1/bds` trừ khi ghi khác.

---

### BDS-UC-013 — Hold inhouse

**Mục tiêu:** TVV giữ căn quỹ gallery trước khi KH ra về.

**Actors:** TVV inhouse

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | TVV | `/crm/re-projects/:id/stack` | Click ô căn `available` pool inhouse | — | Drawer căn | ✓ căn trống |
| 2 | TVV | Drawer | Bấm **Giữ chỗ** | lead_id (search SĐT) | POST `/units/:id/holds` + Idempotency-Key | ✓ lead `re_buyer` |
| 3 | System | — | Khóa `row_version` | — | 201 hold active · căn `hold` | ⚠ 409 → bước 4 |
| 4 | TVV | Drawer / toast | Nếu 409: **Làm mới** | — | Ô đổi màu hold người khác | ○ |
| 5 | TVV | Toast | Đọc TTL | — | «Hết hạn HH:MM» | ✓ |

---

### BDS-UC-014 / 015 — Hold F1 duyệt

**Mục tiêu:** Sàn xin; GĐKD duyệt trong SLA.

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Sale F1 | `/crm/bds/basket` | Click căn trong giỏ | — | Drawer; không thấy inhouse | ✓ trong giỏ |
| 2 | Sale F1 | Drawer | **Xin giữ** | lead_id | 201 `pending` | ⚠ 404/409 quota |
| 3 | System | Chat `x_kenh_gdkd` | Card + ticket `hold_f1_approve` | entity hold | Chuông AM/GĐKD | ✓ TICKETS/CHAT |
| 4 | AM | `/crm/bds/holds` | Tab Chờ duyệt · lọc agency mình | — | Hàng pending | ✓ |
| 5 | GĐKD | Cùng inbox | **Duyệt** hoặc **Từ chối** | reason nếu từ chối | active + TTL / available | ✓ SLA 2h/8h |
| 6 | Sale F1 | Hold của tôi | Thấy kết quả | — | Toast | ✓ |

---

### BDS-UC-018 — Cọc

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | TVV | Drawer hold active | **Chuyển cọc** | deposit_vnd, policy | POST `convert-deposit` | ✓ ≥ deposit_min · one_price |
| 2 | System | — | TX deposit, căn booked | — | 201 | ✓ |
| 3 | System | Collection | Sinh lịch ≤ 4h | template CSBH | Ticket done khi có installment | ✓ |
| 4 | Collection | `/crm/bds/collections` | Xác nhận lịch hiện | — | Bảng installment | ✓ |

---

### BDS-UC-020 — HĐMB cổng kép

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CV HĐ / PC | `/crm/bds/transactions/:id` | Xem 2 cột cổng | — | Xanh/đỏ từng điều kiện | ○ đủ mới enable **Ký HĐMB** |
| 2 | GĐKD | Cùng trang | Nếu đỏ: **Mở ticket cổng** / chat (không ký) | — | Focus `hdmb_gate_*` | ○ I |
| 3 | PC | Legal / TX | Bổ sung Sở XD / waive | file | Gate legal xanh | ✓ BR-27 |
| 4 | Collection | Phiếu thu | Thu đủ % | số tiền | `paid_pct` xanh | ✓ |
| 5 | CV HĐ / PC | TX | **Ký HĐMB** + số HĐ | contract_no | POST `/contract` 201 · sold | ⚠ 400 → modal cổng |
| 6 | — | — | Không «Ký anyway»; GĐKD không submit | — | — | ✓ BR-35 |

---

### BDS-UC-031 — First-touch 15 phút

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | Ingest | Tạo `re_buyer` | UTM, project | Board + ticket 15p | ✓ không b2b_project_id |
| 2 | CSKH | `/crm/bds/leads` | Mở lead badge đỏ | — | Chi tiết; không Deal Room | ✓ |
| 3 | CSKH | Chi tiết | **Đã liên hệ** / log | kênh Zalo/gọi | `touched_at` · ticket done | ✓ ≤ 15p |
| 4 | CSKH | Chi tiết | **Hẹn xem** hoặc **Mất** | lịch / lost_reason | visit hoặc lost | ✓ reason nếu lost |

---

### BDS-UC-036 — Phiếu thu

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Collection | `/crm/bds/collections` | **Phiếu thu** | TX, số tiền, ngày | POST `/receipts` | ✓ ≤ net−paid |
| 2 | System | TX | Cập nhật paid_pct | — | Cột cổng HĐMB đổi | ✓ |
| 3 | Collection | Aging | Xem bucket quá hạn | — | Task overdue | ○ |

---

### BDS-UC-045 — Mở ra quân

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | GĐKD | `/crm/bds/launches/:id` | Checklist 4 mục | — | Đủ mới enable **Mở** | ✓ giá + giỏ + gate + kit |
| 2 | GĐKD | Cùng | **Mở ra quân** | — | TTL 180s, khóa giá, huddle | ✓ |
| 3 | GĐKD | War-room | Theo dõi queue / 409 | — | Poll/SSE | ✓ |
| 4 | GĐKD | Cùng | **Đóng** | — | TTL CSBH, archive huddle | ✓ |

---

### BDS-UC-052 — Card chat handoff

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | Room `cross` | Insert system card | entity_ref | Unread | ✓ BR-39 |
| 2 | Staff | `/crm/chat` | Click chip | — | Drawer hoặc «Hồ sơ ẩn» | ✓ BR-38 |

---

### BDS-UC-054 / 056 — Chat → ticket liên phòng

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Staff | Thread | Menu tin · **Chuyển thành ticket** | queue, assignee_dept | POST `/staff-tickets/tickets` | ✓ dept khác |
| 2 | Ban nhận | `/crm/work` Inbound | **Nhận việc** | — | in_progress | ✓ |
| 3 | Ban nhận | Chi tiết | Làm nghiệp vụ (hold/thu/…) | — | Domain đổi | ✓ |
| 4 | System/user | Chi tiết | **Hoàn thành** | — | done hoặc 400 artifact | ✓ BR-44 |

---

### BDS-UC-060 — Sàn không thấy CĐT

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Sale sàn | `/crm/re-projects` | Mở hub dự án CĐT | — | `{ projects: [] }` | ✓ BDS-19 |
| 2 | Sale sàn | Gõ URL unit inhouse | GET | — | 404 | ✓ BR-28 |
| 3 | Sale sàn | `/crm/chat` room `#ban-kd` CĐT | GET | — | 404 | ✓ BR-36 |
| 4 | Sale sàn | `/crm/work` ticket CĐT | GET | — | 404 | ✓ BR-41 |
