# RNOSAI BA — Client Portal Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-PORTAL-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-PORTAL |
| Số UC | 15 |
| Spec thủ công | 15/15 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/06-CLIENT-PORTAL.md`](../../use-cases/06-CLIENT-PORTAL.md) |

---

## 1. Tóm tắt module

Client portal portal.pttads.vn: JWT scoped login, multi-module KPI dashboard, Meta/SEO/Email read-only views, approval inbox creative/content/email với reject comment, signed URL downloads.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
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
| PORTAL-UC-001 | Login portal scoped client | High | Done | Thủ công |
| PORTAL-UC-002 | Dashboard KPI multi-module | High | Done | Thủ công |
| PORTAL-UC-003 | Meta performance view + CSV | High | Done | Thủ công |
| PORTAL-UC-004 | SEO summary view | Medium | Done | Thủ công |
| PORTAL-UC-005 | Email campaign stats | Medium | Done | Thủ công |
| PORTAL-UC-006 | Approval inbox Meta creative | High | Done | Thủ công |
| PORTAL-UC-007 | Approval SEO content | Medium | Done | Thủ công |
| PORTAL-UC-008 | Approval email campaign | Medium | Done | Thủ công |
| PORTAL-UC-009 | Reject with comment | High | Done | Thủ công |
| PORTAL-UC-010 | Export & download artifact | High | Done | Thủ công |
| PORTAL-UC-011 | Quên mật khẩu / reset | High | Done | Thủ công |
| PORTAL-UC-012 | Đổi mật khẩu khi đã login | Medium | Done | Thủ công |
| PORTAL-UC-013 | Zalo performance view + export | High | Done | Thủ công |
| PORTAL-UC-014 | Zalo creative approval | Medium | Done | Thủ công |
| PORTAL-UC-015 | Google performance view | Medium | In progress | Thủ công |

---

## 2. Chi tiết Use Case

### PORTAL-UC-001 — Login portal scoped client

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-001
- **Tên use case:** Login portal scoped client
- **Màn hình:** SCR-PORTAL-002
- **Actor chính:** Client Viewer / Client Approver
- **Mục tiêu:** Portal JWT scoped single client_id + role
- **Trigger:** User truy cập portal.pttads.vn login
- **Pre-condition:** Portal user provisioned AM SYS-UC-001; account active
- **Post-condition:** Session TTL per policy; redirect /dashboard
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** PLAT-003, TC-PORTAL-01
- **API / Integration:** POST /portal/auth/login · PLAT-UC-003 JWT

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User mở portal-web /login |
| 2 | Email + password submit |
| 3 | API issue JWT scoped client_id + role viewer\|approver |
| 4 | Set httpOnly cookie / token storage per adr-011 |
| 5 | Redirect /dashboard PORTAL-UC-002 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Wrong credentials → generic error no enumeration |
| E2 | Cross-tenant probe → 403 empty SYS-UC-011 |
| E3 | Account disabled → 403 contact AM message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | email, password |
| Output | JWT access+refresh, client_id scope, role caps |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |
| BR-PLAT-003 | Portal JWT scoped single client_id |
| BR-SYS-011 | Multi-tenant isolation — no cross-client data leak |

### PORTAL-UC-002 — Dashboard KPI multi-module

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-002
- **Tên use case:** Dashboard KPI multi-module
- **Màn hình:** SCR-PORTAL-001
- **Actor chính:** Client Viewer
- **Mục tiêu:** Read-only KPI cards Meta/SEO/Email/Zalo per enabled modules
- **Trigger:** Post-login landing /dashboard
- **Pre-condition:** Modules enabled for client; data synced
- **Post-condition:** Read-only view; no internal staff PII/margin
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GET /portal/dashboard · aggregated KPI API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Dashboard load enabled module flags |
| 2 | Render cards: spend, leads, CPL, SEO traffic, email sends, Zalo CPL |
| 3 | Date range selector 7d/30d/90d |
| 4 | Attribution disclaimer footer |
| 5 | Pending approval badge count link /creatives or /notifications |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Module disabled → card hidden not 404 whole page |
| E2 | No data period → empty state per card |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, date_range |
| Output | KPI card JSON, module flags |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-002 | Dashboard KPI chỉ module enabled cho client |

### PORTAL-UC-003 — Meta performance view + CSV

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-003
- **Tên use case:** Meta performance view + CSV
- **Màn hình:** SCR-PORTAL-003
- **Actor chính:** Client Viewer
- **Mục tiêu:** Meta tab campaign table drill metrics export CSV
- **Trigger:** Navigate /meta on portal
- **Pre-condition:** Meta module enabled; META-UC-003 data synced
- **Post-condition:** CSV export scoped client; download logged
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GET /portal/meta/performance · CSV export

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client mở portal /meta |
| 2 | View campaign table read-only scoped client_id |
| 3 | Drill campaign row metrics spend/leads/CPL |
| 4 | Select date range filter |
| 5 | Export CSV period snapshot PORTAL-UC-010 audit |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend footnote client-safe wording |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | date_range, campaign filter |
| Output | performance table, CSV file |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-003 | Meta portal CSV client-safe — no internal attribution fields |
| BR-META-003 | CPL/ROAS tính theo last-click attribution default |

### PORTAL-UC-004 — SEO summary view

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-004
- **Tên use case:** SEO summary view
- **Màn hình:** SCR-PORTAL-006
- **Actor chính:** Client Viewer
- **Mục tiêu:** SEO tab traffic trend, top pages, content delivered count
- **Trigger:** Navigate portal /seo
- **Pre-condition:** SEO module enabled; SEO-UC-012/013 data available
- **Post-condition:** Summary read-only; link PDF if published
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /portal/seo/summary

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client mở /seo summary tab |
| 2 | View traffic trend chart GSC/GA4 aggregate |
| 3 | Top pages table client-safe |
| 4 | Content delivered count this period |
| 5 | Download PDF link if SEO-UC-013 artifact exists |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Sync stale → last updated timestamp shown |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, date_range |
| Output | SEO summary JSON, PDF link optional |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-004 | SEO summary read-only subset; sync stale timestamp shown |
| BR-SEO-013 | Client PDF report client-safe metrics only |

### PORTAL-UC-005 — Email campaign stats

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-005
- **Tên use case:** Email campaign stats
- **Màn hình:** SCR-PORTAL-005
- **Actor chính:** Client Viewer
- **Mục tiêu:** Email tab sent campaigns open/click rates aggregate
- **Trigger:** Navigate portal /email
- **Pre-condition:** Email module enabled; campaigns sent EM-UC-006
- **Post-condition:** Aggregate stats only; no subscriber PII
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /portal/email/stats

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client mở /email stats tab |
| 2 | List sent campaigns read-only |
| 3 | View open rate, click rate, bounce aggregate |
| 4 | Drill campaign summary detail |
| 5 | Approval inbox link PORTAL-UC-008 for pending |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Campaign pending approval → stats hidden until sent |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, period filter |
| Output | campaign stats list[], aggregates |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-005 | Email stats aggregate only — no subscriber PII |
| BR-EM-006 | Campaign F1 test send staff list trước submit approval |

### PORTAL-UC-006 — Approval inbox Meta creative

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-006
- **Tên use case:** Approval inbox Meta creative
- **Màn hình:** SCR-PORTAL-004
- **Actor chính:** Client Approver
- **Mục tiêu:** Approve/reject Meta creative submitted by agency
- **Trigger:** Staff submit creative SVC-UC-006 pending_client
- **Pre-condition:** Approver role JWT; creative pending
- **Post-condition:** Decision synced ops-web + SYS-UC-004
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-004
- **API / Integration:** GET/PATCH /portal/approvals/creatives

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Notification → Approvals inbox /creatives |
| 2 | Preview creative assets + ad copy |
| 3 | Approve → notify staff; unlock launch META-UC-007 |
| 4 | Reject → PORTAL-UC-009 comment required |
| 5 | Audit decision timestamp + approver id |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Viewer role → 403 on approve actions |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative_id, approval_action, comment? |
| Output | approval status, ops-web sync event |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |
| BR-SVC-006 | Creative client approval required before ads wizard |

### PORTAL-UC-007 — Approval SEO content

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-007
- **Tên use case:** Approval SEO content
- **Màn hình:** SCR-PORTAL-006
- **Actor chính:** Client Approver
- **Mục tiêu:** Preview SEO content draft; approve advances pipeline
- **Trigger:** Content submitted client approval SEO-UC-005
- **Pre-condition:** Approver role; content pending review
- **Post-condition:** SEO pipeline stage advances on approve
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** PATCH /portal/approvals/seo-content

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Approver opens SEO content approval item |
| 2 | Preview HTML/markdown rendered client-safe |
| 3 | Optional section-level comments |
| 4 | Approve → SEO-UC-005 stage advance Scheduled |
| 5 | Reject → PORTAL-UC-009 returns Draft ops-web |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Governance fail post-approval → block publish SEO-UC-006 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | content_id, approval_action, section comments |
| Output | approval audit, pipeline stage update |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-007 | SEO content approval advances pipeline stage |
| BR-SEO-005 | Content pipeline stage advance requires checklist per step |

### PORTAL-UC-008 — Approval email campaign

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-008
- **Tên use case:** Approval email campaign
- **Màn hình:** SCR-PORTAL-005
- **Actor chính:** Client Approver
- **Mục tiêu:** Preview email campaign; approve unlocks send EM-UC-007
- **Trigger:** Email strategist submit campaign pending client
- **Pre-condition:** Campaign draft ready; approver JWT
- **Post-condition:** Dual approval recorded EM-UC-007; ESP send allowed
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-004
- **API / Integration:** PATCH /portal/approvals/email-campaigns

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Approver opens email campaign approval item |
| 2 | Preview template render + subject line |
| 3 | View segment size summary aggregate only |
| 4 | Approve → unlock ESP send path EM-UC-008 |
| 5 | Reject → PORTAL-UC-009 with comment |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Staff approval still required EM-UC-007 dual gate |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, approval_action, comment? |
| Output | approval status, send gate flag |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-008 | Email campaign dual approval staff + client EM-UC-007 |
| BR-EM-007 | Dual approval staff + client trước ESP send |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |

### PORTAL-UC-009 — Reject with comment

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-009
- **Tên use case:** Reject with comment
- **Màn hình:** SCR-PORTAL-004, SCR-PORTAL-005, SCR-PORTAL-006
- **Actor chính:** Client Approver
- **Mục tiêu:** Reject approval item với comment bắt buộc
- **Trigger:** Approver selects Reject on any approval UC
- **Pre-condition:** Item pending approval
- **Post-condition:** Rejection reason audit; item returns draft ops-web
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** PATCH approval reject · all approval types

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Approver selects Reject on creative/content/email item |
| 2 | Modal comment required min length BR-PORTAL-009 |
| 3 | PATCH status rejected + comment stored |
| 4 | Notify staff in-app/email |
| 5 | Item returns draft in ops-web; no auto-resubmit |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Empty comment → validation block submit |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | item_id, item_type, reject_comment |
| Output | rejected status, staff notification, audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-009 | Reject without comment blocked min length |

### PORTAL-UC-010 — Export & download artifact

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-010
- **Tên use case:** Export & download artifact
- **Màn hình:** SCR-PORTAL-010, SCR-PORTAL-001
- **Actor chính:** Client Viewer
- **Mục tiêu:** Download PDF reports, CSV exports, signed URLs
- **Trigger:** User requests download from portal
- **Pre-condition:** Artifact available for client scope
- **Post-condition:** Download logged compliance; signed URL expiry
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-005
- **API / Integration:** GET /portal/settings/exports · signed URL generator

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User opens /settings exports or inline download buttons |
| 2 | List available artifacts: Meta CSV, SEO PDF, weekly reports |
| 3 | Generate signed URL with expiry TTL |
| 4 | Client downloads file |
| 5 | Audit log download event client_id + artifact id |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Expired link → regenerate new signed URL |
| E2 | Artifact not ready → 404 with retry later message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | artifact_id, client_id JWT |
| Output | signed download URL, audit log entry |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-010 | Download signed URL expiry + audit log compliance |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |

### PORTAL-UC-011 — Quên mật khẩu / reset

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-011
- **Tên use case:** Quên mật khẩu / reset
- **Màn hình:** SCR-PORTAL-002, SCR-PORTAL-011, SCR-PORTAL-012
- **Actor chính:** Client Viewer
- **Mục tiêu:** Self-serve password reset via email token
- **Trigger:** User clicks Quên mật khẩu on login
- **Pre-condition:** Portal account exists and active
- **Post-condition:** Password updated; user can login with new password
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** GAP-P0-02
- **API / Integration:** POST /portal/auth/forgot-password · POST /portal/auth/reset-password

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client click Quên mật khẩu on /login |
| 2 | Enter email on /forgot-password → generic success message |
| 3 | System send reset link /reset-password?token=… |
| 4 | Client set new password ≥8 chars on /reset-password |
| 5 | Redirect /login?reset=ok → login with new password |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid/expired token → request new link flow |
| E2 | Archived account → block reset contact AM |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | email, reset token, new password |
| Output | password hash updated, audit log |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-011 | Forgot password generic response — no email enumeration |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |

### PORTAL-UC-012 — Đổi mật khẩu khi đã login

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-012
- **Tên use case:** Đổi mật khẩu khi đã login
- **Màn hình:** SCR-PORTAL-010
- **Actor chính:** Client Viewer
- **Mục tiêu:** Change password from settings while authenticated
- **Trigger:** User opens /settings password section
- **Pre-condition:** Valid portal session JWT
- **Post-condition:** Password hash updated; session remains valid
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** POST /portal/auth/change-password

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client open /settings → Đổi mật khẩu section |
| 2 | Enter current password + new password + confirm |
| 3 | API validate current hash and policy |
| 4 | Success toast; optional re-login per policy |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Wrong current password → 401 validation error |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | current_password, new_password |
| Output | updated credential audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-012 | Change password requires current password when logged in |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |

### PORTAL-UC-013 — Zalo performance view + export

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-013
- **Tên use case:** Zalo performance view + export
- **Màn hình:** SCR-PORTAL-007
- **Actor chính:** Client Viewer
- **Mục tiêu:** Read-only Zalo KPI + CSV/PDF export scoped client
- **Trigger:** Navigate /zalo or dashboard widget click
- **Pre-condition:** zalo_enabled module flag; data synced T-1
- **Post-condition:** Export downloaded; audit log compliance
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** ZALO-005, Z3-6
- **API / Integration:** GET /portal/zalo/performance · CSV/PDF export

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client open /zalo — KPI cards load scoped client_id |
| 2 | Select date range T-7 / T-30 |
| 3 | View Spend, Leads, CPL read-only |
| 4 | Export CSV or PDF period snapshot PORTAL-UC-010 audit |
| 5 | Show CPL disclaimer if unmapped spend yellow note |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Module disabled → card hidden on dashboard not 404 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, date_range |
| Output | KPI JSON, export file |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-013 | Portal Zalo export scoped JWT — no cross-tenant KPI leak |
| BR-ZALO-005 | Portal Zalo KPI scoped JWT client_id only |
| BR-PORTAL-010 | Download signed URL expiry + audit log compliance |

### PORTAL-UC-014 — Zalo creative approval

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-014
- **Tên use case:** Zalo creative approval
- **Màn hình:** SCR-PORTAL-004
- **Actor chính:** Client Approver
- **Mục tiêu:** Approve/reject Zalo creative before go-live
- **Trigger:** Creative pending_client_approval channel=zalo
- **Pre-condition:** Approver role; creative in pending state
- **Post-condition:** Decision audited; staff notified; launch unblocked on approve
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** ZALO-019
- **API / Integration:** Portal approvals API · notify staff webhook

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Approver open /creatives filter channel=zalo |
| 2 | Preview image/copy Zalo creative |
| 3 | Approve with optional note OR Reject PORTAL-UC-009 comment |
| 4 | Staff notified; SVC launch QA can proceed on approve |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Budget over threshold → GDKD approves on ops not portal |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative_id, decision, comment? |
| Output | approval audit, status update |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-014 | Zalo creative reject requires comment min length |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |
| BR-PORTAL-009 | Reject without comment blocked min length |
| BR-ZALO-019 | — |

### PORTAL-UC-015 — Google performance view

> 🟢 Spec thủ công

- **Mã use case:** PORTAL-UC-015
- **Tên use case:** Google performance view
- **Màn hình:** SCR-PORTAL-008
- **Actor chính:** Client Viewer
- **Mục tiêu:** Read-only Google Ads KPI summary on portal
- **Trigger:** Navigate /google when google_enabled
- **Pre-condition:** Google channel mapped SVC-UC-008; sync OK
- **Post-condition:** Client-safe metrics visible; no internal fields
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /portal/google/performance

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client open /google when module enabled |
| 2 | View spend/leads/CPL read-only scoped client |
| 3 | Date range filter 7d/30d |
| 4 | Attribution disclaimer footer |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Module in progress → partial data yellow banner |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, date_range |
| Output | Google KPI summary JSON |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-015 | Google portal view read-only — no internal margin fields |
| BR-PORTAL-002 | Dashboard KPI chỉ module enabled cho client |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác | High | Done |
| BR-PORTAL-002 | Dashboard KPI chỉ module enabled cho client | Medium | Done |
| BR-PORTAL-003 | Meta portal CSV client-safe — no internal attribution fields | High | Done |
| BR-PORTAL-004 | SEO summary read-only subset; sync stale timestamp shown | Medium | Done |
| BR-PORTAL-005 | Email stats aggregate only — no subscriber PII | High | Done |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 | High | Done |
| BR-PORTAL-007 | SEO content approval advances pipeline stage | Medium | Done |
| BR-PORTAL-008 | Email campaign dual approval staff + client EM-UC-007 | Medium | Done |
| BR-PORTAL-009 | Reject without comment blocked min length | High | Done |
| BR-PORTAL-010 | Download signed URL expiry + audit log compliance | High | Done |
| BR-PORTAL-011 | Forgot password generic response — no email enumeration | High | Done |
| BR-PORTAL-012 | Change password requires current password when logged in | High | Done |
| BR-PORTAL-013 | Portal Zalo export scoped JWT — no cross-tenant KPI leak | High | Done |
| BR-PORTAL-014 | Zalo creative reject requires comment min length | High | Done |
| BR-PORTAL-015 | Google portal view read-only — no internal margin fields | Medium | In progress |
