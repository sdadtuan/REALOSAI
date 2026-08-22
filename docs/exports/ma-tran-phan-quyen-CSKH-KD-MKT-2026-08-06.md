# Ma trận phân quyền — CSKH-01 / KD-01 / MKT-01

**Ngày xuất:** 2026-08-06  
**Hệ thống:** PTT ops-web + Nest API (`section_id` × `action`)  
**Nguồn:** `admin_page_permissions._POSITION_DEFAULT`

***

## 1. Tổng quan chức vụ

| Mã | Tên | Vai trò vận hành |
|----|-----|------------------|
| **CSKH-01** | Nhân viên CSKH vận hành | CRM · CSKH vận hành 24h — lead spa/operational |
| **KD-01** | Account Manager (AM) B2B Sales | CRM · B2B Sales — Intake → Giao Solution → Báo giá |
| **MKT-01** | Trưởng phòng Marketing / Solution | CRM · Solution/MKT — Consult, R5, release Sales |

***

## 2. P3 — Handoff Sales → Solution (bổ sung)

| Cap | KD-01 (AM) | MKT-01 (Solution) | CSKH-01 |
|-----|:----------:|:-----------------:|:-------:|
| `crm_presales_solution.view` | ✓ | ✓ | — |
| `crm_presales_solution.edit` | — | ✓ | — |
| `crm_presales_solution.claim` | — | ✓ | — |
| `crm_presales_solution.release` | — | ✓ | — |
| Giao Solution (`crm_leads.edit` + stepper) | ✓ | — | — |
| Consult read-only (AM khi handoff active) | ✓ | — | — |

***
## 3.1 — CSKH-01: Nhân viên CSKH vận hành

*CRM · CSKH vận hành 24h — lead spa/operational*

### CRM — Bảng CSKH

| Section | Trang | Quyền |
|---------|-------|-------|
| CSKH — Phễu bán hàng | `/crm` | Xem |
| CSKH — Không gian nhân viên | `/crm` | Sửa, Xem |
| CSKH — Bảng Kanban | `/crm` | Tạo, Sửa, Xem |
| CSKH — Tạo yêu cầu mới | `/crm` | Tạo, Xem |
| ↳ **＋ Yêu cầu mới** | `/crm` | ✓ (create) |
| CSKH — Playbook quy trình | `/crm` | Xem |
| CSKH — Trang khách hàng | `/crm/customers` | Tạo, Sửa, Xem |
| ↳ **＋ Thêm khách hàng** | `/crm/customers` | ✓ (create) |
| CSKH — Trợ lý AI | `/crm` | Tạo, Xuất file, Xem |
### CRM — Marketing Hub

| Section | Trang | Quyền |
|---------|-------|-------|
| Hub — Nhắc việc | `/crm/hub` | Sửa, Xem |
### CRM — Bảng CSKH

| Section | Trang | Quyền |
|---------|-------|-------|
| Quản lý Lead | `/crm/leads` | Tạo, Sửa, Xuất file, Xem |
| ↳ **＋ Tạo lead** | `/crm/leads` | ✓ (create) |
| ↳ **Excel** | `/crm/leads` | ✓ (export) |
| ↳ **PDF** | `/crm/leads` | ✓ (export) |
| ↳ **Import CSV** | `/crm/leads` | ✓ (create) |
| ↳ **Facebook Lead** | `/crm/leads` | ✓ (create) |
| ↳ **Tìm kiếm AI** | `/crm/leads` | ✓ (view) |
| ↳ **→ Case/KH** | `/crm/leads` | ✓ (create) |
| ↳ **Phân lại owner** | `/crm/leads` | ✓ (edit) |
| ↳ **Gộp trùng** | `/crm/leads` | ✓ (edit) |
| ↳ **AI Tóm tắt** | `/crm/leads` | ✓ (view) |
| ↳ **AI Phân loại** | `/crm/leads` | ✓ (edit) |
| ↳ **Gợi ý** | `/crm/leads` | ✓ (view) |
| ↳ **Sửa** | `/crm/leads` | ✓ (edit) |
| ↳ **Chấm lại** | `/crm/leads` | ✓ (edit) |
| ↳ **＋ Ghi activity** | `/crm/leads` | ✓ (create) |
| ↳ **Lưu lead** | `/crm/leads` | ✓ (edit) |
### CRM — Nhân sự

| Section | Trang | Quyền |
|---------|-------|-------|
| Nhân sự — Báo cáo công việc ngày | `/crm/daily-reports` | Tạo, Sửa, Xem |
### CRM — KPI

| Section | Trang | Quyền |
|---------|-------|-------|
| KPI — Bản ghi theo kỳ | `/crm/kpi` | Sửa, Xem |
| ↳ **Lưu bản ghi KPI** | `/crm/kpi` | ✓ (edit) |
### CRM — Hướng dẫn

| Section | Trang | Quyền |
|---------|-------|-------|
| HDSD — Hướng dẫn sử dụng | `/crm/hdsd` | Xuất file, Xem |
### CRM — Chấm công

