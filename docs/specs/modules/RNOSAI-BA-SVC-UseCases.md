# RNOSAI BA — Agency Service Delivery Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-SVC-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-AGENCY |
| Số UC | 12 |
| Spec thủ công | 12/12 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/02-AGENCY-SERVICE-DELIVERY.md`](../../use-cases/02-AGENCY-SERVICE-DELIVERY.md) |

---

## 1. Tóm tắt module

Module Service Delivery quản lý lifecycle 7 giai đoạn (Prospect → Offboarding), onboard checklist, TMMT deliver, Launch QA, Creative Hub, Campaign Write governance, channel account mapping và offboarding SOP.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
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

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| SVC-UC-001 | Workflow lifecycle 7 stage | High | Done | Thủ công |
| SVC-UC-002 | Onboard checklist client | High | Done | Thủ công |
| SVC-UC-003 | Deliver stage — TMMT chính thức | High | Done | Thủ công |
| SVC-UC-004 | Handover → Retain + finance gate | High | Done | Thủ công |
| SVC-UC-005 | Launch QA checklist | High | Done | Thủ công |
| SVC-UC-006 | Creative Hub upload & review | High | Done | Thủ công |
| SVC-UC-007 | Campaign Write queue approval | High | Done | Thủ công |
| SVC-UC-008 | Map channel account (Meta/Google) | High | Done | Thủ công |
| SVC-UC-009 | Agency ingest monitor | Medium | Done | Thủ công |
| SVC-UC-010 | KPI definitions agency-wide | Medium | Done | Thủ công |
| SVC-UC-011 | SOP & marketing plan | Medium | In progress | Thủ công |
| SVC-UC-012 | Offboarding SOP | Medium | Draft | Thủ công |

---

## 2. Chi tiết Use Case

### SVC-UC-001 — Workflow lifecycle 7 stage

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-001
- **Tên use case:** Workflow lifecycle 7 stage
- **Màn hình:** SCR-SVC-004, SCR-AGENCY-001
- **Actor chính:** AM / PM
- **Actor phụ:** Strategist, Finance
- **Mục tiêu:** Theo dõi lifecycle client 7 giai đoạn agency
- **Trigger:** Customer convert / HĐ active
- **Pre-condition:** Customer record exists; service line selected from HĐ
- **Post-condition:** Stage history immutable log; badge visible on agency hub
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GET/PATCH /agency/clients/:id/lifecycle · lifecycle API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | System khởi tạo lifecycle: Prospect → Onboard → Deliver → Optimize → Handover → Retain → Offboarding |
| 2 | AM chuyển stage manual hoặc auto khi checklist gate pass |
| 3 | Mỗi stage có gate items (SVC-UC-002…004) |
| 4 | Hub /agency/clients/[id] hiển thị stage badge |
| 5 | Audit mọi stage transition với actor + timestamp |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Skip stage pilot → Admin override + audit reason bắt buộc |
| E2 | Deliver blocked nếu onboard incomplete BR-SVC-001 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, target_stage, override_reason? |
| Output | lifecycle_state, stage_history[] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-001 | Không Deliver nếu onboard checklist incomplete |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module |

### SVC-UC-002 — Onboard checklist client

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-002
- **Tên use case:** Onboard checklist client
- **Màn hình:** SCR-AGENCY-001, SCR-AGENCY-002
- **Actor chính:** AM / Tracking-Tech
- **Mục tiêu:** Hoàn tất onboard checklist trước go-live module
- **Trigger:** Lifecycle stage = Onboard
- **Pre-condition:** New client record created SYS-UC-001
- **Post-condition:** 100% required items pass; gate cleared for Deliver
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-001
- **API / Integration:** GET/PATCH onboard checklist · /agency/clients/new wizard

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở onboard checklist template theo service bundle |
| 2 | Items: legal docs, billing, ad account, pixel, GSC, email domain, portal users |
| 3 | Mark done per item; attach evidence links |
| 4 | Orchestrator deep-links per module (Meta, Zalo, SEO, EM) |
| 5 | Complete onboard khi 100% required items pass |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Optional item skip → yellow state with AM sign-off |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, checklist item statuses[], evidence URLs |
| Output | checklist completion audit, module enable flags |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module |
| BR-SYS-001 | Onboard client phải map ít nhất 1 channel account |

### SVC-UC-003 — Deliver stage — TMMT chính thức

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-003
- **Tên use case:** Deliver stage — TMMT chính thức
- **Màn hình:** SCR-SVC-004
- **Actor chính:** AM / PM / Media Buyer
- **Mục tiêu:** Publish TMMT và go-live campaign đầu tiên
- **Trigger:** Onboard complete; first campaign ready
- **Pre-condition:** SVC-UC-002 complete; Launch QA eligible
- **Post-condition:** Client officially in delivery; TMMT versioned; hypercare clock start
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** TMMT doc store · PATCH lifecycle stage Deliver

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM chuyển lifecycle → Deliver |
| 2 | Publish TMMT (tài liệu mục tiêu marketing) trên client workspace |
| 3 | Launch QA SVC-UC-005 + first campaign SYS-UC-003 |
| 4 | Hypercare clock start SYS-UC-012 |
| 5 | Notify client portal milestone optional |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | TMMT revision → version bump v2, v3… |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, TMMT document, campaign launch refs |
| Output | TMMT version id, deliver milestone audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-003 | TMMT versioned trước lifecycle Deliver milestone |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |

### SVC-UC-004 — Handover → Retain + finance gate

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-004
- **Tên use case:** Handover → Retain + finance gate
- **Màn hình:** SCR-CRM-018, SCR-CRM-019, SCR-AGENCY-001
- **Actor chính:** AM / Finance
- **Mục tiêu:** Handover pack + finance verify → Retain steady-state
- **Trigger:** Deliver period end; KPI stable
- **Pre-condition:** Delivery complete; billing data synced RNOS-25
- **Post-condition:** Retain playbook active; AM primary contact documented
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-25
- **API / Integration:** GET/POST /crm/orders · /crm/invoices · handover forms

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM compile handover pack: reports, SOP, contacts |
| 2 | Finance verify billing current CRM-UC-011; check invoice overdue |
| 3 | Stage → Handover → client sign-off meeting recorded |
| 4 | Create/update crm_orders + crm_invoices if pending RNOS-25 |
| 5 | Stage → Retain — steady-state SLA playbook |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Outstanding invoice → block Handover until paid |
| E2 | Partial handover → retain with open finance ticket |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, handover checklist, invoice status |
| Output | lifecycle Retain, order/invoice records, sign-off audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-004 | Handover blocked nếu invoice overdue RNOS-25 |
| BR-CRM-011 | Hub contract renewal alert 30/60/90 ngày |

### SVC-UC-005 — Launch QA checklist

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-005
- **Tên use case:** Launch QA checklist
- **Màn hình:** SCR-SVC-001
- **Actor chính:** Media Buyer / Creative Lead
- **Mục tiêu:** Pre-launch QA gate: UTM, pixel, LP, creative, budget
- **Trigger:** Pre-launch campaign trên Meta/Zalo/Google
- **Pre-condition:** Campaign draft ready; creative approved path
- **Post-condition:** QA record linked to campaign write job
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-003
- **API / Integration:** GET/PATCH /crm/launch-qa · Launch QA API · export PDF sign-off

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /crm/launch-qa cho client/campaign |
| 2 | Verify: UTM, pixel, landing page, creative spec, budget cap, audience |
| 3 | Pass/Fail per item; block launch on critical fail (configurable) |
| 4 | Export QA sign-off PDF |
| 5 | Link QA record → META-UC-007 / ZALO launch path |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Critical fail → block campaign write queue submit |
| E2 | Waive fail → GDKD override with reason |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, campaign_id, QA checklist items[] |
| Output | QA pass/fail record, PDF artifact, gate flag |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit |
| BR-META-007 | Launch wizard bắt buộc Launch QA + Campaign Write approval |

### SVC-UC-006 — Creative Hub upload & review

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-006
- **Tên use case:** Creative Hub upload & review
- **Màn hình:** SCR-SVC-003, SCR-PORTAL-004
- **Actor chính:** Creative Lead
- **Actor phụ:** Client Approver
- **Mục tiêu:** Upload creative assets + internal review + client approval
- **Trigger:** Brief approved; creative production start
- **Pre-condition:** Client/campaign context set
- **Post-condition:** Approved assets available in Ads wizard; version control
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /crm/creatives · asset API · portal approval PORTAL-UC-006

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Upload assets image/video/copy → Creative Hub /crm/creatives |
| 2 | Tag client, campaign, format 1:1, 9:16, … |
| 3 | Internal review → status Approved internal |
| 4 | Submit client approval portal /creatives PORTAL-UC-006 |
| 5 | Approved assets unlock META-UC-007 / ZALO-UC-008 wizard |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client reject → revision loop with comment PORTAL-UC-009 |
| E2 | Asset expiry date optional flag on version |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative files[], metadata tags, review notes |
| Output | creative version ids, approval status, audit trail |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-006 | Creative client approval required before ads wizard |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |

### SVC-UC-007 — Campaign Write queue approval

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-007
- **Tên use case:** Campaign Write queue approval
- **Màn hình:** SCR-SVC-002, SCR-META-004
- **Actor chính:** Media Buyer / GDKD
- **Mục tiêu:** Governance queue trước Meta API create/edit
- **Trigger:** Submit campaign create/edit wizard
- **Pre-condition:** Launch QA passed for create; policy rules configured
- **Post-condition:** Audit submitter, approvers, Meta API response ids
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** /crm/campaign-writes · Temporal PLAT-UC-008 · Meta Marketing API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer submit ads-ops wizard → job Campaign Write queue |
| 2 | Policy check: budget threshold → GDKD approve required |
| 3 | Temporal workflow orchestrate approval steps |
| 4 | Approved → Meta API execute create/edit |
| 5 | Failed → retry/alert buyer; audit response ids |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Meta API error → job status failed; buyer fix resubmit |
| E2 | Reject → comment to buyer; draft remains editable |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | write job payload, budget, approver chain |
| Output | job status, Meta external ids, approval audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |
| BR-META-008 | Campaign edit qua write queue — no direct API bypass prod |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification |

### SVC-UC-008 — Map channel account (Meta/Google)

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-008
- **Tên use case:** Map channel account (Meta/Google)
- **Màn hình:** SCR-META-001, SCR-GOOGLE-001, SCR-AGENCY-001
- **Actor chính:** AM / Tracking-Tech
- **Mục tiêu:** Link Meta/Google ad account → client unique mapping
- **Trigger:** Onboard channel step or settings update
- **Pre-condition:** OAuth credentials available
- **Post-condition:** client_id ↔ ad_account_id mapping unique; sync workers enabled
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /clients/:id/channel-accounts · META-UC-001 · Google sync

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Agency client settings → Channel accounts tab |
| 2 | Link Meta ad account id / Google Ads customer id |
| 3 | OAuth flow → verify token valid |
| 4 | Enable sync workers insights daily |
| 5 | Hub reflects connected status green |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Token invalid → red status + re-auth banner |
| E2 | Account already mapped other client → 409 conflict |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, channel, external_account_id, oauth tokens |
| Output | channel_account row, sync enable flag |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-008 | Channel account mapping unique per client |
| BR-META-001 | Ad account OAuth refresh trước khi hết hạn token |

### SVC-UC-009 — Agency ingest monitor

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-009
- **Tên use case:** Agency ingest monitor
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** Admin / DevOps / Tracking-Tech
- **Mục tiêu:** Monitor webhook volume, error rate, lag per channel
- **Trigger:** DevOps daily check or incident SYS-UC-008
- **Pre-condition:** Webhooks configured PLAT-UC-004/005/006
- **Post-condition:** Failed payloads replayable; SLA visible
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /agency/ingest · webhook metrics · replay API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /agency/ingest dashboard |
| 2 | View volume, error rate, lag per channel Meta/Zalo/Email |
| 3 | Drill failed payload sample (no PII prod log) |
| 4 | Replay failed webhook with audit |
| 5 | Alert if SLA breach → SYS-UC-008 incident |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Replay duplicate → idempotency skip |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | channel filter, time range, failed job ids |
| Output | metrics dashboard, replay results, incident tickets |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-009 | Ingest monitor replay idempotent webhook payloads |
| BR-SYS-008 | Webhook down P1 incident alert within 5 minutes |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 |

### SVC-UC-010 — KPI definitions agency-wide

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-010
- **Tên use case:** KPI definitions agency-wide
- **Màn hình:** SCR-AGENCY-003
- **Actor chính:** Admin / GDKD
- **Mục tiêu:** Define KPI formulas agency-wide consumed by hub widgets
- **Trigger:** Admin configure KPI catalog
- **Pre-condition:** KPI dictionary seed available
- **Post-condition:** Hub/reports use consistent CPL, ROAS, rank delta formulas
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** KPI config admin · kpi-dictionary-seed.sql

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Admin mở agency hub KPI settings |
| 2 | Define formulas: CPL, ROAS, rank delta, SLA breach rate |
| 3 | Assign KPI visibility per role |
| 4 | Hub widgets Meta/Zalo/SEO consume definitions |
| 5 | Version KPI config changes with audit |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid formula → validation error on save |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | KPI code, formula expression, role visibility |
| Output | KPI catalog version, widget binding |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-010 | KPI formula changes versioned with audit |

### SVC-UC-011 — SOP & marketing plan

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-011
- **Tên use case:** SOP & marketing plan
- **Màn hình:** SCR-SVC-004, SCR-AGENCY-001
- **Actor chính:** AM / Strategist
- **Mục tiêu:** Upload SOP + quarterly marketing plan linked lifecycle Optimize
- **Trigger:** Client enter Optimize stage or quarterly planning
- **Pre-condition:** Client active in Deliver/Optimize
- **Post-condition:** Documents versioned on client workspace
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** client workspace documents API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Upload SOP per client service line |
| 2 | Fill quarterly marketing plan template |
| 3 | Link documents to lifecycle stage Optimize |
| 4 | AM review with client optional portal share |
| 5 | Track plan vs actual KPI on hub |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Plan overdue → reminder task to AM |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, document files, plan period, KPI targets |
| Output | document version ids, plan status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-011 | SOP/marketing plan linked lifecycle Optimize stage |

### SVC-UC-012 — Offboarding SOP

> 🟢 Spec thủ công

- **Mã use case:** SVC-UC-012
- **Tên use case:** Offboarding SOP
- **Màn hình:** SCR-AGENCY-001
- **Actor chính:** AM / Admin
- **Mục tiêu:** Offboard checklist: revoke access, export data, archive
- **Trigger:** HĐ terminate SYS-UC-006
- **Pre-condition:** Offboard request approved
- **Post-condition:** All tokens revoked; client read-only archive
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-006
- **API / Integration:** offboarding checklist · token revoke · archive API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Trigger lifecycle → Offboarding |
| 2 | Checklist: revoke OAuth, portal users, webhook endpoints |
| 3 | Export client data package for compliance |
| 4 | Final report deliver to client |
| 5 | Stage → Archived; read-only retention policy |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Outstanding legal hold → delay archive |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, offboard reason, checklist completions |
| Output | archive state, export bundle URL, revoke audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-012 | Offboard revoke all OAuth portal webhook tokens |
| BR-SYS-006 | Offboard revoke all OAuth portal webhook tokens |

---

## 3. Chi tiết Màn hình module

### SCR-SVC-001 — Launch QA Checklist

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-SVC-001
- **Tên màn hình:** Launch QA Checklist
- **Route:** /crm/launch-qa
- **Module:** MOD-AGENCY — Agency Service Delivery
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Pre-launch QA gate
- **Vai trò:** AM, Media Buyer
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** SVC-UC-005
- **API liên quan:** GET/POST /api/v1/* — module Agency
- **Parity / RNOS:** —
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** Agency
- **Ghi chú:** Pre-launch QA gate

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Launch QA Checklist |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/launch-qa |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |

### SCR-SVC-002 — Campaign Write Queue

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-SVC-002
- **Tên màn hình:** Campaign Write Queue
- **Route:** /crm/campaign-writes
- **Module:** MOD-AGENCY — Agency Service Delivery
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Approval queue ✅
- **Vai trò:** Creative Lead, AM
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** SVC-UC-007
- **API liên quan:** GET/POST /api/v1/* — module Agency
- **Parity / RNOS:** —
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** Agency
- **Ghi chú:** Approval queue ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Campaign Write Queue |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/campaign-writes |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |

### SCR-SVC-003 — Creative Hub

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-SVC-003
- **Tên màn hình:** Creative Hub
- **Route:** /crm/creatives
- **Module:** MOD-AGENCY — Agency Service Delivery
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Upload & review creative
- **Vai trò:** Creative Lead
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** SVC-UC-006
- **API liên quan:** GET/POST /api/v1/* — module Agency
- **Parity / RNOS:** —
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** Agency
- **Ghi chú:** Upload & review creative

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Creative Hub |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/creatives |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-006 | Creative client approval required before ads wizard |

### SCR-SVC-004 — Service Delivery Workflow

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-SVC-004
- **Tên màn hình:** Service Delivery Workflow
- **Route:** /crm/service-delivery
- **Module:** MOD-AGENCY — Agency Service Delivery
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** 7-stage lifecycle
- **Vai trò:** AM, PM
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** SVC-UC-001, SVC-UC-003
- **API liên quan:** GET/POST /api/v1/* — module Agency
- **Parity / RNOS:** —
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** Agency
- **Ghi chú:** 7-stage lifecycle

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Service Delivery Workflow |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/service-delivery |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SVC-001 | Không Deliver nếu onboard checklist incomplete |
| BR-SVC-003 | TMMT versioned trước lifecycle Deliver milestone |
| BR-SVC-011 | SOP/marketing plan linked lifecycle Optimize stage |

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-SVC-001 | Không Deliver nếu onboard checklist incomplete | High | Done |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module | High | Done |
| BR-SVC-003 | TMMT versioned trước lifecycle Deliver milestone | High | Done |
| BR-SVC-004 | Handover blocked nếu invoice overdue RNOS-25 | High | Done |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit | High | Done |
| BR-SVC-006 | Creative client approval required before ads wizard | High | Done |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve | High | Done |
| BR-SVC-008 | Channel account mapping unique per client | High | Done |
| BR-SVC-009 | Ingest monitor replay idempotent webhook payloads | Medium | Done |
| BR-SVC-010 | KPI formula changes versioned with audit | Medium | Done |
| BR-SVC-011 | SOP/marketing plan linked lifecycle Optimize stage | Medium | In progress |
| BR-SVC-012 | Offboard revoke all OAuth portal webhook tokens | High | Draft |
