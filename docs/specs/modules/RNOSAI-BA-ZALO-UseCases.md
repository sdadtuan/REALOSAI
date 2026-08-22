# RNOSAI BA — Zalo Ads OS Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-ZALO-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-ZALO |
| Số UC | 21 |
| Spec thủ công | 21/21 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/08-ZALO-ADS.md`](../../use-cases/08-ZALO-ADS.md) |

---

## 1. Tóm tắt module

Module Zalo Ads OS quản lý OAuth OA/Ads account, hub CPL staff, sync insights, webhook + form poll lead ingest, dedup CRM pipeline, portal performance và onboard orchestrator. Closed-loop với SYS-UC-002 (Spend → Lead → Revenue).

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-ZALO-001 | Zalo Ads Hub | /zalo/zalo-ads | Done | ZALO-UC-001, ZALO-UC-002, ZALO-UC-004 |
| SCR-ZALO-002 | Zalo Leads Inbox | /zalo/leads | Done | ZALO-UC-011, ZALO-UC-012, ZALO-UC-013 |
| SCR-PORTAL-007 | Portal Zalo Performance | /zalo | Done | PORTAL-UC-013, ZALO-UC-005 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| ZALO-UC-001 | Kết nối Zalo Ads / OA | High | Done | Thủ công |
| ZALO-UC-002 | Hub map campaign | High | Done | Thủ công |
| ZALO-UC-003 | Sync insights → daily_performance | High | Done | Thủ công |
| ZALO-UC-004 | Hub CPL staff | High | Done | Thủ công |
| ZALO-UC-005 | Portal performance | High | Done | Thủ công |
| ZALO-UC-006 | Brief chiến dịch | Medium | Done | Thủ công |
| ZALO-UC-007 | Tạo campaign draft | Medium | In progress | Thủ công |
| ZALO-UC-008 | Duyệt nội dung | Medium | Done | Thủ công |
| ZALO-UC-009 | Triển khai lên Zalo (API) | Low | Draft | Thủ công |
| ZALO-UC-010 | Pause/update/stop campaign | Low | Draft | Thủ công |
| ZALO-UC-011 | Webhook lead → CRM | High | Done | Thủ công |
| ZALO-UC-012 | Poll form lead API | High | Done | Thủ công |
| ZALO-UC-013 | Dedup & chuẩn hóa lead | High | Done | Thủ công |
| ZALO-UC-014 | CRM pipeline | High | Done | Thủ công |
| ZALO-UC-015 | CRM status sync hub | Medium | Done | Thủ công |
| ZALO-UC-016 | Xuất báo cáo KH | Medium | Done | Thủ công |
| ZALO-UC-017 | Cảnh báo bất thường | Medium | Done | Thủ công |
| ZALO-UC-018 | Phân tích đa chiều | Low | Draft | Thủ công |
| ZALO-UC-019 | Client duyệt budget | Medium | In progress | Thủ công |
| ZALO-UC-020 | Thông báo tiến độ | Medium | Done | Thủ công |
| ZALO-UC-021 | Onboard orchestrator Zalo | Medium | Done | Thủ công |

---

## 2. Chi tiết Use Case

### ZALO-UC-001 — Kết nối Zalo Ads / OA

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-001
- **Tên use case:** Kết nối Zalo Ads / OA
- **Màn hình:** SCR-AGENCY-001, SCR-ZALO-001
- **Actor chính:** Media Buyer / Tracking-Tech
- **Actor phụ:** AM
- **Mục tiêu:** OAuth và lưu credential Zalo Ads/OA cho client agency
- **Trigger:** AM thêm channel account Zalo trên client detail
- **Pre-condition:** Client agency tồn tại; Zalo Developer App đã tạo
- **Post-condition:** client_channel_accounts channel=zalo có token hợp lệ + webhook configured
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z1
- **Trace ref:** —
- **API / Integration:** POST /clients/:id/channel-accounts · /zalo-ads/oauth/* · POST /webhooks/zalo

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM mở /agency/clients/[id]?tab=channels |
| 2 | Thêm channel account type=zalo + OA id / ad account id |
| 3 | Bấm Connect Zalo → OAuth redirect → token lưu vault |
| 4 | Cấu hình webhook Zalo trỏ POST /webhooks/zalo |
| 5 | Hệ thống validate credential; hiển thị token status xanh/đỏ trên hub |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | OAuth fail → banner lỗi; giữ stub credential_ref dev |
| E2 | Pilot only → PTT_ZALO_ADS_PILOT chặn client ngoài list |
| E3 | Token sắp hết hạn → alert AM refresh trước 24h |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, oa_id, ad_account_id, oauth_code |
| Output | credential_ref, token_expiry, webhook_status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-001 | Zalo OAuth token refresh SLA <24h before expiry |

### ZALO-UC-002 — Hub map campaign

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-002
- **Tên use case:** Hub map campaign
- **Màn hình:** SCR-ZALO-001, SCR-AGENCY-001
- **Actor chính:** Media Buyer
- **Mục tiêu:** Map external Zalo campaign id ↔ hub contract / target CPL
- **Trigger:** Buyer mở tab campaigns hoặc hub unmapped banner
- **Pre-condition:** Campaigns đã sync từ Zalo API
- **Post-condition:** hub_campaign_map.channel=zalo; unmapped count giảm
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z0
- **Trace ref:** —
- **API / Integration:** POST /hub-campaign-maps · HubCampaignMapsPanel

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer mở /agency/clients/[id]?tab=campaigns hoặc /zalo/zalo-ads |
| 2 | Filter channel Zalo + client |
| 3 | Chọn external campaign id → map contract / target CPL / RE project |
| 4 | Lưu mapping → hub CPL tính đúng spend/leads |
| 5 | Unmapped campaigns hiển thị vàng trên hub cho đến khi map |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Campaign archived trên Zalo → soft-unmap + audit |
| E2 | Duplicate map → 409 conflict message |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | external_campaign_id, client_id, contract_id, target_cpl_vnd |
| Output | hub_campaign_map row + mapping audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-002 | Hub campaign map bắt buộc trước tính CPL client-facing |

### ZALO-UC-003 — Sync insights → daily_performance

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-003
- **Tên use case:** Sync insights → daily_performance
- **Màn hình:** SCR-ZALO-001
- **Actor chính:** System
- **Actor phụ:** Media Buyer (manual sync)
- **Mục tiêu:** Đồng bộ metrics Zalo campaign-level vào daily_performance
- **Trigger:** Cron T+1 hoặc Buyer bấm Sync Zalo insights
- **Pre-condition:** API credentials valid; client_channel_accounts active
- **Post-condition:** daily_performance channel=zalo upserted; zalo_insights_sync_state updated
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z1
- **Trace ref:** —
- **API / Integration:** POST /clients/:id/sync/zalo-insights · job zalo_insights_sync

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Trigger manual hoặc cron scheduler |
| 2 | Job zalo_insights_sync chạy qua ptt_worker |
| 3 | Adapter lấy metrics campaign-level từ Zalo API |
| 4 | Normalize spend, impressions, clicks, leads → upsert daily_performance |
| 5 | Cập nhật zalo_insights_sync_state.last_sync_at |
| 6 | Hub CPL tiles refresh sau sync |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Token expired → job fail; hub 🔴; alert AM |
| E2 | Stub mode → sinh dữ liệu pilot cho demo client |
| E3 | Partial API fail → retry slice; log failed campaign ids |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, date_range, campaign_ids[] |
| Output | daily_performance rows[], sync_state, job_run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-003 | Insights sync T+1; manual sync audit job_run_id |

### ZALO-UC-004 — Hub CPL staff

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-004
- **Tên use case:** Hub CPL staff
- **Màn hình:** SCR-ZALO-001
- **Actor chính:** Media Buyer / AM / Analyst
- **Mục tiêu:** Xem KPI Spend, Leads, CPL, CTR Zalo trên hub staff
- **Trigger:** User mở /zalo/zalo-ads
- **Pre-condition:** Performance data synced (ZALO-UC-003)
- **Post-condition:** KPI khớp closed-loop SYS-UC-002 channel=zalo
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z1
- **Trace ref:** —
- **API / Integration:** GET /zalo-ads/hub · export CSV

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /zalo/zalo-ads trên ops-web |
| 2 | Filter client, date range T-7/T-30/custom |
| 3 | Xem tiles Spend, Leads, CPL, CTR, ROAS (nếu revenue map) |
| 4 | Drill-down campaign row → chi tiết daily breakdown |
| 5 | Export CSV snapshot cho AM/client report |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend → yellow banner; CPL client exclude unmapped |
| E2 | No data period → empty state + link sync |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, date_from, date_to, filters |
| Output | KPI aggregates + campaign table + CSV file |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-004 | Hub CPL staff exclude unmapped spend khỏi client KPI |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |

### ZALO-UC-005 — Portal performance

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-005
- **Tên use case:** Portal performance
- **Màn hình:** SCR-PORTAL-007
- **Actor chính:** Client Viewer
- **Mục tiêu:** Client xem KPI Zalo read-only scoped client_id
- **Trigger:** Client login portal → /zalo
- **Pre-condition:** Portal account active; Zalo module enabled for client
- **Post-condition:** JWT scope enforced; không thấy client khác
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z1
- **Trace ref:** —
- **API / Integration:** GET /portal/performance?channel=zalo

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Client login portal (PORTAL-UC-001) |
| 2 | Navigate /zalo |
| 3 | Xem KPI tiles read-only: spend, leads, CPL |
| 4 | Optional date range filter 7d/30d |
| 5 | Export CSV nếu cap portal.export enabled |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Module disabled → 404 hoặc empty module message |
| E2 | Cross-tenant probe → 403 empty |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | JWT client_id, date_range |
| Output | Scoped KPI JSON / CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-005 | Portal Zalo KPI scoped JWT client_id only |
| BR-PORTAL-001 | Portal login scoped client — không thấy data client khác |
| BR-PORTAL-002 | Dashboard KPI chỉ module enabled cho client |

### ZALO-UC-006 — Brief chiến dịch

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-006
- **Tên use case:** Brief chiến dịch
- **Màn hình:** SCR-ZALO-001, SCR-SVC-004
- **Actor chính:** AM / Media Buyer
- **Actor phụ:** Client (review brief)
- **Mục tiêu:** Ghi nhận brief Zalo: mục tiêu, ngân sách, audience, form type
- **Trigger:** AM mở lifecycle stage Consult/Proposal
- **Pre-condition:** Client active; service delivery workflow stage phù hợp
- **Post-condition:** Brief saved; Buyer có thể tạo draft campaign
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** —
- **API / Integration:** PATCH /service-delivery/:id/consult-brief

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM mở /crm/service-delivery/[id] stage Consult |
| 2 | Nhập mục tiêu, ngân sách VND, audience, form lead type |
| 3 | Upload tài liệu tham khảo (PDF/image) |
| 4 | Submit brief → status pending_buyer_review |
| 5 | Media Buyer nhận notification → chuyển ZALO-UC-007 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client reject brief → AM revise loop |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | objective, budget_vnd, audience, form_type, attachments[] |
| Output | brief_id, workflow_stage advance |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-006 | Brief Zalo phải có budget + form type trước draft |

### ZALO-UC-007 — Tạo campaign draft

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-007
- **Tên use case:** Tạo campaign draft
- **Màn hình:** SCR-ZALO-001
- **Actor chính:** Media Buyer
- **Mục tiêu:** Tạo draft campaign Zalo nội bộ trước khi launch
- **Trigger:** Brief approved hoặc Buyer tạo mới từ hub
- **Pre-condition:** Zalo account connected; brief approved (P1 path)
- **Post-condition:** Draft status pending_approval; creative linked
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** —
- **API / Integration:** POST /zalo/campaigns/draft (future) · CRM creatives link

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn client + Zalo account trên hub |
| 2 | Nhập objective, budget, schedule, form lead mapping |
| 3 | Gắn creative assets từ SCR-SVC-003 Creative Hub |
| 4 | Lưu draft pending_approval |
| 5 | Trigger approval workflow ZALO-UC-008 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | v1 manual: Buyer tạo trên Zalo Ads UI → map ID (ZALO-UC-002) |
| E2 | Missing creative → block save với checklist |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign draft payload, creative_ids[] |
| Output | internal draft id, approval queue entry |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-007 | Campaign draft không publish khi thiếu creative approved |

### ZALO-UC-008 — Duyệt nội dung

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-008
- **Tên use case:** Duyệt nội dung
- **Màn hình:** SCR-ZALO-001, SCR-PORTAL-004, SCR-SVC-003
- **Actor chính:** Creative Lead / Client Approver
- **Actor phụ:** Media Buyer, Manager
- **Mục tiêu:** Dual approval creative Zalo trước launch
- **Trigger:** Buyer submit creative pending_client
- **Pre-condition:** Creative uploaded; governance rules pass
- **Post-condition:** Approval recorded; Launch QA eligible
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** —
- **API / Integration:** POST /creatives/:id/approve · portal /creatives

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer submit creative → pending_client |
| 2 | Client duyệt trên portal /creatives (SYS-UC-004) |
| 3 | Manager approve budget nếu vượt ngưỡng |
| 4 | Creative Lead final QA pass |
| 5 | Launch QA checklist SCR-SVC-001 pass → ready launch |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client reject → comment bắt buộc (PORTAL-UC-009) |
| E2 | Budget over threshold → GDKD approve required |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | creative_id, approval_action, comment |
| Output | approval audit, status approved\|rejected |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-008 | Creative Zalo dual approval client + internal QA |
| BR-SYS-004 | Client approver JWT scoped một client_id cross-module |

### ZALO-UC-009 — Triển khai lên Zalo (API)

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-009
- **Tên use case:** Triển khai lên Zalo (API)
- **Màn hình:** SCR-ZALO-001, SCR-SVC-002
- **Actor chính:** Media Buyer / System
- **Mục tiêu:** Push approved campaign lên Zalo Ads qua API
- **Trigger:** Draft approved + Launch QA pass
- **Pre-condition:** ZALO-UC-008 complete; campaign-writes queue configured
- **Post-condition:** Campaign live on Zalo; external id auto hub-mapped
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave Z4
- **Trace ref:** —
- **API / Integration:** campaign-writes queue · Zalo Ads API create campaign

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Hệ thống build payload Zalo API từ approved draft |
| 2 | Enqueue campaign-writes job → worker execute |
| 3 | Nhận external campaign id từ Zalo response |
| 4 | Auto hub map (ZALO-UC-002) |
| 5 | Audit log + notify AM/Media Buyer |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | API không hỗ trợ write → manual launch + map ID (v1 workaround) |
| E2 | API error → retry 3x; incident P1 if all fail |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | approved draft_id, launch payload |
| Output | external_campaign_id, launch audit, job status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-009 | — |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |

### ZALO-UC-010 — Pause/update/stop campaign

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-010
- **Tên use case:** Pause/update/stop campaign
- **Màn hình:** SCR-ZALO-001
- **Actor chính:** Media Buyer
- **Mục tiêu:** Điều khiển trạng thái campaign Zalo (pause/resume/budget)
- **Trigger:** Buyer chọn action trên hub campaign row
- **Pre-condition:** Campaign live on Zalo; mapped on hub
- **Post-condition:** Status updated via API hoặc manual audit
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave Z4
- **Trace ref:** —
- **API / Integration:** Zalo Ads API pause/resume/update · audit log

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer mở campaign detail trên /zalo/zalo-ads |
| 2 | Chọn Pause / Resume / Update budget / Stop |
| 3 | Confirm modal với reason (governance) |
| 4 | API call hoặc manual instruction logged |
| 5 | Hub status sync sau action |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Emergency stop → META-UC-012 pattern cross-channel |
| E2 | API deny → manual + ticket tracking |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, action, new_budget_vnd, reason |
| Output | updated campaign status, audit entry |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-010 | — |

### ZALO-UC-011 — Webhook lead → CRM

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-011
- **Tên use case:** Webhook lead → CRM
- **Màn hình:** SCR-ZALO-002, SCR-CRM-001
- **Actor chính:** System
- **Actor phụ:** CSKH (consumer)
- **Mục tiêu:** Ingest lead realtime từ Zalo webhook vào CRM
- **Trigger:** Zalo POST webhook lead event
- **Pre-condition:** Webhook secret configured; endpoint live
- **Post-condition:** Lead visible /crm/leads?channel=zalo với owner assigned
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z0
- **Trace ref:** PLAT-005
- **API / Integration:** POST /webhooks/zalo · zalo-webhook.parser.ts

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Zalo POST webhook payload tới /webhooks/zalo |
| 2 | Verify HMAC signature (PLAT-UC-005) |
| 3 | Parse fields → normalize phone/name/form_id |
| 4 | Dedup (ZALO-UC-013) → insert crm_leads channel=zalo |
| 5 | Return HTTP 200 ack |
| 6 | Trigger assignment CRM-UC-001 + score AI-UC-001 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid signature → 401 + alert DevOps |
| E2 | Missing phone → queue review CRM-UC-003 |
| E3 | Duplicate 24h → link existing lead id |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | Zalo webhook JSON, X-Signature headers |
| Output | lead_id, ingest audit, zalo_lead_events row |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-011 | Zalo webhook lead dedup same as CRM BR-CRM-001 |
| BR-PLAT-005 | Zalo/Google webhook signature verify trước normalize lead |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### ZALO-UC-012 — Poll form lead API

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-012
- **Tên use case:** Poll form lead API
- **Màn hình:** SCR-ZALO-002
- **Actor chính:** System
- **Mục tiêu:** Poll lead từ Zalo form API bù webhook gap
- **Trigger:** Worker zalo_form_lead_poll theo cron
- **Pre-condition:** Form API credentials; cursor initialized
- **Post-condition:** Leads ingested SLA ≤15 phút từ submit form
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z2
- **Trace ref:** —
- **API / Integration:** openapi.zalo.me/v2.0/oa/form/get · POST /zalo/forms/:id/poll

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Worker đọc zalo_lead_form_sync_cursor |
| 2 | Gọi Zalo form/get với since cursor |
| 3 | Normalize + dedup (ZALO-UC-013) |
| 4 | Push CRM pipeline (ZALO-UC-014) |
| 5 | Advance cursor; log poll batch metrics |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Rate limit → backoff exponential |
| E2 | Empty batch → skip advance cursor |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | form_id, cursor_timestamp, oa_id |
| Output | leads_created[], cursor_new, poll_run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-012 | Form poll SLA ≤15 phút từ submit form |
| BR-ZALO-011 | Zalo webhook lead dedup same as CRM BR-CRM-001 |

### ZALO-UC-013 — Dedup & chuẩn hóa lead

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-013
- **Tên use case:** Dedup & chuẩn hóa lead
- **Màn hình:** SCR-ZALO-002, SCR-CRM-001
- **Actor chính:** System
- **Mục tiêu:** Chuẩn hóa phone/email và chống trùng lead Zalo
- **Trigger:** Mọi ingest path webhook hoặc poll
- **Pre-condition:** Lead ingest active
- **Post-condition:** Duplicate flagged; fingerprint logged
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z0/Z2
- **Trace ref:** CRM-001
- **API / Integration:** dedup engine · zalo_lead_events

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Normalize phone VN (+84/0xxx → E.164 internal) |
| 2 | Normalize email lowercase trim |
| 3 | Fingerprint hash phone+client_id |
| 4 | Match existing lead within 24h window → mark duplicate |
| 5 | Log zalo_lead_events với dedup decision |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Same phone different client → separate leads (tenant isolation) |
| E2 | Invalid phone → queue manual review |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | raw lead fields, client_id, source_event_id |
| Output | normalized lead, is_duplicate flag, merge_target_id? |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-013 | Dedup phone+client trong 24h → duplicate flag |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### ZALO-UC-014 — CRM pipeline

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-014
- **Tên use case:** CRM pipeline
- **Màn hình:** SCR-CRM-001, SCR-CRM-002, SCR-ZALO-002
- **Actor chính:** CSKH
- **Actor phụ:** System (auto-assign)
- **Mục tiêu:** CSKH xử lý lead Zalo trên pipeline CRM chuẩn
- **Trigger:** Lead assigned sau ingest
- **Pre-condition:** Lead assigned owner (CRM-UC-001)
- **Post-condition:** Pipeline stage tracked; timeline updated
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave Z0
- **Trace ref:** —
- **API / Integration:** GET/PATCH /api/v1/leads/:id · activity timeline

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Lead auto-assign owner theo rule |
| 2 | CSKH nhận notification in-app |
| 3 | Mở /crm/leads/[id] → log call/note |
| 4 | Advance status B1/B2 theo CRM-UC-002 |
| 5 | Attribution chips link về /zalo/zalo-ads campaign |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | No owner match → GDKD review queue |
| E2 | Lost lead → reason code + stop nurture |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, activity, status transition |
| Output | updated pipeline stage, SLA metrics |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-014 | Lead Zalo pipeline theo CRM status chuẩn B1/B2 |
| BR-CRM-002 | Chuyển status B2 bắt buộc ghi activity timeline |

### ZALO-UC-015 — CRM status sync hub

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-015
- **Tên use case:** CRM status sync hub
- **Màn hình:** SCR-ZALO-001, SCR-CRM-002
- **Actor chính:** System
- **Mục tiêu:** Đồng bộ Won/Lost CRM ngược lên hub conversion metrics
- **Trigger:** CRM lead/customer status change domain event
- **Pre-condition:** Lead mapped to Zalo campaign on hub
- **Post-condition:** Hub CPL/CPA conversion metrics updated
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z2
- **Trace ref:** —
- **API / Integration:** domain event consumer · hub metrics recompute

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CRM emit lead.status_changed / customer.converted |
| 2 | Worker map lead → hub campaign via attribution |
| 3 | Recompute conversion count + revenue (if mapped) |
| 4 | Update hub tiles CPA/CPL closed-loop |
| 5 | Optional portal KPI refresh cache |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped campaign → skip conversion; flag in hub |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, new_status, converted_revenue_vnd? |
| Output | hub conversion metrics delta |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-015 | CRM Won/Lost sync conversion metrics hub Zalo |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |

### ZALO-UC-016 — Xuất báo cáo KH

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-016
- **Tên use case:** Xuất báo cáo KH
- **Màn hình:** SCR-PORTAL-007, SCR-ZALO-001
- **Actor chính:** AM / Analyst
- **Mục tiêu:** Export báo cáo Zalo CSV/PDF cho khách hàng
- **Trigger:** Reporting period closed hoặc AM manual export
- **Pre-condition:** Hub data synced; period closed
- **Post-condition:** Report delivered portal hoặc email (SYS-UC-005)
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z2
- **Trace ref:** SYS-005
- **API / Integration:** GET /zalo-ads/hub/export · portal artifact download

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM chọn client + period trên hub |
| 2 | Preview KPI summary table |
| 3 | Export CSV hoặc generate PDF template |
| 4 | Upload artifact to portal /settings exports |
| 5 | Optional email notify client (SYS-UC-005) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend warning in report footnote |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, period, format csv\|pdf |
| Output | report file URL, delivery audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-016 | — |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |

### ZALO-UC-017 — Cảnh báo bất thường

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-017
- **Tên use case:** Cảnh báo bất thường
- **Màn hình:** SCR-ZALO-001, SCR-AI-001
- **Actor chính:** System / Media Buyer
- **Actor phụ:** GDKD (digest)
- **Mục tiêu:** Alert khi CPL spike, CTR drop, zero leads 24h
- **Trigger:** Rule engine scan daily hoặc realtime threshold
- **Pre-condition:** Baseline metrics ≥7d; mapped campaigns exist
- **Post-condition:** Notification Slack/email + hub banner
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** AI-UC-019
- **API / Integration:** alert module · AI anomaly digest cross-link

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Rule scan: CPL > target_cpl_vnd, CTR drop >30%, zero leads 24h |
| 2 | Create alert record severity high/medium |
| 3 | Hub banner on /zalo/zalo-ads link campaign detail |
| 4 | Notify Media Buyer + AM via in-app/Slack |
| 5 | Optional rollup vào AI-UC-019 anomaly digest |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | False positive → user dismiss + tune threshold |
| E2 | Insufficient data → skip alert with note |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | daily_performance[], targets, thresholds |
| Output | alert_id[], notifications sent |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-017 | Alert CPL > target hoặc zero leads 24h |
| BR-AI-019 | Anomaly digest threshold configurable per channel |

### ZALO-UC-018 — Phân tích đa chiều

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-018
- **Tên use case:** Phân tích đa chiều
- **Màn hình:** SCR-ZALO-001
- **Actor chính:** Analyst / Media Buyer
- **Mục tiêu:** Drill hub theo creative/client/campaign dimension
- **Trigger:** Analyst mở analytics view trên hub
- **Pre-condition:** Data ≥30 ngày trên daily_performance
- **Post-condition:** Multi-dim chart rendered; export available
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave Z4
- **Trace ref:** —
- **API / Integration:** GET /zalo-ads/hub/breakdown · future ClickHouse BI

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở breakdown view trên hub |
| 2 | Chọn dimensions: campaign, creative, date, placement |
| 3 | Render chart/table compare periods |
| 4 | Export CSV snapshot |
| 5 | Optional link Grafana dashboard (future) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Data <30d → show partial data warning |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | dimensions[], metrics[], date_range |
| Output | breakdown dataset, chart config, CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-018 | — |

### ZALO-UC-019 — Client duyệt budget

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-019
- **Tên use case:** Client duyệt budget
- **Màn hình:** SCR-PORTAL-007, SCR-PORTAL-004
- **Actor chính:** Client Approver
- **Mục tiêu:** Client approve budget proposal Zalo trước launch
- **Trigger:** AM submit budget proposal > threshold
- **Pre-condition:** Budget proposal ready on portal
- **Post-condition:** Approval recorded; Buyer có thể launch
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** —
- **API / Integration:** portal approval inbox · PATCH approval status

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | AM tạo budget proposal gắn Zalo campaign draft |
| 2 | Client nhận notification portal |
| 3 | Mở /zalo hoặc /creatives approval inbox |
| 4 | Review budget + creative preview |
| 5 | Approve hoặc Reject với comment (PORTAL-UC-009) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Partial approve → AM revise proposal |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | proposal_id, approval_action, comment |
| Output | approval audit, workflow unblock |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-019 | — |
| BR-PORTAL-006 | Creative approval synced ops-web SYS-UC-004 |

### ZALO-UC-020 — Thông báo tiến độ

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-020
- **Tên use case:** Thông báo tiến độ
- **Màn hình:** SCR-PORTAL-009, SCR-ZALO-001
- **Actor chính:** System
- **Actor phụ:** AM, Client Viewer
- **Mục tiêu:** Notify milestone: approve, launch, error, KPI target
- **Trigger:** Domain events: approval, launch, alert, milestone
- **Pre-condition:** Portal notifications enabled (PORTAL-UC-010)
- **Post-condition:** In-app notification delivered read/unread
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z3
- **Trace ref:** —
- **API / Integration:** portal notifications DDL · in-app bell

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Event: creative approved / campaign launched / alert fired |
| 2 | Create portal_notification scoped client_id |
| 3 | Client xem /notifications |
| 4 | AM copy trên ops-web activity feed (optional) |
| 5 | Mark read; retention policy 90d |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Email fallback nếu in-app disabled |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | event_type, client_id, payload summary |
| Output | notification_id, delivery status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-020 | — |
| BR-PORTAL-010 | Download signed URL expiry + audit log compliance |

### ZALO-UC-021 — Onboard orchestrator Zalo

> 🟢 Spec thủ công

- **Mã use case:** ZALO-UC-021
- **Tên use case:** Onboard orchestrator Zalo
- **Màn hình:** SCR-AGENCY-001, SCR-ZALO-001
- **Actor chính:** AM
- **Mục tiêu:** Onboard Zalo module qua orchestrator checklist SYS-UC-001
- **Trigger:** Client onboard wizard step Zalo
- **Pre-condition:** Client record created (SYS-UC-001)
- **Post-condition:** Zalo module enabled; all green checks
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave Z2
- **Trace ref:** SYS-001
- **API / Integration:** onboarding-orchestrator · deep-links per step

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tab onboard orchestrator hiển thị steps Zalo |
| 2 | Step 1: Connect account (ZALO-UC-001) |
| 3 | Step 2: Map campaign sample (ZALO-UC-002) |
| 4 | Step 3: First sync insights (ZALO-UC-003) |
| 5 | Step 4: Webhook test + first lead (ZALO-UC-011) |
| 6 | All green → enable Zalo module flag for client |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Step fail → yellow state + deep-link fix |
| E2 | Skip Zalo module → client without Zalo routes |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, orchestrator checklist state |
| Output | module_flags.zalo=true, checklist completion audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-021 | Onboard orchestrator Zalo 5 steps trước enable module |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module |
| BR-SYS-001 | Onboard client phải map ít nhất 1 channel account |

---

## 3. Chi tiết Màn hình module

### SCR-ZALO-001 — Zalo Ads Hub

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-ZALO-001
- **Tên màn hình:** Zalo Ads Hub
- **Route:** /zalo/zalo-ads
- **Module:** MOD-ZALO
- **Mục đích:** Hub CPL, map campaign, sync insights Zalo
- **Vai trò:** Media Buyer, AM
- **Use case liên quan:** ZALO-UC-001, ZALO-UC-002, ZALO-UC-004
- **Trạng thái triển khai:** Done

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OA/Ads account | Select | Có | Chọn tài khoản Zalo |
| 2 | CPL tiles | KPI | Có | Spend · leads · CPL |
| 3 | Campaign table | Table | Có | Status · budget · CRM map |
| 4 | Sync indicator | Badge | Có | Last poll/sync time |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-001 | Zalo OAuth token refresh SLA <24h before expiry |
| BR-ZALO-002 | Hub campaign map bắt buộc trước tính CPL client-facing |
| BR-ZALO-004 | Hub CPL staff exclude unmapped spend khỏi client KPI |

### SCR-ZALO-002 — Zalo Leads Inbox

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-ZALO-002
- **Tên màn hình:** Zalo Leads Inbox
- **Route:** /zalo/leads
- **Module:** MOD-ZALO — Zalo Ads OS
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Webhook + poll form ✅
- **Vai trò:** CSKH, Media Buyer
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** ZALO-UC-011, ZALO-UC-012, ZALO-UC-013
- **API liên quan:** GET/POST /api/v1/* — module Zalo
- **Parity / RNOS:** —
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** Media
- **Ghi chú:** Webhook + poll form ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Zalo Leads Inbox |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /zalo/leads |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-ZALO-011 | Zalo webhook lead dedup same as CRM BR-CRM-001 |
| BR-ZALO-012 | Form poll SLA ≤15 phút từ submit form |
| BR-ZALO-013 | Dedup phone+client trong 24h → duplicate flag |
| BR-ZALO-014 | Lead Zalo pipeline theo CRM status chuẩn B1/B2 |

### SCR-PORTAL-007 — Portal Zalo Performance

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-PORTAL-007
- **Tên màn hình:** Portal Zalo Performance
- **Route:** /zalo
- **Module:** MOD-PORTAL — Client Portal
- **Ứng dụng:** portal-web (portal.pttads.vn)
- **Mục đích:** Zalo Ads performance read-only — CPL KPI + export
- **Vai trò:** Client Viewer
- **Điều kiện trước:** Authenticated portal session
- **Điều kiện sau:** Zalo KPI table + CSV/PDF export
- **Use case liên quan:** PORTAL-UC-013, ZALO-UC-005
- **API liên quan:** GET portal performance channel=zalo · export
- **Parity / RNOS:** Z3-6
- **Trạng thái triển khai:** Done (deep spec v2.0)
- **Ghi chú:** Zalo KPI + CSV/PDF export ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | PortalNav | Navigation | Có | Standard shell |
| 2 | PerformancePanel | Panel | Có | channel=zalo · T-7/T-30 · group-by |
| 3 | ExportButtons | Button | Có | CSV/PDF Z3-6 |
| 4 | SummaryGrid | KPI | Có | Spend · leads · CPL |
| 5 | PerformanceTable | Table | Có | Zalo-specific rows |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-PORTAL-013 | Portal Zalo export scoped JWT — no cross-tenant KPI leak |
| BR-ZALO-005 | Portal Zalo KPI scoped JWT client_id only |

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-ZALO-001 | Zalo OAuth token refresh SLA <24h before expiry | High | Done |
| BR-ZALO-002 | Hub campaign map bắt buộc trước tính CPL client-facing | High | Done |
| BR-ZALO-003 | Insights sync T+1; manual sync audit job_run_id | High | Done |
| BR-ZALO-004 | Hub CPL staff exclude unmapped spend khỏi client KPI | High | Done |
| BR-ZALO-005 | Portal Zalo KPI scoped JWT client_id only | High | Done |
| BR-ZALO-006 | Brief Zalo phải có budget + form type trước draft | Medium | Done |
| BR-ZALO-007 | Campaign draft không publish khi thiếu creative approved | Medium | In progress |
| BR-ZALO-008 | Creative Zalo dual approval client + internal QA | High | Done |
| BR-ZALO-011 | Zalo webhook lead dedup same as CRM BR-CRM-001 | High | Done |
| BR-ZALO-012 | Form poll SLA ≤15 phút từ submit form | High | Done |
| BR-ZALO-013 | Dedup phone+client trong 24h → duplicate flag | High | Done |
| BR-ZALO-014 | Lead Zalo pipeline theo CRM status chuẩn B1/B2 | High | Done |
| BR-ZALO-015 | CRM Won/Lost sync conversion metrics hub Zalo | Medium | Done |
| BR-ZALO-017 | Alert CPL > target hoặc zero leads 24h | Medium | Done |
| BR-ZALO-021 | Onboard orchestrator Zalo 5 steps trước enable module | Medium | Done |
