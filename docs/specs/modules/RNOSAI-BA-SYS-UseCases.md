# RNOSAI BA — System Overview Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-SYS-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-SYS |
| Số UC | 12 |
| Spec thủ công | 12/12 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/00-SYSTEM-OVERVIEW.md`](../../use-cases/00-SYSTEM-OVERVIEW.md) |

---

## 1. Tóm tắt module

Use case cross-module: onboard client E2E, closed-loop Spend→Lead→Revenue, launch governance, client approval, báo cáo định kỳ, offboard, executive drill-down, webhook incident, cutover flags, audit trail, tenant isolation, hypercare.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-CRM-001 | Quản lý Lead (danh sách) | /crm/leads | Done | CRM-UC-001, CRM-UC-002, CRM-UC-015 |
| SCR-CRM-002 | Chi tiết Lead | /crm/leads/[id] | Done | CRM-UC-002, AI-UC-001, AI-UC-002, AI-UC-003, AI-UC-004 |
| SCR-CRM-003 | Phải tra soát (Review Queue) | /crm/leads/review-queue | Done | CRM-UC-003 |
| SCR-CRM-004 | Bảng CSKH SLA | /crm/cskh-board | Done | CRM-UC-008 |
| SCR-CRM-005 | Dashboard kinh doanh chủ DN | /crm/business-dashboard | Done | CRM-UC-014 |
| SCR-CRM-006 | Dự báo doanh thu (Forecast) | /crm/forecast | Done | AI-UC-013 |
| SCR-CRM-007 | Sức khỏe khách hàng (Health) | /crm/health | Done | AI-UC-017 |
| SCR-CRM-008 | Khách hàng (post-convert) | /crm/customers | Done | CRM-UC-007 |
| SCR-CRM-009 | Chi tiết Khách hàng | /crm/customers/[id] | Done | CRM-UC-007, AI-UC-008 |
| SCR-CRM-010 | Hub CRM / Review | /crm/hub | Done | CRM-UC-003, CRM-UC-011 |
| SCR-CRM-011 | KPI Dashboard nhân sự | /crm/kpi | Done | CRM-UC-013 |
| SCR-CRM-012 | Intake / Onboarding lead | /crm/intake | Done | CRM-UC-005, SYS-UC-001 |
| SCR-CRM-013 | Pipeline Sales | /crm/sales | In progress | CRM-UC-009 |
| SCR-CRM-014 | Đề xuất / Proposal | /crm/proposals | Done | CRM-UC-006 |
| SCR-CRM-015 | Dự án BĐS (RE Projects) | /crm/re-projects | Done | CRM-UC-010, META-UC-004 |
| SCR-CRM-016 | Quản lý nhân sự CRM | /crm/staff | Done | CRM-UC-013 |
| SCR-CRM-017 | Tickets / Case CSKH | /crm/tickets | Done | CRM-UC-008 |
| SCR-CRM-018 | Đơn hàng | /crm/orders | Done | SVC-UC-004 |
| SCR-CRM-019 | Hóa đơn | /crm/invoices | Done | SVC-UC-004 |
| SCR-CRM-020 | Tài chính / AR aging | /crm/financials | Done | SVC-UC-004, CRM-UC-011 |
| SCR-CRM-021 | Marketing Plan | /crm/marketing-plan | In progress | SVC-UC-011 |
| SCR-CRM-022 | SOP Library | /crm/sop | In progress | SVC-UC-011 |
| SCR-CRM-023 | Catalog dịch vụ / ngành | /crm/catalog | Done | CRM-UC-012 |
| SCR-CRM-024 | Staff KPI Dashboard | /crm/staff-kpi | Done | CRM-UC-013 |
| SCR-CRM-025 | Owner Weekly Report | /crm/owner-weekly | Done | CRM-UC-014 |
| SCR-CRM-026 | Payroll / chấm công | /crm/payroll | Done | CRM-UC-013 |
| SCR-CRM-027 | Chi tiết nhân sự | /crm/staff/[id] | Done | CRM-UC-013 |
| SCR-CRM-030 | Chi tiết Marketing Plan | /crm/marketing-plan/[id] | In progress | SVC-UC-011 |
| SCR-CRM-028 | Chi tiết dự án BĐS | /crm/re-projects/[id] | Done | CRM-UC-010 |
| SCR-CRM-029 | Chi tiết Service Delivery | /crm/service-delivery/[id] | Done | SVC-UC-001, SVC-UC-003 |
| SCR-SVC-001 | Launch QA Checklist | /crm/launch-qa | Done | SVC-UC-005 |
| SCR-SVC-002 | Campaign Write Queue | /crm/campaign-writes | Done | SVC-UC-007 |
| SCR-SVC-003 | Creative Hub | /crm/creatives | Done | SVC-UC-006 |
| SCR-SVC-004 | Service Delivery Workflow | /crm/service-delivery | Done | SVC-UC-001, SVC-UC-003 |
| SCR-AGENCY-001 | Chi tiết Client Agency | /agency/clients/[id] | Done | SVC-UC-002, SYS-UC-001 |
| SCR-AGENCY-002 | Tạo Client mới | /agency/clients/new | Done | SYS-UC-001, SVC-UC-002 |
| SCR-AGENCY-003 | Agency Hub | /agency | Done | SVC-UC-010 |
| SCR-AGENCY-004 | Ingest Monitor | /agency/ingest | Done | SVC-UC-009 |
| SCR-AGENCY-005 | Agency Jobs Queue | /agency/jobs | Done | PLAT-UC-007 |
| SCR-AGENCY-006 | KPI Definitions | /agency/kpi-definitions | Done | SVC-UC-010 |
| SCR-AGENCY-007 | Agency Notifications | /agency/notifications | Done | ZALO-UC-020 |
| SCR-META-001 | Facebook Ads Hub | /meta/facebook-ads | Done | META-UC-001, META-UC-002, META-UC-003 |
| SCR-META-002 | Meta Intelligence | /meta/intelligence | Done | META-UC-010, META-UC-011 |
| SCR-META-003 | Tracking Health & Pixel | /meta/tracking | Done | META-UC-006, META-UC-005 |
| SCR-META-004 | Ads Ops (Launch/Edit) | /meta/ads-ops | Done | META-UC-007, META-UC-008 |
| SCR-META-005 | Ads Combined (cross-channel) | /meta/ads-combined | Done | SYS-UC-002, ZALO-UC-018 |
| SCR-META-006 | Meta API Migration | /meta/migration | Draft | META-UC-014 |
| SCR-ADMIN-001 | Admin AI Runs | /admin/ai/runs | Done | AI-UC-009 |
| SCR-ADMIN-002 | Admin AI Agents | /admin/ai/agents | Done | AI-UC-010 |
| SCR-ADMIN-003 | Admin AI Tools | /admin/ai/tools | Done | AI-UC-020 |
| SCR-ADMIN-004 | CRM Pipeline Config | /admin/crm/pipeline | Done | CRM-UC-009 |
| SCR-ADMIN-005 | CRM Custom Fields | /admin/crm/custom-fields | Done | CRM-UC-012 |
| SCR-GOOGLE-001 | Google Ads Hub | /google/google-ads | Done | SVC-UC-008, PLAT-UC-005 |
| SCR-PORTAL-001 | Portal Dashboard KPI | /dashboard | Done | PORTAL-UC-001, PORTAL-UC-002 |
| SCR-PORTAL-002 | Portal Login | /login | Done | PORTAL-UC-001, PORTAL-UC-011, PLAT-UC-003 |
| SCR-PORTAL-003 | Portal Meta Performance | /meta | Done | PORTAL-UC-003 |
| SCR-PORTAL-004 | Portal Creatives Approval | /creatives | Done | PORTAL-UC-006, PORTAL-UC-009, PORTAL-UC-014 |
| SCR-PORTAL-005 | Portal Email Stats | /email | Done | PORTAL-UC-005, PORTAL-UC-008 |
| SCR-PORTAL-006 | Portal SEO Summary | /seo | Done | PORTAL-UC-004, PORTAL-UC-007 |
| SCR-PORTAL-007 | Portal Zalo Performance | /zalo | Done | PORTAL-UC-013, ZALO-UC-005 |
| SCR-PORTAL-008 | Portal Google Performance | /google | In progress | PORTAL-UC-015 |
| SCR-PORTAL-009 | Portal Notifications | /notifications | Done | PORTAL-UC-010, ZALO-UC-020 |
| SCR-PORTAL-010 | Portal Settings | /settings | Done | PORTAL-UC-010, PORTAL-UC-012 |
| SCR-PORTAL-011 | Portal Forgot Password | /forgot-password | Done | PORTAL-UC-011 |
| SCR-PORTAL-012 | Portal Reset Password | /reset-password | Done | PORTAL-UC-011 |
| SCR-PORTAL-013 | Portal Archived Client | /archived | Done | PORTAL-UC-001 |
| SCR-PORTAL-014 | Portal Email Approvals | /email/approvals | Done | PORTAL-UC-008 |
| SCR-PORTAL-015 | Portal Email Campaign Detail | /email/campaigns/[id] | Done | PORTAL-UC-005 |
| SCR-PORTAL-016 | Portal SEO Reports | /seo/reports | Done | PORTAL-UC-004, PORTAL-UC-010 |
| SCR-PORTAL-017 | Portal SEO Content List | /seo/content | Done | PORTAL-UC-007 |
| SCR-PORTAL-018 | Portal SEO Content Detail | /seo/content/[id] | Done | PORTAL-UC-007 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| SYS-UC-001 | Onboard client mới end-to-end | High | Done | Thủ công |
| SYS-UC-002 | Closed-loop Spend → Lead → Revenue | High | Done | Thủ công |
| SYS-UC-003 | Launch campaign đa kênh có governance | High | Done | Thủ công |
| SYS-UC-004 | Client approval cross-module | High | Done | Thủ công |
| SYS-UC-005 | Báo cáo định kỳ cho khách hàng | High | Done | Thủ công |
| SYS-UC-006 | Offboard client & thu hồi quyền | Medium | In progress | Thủ công |
| SYS-UC-007 | Drill-down executive ≤3 clicks | Medium | Done | Thủ công |
| SYS-UC-008 | Incident P1 — webhook down | High | Done | Thủ công |
| SYS-UC-009 | Staged prod cutover module flag | Medium | Done | Thủ công |
| SYS-UC-010 | Audit trail tra cứu cross-module | Medium | Done | Thủ công |
| SYS-UC-011 | Multi-client isolation verify | High | Done | Thủ công |
| SYS-UC-012 | Hypercare post go-live | Medium | In progress | Thủ công |

---

## 2. Chi tiết Use Case

### SYS-UC-001 — Onboard client mới end-to-end

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-001
- **Tên use case:** Onboard client mới end-to-end
- **Màn hình:** SCR-AGENCY-002, SCR-AGENCY-001
- **Actor chính:** AM / Admin
- **Actor phụ:** Tracking/Tech, Email/SEO Strategist
- **Mục tiêu:** Onboard client qua checklist và bật module theo HĐ
- **Trigger:** HĐ mới ký; lifecycle → Onboard
- **Pre-condition:** Lead convert hoặc customer CRM tồn tại; staff cap CRM/agency
- **Post-condition:** Client active; module flags theo HĐ; portal users (optional)
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-001, TC-ONBOARD-01
- **API / Integration:** POST /agency/clients/new · onboard orchestrator · SVC-UC-002

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM xác nhận customer master /crm/hub hoặc /crm/customers |
| 2 | Tạo service lifecycle stage Onboard SVC-UC-001 |
| 3 | Hoàn thành onboard checklist SVC-UC-002 |
| 4 | Onboard module theo HĐ: Meta META-UC-001, SEO SEO-UC-001, Email EM-UC-001 |
| 5 | Tracking verify webhook + CAPI META-UC-004/005 |
| 6 | AM tạo portal users PORTAL-UC-001 |
| 7 | Lifecycle → Deliver khi checklist pass |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Chỉ CRM chưa ads → defer Meta trong checklist |
| E2 | Client từ chối portal → optional; báo cáo manual |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | customer_id, service bundle, HĐ module list |
| Output | client_id, module flags, checklist audit, portal map |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-001 | Onboard client phải map ít nhất 1 channel account |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module |

### SYS-UC-002 — Closed-loop Spend → Lead → Revenue

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-002
- **Tên use case:** Closed-loop Spend → Lead → Revenue
- **Màn hình:** SCR-META-001, SCR-CRM-001, SCR-CRM-005
- **Actor chính:** GDKD / System
- **Actor phụ:** Media Buyer, AM, Sales
- **Mục tiêu:** Attribution Spend → Lead → Revenue visible hub + portal
- **Trigger:** Campaign Meta chạy; CRM lead ingest hoạt động
- **Pre-condition:** Ad account mapped; insights T-1 OK; CRM ingest OK
- **Post-condition:** CPL/ROAS closed-loop trên hub và portal
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-002, TC-LOOP-01
- **API / Integration:** Meta insights sync · CRM pipeline · hub KPI API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Worker sync Meta spend T-1 META-UC-003 |
| 2 | Webhook lead form → CRM lead META-UC-004, CRM-UC-001 |
| 3 | Sales cập nhật pipeline → Won CRM-UC-009 |
| 4 | CAPI conversion events META-UC-005 |
| 5 | Hub tính CPL, ROAS (revenue CRM nếu có) |
| 6 | AM review /meta/facebook-ads + báo cáo client SYS-UC-005 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend → CPL cảnh báo vàng; map campaign META-UC-002 |
| E2 | Không revenue data → ROAS ẩn; chỉ CPL |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | spend sync, leads, deal revenue, campaign map |
| Output | CPL, ROAS, attribution dashboard rows |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |
| BR-META-003 | CPL/ROAS tính theo last-click attribution default |

### SYS-UC-003 — Launch campaign đa kênh có governance

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-003
- **Tên use case:** Launch campaign đa kênh có governance
- **Màn hình:** SCR-SVC-001, SCR-META-004, SCR-SVC-002
- **Actor chính:** AM / Media Buyer
- **Actor phụ:** Creative Lead, Client Approver, Compliance
- **Mục tiêu:** Go-live campaign cross-channel với QA + approval audit
- **Trigger:** Yêu cầu go-live campaign mới
- **Pre-condition:** Client onboard; creative sẵn sàng; Launch QA policy bật
- **Post-condition:** Campaign live Meta; audit log đầy đủ
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-003
- **API / Integration:** Launch QA · Ads Ops wizard · Campaign Write queue · Meta launch API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Creative upload Creative Hub SVC-UC-006 |
| 2 | Launch QA checklist pass SVC-UC-005 |
| 3 | Buyer mở Ads Ops wizard META-UC-007 |
| 4 | Submit Campaign Write queue / Temporal SVC-UC-007 |
| 5 | Client approver portal PORTAL-UC-006 nếu policy yêu cầu |
| 6 | Governance pass → launch API Meta |
| 7 | Monitor hub + alerts META-UC-009 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Reject creative → quay bước 1 với comment |
| E2 | Budget over threshold → thêm approver GDKD BR-SVC-007 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative assets, campaign config, approval policy |
| Output | campaign_id live, governance audit chain |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit |
| BR-SVC-006 | Creative client approval required before ads wizard |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |

### SYS-UC-004 — Client approval cross-module

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-004
- **Tên use case:** Client approval cross-module
- **Màn hình:** SCR-PORTAL-004, SCR-PORTAL-006, SCR-PORTAL-005
- **Actor chính:** Client Approver
- **Actor phụ:** AM, Strategist (submitter)
- **Mục tiêu:** Client sign-off item cross-module với audit
- **Trigger:** Staff submit item pending_client_approval
- **Pre-condition:** Portal approver active; item pending_client_approval
- **Post-condition:** Audit ghi approver, timestamp, decision
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-004
- **API / Integration:** Portal approvals API · Temporal signals · notify webhooks

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Staff submit Meta creative / SEO content / Email campaign |
| 2 | System notify portal PORTAL-UC-006…008 |
| 3 | Approver login → inbox → preview |
| 4 | Approve → status cập nhật → staff notification |
| 5 | Staff tiếp tục launch/publish/send theo module |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Reject PORTAL-UC-009 — comment bắt buộc |
| E2 | SLA quá 24h → AM escalate manual |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | approval_item_id, module, preview payload |
| Output | decision, comment, audit record, downstream unlock |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |
| BR-PORTAL-009 | Reject without comment blocked min length |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification |

### SYS-UC-005 — Báo cáo định kỳ cho khách hàng

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-005
- **Tên use case:** Báo cáo định kỳ cho khách hàng
- **Màn hình:** SCR-PORTAL-001, SCR-PORTAL-003
- **Actor chính:** AM / System
- **Actor phụ:** Client Viewer
- **Mục tiêu:** Deliver báo cáo weekly/monthly PDF hoặc portal view
- **Trigger:** Scheduler weekly/monthly hoặc on-demand
- **Pre-condition:** Module sync OK; portal hoặc email recipient configured
- **Post-condition:** Artifact stored; delivery log
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-005
- **API / Integration:** Report scheduler · PDF worker · portal notification · email webhook

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Scheduler trigger Meta RPT, SEO PDF, Email schedule |
| 2 | Worker aggregate KPI T-1 / period |
| 3 | Generate PDF hoặc enable portal view |
| 4 | Deliver email webhook hoặc portal notification |
| 5 | AM confirm client đã nhận hypercare SYS-UC-012 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Sync fail → báo cáo partial + disclaimer yellow banner |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, period, module list, recipient config |
| Output | PDF/CSV artifact, delivery log, portal link |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |
| BR-META-013 | Weekly PDF client-safe — no internal margin/owner fields |
| BR-SEO-013 | Client PDF report client-safe metrics only |
| BR-PORTAL-003 | Meta portal CSV client-safe — no internal attribution fields |

### SYS-UC-006 — Offboard client & thu hồi quyền

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-006
- **Tên use case:** Offboard client & thu hồi quyền
- **Màn hình:** SCR-AGENCY-001
- **Actor chính:** Admin
- **Actor phụ:** AM, Tracking, DevOps
- **Mục tiêu:** Revoke access all modules; archive client
- **Trigger:** HĐ chấm dứt; lifecycle → Offboarding
- **Pre-condition:** Offboard request approved; SVC-UC-012 initiated
- **Post-condition:** Không active spend/send; tokens revoked; client Archived
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-006
- **API / Integration:** Token revoke APIs · portal disable · module pause endpoints

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Lifecycle stage Offboarding SVC-UC-012 |
| 2 | Revoke Meta token / pause email send / archive SEO sync |
| 3 | Disable portal users |
| 4 | Export data theo HĐ nếu yêu cầu |
| 5 | Archive client → Archived |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Outstanding legal hold → partial revoke with compliance ticket |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, offboard checklist, export request |
| Output | revoked tokens, archived status, export package |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-006 | Offboard revoke all OAuth portal webhook tokens |
| BR-SVC-012 | Offboard revoke all OAuth portal webhook tokens |

### SYS-UC-007 — Drill-down executive ≤3 clicks

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-007
- **Tên use case:** Drill-down executive ≤3 clicks
- **Màn hình:** SCR-CRM-005, SCR-META-001
- **Actor chính:** GDKD
- **Actor phụ:** AM, Head
- **Mục tiêu:** Trả lời client health trong ≤3 click từ hub tile
- **Trigger:** Review sáng hub executive
- **Pre-condition:** Hub KPI tiles populated; user cap executive dashboard
- **Post-condition:** Detail module reached ≤3 clicks; PO acceptance RNOS-46
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-46
- **API / Integration:** Hub drill-down routes · client workspace APIs

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở hub module SEO /email /meta |
| 2 | Click client health row (click 1) |
| 3 | Client workspace (click 2) |
| 4 | Module detail contacts/issues/campaign (click 3) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Missing module data → deep-link với stale banner not dead-end |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | hub context, client_id filter |
| Output | drill path ≤3 hops, detail view payload |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-007 | Executive drill-down ≤3 clicks từ dashboard tile |
| BR-CRM-014 | Dashboard kinh doanh chỉ aggregate tenant hiện tại |
| BR-SEO-012 | SEO hub drill-down ≤3 clicks |

### SYS-UC-008 — Incident P1 — webhook down

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-008
- **Tên use case:** Incident P1 — webhook down
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** DevOps / Admin
- **Actor phụ:** AM (comms client)
- **Mục tiêu:** Restore webhook ingest; log incident P1
- **Trigger:** Webhook error rate >1% hoặc zero ingest >15min
- **Pre-condition:** Monitoring alert RPT-M7 red; ingest monitor visible
- **Post-condition:** Ingest restored; incident log closed
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-008
- **API / Integration:** Ingest monitor · replay dead letter · alert webhooks

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Alert monitoring red trên /agency/ingest |
| 2 | DevOps verify nginx, Nest, signature, Meta app config |
| 3 | Fix hoặc rollback env |
| 4 | Replay failed events dead letter nếu có |
| 5 | Post-mortem + client comms nếu mất lead |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Signature misconfig → rotate secret + replay window |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | alert payload, failed event queue, runbook steps |
| Output | incident ticket, restore timestamp, replay count |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-008 | Webhook down P1 incident alert within 5 minutes |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 |
| BR-SVC-009 | Ingest monitor replay idempotent webhook payloads |

### SYS-UC-009 — Staged prod cutover module flag

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-009
- **Tên use case:** Staged prod cutover module flag
- **Màn hình:** SCR-ADMIN-002
- **Actor chính:** Super Admin
- **Actor phụ:** DevOps, Tech Lead
- **Mục tiêu:** Bật module theo gate A/B/C/D với soak evidence
- **Trigger:** Gate A / module pilot ready
- **Pre-condition:** Staging soak scripts available; feature flags configured
- **Post-condition:** Module enabled per tenant; smoke UAT sign-off
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-009
- **API / Integration:** Env flags PTT_* · ops-web NEXT_PUBLIC_* rebuild · gate scripts

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | B1: PTT_EMAIL_ENABLED=1 send off |
| 2 | Soak ≥3–7 ngày; gate scripts PASS |
| 3 | B2/B3/B4: bật send, portal, journeys theo checklist |
| 4 | Rebuild ops-web NEXT_PUBLIC_* flags |
| 5 | Smoke UAT + sign-off PLAT-UC-010 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Gate fail → rollback flag + incident note |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | module flag matrix, tenant list, gate script results |
| Output | enabled modules per env, soak evidence artifacts |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-009 | Staged prod cutover module flag soak ≥3 ngày gate PASS |
| BR-PLAT-010 | Health + soak gate PASS required trước prod cutover |

### SYS-UC-010 — Audit trail tra cứu cross-module

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-010
- **Tên use case:** Audit trail tra cứu cross-module
- **Màn hình:** SCR-ADMIN-001
- **Actor chính:** Compliance / Admin
- **Mục tiêu:** Tra cứu audit governance cross-module theo client/date/actor
- **Trigger:** Compliance review hoặc dispute investigation
- **Pre-condition:** Audit index populated từ EM, SEO, CRM, portal, AI
- **Post-condition:** Query returns hits với export optional
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** AI-UC-009
- **API / Integration:** GET /admin/audit · cross-module audit index

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Admin mở audit console SCR-ADMIN-001 |
| 2 | Filter client_id, date range, actor, module |
| 3 | Search spans Email E-13, SEO S-14, CRM workflow, portal approvals |
| 4 | View detail row immutable timestamp + payload hash |
| 5 | Export CSV scoped compliance role |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Index lag → show last_sync_at warning |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | filters: client_id, date, actor, module |
| Output | audit rows[], export file |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-010 | Cross-module audit query immutable export compliance role |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |
| BR-EM-012 | Governance rule changes audit immutable |

### SYS-UC-011 — Multi-client isolation verify

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-011
- **Tên use case:** Multi-client isolation verify
- **Màn hình:** SCR-AGENCY-001
- **Actor chính:** Admin / QA
- **Actor phụ:** Security
- **Mục tiêu:** Verify không cross-tenant data leak portal + staff APIs
- **Trigger:** Pen test checklist hoặc release gate
- **Pre-condition:** Multi-tenant data seeded TC-ISO-01
- **Post-condition:** Pen test checklist pass; no cross-client leak
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-011, TC-ISO-01
- **API / Integration:** All APIs filter client_id · portal JWT scope tests

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User client A login portal |
| 2 | API không trả data client B — 403 hoặc empty |
| 3 | Staff filter bắt buộc client_id Meta/SEO/Email APIs |
| 4 | Automated TC-ISO-01 regression |
| 5 | Document evidence cho nghiệm thu |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Leak detected → block release P0 hotfix |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | tenant A/B credentials, probe endpoints |
| Output | isolation test report pass/fail |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-011 | Multi-tenant isolation — no cross-client data leak |
| BR-PLAT-003 | Portal JWT scoped single client_id |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |

### SYS-UC-012 — Hypercare post go-live

> 🟢 Spec thủ công

- **Mã use case:** SYS-UC-012
- **Tên use case:** Hypercare post go-live
- **Màn hình:** SCR-CRM-004, SCR-AGENCY-001
- **Actor chính:** AM / CSKH
- **Actor phụ:** Tech Lead
- **Mục tiêu:** 30-day hypercare SLA sau go-live với daily standup
- **Trigger:** Sign-off nghiệm thu; SVC-UC-003 deliver milestone
- **Pre-condition:** Go-live date set; hypercare playbook configured
- **Post-condition:** Hypercare exit report; steady-state SLA handoff
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-012
- **API / Integration:** CSKH board SLA · hypercare tracker · soak scripts

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Start hypercare clock tại go-live Deliver |
| 2 | Daily standup 2–4 tuần AM + Tech Lead |
| 3 | P1 ack 30min; defect triage CRM-UC-008 board |
| 4 | Run soak scripts; monitor ingest + reports SYS-UC-005 |
| 5 | Hypercare exit report → steady-state SLA |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Critical defect → extend hypercare với PO sign-off |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | go_live_date, defect list, SLA config |
| Output | hypercare exit report, SLA handoff doc |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SYS-012 | Hypercare 30-day P1 ack SLA post go-live |
| BR-CRM-008 | SLA breach highlight trên CSKH board theo config |
| BR-SVC-003 | TMMT versioned trước lifecycle Deliver milestone |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map | High | Done |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail | High | Done |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module | High | Done |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer | High | Done |
| BR-SYS-006 | Offboard revoke all OAuth portal webhook tokens | High | In progress |
| BR-SYS-007 | Executive drill-down ≤3 clicks từ dashboard tile | Medium | Done |
| BR-SYS-008 | Webhook down P1 incident alert within 5 minutes | High | Done |
| BR-SYS-009 | Staged prod cutover module flag soak ≥3 ngày gate PASS | High | Done |
| BR-SYS-010 | Cross-module audit query immutable export compliance role | Medium | Done |
| BR-SYS-011 | Multi-tenant isolation — no cross-client data leak | High | Done |
| BR-SYS-012 | Hypercare 30-day P1 ack SLA post go-live | Medium | In progress |
| BR-SYS-001 | Onboard client phải map ít nhất 1 channel account | High | Done |
