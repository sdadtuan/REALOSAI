# Hướng dẫn — Ops DV OS

> **Module:** MOD-OPS  
> **Đối tượng:** AM, Team Lead, Specialist (SP), Executive (GDKD)  
> **URL:** https://rs.pttads.vn/crm/ops/* · tab **Ops Hub** trên lifecycle  
> **Pilot DV:** DV02, DV05, DV04, DV20

---

## 1. Giới thiệu

Ops DV OS chuẩn hóa **vận hành 21 dịch vụ (DV01–DV21)**: catalog profile, checklist tuần, KPI tháng, cảnh báo tự động, dashboard theo vai trò, và tóm tắt portal cho khách.

**Bật module:** `PTT_OPS_DV_ENABLED=1`, `NEXT_PUBLIC_OPS_DV=1`

---

## 2. Ops Hub (trên lifecycle)

**Route:** `/crm/service-delivery/[id]?tab=ops-hub`

### 2.1. Mở Ops Hub

1. Mở lifecycle detail client đang **Deliver/Retain**
2. Click tab **Ops Hub**
3. Header hiển thị: mã DV, tên dịch vụ, AM, stage
4. **Engine grid** — link nhanh sang module (Meta, SEO, Content, …)

> Tab ẩn nếu DV không thuộc pilot hoặc flag tắt.

### 2.2. Spawn checklist tuần

**Khi nào:** Đầu tuần (T2) hoặc sau accept quote

1. Trên Ops Hub, section **Checklist tuần**
2. Bấm **Sinh checklist tuần** (Spawn week)
3. Hệ thống tạo task theo template DV — **idempotent** (spawn lại không duplicate)
4. Specialist thấy task trên **My Tasks**

**Auto spawn:** Cron `PTT_OPS_WEEKLY_SPAWN=1` sinh tự động.

### 2.3. Cập nhật checklist tuần (Specialist)

1. Mở `/crm/ops/my-tasks` hoặc Ops Hub
2. Mỗi task: chọn **Pending / Done / Skipped**
3. Ghi note nếu skipped
4. **Lưu** — AM thấy tiến độ trên hub

### 2.4. Nhập KPI tháng

1. Ops Hub → section **KPI tháng**
2. Nhập **actual** cho từng chỉ số (CPL, lead, traffic, … tùy DV)
3. Bấm **Lưu KPI**
4. Bấm **Tính nhãn** — hệ thống gán:
   - **Đạt** — trong ngưỡng target
   - **Cần chú ý** — lệch nhẹ
   - **Không đạt** — vượt ngưỡng cảnh báo (BR-OPS-KPI-01)

### 2.5. Cảnh báo trên Hub

Section **Alerts** liệt kê cảnh báo mở (task overdue, KPI đỏ). Link → **Alert center** để ack.

---

## 3. Quote Builder (INT-P2)

**Route:** `/crm/proposals` (wizard Ops DV)

1. **+ Tạo báo giá Ops** — chọn DV
2. Chọn gói **Basic / Standard / Premium** — xem line items
3. Chỉnh giá/discount nếu có cap
4. **Export PDF/DOCX** gửi khách
5. Khách đồng ý → **Accept**
   - Tạo/cập nhật lifecycle
   - Optional: tick **Spawn checklist tuần** ngay

---

## 4. Ops Agent & Alert Center

**Bật agent:** `PTT_OPS_AGENT_ENABLED=1`

### 4.1. Ops Agent (scan tự động)

Cron hoặc manual `POST /api/ops/agent/run`:

- Scan task **due/overdue**
- Scan KPI nhãn **Không đạt / Cần chú ý**
- Ghi **ops_alert_log**

### 4.2. Alert Center

**Route:** `/crm/ops/alerts`

1. Filter: mở / đã ack, severity, DV, AM
2. Click alert → xem context (lifecycle, task, KPI)
3. **Acknowledge** — ghi nhận đã xử lý
4. Xử lý root cause trên lifecycle hoặc module liên quan

---

## 5. Ops Dashboard (theo vai trò)

**Route:** `/crm/ops/dashboard`

| Tab | Vai trò | Nội dung |
|-----|---------|----------|
| **AM** | Account Manager | Danh sách lifecycle assigned — tiến độ checklist, KPI |
| **Team Lead** | Trưởng phòng | Aggregate theo phòng ban / team |
| **Specialist** | SP | Task pending tuần — link My Tasks |
| **Executive** | GDKD | Tổng hợp pilot DV — KPI đỏ, alert count |

**Buổi sáng AM (10 phút):**

1. Dashboard tab AM — sort KPI đỏ
2. Drill lifecycle → Ops Hub
3. Follow-up Specialist task overdue
4. Ack alerts đã xử lý

---

## 6. Portal Ops Summary (khách hàng)

**Portal route:** `/service-delivery`  
**Bật:** `PTT_OPS_PORTAL_SUMMARY=1`

Khách xem **read-only**: tiến độ triển khai, KPI tháng, trạng thái checklist (không chi tiết nội bộ).

AM hướng dẫn khách: [14-client-portal.md](./14-client-portal.md) § Service Delivery.

---

## 7. Catalog DV01–DV21

**API:** `GET /api/ops/catalog` (Admin/AM)

Mỗi DV có: profile, readiness %, route map tới engine (SEO hub, Email hub, …). Dùng khi tư vấn gói dịch vụ và setup lifecycle.

---

## 8. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Tab Ops Hub không hiện | Kiểm tra pilot DV + flag |
| Spawn duplicate task | Không nên — báo Dev nếu xảy ra |
| KPI nhãn sai | Re-enter actual → Tính nhãn lại |
| Portal không có summary | `PTT_OPS_PORTAL_SUMMARY` + lifecycle linked |

---

## 9. Tài liệu tham chiếu

- Spec: [`docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md`](../specs/2026-08-10-ptt-ops-rnosai-integration-spec.md)
- Trạng thái: [`docs/superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md`](../superpowers/specs/2026-08-10-ptt-ops-dv-implementation-status.md)
- Tính năng: [`docs/tong-ket-tinh-nang/04-ops-dv.md`](../tong-ket-tinh-nang/04-ops-dv.md)
