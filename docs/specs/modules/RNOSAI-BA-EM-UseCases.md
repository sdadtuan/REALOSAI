# RNOSAI BA — Email Marketing Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-EM-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-EM |
| Số UC | 14 |
| Spec thủ công | 14/14 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/05-EMAIL-MARKETING.md`](../../use-cases/05-EMAIL-MARKETING.md) |

---

## 1. Tóm tắt module

Module Email Marketing Enterprise: workspace + domain wizard, capture/consent, CSV import, segment RFM, template preflight, broadcast F1 dual approval, ESP webhook, suppression, deliverability F3, journeys, governance rules, reports BI, preference center.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-EM-001 | Email Hub | /email/hub | Done | EM-UC-001, EM-UC-013 |
| SCR-EM-002 | Email Campaigns | /email/campaigns | Done | EM-UC-006, EM-UC-007 |
| SCR-EM-003 | Email Contacts | /email/contacts | Done | EM-UC-002, EM-UC-003, EM-UC-004 |
| SCR-EM-004 | Email Templates | /email/templates | Done | EM-UC-005 |
| SCR-EM-005 | Email Journeys | /email/journeys | Done | EM-UC-011 |
| SCR-EM-006 | Email Governance | /email/governance | Done | EM-UC-012 |
| SCR-EM-007 | Email Deliverability | /email/deliverability | Done | EM-UC-010 |
| SCR-EM-008 | Email Reports | /email/reports | Done | EM-UC-013 |
| SCR-EM-009 | Email Segments | /email/segments | Done | EM-UC-004 |
| SCR-EM-010 | Suppression List | /email/suppression | Done | EM-UC-009 |
| SCR-EM-011 | Consent Log | /email/consent | Done | EM-UC-002 |
| SCR-EM-012 | Email Client Workspace | /email/clients | Done | EM-UC-001 |
| SCR-EM-021 | Chi tiết Email Client Workspace | /email/clients/[id] | Done | EM-UC-001 |
| SCR-EM-013 | Email Gate A (prod cutover) | /email/gate-a | Done | SYS-UC-009 |
| SCR-EM-014 | Public Confirm (double opt-in) | /email/public/confirm/[token] | Done | EM-UC-002 |
| SCR-EM-015 | Public Preference Center | /email/public/preferences/[token] | Done | EM-UC-014 |
| SCR-EM-016 | Public Unsubscribe | /email/public/unsubscribe/[token] | Done | EM-UC-009 |
| SCR-EM-017 | Chi tiết Campaign | /email/campaigns/[id] | Done | EM-UC-006, EM-UC-007 |
| SCR-EM-018 | Campaign Review | /email/campaigns/[id]/review | Done | EM-UC-007 |
| SCR-EM-019 | Chi tiết Journey | /email/journeys/[id] | Done | EM-UC-011 |
| SCR-EM-020 | Chi tiết Template | /email/templates/[id] | Done | EM-UC-005 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| EM-UC-001 | Onboard email workspace & domain | High | Done | Thủ công |
| EM-UC-002 | Capture form → consent | High | Done | Thủ công |
| EM-UC-003 | Import contacts CSV | High | Done | Thủ công |
| EM-UC-004 | Segment compute (RFM/behavior) | High | Done | Thủ công |
| EM-UC-005 | Template studio + preflight | High | Done | Thủ công |
| EM-UC-006 | Campaign broadcast F1 | High | Done | Thủ công |
| EM-UC-007 | Staff + client approval | High | Done | Thủ công |
| EM-UC-008 | ESP send & webhook engagement | High | Done | Thủ công |
| EM-UC-009 | Suppression & one-click unsub | High | Done | Thủ công |
| EM-UC-010 | Deliverability incident F3 | High | Done | Thủ công |
| EM-UC-011 | Journey automation activate | Medium | Done | Thủ công |
| EM-UC-012 | Governance rule CRUD | Medium | Done | Thủ công |
| EM-UC-013 | Reports & Grafana BI | Medium | Done | Thủ công |
| EM-UC-014 | Public preference center | High | Done | Thủ công |

---

## 2. Chi tiết Use Case

### EM-UC-001 — Onboard email workspace & domain

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-001
- **Tên use case:** Onboard email workspace & domain
- **Màn hình:** SCR-EM-001
- **Actor chính:** Email Strategist / AM
- **Mục tiêu:** Workspace active với domain authenticated SPF/DKIM/DMARC
- **Trigger:** HĐ Email Marketing; SYS-UC-001 module step
- **Pre-condition:** PTT_EMAIL_ENABLED=1; customer active
- **Post-condition:** Sending domain verified; hub deliverability status green/yellow
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-001, TC-EM-01
- **API / Integration:** POST /email/workspaces · domain wizard E-11 · /email/deliverability

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tạo email workspace per client |
| 2 | Domain onboarding wizard: SPF, DKIM, DMARC, ESP verify |
| 3 | Warm-up plan documented |
| 4 | Hub /email/hub shows deliverability status |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | DNS pending → yellow status until verify pass |
| E2 | Send without verified domain → blocked TC-EM-01 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, domain, DNS records, ESP config |
| Output | workspace_id, domain verify status, warm-up doc ref |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-001 | Email domain phải verified trước khi send campaign |

### EM-UC-002 — Capture form → consent

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-002
- **Tên use case:** Capture form → consent
- **Màn hình:** SCR-EM-003
- **Actor chính:** System / End Subscriber
- **Mục tiêu:** Capture contact với consent log immutable
- **Trigger:** Public form submit embedded site
- **Pre-condition:** Form embed configured; capture API active
- **Post-condition:** Contact created subscribed hoặc pending_confirm; GDPR log
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /email/contacts/capture · double opt-in mailer

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Embed form POST → capture API |
| 2 | Record consent timestamp, source, IP hashed |
| 3 | Double opt-in email if policy enabled |
| 4 | Contact created subscribed or pending_confirm |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid email → 400 validation message |
| E2 | Suppressed email → reject with generic message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | form fields, consent checkbox, source URL |
| Output | contact_id, consent record, opt-in status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-002 | No marketing send without documented consent |
| BR-EM-009 | Suppression global per client workspace — unsub honored |

### EM-UC-003 — Import contacts CSV

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-003
- **Tên use case:** Import contacts CSV
- **Màn hình:** SCR-EM-003
- **Actor chính:** Email Strategist
- **Mục tiêu:** Batch import contacts với dedup và suppression check
- **Trigger:** Strategist upload CSV import UI
- **Pre-condition:** CSV template valid; workspace active
- **Post-condition:** Import job log; tags applied
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /email/contacts/import · preview + confirm batch

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | E-04 import UI → upload CSV |
| 2 | Map columns; validate email format |
| 3 | Dedup + suppression check EM-UC-009 |
| 4 | Preview → confirm batch import |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | High bounce list → quarantine import; compliance review |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | CSV file, column mapping, tags |
| Output | import job id, inserted/updated/skipped counts |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-003 | CSV import validate format + dedup before batch |
| BR-EM-009 | Suppression global per client workspace — unsub honored |

### EM-UC-004 — Segment compute (RFM/behavior)

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-004
- **Tên use case:** Segment compute (RFM/behavior)
- **Màn hình:** SCR-EM-003
- **Actor chính:** Email Strategist / System
- **Mục tiêu:** Compute và cache segment membership RFM/behavior
- **Trigger:** Save segment hoặc scheduled recompute
- **Pre-condition:** Contact data populated
- **Post-condition:** Segment member count cached; recompute on schedule
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /email/segments/:id/compute · segment builder E-05

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Segment Builder tabs Rules/Static/Lifecycle/RFM/Behavior |
| 2 | Define criteria → Compute segment size |
| 3 | Save segment version |
| 4 | Use in campaign or journey targeting |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Empty criteria → block save validation |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | segment rules JSON, client_id |
| Output | segment_id, member_count, version |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-004 | Segment compute versioned; recompute on schedule |

### EM-UC-005 — Template studio + preflight

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-005
- **Tên use case:** Template studio + preflight
- **Màn hình:** SCR-EM-004
- **Actor chính:** Email Strategist
- **Actor phụ:** Creative
- **Mục tiêu:** Template pass preflight trước attach campaign
- **Trigger:** Create/edit template E-06
- **Pre-condition:** Brand assets ready
- **Post-condition:** Preflight pass required before send configurable strict
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** /email/templates · preflight API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Template studio drag blocks, merge tags |
| 2 | Preflight: broken links, alt text, spam score, dark mode |
| 3 | Save template version |
| 4 | Attach to campaign EM-UC-006 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Preflight fail → block attach until fix |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | template HTML/blocks, merge tags, brand assets |
| Output | template version id, preflight report |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-005 | Template preflight pass required before attach campaign |

### EM-UC-006 — Campaign broadcast F1

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-006
- **Tên use case:** Campaign broadcast F1
- **Màn hình:** SCR-EM-002
- **Actor chính:** Email Strategist
- **Mục tiêu:** Schedule hoặc send broadcast F1 với approval gate
- **Trigger:** Schedule or send now
- **Pre-condition:** Template + segment ready; domain verified
- **Post-condition:** Campaign status scheduled/sending/sent
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** /email/campaigns · campaign API F1 flow

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Create campaign: name, segment, template, subject, from |
| 2 | Test send to staff list |
| 3 | Submit → staff approval EM-UC-007 |
| 4 | On approve → queue ESP send EM-UC-008 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Governance block EM-UC-012 → warn/block on submit |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign config, segment_id, template_id, schedule |
| Output | campaign_id, status, approval state |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-006 | Campaign F1 test send staff list trước submit approval |
| BR-EM-007 | Dual approval staff + client trước ESP send |
| BR-EM-012 | Governance rule changes audit immutable |

### EM-UC-007 — Staff + client approval

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-007
- **Tên use case:** Staff + client approval
- **Màn hình:** SCR-EM-002, SCR-PORTAL-005
- **Actor chính:** Email Strategist / Client Approver
- **Actor phụ:** Compliance
- **Mục tiêu:** Dual approval staff + client trước ESP send
- **Trigger:** Campaign draft submitted
- **Pre-condition:** Campaign draft ready; governance rules evaluated
- **Post-condition:** Approval audit who/when/version id
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-004
- **API / Integration:** Temporal workflow · portal PORTAL-UC-008 · compliance gate

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Strategist submit → internal compliance review optional |
| 2 | Client approver portal PORTAL-UC-008 |
| 3 | Approve → unlock send; Reject → draft + comment |
| 4 | Audit chain immutable PLAT-UC-008 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client SLA timeout → escalate AM notify |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, approval chain config |
| Output | approval decisions[], unlock send flag |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-007 | Dual approval staff + client trước ESP send |
| BR-PORTAL-008 | Email campaign dual approval staff + client EM-UC-007 |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification |

### EM-UC-008 — ESP send & webhook engagement

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-008
- **Tên use case:** ESP send & webhook engagement
- **Màn hình:** SCR-EM-002
- **Actor chính:** System
- **Mục tiêu:** Batch send ESP và ingest engagement events
- **Trigger:** Campaign approved; send window reached
- **Pre-condition:** Campaign approved; suppression applied
- **Post-condition:** Engagement metrics on reports EM-UC-013
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** PLAT-006
- **API / Integration:** ESP batch API · PLAT-UC-006 webhook · /email/campaigns/:id/stats

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Worker batch send via ESP SendGrid/SES |
| 2 | PLAT-UC-006 ingest delivered/open/click/bounce |
| 3 | Update campaign stats real-time |
| 4 | Bounce → auto suppression EM-UC-009 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | ESP rate limit → retry queue PLAT-UC-007 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign send batch, recipient list scoped |
| Output | send job id, engagement events[], stats |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-008 | ESP send batch scoped suppression list applied |
| BR-PLAT-006 | ESP webhook idempotent — bounce triggers global suppression |
| BR-EM-009 | Suppression global per client workspace — unsub honored |

### EM-UC-009 — Suppression & one-click unsub

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-009
- **Tên use case:** Suppression & one-click unsub
- **Màn hình:** SCR-EM-003
- **Actor chính:** System / End Subscriber
- **Mục tiêu:** Global suppression honored on all future sends
- **Trigger:** One-click unsub hoặc bounce/spam complaint
- **Pre-condition:** Suppression list active per workspace
- **Post-condition:** Future sends exclude contact; audit reason
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** List-Unsubscribe header · suppression API · EM-UC-014 sync

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | List-Unsubscribe header + preference link in sends |
| 2 | One-click POST → global suppression list |
| 3 | Future sends exclude contact |
| 4 | Audit reason timestamp source |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Resubscribe via preference center EM-UC-014 with new consent |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | contact email, unsub reason, source |
| Output | suppression record, updated contact status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-009 | Suppression global per client workspace — unsub honored |
| BR-EM-014 | Preference center token expiry + unsub sync suppression |

### EM-UC-010 — Deliverability incident F3

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-010
- **Tên use case:** Deliverability incident F3
- **Màn hình:** SCR-EM-007
- **Actor chính:** Email Strategist / Compliance
- **Actor phụ:** DevOps
- **Mục tiêu:** Pause sends và remediate bounce/blocklist spike
- **Trigger:** Bounce rate spike, blocklist, domain fail
- **Pre-condition:** Hub monitoring active; alert channels configured
- **Post-condition:** Incident ticket closed; post-mortem
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** /email/deliverability · F3 runbook · pause send API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Hub alert banner + Slack/Teams EM-UC-013 alerts |
| 2 | Pause sends for domain/client |
| 3 | DNS/ESP remediation checklist |
| 4 | Resume after verify + soak |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | False positive → resume with monitoring window |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | incident metrics, domain, client scope |
| Output | incident id, pause/resume audit, post-mortem |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-010 | Deliverability F3 pause sends on bounce/blocklist spike |

### EM-UC-011 — Journey automation activate

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-011
- **Tên use case:** Journey automation activate
- **Màn hình:** SCR-EM-005
- **Actor chính:** Email Strategist
- **Mục tiêu:** Journey graph live với enroll cap respected
- **Trigger:** PTT_EMAIL_JOURNEYS=1 prod cutover
- **Pre-condition:** Journey designed; test mode passed
- **Post-condition:** Journey version live; enrollments tracked
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** /email/journeys · journey engine activate

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Build journey graph trigger → wait → send → branch |
| 2 | Test mode dry-run enrollments |
| 3 | Activate journey version |
| 4 | Monitor enrollments + cap alerts |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Enroll cap hit → pause enroll + notify strategist |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | journey graph JSON, triggers, caps |
| Output | journey version id, enrollment metrics |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-011 | Journey enroll cap respected — pause on threshold |

### EM-UC-012 — Governance rule CRUD

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-012
- **Tên use case:** Governance rule CRUD
- **Màn hình:** SCR-EM-006
- **Actor chính:** Compliance / Admin
- **Mục tiêu:** Rules enforced pre-send với audit mọi thay đổi
- **Trigger:** Admin create/edit governance rules E-13
- **Pre-condition:** Admin/compliance access
- **Post-condition:** Rules saved; evaluate on campaign submit
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** POST/PATCH/DELETE /email/governance/rules · E-13 UI

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Governance UI create/edit/delete rules |
| 2 | Rules: max send rate, footer, banned keywords, quiet hours |
| 3 | Evaluate on campaign submit block/warn |
| 4 | Audit log every change SYS-UC-010 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Conflicting rules → priority order admin config |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | rule definition JSON, scope client/global |
| Output | rule id, evaluation result on submit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-012 | Governance rule changes audit immutable |
| BR-SYS-010 | Cross-module audit query immutable export compliance role |

### EM-UC-013 — Reports & Grafana BI

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-013
- **Tên use case:** Reports & Grafana BI
- **Màn hình:** SCR-EM-008
- **Actor chính:** Email Strategist / AM
- **Mục tiêu:** Campaign performance reports + Grafana BI export
- **Trigger:** User opens /email/reports hoặc scheduled export
- **Pre-condition:** Campaign data exists
- **Post-condition:** Reports exported; BI status card updated
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** /email/reports · GET /reports/bi-status · Grafana link

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | E-12 reports: campaign, deliverability, segment growth |
| 2 | Date range + client filter |
| 3 | BI status card link Grafana if configured |
| 4 | Export CSV/PDF client-safe metrics |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Grafana unreachable → inline report only |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | date range, client_id, report type |
| Output | report rows, export file, bi_status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-013 | Email reports client-safe — no subscriber PII export |
| BR-PORTAL-005 | Email stats aggregate only — no subscriber PII |

### EM-UC-014 — Public preference center

> 🟢 Spec thủ công

- **Mã use case:** EM-UC-014
- **Tên use case:** Public preference center
- **Màn hình:** SCR-EM-003
- **Actor chính:** End Subscriber
- **Mục tiêu:** Tokenized preference update và unsub all
- **Trigger:** Public URL token click from email
- **Pre-condition:** Token valid not expired
- **Post-condition:** Consent preferences updated; sync suppression
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** Public preference routes · EM spec §preference

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Public URL tokenized → view subscriptions |
| 2 | Update topic preferences or frequency |
| 3 | Unsubscribe all one-click |
| 4 | Confirmation page + sync EM-UC-009 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Expired token → request new link flow |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | preference token, selected topics, unsub flag |
| Output | updated preferences, suppression sync |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-EM-014 | Preference center token expiry + unsub sync suppression |
| BR-EM-009 | Suppression global per client workspace — unsub honored |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-EM-001 | Email domain phải verified trước khi send campaign | High | Done |
| BR-EM-002 | No marketing send without documented consent | High | Done |
| BR-EM-003 | CSV import validate format + dedup before batch | High | Done |
| BR-EM-004 | Segment compute versioned; recompute on schedule | Medium | Done |
| BR-EM-005 | Template preflight pass required before attach campaign | High | Done |
| BR-EM-006 | Campaign F1 test send staff list trước submit approval | High | Done |
| BR-EM-007 | Dual approval staff + client trước ESP send | High | Done |
| BR-EM-008 | ESP send batch scoped suppression list applied | High | Done |
| BR-EM-009 | Suppression global per client workspace — unsub honored | High | Done |
| BR-EM-010 | Deliverability F3 pause sends on bounce/blocklist spike | High | Done |
| BR-EM-011 | Journey enroll cap respected — pause on threshold | Medium | Done |
| BR-EM-012 | Governance rule changes audit immutable | Medium | Done |
| BR-EM-013 | Email reports client-safe — no subscriber PII export | High | Done |
| BR-EM-014 | Preference center token expiry + unsub sync suppression | High | Done |
