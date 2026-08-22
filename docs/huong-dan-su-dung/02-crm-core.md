# Hướng dẫn — CRM Core

> **Module:** MOD-CRM  
> **Đối tượng:** CSKH, Sales, AM, GDKD, Finance  
> **URL:** https://rs.pttads.vn/crm/*

---

## 1. Giới thiệu

CRM Core quản lý **lead → khách hàng → sales → tài chính → CSKH → KPI**. Đây là điểm vào chính cho mọi luồng doanh thu agency.

**Điều kiện:** Đăng nhập ops-web + cap `crm_*` tương ứng.

---

## 2. Quản lý Lead

### 2.1. Xem danh sách lead

**Route:** `/crm/leads`

1. Sidebar → **Quản lý Lead**
2. Dùng filter: **Trạng thái**, **Nguồn**, **Owner**, **Ngành**
3. Click hàng → mở detail `/crm/leads/[id]`

**Vertical routes (nếu bật):**

- B2B: `/crm/b2b/leads`
- SPA: `/crm/spa/leads`
- Operational: `/crm/operational/leads`

### 2.2. Xử lý lead mới từ ads (CSKH)

**SLA mục tiêu:** Liên hệ trong **15 phút**

1. Filter status **Mới** + owner = me
2. Mở lead detail — xem source, UTM, campaign (nếu mapped Meta/Zalo)
3. Gọi khách → bấm **+ Activity** → chọn **Call**
4. Nhập duration, outcome, ghi chú → **Lưu**
5. Đổi status → **B2 — Liên hệ OK**
6. Nếu qualify → chuyển **Pre-sales** (tab hoặc status tiếp theo)

**Lead trùng:** Hệ thống merge/link — xem note "linked to existing", mở lead gốc.

### 2.3. Review queue (GDKD)

**Route:** `/crm/leads/review-queue` hoặc widget trên `/crm/hub`

1. GDKD mở queue — lead high-value / chưa gán owner
2. Xem summary: source, giá trị ước tính
3. **Approve assign** → chọn owner + priority  
   hoặc **Reject** → **bắt buộc** ghi comment
4. CSKH/AM nhận notification — lead xuất hiện trên list của họ

**Quy tắc:** Deal vượt ngưỡng → GDKD phải approve trước khi tạo proposal.

### 2.4. Lead Intake / BANT

**Route:** `/crm/intake`

1. Mở form intake có cấu trúc
2. Điền BANT: Budget, Authority, Need, Timeline
3. Submit → tạo/cập nhật lead với điểm qualify
4. Routing tự gán specialist theo ngành

---

## 3. Pre-sales & Proposal

### 3.1. Pre-sales trên lead

**Route:** `/crm/leads/[id]` (tab Pre-sales, nếu `PTT_PRESALES_ON_LEAD=1`)

1. AM/Pre-sales mở lead đã B2 qualify
2. Tab **Consult** — ghi biên bản tư vấn
3. Tab **Contract** — draft hợp đồng sơ bộ
4. Chuyển sang Proposal khi sẵn sàng báo giá

### 3.2. Báo giá / Proposal

**Route:** `/crm/proposals`

1. **+ Tạo proposal** — chọn lead/customer, dịch vụ
2. Thêm line items, giá, discount
3. **Quote Builder Ops DV** (nếu bật): chọn 3 gói Basic/Standard/Premium
4. Export PDF/DOCX gửi khách
5. **Accept** → tạo lifecycle + optional spawn checklist tuần

---

## 4. Khách hàng & Sales

### 4.1. Customers 360

**Route:** `/crm/customers`, `/crm/customers/[id]`

1. Danh sách khách sau convert
2. Detail: timeline hoạt động, hợp đồng, lifecycle link
3. Dùng làm master khi onboard SEO/Email/Meta

### 4.2. Sales Pipeline

**Route:** `/crm/sales`

1. Kanban/table theo stage
2. Kéo deal giữa stage hoặc sửa trên detail
3. Forecast cơ bản theo pipeline value

### 4.3. Orders & Invoices

| Route | Thao tác |
|-------|----------|
| `/crm/orders` | Tạo/sửa đơn hàng từ proposal won |
| `/crm/invoices` | Phát hành hóa đơn, trạng thái thanh toán |

---

## 5. Tài chính

**Route:** `/crm/financials`

1. Xem **AR aging** — công nợ theo khách, theo AM
2. Filter quá hạn → follow-up thu nợ
3. **Finance gate:** Handover lifecycle bị chặn nếu còn nợ (xem [03-agency-service-delivery.md](./03-agency-service-delivery.md))

**Dashboard GDKD:** `/crm/business-dashboard`, `/crm/gdkd-enterprise`

**Forecast:** `/crm/forecast` — revenue forecast, MAPE (nếu bật AI forecast)

---

## 6. CSKH Board

**Route:** `/crm/cskh-board`

1. Board ticket theo cột trạng thái
2. Filter SLA breach (hàng đỏ)
3. Mở ticket → assign, comment, đóng case
4. **Export Excel** — báo cáo SLA tuần/tháng

**Tickets:** `/crm/tickets` — list dạng bảng thay vì board

---

## 7. KPI nhân viên

| Route | Đối tượng |
|-------|-----------|
| `/crm/staff-kpi` | KPI cá nhân AM/SP |
| `/crm/kpi` | Hub KPI tổng hợp |
| `/crm/kpi/solution` | KPI team Solution |
| `/crm/solution/queue` | Hàng chờ handoff solution |

---

## 8. Catalog & dự án đặc thù

| Route | Mục đích |
|-------|----------|
| `/crm/catalog` | Danh mục dịch vụ/ngành CRM |
| `/crm/re-projects` | Dự án bất động sản |
| `/crm/owner-weekly` | Báo cáo tuần chủ sở hữu |

---

## 9. Luồng nghiệp vụ mẫu

### CSKH buổi sáng (30 phút)

1. `/crm/leads` — filter Mới + owner=me
2. Xử lý review queue nếu có
3. Log call + cập nhật status từng lead
4. `/crm/cskh-board` — kiểm tra SLA đỏ

### AM chốt deal (1 buổi)

1. Lead B2 → Pre-sales consult
2. `/crm/proposals` — báo giá + export PDF
3. Khách đồng ý → Accept proposal
4. `/crm/service-delivery` — lifecycle mới xuất hiện Onboard

---

## 10. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Lead webhook không vào | Kiểm tra Meta/Zalo webhook + dedup |
| Không tạo được proposal | GDKD chưa approve assign deal lớn |
| Handover bị block | Finance gate — thu nợ trước |
| KPI không cập nhật | Cron KPI / flag `PTT_CRM_KPI_PG` |

---

## 11. Tài liệu tham chiếu

- Actions từng bước: [`docs/use-cases/actions/01-CRM-ACTIONS.md`](../use-cases/actions/01-CRM-ACTIONS.md)
- Use case: [`docs/use-cases/01-CRM-CORE.md`](../use-cases/01-CRM-CORE.md)