| Section | Trang | Quyền |
|---------|-------|-------|
| Chấm công — Bảng chấm công | `/crm/payroll` | Xem |

***

## 3.2 — KD-01: Account Manager (AM) B2B Sales

*CRM · B2B Sales — Intake → Giao Solution → Báo giá*

### CRM — Bảng CSKH

| Section | Trang | Quyền |
|---------|-------|-------|
| Quản lý Lead | `/crm/leads` | Tạo, Sửa, Xem |
| ↳ **Sửa** | `/crm/leads` | ✓ (edit) |
| ↳ **＋ Ghi activity** | `/crm/leads` | ✓ (create) |
### CRM — B2B Sales

| Section | Trang | Quyền |
|---------|-------|-------|
| Pre-sales — Solution/MKT | `/crm/solution/queue` | Xem |
### CRM — Hướng dẫn

| Section | Trang | Quyền |
|---------|-------|-------|
| HDSD — Hướng dẫn sử dụng | `/crm/hdsd` | Xuất file, Xem |
### CRM · Agency Ops

| Section | Trang | Quyền |
|---------|-------|-------|
| Agency Ops | `/crm/agency` | Cấu hình, Tạo, Sửa, Xem |
### CRM · Quảng cáo

| Section | Trang | Quyền |
|---------|-------|-------|
| Facebook Ads | `/crm/facebook-ads` | Cấu hình, Tạo, Sửa, Xem |
| Google Ads | `/crm/google-ads` | Xuất file, Xem |
### CRM · SEO/AEO

| Section | Trang | Quyền |
|---------|-------|-------|
| SEO/AEO Ops — Tổng quan | `/seo/hub` | Xem |
| SEO/AEO — Cài đặt client | `/seo/clients` | Cấu hình, Sửa, Xem |
| SEO/AEO — Báo cáo | `/seo/reports` | Xuất file, Xem |

***

## 3.3 — MKT-01: Trưởng phòng Marketing / Solution

*CRM · Solution/MKT — Consult, R5, release Sales*

### CRM — Bảng CSKH

| Section | Trang | Quyền |
|---------|-------|-------|
| CSKH — Phễu bán hàng | `/crm` | Xuất file, Xem |
| CSKH — Trang khách hàng | `/crm/customers` | Xem |
| CSKH — Trợ lý AI | `/crm` | Tạo, Xuất file, Xem |
### CRM — Marketing Hub

| Section | Trang | Quyền |
|---------|-------|-------|
| Hub — Chiến dịch | `/crm/hub` | Tạo, Xóa, Sửa, Xem |
| ↳ **Chiến dịch mới** | `/crm/hub` | ✓ (create) |
| Hub — Hợp đồng | `/crm/hub` | Sửa, Xem |
| Hub — Nhắc việc | `/crm/hub` | Tạo, Sửa, Xem |
| ↳ **Thêm nhắc việc** | `/crm/hub` | ✓ (create) |
### CRM — Marketing

| Section | Trang | Quyền |
|---------|-------|-------|
| Kế hoạch marketing | `/crm/marketing-plan` | Tạo, Sửa, Xuất file, Xem |
| Business Dashboard KPI | `/crm/business-dashboard` | Cấu hình, Xuất file, Xem |
| Dashboard tuần (Chủ DN) | `/crm/owner-weekly` | Cấu hình, Xuất file, Xem |
### CRM — Admin

| Section | Trang | Quyền |
|---------|-------|-------|
| CRM — Custom field & pipeline | `/admin/crm/custom-fields` | Cấu hình, Xem |
### CRM — SOP

| Section | Trang | Quyền |
|---------|-------|-------|
| SOP — Tiến trình đang chạy | `/crm/sop` | Tạo, Sửa, Xem |
| SOP — Playbook / Template | `/crm/sop` | Xem |
| SOP — Task quá hạn | `/crm/sop` | Sửa, Xem |
### CRM — Bảng CSKH

| Section | Trang | Quyền |
|---------|-------|-------|
| Quản lý Lead | `/crm/leads` | Cấu hình, Tạo, Sửa, Xuất file, Xem |
| ↳ **＋ Tạo lead** | `/crm/leads` | ✓ (create) |
| ↳ **Excel** | `/crm/leads` | ✓ (export) |
| ↳ **PDF** | `/crm/leads` | ✓ (export) |
| ↳ **Import CSV** | `/crm/leads` | ✓ (create) |
| ↳ **Facebook Lead** | `/crm/leads` | ✓ (create) |
| ↳ **Cấu hình phân lead** | `/crm/leads` | ✓ (configure) |
| ↳ **Quy tắc điểm & hạng** | `/crm/leads` | ✓ (configure) |
| ↳ **Tìm kiếm AI** | `/crm/leads` | ✓ (view) |
| ↳ **→ Case/KH** | `/crm/leads` | ✓ (create) |
| ↳ **Phân lại owner** | `/crm/leads` | ✓ (edit) |
| ↳ **Gộp trùng** | `/crm/leads` | ✓ (edit) |
| ↳ **AI Tóm tắt** | `/crm/leads` | ✓ (view) |
| ↳ **AI Phân loại** | `/crm/leads` | ✓ (edit) |
| ↳ **Gợi ý** | `/crm/leads` | ✓ (view) |
| ↳ **Sửa** | `/crm/leads` | ✓ (edit) |
| ↳ **Chấm lại** | `/crm/leads` | ✓ (edit) |
| ↳ **＋ Ghi activity** | `/crm/leads` | ✓ (create) |
| ↳ **Lưu lead** | `/crm/leads` | ✓ (edit) |
### CRM — B2B Sales

