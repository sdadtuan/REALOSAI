# RNOSAI BA — Platform Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-PLAT-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-PLAT |
| Số UC | 10 |
| Spec thủ công | 10/10 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/07-PLATFORM-AUTH-WEBHOOKS.md`](../../use-cases/07-PLATFORM-AUTH-WEBHOOKS.md) |

---

## 1. Tóm tắt module

Platform layer: staff JWT login + RBAC caps, portal JWT scoped, webhook ingest Meta/Zalo/Google/ESP, BullMQ job workers, Temporal approval workflows, staff seed permissions, health check + soak gates.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-AUTH-001 | Đăng nhập Staff (ops-web) | /login | Done | PLAT-UC-001 |
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
| SCR-ADMIN-001 | Admin AI Runs | /admin/ai/runs | Done | AI-UC-009 |
| SCR-ADMIN-002 | Admin AI Agents | /admin/ai/agents | Done | AI-UC-010 |
| SCR-ADMIN-003 | Admin AI Tools | /admin/ai/tools | Done | AI-UC-020 |
| SCR-ADMIN-004 | CRM Pipeline Config | /admin/crm/pipeline | Done | CRM-UC-009 |
| SCR-ADMIN-005 | CRM Custom Fields | /admin/crm/custom-fields | Done | CRM-UC-012 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| PLAT-UC-001 | Staff JWT login & refresh | High | Done | Thủ công |
| PLAT-UC-002 | RBAC cap enforcement | High | Done | Thủ công |
| PLAT-UC-003 | Portal JWT login | High | Done | Thủ công |
| PLAT-UC-004 | Webhook Meta ingest | High | Done | Thủ công |
| PLAT-UC-005 | Webhook Zalo/Google ingest | High | Done | Thủ công |
| PLAT-UC-006 | Webhook Email ESP ingest | High | Done | Thủ công |
| PLAT-UC-007 | Job queue worker process | High | Done | Thủ công |
| PLAT-UC-008 | Temporal approval workflow | Medium | In progress | Thủ công |
| PLAT-UC-009 | Seed staff permissions | High | Done | Thủ công |
| PLAT-UC-010 | Health check & soak evidence | Medium | Done | Thủ công |

---

## 2. Chi tiết Use Case

### PLAT-UC-001 — Staff JWT login & refresh

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-001
- **Tên use case:** Staff JWT login & refresh
- **Màn hình:** SCR-AUTH-001
- **Actor chính:** Staff
- **Mục tiêu:** Issue JWT access + refresh; session scoped staff id + caps
- **Trigger:** Login ops-web rs.pttads.vn
- **Pre-condition:** Staff account seeded PLAT-UC-009; account active
- **Post-condition:** Session valid; refresh before expiry BR-PLAT-001
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** TC-AUTH-01
- **API / Integration:** POST /auth/login · POST /auth/refresh · ops-web auth middleware

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | POST /auth/login email + password |
| 2 | Validate bcrypt hash; issue access JWT + refresh token |
| 3 | ops-web stores token; Authorization header |
| 4 | Refresh before expiry via /auth/refresh |
| 5 | Redirect dashboard theo caps array |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid credentials → 401 rate limit lockout |
| E2 | Account disabled → 403 contact admin |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | email, password |
| Output | access JWT, refresh token, caps[], staff_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-001 | Session refresh trước khi hết hạn access token |
| BR-PLAT-002 | RBAC cap enforcement 403 trên route/API unauthorized |

### PLAT-UC-002 — RBAC cap enforcement

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-002
- **Tên use case:** RBAC cap enforcement
- **Màn hình:** SCR-AUTH-001
- **Actor chính:** All staff
- **Mục tiêu:** Least privilege enforced server-side 403 unauthorized
- **Trigger:** Every API request và UI nav render
- **Pre-condition:** JWT caps assigned PLAT-UC-009
- **Post-condition:** 403 on unauthorized route; UI hides nav without cap
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** Nest guards per route cap · ops-web nav filter

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | API route declares required cap e.g. crm.leads.read |
| 2 | Guard checks JWT caps vs route deny by default |
| 3 | UI hides nav items without cap |
| 4 | 403 on unauthorized API not UI-only bypass |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Missing cap in token → re-login after role change |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT caps[], route required cap |
| Output | 200 authorized or 403 forbidden |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-002 | RBAC cap enforcement 403 trên route/API unauthorized |

### PLAT-UC-003 — Portal JWT login

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-003
- **Tên use case:** Portal JWT login
- **Màn hình:** SCR-PORTAL-002
- **Actor chính:** Client Viewer
- **Actor phụ:** Client Approver
- **Mục tiêu:** Portal JWT scoped client_id + portal_role
- **Trigger:** Login portal.pttads.vn
- **Pre-condition:** Portal account active PORTAL-UC-001 provisioned
- **Post-condition:** All portal APIs filter client_id SYS-UC-011
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** PORTAL-001
- **API / Integration:** POST /portal/auth/login · separate issuer/audience

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Portal login separate issuer/audience from staff |
| 2 | JWT contains client_id, portal_role viewer\|approver |
| 3 | All portal APIs filter by client_id middleware |
| 4 | No cross-tenant access TC-ISO-01 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Wrong tenant probe → 403 empty result |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | email, password |
| Output | portal JWT, client_id scope, role |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-003 | Portal JWT scoped single client_id |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |
| BR-SYS-011 | Multi-tenant isolation — no cross-client data leak |

### PLAT-UC-004 — Webhook Meta ingest

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-004
- **Tên use case:** Webhook Meta ingest
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** System
- **Mục tiêu:** Verify signature; queue lead → CRM idempotent
- **Trigger:** Meta POST leadgen / verification
- **Pre-condition:** Webhook secret + tenant routing configured
- **Post-condition:** Event persisted; downstream job queued META-UC-004
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** META-004, TC-WH-META-01
- **API / Integration:** POST /webhooks/meta · X-Hub-Signature-256 verify

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Verify X-Hub-Signature-256 |
| 2 | Handle challenge GET subscription |
| 3 | Queue lead payload → worker → CRM |
| 4 | Return 200 within timeout <5s |
| 5 | Idempotent via event id dedup |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Signature fail → 401 + alert SYS-UC-008 |
| E2 | Down sustained → incident P1 runbook |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | Meta webhook payload + headers |
| Output | event_id, job_id, ingest status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 |
| BR-SYS-008 | Webhook down P1 incident alert within 5 minutes |
| BR-SVC-009 | Ingest monitor replay idempotent webhook payloads |

### PLAT-UC-005 — Webhook Zalo/Google ingest

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-005
- **Tên use case:** Webhook Zalo/Google ingest
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** System
- **Mục tiêu:** Channel signature verify → normalize lead → CRM
- **Trigger:** Zalo OA hoặc Google Ads lead webhook POST
- **Pre-condition:** Endpoint configured per tenant
- **Post-condition:** Payload normalized; CRM ingest CRM-UC-001
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** ZALO-011
- **API / Integration:** Zalo OA webhook · Google Ads lead form webhook

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Channel-specific signature verify |
| 2 | Normalize lead fields to CRM schema |
| 3 | Dedup phone+client BR-ZALO-013 if Zalo |
| 4 | Persist + queue CRM ingest job |
| 5 | Monitor on /agency/ingest |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unknown tenant routing → 404 + log |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | channel payload, signature headers |
| Output | normalized lead, crm_job_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-005 | Zalo/Google webhook signature verify trước normalize lead |
| BR-ZALO-011 | Zalo webhook lead dedup same as CRM BR-CRM-001 |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### PLAT-UC-006 — Webhook Email ESP ingest

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-006
- **Tên use case:** Webhook Email ESP ingest
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** System
- **Mục tiêu:** Parse ESP events → update contact + campaign stats
- **Trigger:** ESP POST delivered/bounce/open/click/complaint
- **Pre-condition:** ESP webhook configured per workspace
- **Post-condition:** Bounce triggers suppression EM-UC-009
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** EM-008
- **API / Integration:** ESP webhook endpoints · email event worker

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Parse ESP event type delivered/open/click/bounce/spam |
| 2 | Update contact engagement fields |
| 3 | Update campaign stats EM-UC-008 real-time |
| 4 | Bounce/complaint → suppression EM-UC-009 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate event id → idempotent skip |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | ESP event JSON, signature |
| Output | contact update, campaign stat delta |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-006 | ESP webhook idempotent — bounce triggers global suppression |
| BR-EM-008 | ESP send batch scoped suppression list applied |
| BR-EM-009 | Suppression global per client workspace — unsub honored |

### PLAT-UC-007 — Job queue worker process

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-007
- **Tên use case:** Job queue worker process
- **Màn hình:** SCR-AGENCY-005
- **Actor chính:** System
- **Mục tiêu:** At-least-once job processing với retry + dead letter
- **Trigger:** Job enqueued sync/send/report/segment
- **Pre-condition:** BullMQ/Redis queue configured
- **Post-condition:** Jobs processed; metrics queue depth + failure rate
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** Worker service · Redis · /agency/jobs monitor UI

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Queue types: sync, send, report, segment compute |
| 2 | Worker consume with retry backoff |
| 3 | Dead letter on max retries |
| 4 | Metrics visible SCR-AGENCY-005 dashboard |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Poison message → DLQ + alert DevOps |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | job payload, job type, tenant context |
| Output | job status, retry count, DLQ ref |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-007 | Job queue retry + dead letter — poison message alert DevOps |

### PLAT-UC-008 — Temporal approval workflow

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-008
- **Tên use case:** Temporal approval workflow
- **Màn hình:** SCR-SVC-002
- **Actor chính:** System
- **Mục tiêu:** Durable human-in-loop approval với timeout escalate
- **Trigger:** Campaign write / email send / cross-module approval
- **Pre-condition:** Temporal connected namespace configured
- **Post-condition:** Workflow history durable; side effect on complete
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** Temporal namespace · signals staff/client · SVC-UC-007 EM-UC-007

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Start workflow on submit approval-required item |
| 2 | Wait human signals staff then client |
| 3 | Timeout → escalate notification AM |
| 4 | Complete → execute side effect Meta API ESP send |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Reject signal → terminate workflow return draft |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | workflow type, item ref, approver list |
| Output | workflow id, final decision, side effect result |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |

### PLAT-UC-009 — Seed staff permissions

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-009
- **Tên use case:** Seed staff permissions
- **Màn hình:** SCR-AUTH-001
- **Actor chính:** Super Admin
- **Actor phụ:** DevOps
- **Mục tiêu:** Staff user với role template caps for fresh deploy/hire
- **Trigger:** Fresh deploy hoặc new hire onboarding
- **Pre-condition:** Seed script or admin UI access
- **Post-condition:** Staff access permitted modules only PLAT-UC-002
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** Seed scripts · admin user API · accounts.json handover

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Run seed script or admin UI create user |
| 2 | Assign role template caps matrix |
| 3 | User first login optional force password change |
| 4 | Verify login TC-AUTH-01 smoke |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate email → reject create |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | email, role template, cap overrides |
| Output | staff user id, caps[], audit create |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-009 | Staff seed role template caps — deny by default |
| BR-PLAT-002 | RBAC cap enforcement 403 trên route/API unauthorized |

### PLAT-UC-010 — Health check & soak evidence

> 🟢 Spec thủ công

- **Mã use case:** PLAT-UC-010
- **Tên use case:** Health check & soak evidence
- **Màn hình:** SCR-AGENCY-004
- **Actor chính:** DevOps
- **Actor phụ:** QA
- **Mục tiêu:** Gate PASS artifacts liveness/readiness + soak scripts
- **Trigger:** Staging/prod deploy or nghiệm thu gate
- **Pre-condition:** Services deployed; gate scripts in repo
- **Post-condition:** Evidence stored CI/ops folder SYS-UC-009
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /health DB Redis Temporal · email_p1_gate.sh module gates

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | GET /health liveness/readiness DB Redis Temporal |
| 2 | Run soak scripts email_p1_gate.sh module gates |
| 3 | Collect evidence nghiệm thu handover §6 |
| 4 | Attach to change log gate PASS |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Health fail → block cutover SYS-UC-009 rollback |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | env target, gate script list |
| Output | health status JSON, gate PASS artifacts |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PLAT-010 | Health + soak gate PASS required trước prod cutover |
| BR-SYS-009 | Staged prod cutover module flag soak ≥3 ngày gate PASS |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-PLAT-001 | Session refresh trước khi hết hạn access token | High | Done |
| BR-PLAT-002 | RBAC cap enforcement 403 trên route/API unauthorized | High | Done |
| BR-PLAT-003 | Portal JWT scoped single client_id | High | Done |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 | High | Done |
| BR-PLAT-005 | Zalo/Google webhook signature verify trước normalize lead | High | Done |
| BR-PLAT-006 | ESP webhook idempotent — bounce triggers global suppression | High | Done |
| BR-PLAT-007 | Job queue retry + dead letter — poison message alert DevOps | High | Done |
| BR-PLAT-008 | Temporal approval timeout escalate AM notification | Medium | In progress |
| BR-PLAT-009 | Staff seed role template caps — deny by default | High | Done |
| BR-PLAT-010 | Health + soak gate PASS required trước prod cutover | High | Done |
