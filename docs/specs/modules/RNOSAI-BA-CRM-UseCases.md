# RNOSAI BA — CRM Core Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-CRM-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-CRM |
| Số UC | 15 |
| Spec thủ công | 15/15 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/01-CRM-CORE.md`](../../use-cases/01-CRM-CORE.md) |

---

## 1. Tóm tắt module

Module CRM Core quản lý vòng đời lead (ingest → B2 → proposal → customer), CSKH SLA board, pipeline sales, RE projects, executive dashboard và import/export Excel (P0-2 Getfly parity). Hub hợp đồng liên kết RNOS-25 orders/invoices.

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

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| CRM-UC-001 | Đăng nhập & phân công lead tự động | High | Done | Thủ công |
| CRM-UC-002 | Chăm sóc lead B2 (Liên hệ OK) | High | Done | Thủ công |
| CRM-UC-003 | Review queue GDKD | High | Done | Thủ công |
| CRM-UC-004 | Add-on ngành trên lead | Medium | In progress | Thủ công |
| CRM-UC-005 | Pre-sales & KH MKT sơ bộ | High | Done | Thủ công |
| CRM-UC-006 | Chuyển lead → Proposal/HĐ | High | Done | Thủ công |
| CRM-UC-007 | Convert → Customer + Case | High | Done | Thủ công |
| CRM-UC-008 | Quản lý bảng CSKH | High | Done | Thủ công |
| CRM-UC-009 | Pipeline sales & đề xuất | Medium | In progress | Thủ công |
| CRM-UC-010 | Dự án BĐS (RE Projects) | Medium | Done | Thủ công |
| CRM-UC-011 | Hub hợp đồng & lifecycle | High | Done | Thủ công |
| CRM-UC-012 | Catalog dịch vụ/ngành | Medium | Done | Thủ công |
| CRM-UC-013 | KPI nhân sự & chấm công | Medium | Done | Thủ công |
| CRM-UC-014 | Dashboard kinh doanh chủ DN | Medium | Done | Thủ công |
| CRM-UC-015 | Import/export lead | Medium | Done | Thủ công |

---

## 2. Chi tiết Use Case

### CRM-UC-001 — Đăng nhập & phân công lead tự động

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-001
- **Tên use case:** Đăng nhập & phân công lead tự động
- **Màn hình:** SCR-CRM-001, SCR-AUTH-001
- **Actor chính:** CSKH / Sales
- **Actor phụ:** System (webhook ingest, assignment engine)
- **Mục tiêu:** Lead mới được gán owner primary tự động sau ingest
- **Trigger:** Lead mới từ Meta/Zalo/form hoặc import Excel
- **Pre-condition:** Staff đăng nhập ops-web; assignment rules configured; lead source mapped
- **Post-condition:** Lead có owner primary; audit source + timestamp
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** P0-2
- **API / Integration:** POST /api/v1/leads · POST /webhooks/meta|zalo · GET /crm/leads

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Webhook hoặc form submit tạo lead (PLAT-UC-004/005, META-UC-004, ZALO-UC-011) |
| 2 | Engine dedup theo phone/email (BR-CRM-001) |
| 3 | Gán owner: round-robin / territory / product line / ML route (RNOS-26) |
| 4 | Lead xuất hiện /crm/leads status Mới + cột AI Score |
| 5 | CSKH nhận notification in-app; trigger AI-UC-001 score async |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate → merge hoặc link existing lead; không tạo bản ghi trùng |
| E2 | Không match rule → fallback GDKD review queue (CRM-UC-003) |
| E3 | Import batch → queue assignment per row |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | Lead payload: phone, name, email, source, campaign_id, meta_json |
| Output | Lead record + owner_id + assignment audit + ingest source |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 |

### CRM-UC-002 — Chăm sóc lead B2 (Liên hệ OK)

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-002
- **Tên use case:** Chăm sóc lead B2 (Liên hệ OK)
- **Màn hình:** SCR-CRM-002
- **Actor chính:** CSKH
- **Mục tiêu:** Ghi nhận liên hệ thành công và chuyển status B2
- **Trigger:** CSKH liên hệ thành công lead Mới/B1
- **Pre-condition:** Lead status Mới/B1; staff là owner primary
- **Post-condition:** SLA contact time tracked; KPI CSKH cập nhật; activity timeline
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** PATCH /api/v1/leads/:id · POST activity · LeadFunnelPanel

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSKH mở /crm/leads/[id] — verify owner=me hoặc GDKD |
| 2 | Log call/note trên activity timeline |
| 3 | Cập nhật status → B2 — Liên hệ OK qua LeadFunnelPanel |
| 4 | Hệ thống ghi activity + SLA contact timestamp |
| 5 | Nếu qualify → chuyển Pre-sales CRM-UC-005 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Không liên lạc được → B1 retry hoặc Lost với reason bắt buộc |
| E2 | Copy SĐT/Zalo từ lead detail → log manual outreach |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, activity note, call outcome, next action |
| Output | updated status B2, activity record, SLA metrics |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-002 | Chuyển status B2 bắt buộc ghi activity timeline |

### CRM-UC-003 — Review queue GDKD

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-003
- **Tên use case:** Review queue GDKD
- **Màn hình:** SCR-CRM-003, SCR-CRM-010
- **Actor chính:** GDKD / Head Sales
- **Mục tiêu:** GDKD duyệt/reassign lead high-value hoặc không match assignment rule
- **Trigger:** Lead vào review queue: high value / no owner / policy
- **Pre-condition:** Agency tenant; lead flagged review_required
- **Post-condition:** Lead có owner hợp lệ hoặc archived với reason audit
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GET /crm/leads/review-queue · PATCH assign/reject

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | GDKD mở /crm/leads/review-queue hoặc hub CRM |
| 2 | Xem lead summary, source, estimated value, reason queue |
| 3 | Approve assign → chọn owner + priority |
| 4 | Reject/reassign → comment bắt buộc |
| 5 | Lead rời queue; notification gửi owner mới |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Deal > threshold → bắt buộc GDKD trước proposal (BR-CRM-003) |
| E2 | Bulk approve nhiều lead cùng owner |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, assignee_id, priority, reject_reason |
| Output | assignment audit, queue status cleared |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-003 | Review queue: deal > threshold bắt buộc GDKD approve |

### CRM-UC-004 — Add-on ngành trên lead

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-004
- **Tên use case:** Add-on ngành trên lead
- **Màn hình:** SCR-CRM-002
- **Actor chính:** CSKH / AM
- **Mục tiêu:** Theo dõi nhu cầu đa ngành trên một lead (BĐS + MKT + …)
- **Trigger:** Lead có nhu cầu cross-industry trong discovery
- **Pre-condition:** Lead active; catalog ngành seeded CRM-UC-012
- **Post-condition:** Lead có 1+ add-on lines; routing rules áp dụng per line
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** PATCH lead add-ons · catalog API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở lead detail → tab Add-ons |
| 2 | Chọn ngành từ catalog (CRM-UC-012) |
| 3 | Gán specialist phụ theo ngành |
| 4 | Pipeline tracking per add-on line trên funnel panel |
| 5 | Add-on Won/Lost độc lập với lead master status |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate add-on ngành → merge lines |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, industry_sku[], specialist_ids[] |
| Output | add_on lines[], routing overrides |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-004 | Add-on ngành: routing specialist theo catalog line |
| BR-CRM-012 | Catalog SKU disabled không xóa proposal in-use |

### CRM-UC-005 — Pre-sales & KH MKT sơ bộ

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-005
- **Tên use case:** Pre-sales & KH MKT sơ bộ
- **Màn hình:** SCR-CRM-012, SCR-CRM-002
- **Actor chính:** Pre-sales / AM
- **Mục tiêu:** Discovery qualify và tạo KH MKT sơ bộ (draft scope)
- **Trigger:** Lead B2 qualify sau CRM-UC-002
- **Pre-condition:** Lead status B2+; pre-sales cap enabled
- **Post-condition:** KH MKT draft linked to lead; stage Proposal prep
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /crm/intake · pre-sales record API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Pre-sales discovery call → ghi needs, budget, timeline trên /crm/intake |
| 2 | Tạo KH MKT sơ bộ draft scope document |
| 3 | Attach competitor / brief docs |
| 4 | Chuyển stage → Proposal prep (CRM-UC-006) |
| 5 | Notify AM nếu handoff từ CSKH |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Not qualify → return lead CSKH với reason |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, discovery notes, budget_range, timeline, attachments[] |
| Output | pre_sales_record_id, KH MKT draft_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-005 | Pre-sales record bắt buộc trước proposal stage |

### CRM-UC-006 — Chuyển lead → Proposal/HĐ

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-006
- **Tên use case:** Chuyển lead → Proposal/HĐ
- **Màn hình:** SCR-CRM-014, SCR-CRM-002
- **Actor chính:** Sales / AM
- **Mục tiêu:** Tạo proposal từ template → client accept → HĐ draft
- **Trigger:** Client đồng ý scope sơ bộ (CRM-UC-005)
- **Pre-condition:** Lead qualified; catalog dịch vụ active
- **Post-condition:** Proposal linked; HĐ record nếu ký; stage Proposal/Won path
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /crm/proposals · GET/POST contracts API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM tạo Proposal từ template trên /crm/proposals |
| 2 | Chọn dịch vụ từ catalog → pricing lines |
| 3 | Gửi client email/PDF export |
| 4 | Client accept → tạo HĐ draft |
| 5 | Legal/finance sign-off → HĐ active → CRM-UC-007 path |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Revision → version proposal; giữ history |
| E2 | GDKD approval nếu deal > threshold (CRM-UC-003) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, service_skus[], pricing_lines[], proposal_version |
| Output | proposal_id, contract_draft_id, PDF artifact |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-006 | Proposal version history immutable; client accept audit |
| BR-CRM-003 | Review queue: deal > threshold bắt buộc GDKD approve |

### CRM-UC-007 — Convert → Customer + Case

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-007
- **Tên use case:** Convert → Customer + Case
- **Màn hình:** SCR-CRM-008, SCR-CRM-009, SCR-CRM-002
- **Actor chính:** Sales / AM
- **Actor phụ:** System
- **Mục tiêu:** Convert lead/deal Won → Customer master + delivery case
- **Trigger:** HĐ ký / Won deal
- **Pre-condition:** Contract signed; unique customer code available
- **Post-condition:** Customer active; duplicate lead merged; SVC onboard triggered
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-001
- **API / Integration:** POST /api/v1/leads/:id/convert · GET /crm/customers

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM action Convert to Customer trên lead/deal detail |
| 2 | System tạo Customer master + link HĐ |
| 3 | Tạo Case delivery initial (optional RE project CRM-UC-010) |
| 4 | Trigger service lifecycle Onboard SVC-UC-001 |
| 5 | Revenue fields feed closed-loop SYS-UC-002 |
| 6 | Timeline enrich AI-UC-008 trên customer detail |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate legal entity → merge customer records |
| E2 | Partial convert → retain lead for upsell lines |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, contract_id, customer legal fields |
| Output | customer_id, case_id, merge audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-007 | Customer code unique; một legal entity một master |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### CRM-UC-008 — Quản lý bảng CSKH

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-008
- **Tên use case:** Quản lý bảng CSKH
- **Màn hình:** SCR-CRM-004, SCR-CRM-017
- **Actor chính:** CSKH / CSKH Lead
- **Mục tiêu:** Theo dõi case CSKH Kanban SLA + ticket queue
- **Trigger:** Daily ops CSKH; case mới hoặc SLA breach
- **Pre-condition:** Case CSKH tồn tại; cap cskh.view
- **Post-condition:** Kanban SLA accurate; breaches visible; assignments updated
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** P1-3, RNOS-24
- **API / Integration:** GET /api/v1/cskh/board · PATCH cases/:id · /crm/tickets

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSKH mở /crm/cskh-board Kanban |
| 2 | Filter owner, SLA status, client |
| 3 | Kéo thả hoặc cập nhật case status |
| 4 | SLA badge xanh/vàng/đỏ realtime |
| 5 | Bulk assign / reschedule follow-up; export snapshot standup |
| 6 | Ticket queue /crm/tickets cho case phức tạp |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Reassign case → owner mới notification |
| E2 | SLA breach → escalate GDKD optional |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | case_id, new status, assignee, due_at |
| Output | updated Kanban state, SLA metrics, export CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-008 | SLA breach highlight trên CSKH board theo config |

### CRM-UC-009 — Pipeline sales & đề xuất

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-009
- **Tên use case:** Pipeline sales & đề xuất
- **Màn hình:** SCR-CRM-013
- **Actor chính:** Sales / GDKD
- **Mục tiêu:** Kanban pipeline deals Qualify → Won/Lost với forecast weight
- **Trigger:** Deal enter pipeline hoặc stage drag
- **Pre-condition:** Lead qualified hoặc proposal linked
- **Post-condition:** Pipeline report accurate; Won triggers CRM-UC-007
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-23
- **API / Integration:** GET/PATCH /crm/sales/pipeline · deal score AI-UC-012

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /crm/sales pipeline Kanban |
| 2 | Drag stage: Qualify → Proposal → Negotiation → Won/Lost |
| 3 | Ghi lost reason taxonomy nếu Lost |
| 4 | Forecast weight per stage cho GDKD dashboard |
| 5 | Deal score mini-bar AI-UC-012; NBA AI-UC-011 nếu stalled |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Won → prompt convert customer CRM-UC-007 |
| E2 | Stage regression → audit who moved back |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | deal_id, new_stage, lost_reason?, quote_value |
| Output | pipeline snapshot, forecast delta, deal score |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-009 | Pipeline lost reason taxonomy bắt buộc khi stage Lost |
| BR-AI-011 | NBA không emit trên deal Won hoặc vừa close |

### CRM-UC-010 — Dự án BĐS (RE Projects)

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-010
- **Tên use case:** Dự án BĐS (RE Projects)
- **Màn hình:** SCR-CRM-015
- **Actor chính:** RE PM / AM BĐS
- **Mục tiêu:** Quản lý RE project: units inventory, campaign mapping, lead theo dự án
- **Trigger:** Tạo RE project gắn customer hoặc pre-launch
- **Pre-condition:** RE module enabled; Facebook leadgen webhook configured
- **Post-condition:** Leads mapped to project; attribution per dự án
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R1
- **Trace ref:** TC-PROJ-08, META-UC-004
- **API / Integration:** POST /crm/re-projects · webhook leadgen map project_id

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tạo RE project: tên, location, units inventory |
| 2 | Map Meta/Zalo campaigns → project (hub map) |
| 3 | Webhook leadgen gắn project_id + assignment pool BĐS |
| 4 | Báo cáo leads/conversion theo project |
| 5 | Drill lead list filter project trên /crm/leads |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unit sold out → stop assign new leads to unit |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | project config, units[], campaign_map[] |
| Output | project_id, lead attribution, inventory state |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-010 | RE project lead gắn project_id; pool assign theo phân khu |
| BR-META-004 | Webhook leadgen verify signature + map field VN |

### CRM-UC-011 — Hub hợp đồng & lifecycle

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-011
- **Tên use case:** Hub hợp đồng & lifecycle
- **Màn hình:** SCR-CRM-010
- **Actor chính:** AM / GDKD / Finance
- **Mục tiêu:** Single pane contract health + lifecycle stage per client
- **Trigger:** AM/GDKD mở hub CRM daily
- **Pre-condition:** Contracts exist in system
- **Post-condition:** Renewal alerts visible; drill HĐ → services → invoices
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-25
- **API / Integration:** GET /crm/hub · contract lifecycle API · orders/invoices drill

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /crm/hub — contracts expiring widget |
| 2 | Drill client → HĐ detail → linked services modules |
| 3 | Alert renewal 30/60/90 days |
| 4 | Link orders/invoices RNOS-25 finance gate |
| 5 | Review queue shortcut CRM-UC-003 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Overdue invoice → highlight red; block handover SVC-UC-004 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | filter client, lifecycle stage, date range |
| Output | hub dashboard state, renewal task suggestions |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-011 | Hub contract renewal alert 30/60/90 ngày |
| BR-SVC-004 | Handover blocked nếu invoice overdue RNOS-25 |

### CRM-UC-012 — Catalog dịch vụ/ngành

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-012
- **Tên use case:** Catalog dịch vụ/ngành
- **Màn hình:** SCR-CRM-012
- **Actor chính:** Admin / AM
- **Mục tiêu:** CRUD service SKUs, industry verticals, pricing tiers cho proposal
- **Trigger:** Admin maintain catalog hoặc AM chọn dịch vụ proposal
- **Pre-condition:** Admin cap catalog.edit
- **Post-condition:** Service lines selectable on proposals; disabled SKUs hidden
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET/POST /crm/catalog · admin catalog API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Admin mở catalog management (intake/admin route) |
| 2 | CRUD service SKUs + industry verticals |
| 3 | Set pricing tiers và enable/disable per SKU |
| 4 | AM chọn catalog lines trên proposal CRM-UC-006 |
| 5 | Add-on ngành CRM-UC-004 reference same catalog |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Disable SKU in-use → grandfather existing proposals |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | sku code, name, industry, price_tier, active flag |
| Output | catalog version, selectable SKUs list |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-012 | Catalog SKU disabled không xóa proposal in-use |

### CRM-UC-013 — KPI nhân sự & chấm công

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-013
- **Tên use case:** KPI nhân sự & chấm công
- **Màn hình:** SCR-CRM-011, SCR-CRM-016
- **Actor chính:** GDKD / HR / Team Lead
- **Mục tiêu:** Attendance + KPI scorecard per staff (leads handled, conversion)
- **Trigger:** Monthly close hoặc GDKD review /crm/kpi
- **Pre-condition:** Staff roster active SCR-CRM-016; caps assigned
- **Post-condition:** KPI tiles rendered; export staff KPI Excel
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-42
- **API / Integration:** GET /crm/kpi · export Excel · staff roster API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | HR maintain roster /crm/staff caps và teams |
| 2 | Attendance log ingest (manual or integration) |
| 3 | KPI targets per role: leads handled, B2 rate, conversion |
| 4 | GDKD mở /crm/kpi — tiles + drill staff row |
| 5 | Export staff KPI Excel for payroll/bonus review |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Missing attendance → KPI partial with warning |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | staff_id, period, attendance records, KPI targets |
| Output | scorecard tiles, Excel export file |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-013 | Staff KPI export chỉ tenant hiện tại; HR cap required |

### CRM-UC-014 — Dashboard kinh doanh chủ DN

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-014
- **Tên use case:** Dashboard kinh doanh chủ DN
- **Màn hình:** SCR-CRM-005
- **Actor chính:** GDKD / Chủ DN
- **Mục tiêu:** Executive dashboard revenue YTD, pipeline, win rate, channel mix
- **Trigger:** GDKD mở /crm/business-dashboard
- **Pre-condition:** Finance + CRM data synced tenant scope
- **Post-condition:** Drill-down ≤3 clicks SYS-UC-007; tiles accurate
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-46
- **API / Integration:** GET /api/v1/crm/business-dashboard

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /crm/business-dashboard executive tiles |
| 2 | Xem revenue YTD, pipeline weighted, win rate, top AM |
| 3 | Channel mix Meta/Zalo/Google split |
| 4 | Drill tile → detail module ≤3 clicks |
| 5 | Optional export PDF snapshot |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Cross-tenant data probe → empty/403 (BR-CRM-014) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | tenant_id, date_range, drill path |
| Output | KPI aggregates, drill targets, PDF export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-014 | Dashboard kinh doanh chỉ aggregate tenant hiện tại |
| BR-SYS-007 | Executive drill-down ≤3 clicks từ dashboard tile |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |

### CRM-UC-015 — Import/export lead

> 🟢 Spec thủ công

- **Mã use case:** CRM-UC-015
- **Tên use case:** Import/export lead
- **Màn hình:** SCR-CRM-001
- **Actor chính:** Sales / AM / Admin
- **Mục tiêu:** Import/export lead Excel/CSV với validate và dedup preview
- **Trigger:** User bấm Import/Export trên CrmLeadsImportExport toolbar
- **Pre-condition:** Cap crm_leads.edit; template chuẩn downloaded
- **Post-condition:** Import job log; source tagged import; export filter results
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R1
- **Trace ref:** P0-2
- **API / Integration:** POST /api/v1/leads/import · GET export · leads_import_sample.csv

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Download CSV/Excel template chuẩn |
| 2 | Upload file → validate columns bắt buộc phone/name |
| 3 | Dedup preview: new vs skip vs update rows |
| 4 | Confirm import → batch create/update + assignment CRM-UC-001 |
| 5 | Export filter results CSV từ danh sách hiện tại |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Validation fail → row-level error report; partial import optional |
| E2 | Missing required column → HTTP 400 + message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | import file, column mapping, dedup mode |
| Output | import job result counts, export CSV, audit log |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-015 | Import Excel phải dùng template chuẩn + validate cột bắt buộc |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email | High | Done |
| BR-CRM-002 | Chuyển status B2 bắt buộc ghi activity timeline | High | Done |
| BR-CRM-003 | Review queue: deal > threshold bắt buộc GDKD approve | High | Done |
| BR-CRM-004 | Add-on ngành: routing specialist theo catalog line | Medium | In progress |
| BR-CRM-005 | Pre-sales record bắt buộc trước proposal stage | High | Done |
| BR-CRM-006 | Proposal version history immutable; client accept audit | High | Done |
| BR-CRM-007 | Customer code unique; một legal entity một master | High | Done |
| BR-CRM-008 | SLA breach highlight trên CSKH board theo config | High | Done |
| BR-CRM-009 | Pipeline lost reason taxonomy bắt buộc khi stage Lost | Medium | In progress |
| BR-CRM-010 | RE project lead gắn project_id; pool assign theo phân khu | High | Done |
| BR-CRM-011 | Hub contract renewal alert 30/60/90 ngày | High | Done |
| BR-CRM-012 | Catalog SKU disabled không xóa proposal in-use | Medium | Done |
| BR-CRM-013 | Staff KPI export chỉ tenant hiện tại; HR cap required | Medium | Done |
| BR-CRM-014 | Dashboard kinh doanh chỉ aggregate tenant hiện tại | High | Done |
| BR-CRM-015 | Import Excel phải dùng template chuẩn + validate cột bắt buộc | High | Done |