| Section | Trang | Quyền |
|---------|-------|-------|
| Pre-sales — Solution/MKT | `/crm/solution/queue` | Nhận case Solution, Sửa, Trả Sales / Báo giá, Xem |
### CRM — Nhân sự

| Section | Trang | Quyền |
|---------|-------|-------|
| Nhân sự — Báo cáo công việc ngày | `/crm/daily-reports` | Tạo, Sửa, Xuất file, Xem |
### CRM — KPI

| Section | Trang | Quyền |
|---------|-------|-------|
| KPI — Cảnh báo | `/crm/kpi` | Xem |
| KPI — Biểu đồ | `/crm/kpi` | Xuất file, Xem |
| KPI — Bản ghi theo kỳ | `/crm/kpi` | Tạo, Sửa, Xem |
| ↳ **Lưu bản ghi KPI** | `/crm/kpi` | ✓ (edit) |
### CRM — Hướng dẫn

| Section | Trang | Quyền |
|---------|-------|-------|
| HDSD — Hướng dẫn sử dụng | `/crm/hdsd` | Xuất file, Xem |
### CRM — Kinh doanh

| Section | Trang | Quyền |
|---------|-------|-------|
| KD — Tổng quan | `/crm/sales` | Xuất file, Xem |
| KD — Phễu bán hàng | `/crm/sales` | Xuất file, Xem |
| KD — Nghiên cứu thị trường | `/crm/sales` | Tạo, Sửa, Xem |
| Dự án BĐS — Tổng quan | `/crm/re-projects` | Xuất file, Xem |
| Dự án BĐS — Kế hoạch kinh doanh | `/crm/re-projects` | Xem |
| Dự án BĐS — Kế hoạch marketing | `/crm/re-projects` | Tạo, Sửa, Xem |
| ↳ **Lưu KH marketing dự án** | `/crm/re-projects` | ✓ (edit) |
| Dự án BĐS — Kế hoạch bán hàng | `/crm/re-projects` | Xem |
| Dự án BĐS — Hoạch định KPI | `/crm/re-projects` | Tạo, Sửa, Xem |
| Dự án BĐS — Quản lý sản phẩm | `/crm/re-projects` | Xem |
| Dự án BĐS — Quản lý rủi ro | `/crm/re-projects` | Tạo, Sửa, Xem |
| Dự án BĐS — Lợi nhuận & ngân sách | `/crm/re-projects` | Tạo, Sửa, Xuất file, Xem |
### CRM · Agency Ops

| Section | Trang | Quyền |
|---------|-------|-------|
| Agency Ops | `/crm/agency` | Cấu hình, Tạo, Sửa, Xem |
### CRM · Quảng cáo

| Section | Trang | Quyền |
|---------|-------|-------|
| Facebook Ads | `/crm/facebook-ads` | Cấu hình, Tạo, Sửa, Xem |
| Google Ads | `/crm/google-ads` | Xuất file, Xem |
### CRM · SEO/AEO

| Section | Trang | Quyền |
|---------|-------|-------|
| SEO/AEO Ops — Tổng quan | `/seo/hub` | Duyệt / phê duyệt, Cấu hình, Tạo, Sửa, Xuất file, Xem |
| SEO/AEO — Nội dung & Nghiên cứu | `/seo/research` | Tạo, Sửa, Xem |
| SEO/AEO — Phê duyệt | `/seo/content` | Duyệt / phê duyệt |
| SEO/AEO — Kỹ thuật | `/seo/technical` | Tạo, Sửa, Xem |
| SEO/AEO — Cài đặt client | `/seo/clients` | Cấu hình, Sửa, Xem |
| SEO/AEO — Báo cáo | `/seo/reports` | Xuất file, Xem |
### CRM · Email

| Section | Trang | Quyền |
|---------|-------|-------|
| Email Marketing | `/email/hub` | Duyệt / phê duyệt, Tuân thủ (email), Deliverability (email), Báo cáo (email), Cài đặt (email), Xem, Ghi (email) |

***

## 4. Ký duyệt

| Vai trò | Họ tên | Ngày | Chữ ký |
|---------|--------|------|--------|
| PO / Product Owner | | | |
| GDKD Sales | | | |
| Head Solution / MKT | | | |
| IT / Admin hệ thống | | | |

***

*In file này ra PDF: mở bằng VS Code / browser → Print → Save as PDF.*