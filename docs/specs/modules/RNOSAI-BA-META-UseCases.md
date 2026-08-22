# RNOSAI BA — Meta Enterprise Ops Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-META-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-META |
| Số UC | 14 |
| Spec thủ công | 14/14 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/03-META-ENTERPRISE.md`](../../use-cases/03-META-ENTERPRISE.md) |

---

## 1. Tóm tắt module

Module Meta Enterprise Ops: OAuth ad account, hub CPL/ROAS closed-loop, leadgen webhook, CAPI dedup, tracking health, ads-ops launch/edit governance, intelligence forecast/breakdown, emergency pause và weekly client PDF.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-META-001 | Facebook Ads Hub | /meta/facebook-ads | Done | META-UC-001, META-UC-002, META-UC-003 |
| SCR-META-002 | Meta Intelligence | /meta/intelligence | Done | META-UC-010, META-UC-011 |
| SCR-META-003 | Tracking Health & Pixel | /meta/tracking | Done | META-UC-006, META-UC-005 |
| SCR-META-004 | Ads Ops (Launch/Edit) | /meta/ads-ops | Done | META-UC-007, META-UC-008 |
| SCR-META-005 | Ads Combined (cross-channel) | /meta/ads-combined | Done | SYS-UC-002, ZALO-UC-018 |
| SCR-META-006 | Meta API Migration | /meta/migration | Draft | META-UC-014 |
| SCR-GOOGLE-001 | Google Ads Hub | /google/google-ads | Done | SVC-UC-008, PLAT-UC-005 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| META-UC-001 | Kết nối ad account & sync insights | High | Done | Thủ công |
| META-UC-002 | Hub map campaign ↔ CRM | High | Done | Thủ công |
| META-UC-003 | Xem CPL/ROAS trên hub | High | Done | Thủ công |
| META-UC-004 | Webhook lead Meta → CRM | High | Done | Thủ công |
| META-UC-005 | CAPI event gửi & dedup | High | Done | Thủ công |
| META-UC-006 | Tracking health & pixel test | High | Done | Thủ công |
| META-UC-007 | Launch Ads wizard | High | Done | Thủ công |
| META-UC-008 | Edit campaign có governance | High | Done | Thủ công |
| META-UC-009 | Anomaly detection & alert | Medium | Done | Thủ công |
| META-UC-010 | Intelligence forecast | Medium | Done | Thủ công |
| META-UC-011 | Breakdown insights (platform/placement) | Medium | Done | Thủ công |
| META-UC-012 | Pause domain/client spend emergency | High | Done | Thủ công |
| META-UC-013 | Weekly client PDF report | Medium | Done | Thủ công |
| META-UC-014 | Horizon migration signoff | Medium | Draft | Thủ công |

---

## 2. Chi tiết Use Case

### META-UC-001 — Kết nối ad account & sync insights

> 🟢 Spec thủ công

- **Mã use case:** META-UC-001
- **Tên use case:** Kết nối ad account & sync insights
- **Màn hình:** SCR-META-001, SCR-AGENCY-001
- **Actor chính:** Tracking/Tech / Media Buyer
- **Actor phụ:** System (sync worker)
- **Mục tiêu:** Map Meta ad account → client và sync T-1 insights
- **Trigger:** Onboard Meta service hoặc manual sync
- **Pre-condition:** Meta Business Manager access; system user token configured
- **Post-condition:** Insights table populated; last_sync timestamp; hub status green/yellow/red
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /clients/:id/channel-accounts · POST sync/meta-insights · GET /meta/insights

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Map ad account → client SVC-UC-008 tab channels |
| 2 | OAuth/system user token lưu vault; refresh before expiry |
| 3 | Worker sync campaigns/adsets/ads T-1 insights |
| 4 | Hub /meta/facebook-ads hiển thị spend, impressions, clicks |
| 5 | Sync status indicator green/yellow/red trên hub |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Token expired → alert AM; re-auth OAuth flow |
| E2 | Partial sync fail → retry failed ad accounts slice |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, ad_account_id, oauth tokens, date_range |
| Output | insights rows[], sync_state, hub health badge |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-001 | Ad account OAuth refresh trước khi hết hạn token |
| BR-SVC-008 | Channel account mapping unique per client |

### META-UC-002 — Hub map campaign ↔ CRM

> 🟢 Spec thủ công

- **Mã use case:** META-UC-002
- **Tên use case:** Hub map campaign ↔ CRM
- **Màn hình:** SCR-META-001, SCR-AGENCY-001
- **Actor chính:** Media Buyer
- **Mục tiêu:** Map external Meta campaign id ↔ CRM client/project/deal for CPL
- **Trigger:** Unmapped campaigns listed on hub yellow banner
- **Pre-condition:** Campaigns synced META-UC-001
- **Post-condition:** campaign_id → client_id relation stored; CPL enabled
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /hub-campaign-maps · HubCampaignMapsPanel · bulk CSV map

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer mở /meta/facebook-ads hoặc client tab campaigns |
| 2 | Filter unmapped campaigns highlighted yellow |
| 3 | Select CRM client/project/deal line + target CPL |
| 4 | Save mapping → hub_campaign_map stored |
| 5 | Optional bulk map CSV upload |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Campaign archived on Meta → soft-unmap audit |
| E2 | Duplicate map → 409 conflict |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | external_campaign_id, client_id, contract_id, target_cpl |
| Output | hub_campaign_map row, mapping audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-002 | Hub campaign map bắt buộc trước CPL client rollup |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |

### META-UC-003 — Xem CPL/ROAS trên hub

> 🟢 Spec thủ công

- **Mã use case:** META-UC-003
- **Tên use case:** Xem CPL/ROAS trên hub
- **Màn hình:** SCR-META-001
- **Actor chính:** Media Buyer / AM
- **Mục tiêu:** Hub aggregate spend + CRM leads + revenue → CPL/ROAS
- **Trigger:** User mở /meta/facebook-ads
- **Pre-condition:** Performance synced; mappings exist for client rollup
- **Post-condition:** KPI matches closed-loop SYS-UC-002
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-002
- **API / Integration:** GET /meta/facebook-ads/hub · attribution API · export CSV

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Hub aggregate spend Meta + leads CRM + revenue Won |
| 2 | Display CPL, ROAS, trend 7/30 days tiles |
| 3 | Filter client, campaign, date range |
| 4 | Drill campaign row → daily breakdown |
| 5 | Export CSV snapshot for client report |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend → yellow warning; exclude from client rollup |
| E2 | No leads period → CPL N/A with note |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, date_from, date_to, campaign filters |
| Output | CPL, ROAS, trend charts, CSV export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-003 | CPL/ROAS tính theo last-click attribution default |
| BR-SYS-002 | Closed-loop attribution requires campaign ↔ CRM map |

### META-UC-004 — Webhook lead Meta → CRM

> 🟢 Spec thủ công

- **Mã use case:** META-UC-004
- **Tên use case:** Webhook lead Meta → CRM
- **Màn hình:** SCR-CRM-001, SCR-CRM-015
- **Actor chính:** System
- **Actor phụ:** CSKH (consumer)
- **Mục tiêu:** Meta Leadgen webhook tạo lead CRM ≤60s SLA
- **Trigger:** Meta POST leadgen webhook
- **Pre-condition:** Webhook secret + form field map configured
- **Post-condition:** Lead in CRM with source Meta; owner assigned; score triggered
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** PLAT-004, TC-PROJ-08
- **API / Integration:** POST /webhooks/meta · lead ingest worker · facebook_webhook.parser

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Meta POST leadgen payload → PLAT-UC-004 endpoint |
| 2 | Verify X-Hub-Signature-256 signature |
| 3 | Parse leadgen → normalize VN phone, full_name fields |
| 4 | Dedup phone → create/update CRM lead (CRM-UC-001) |
| 5 | Map campaign/adset attribution meta_json |
| 6 | Auto-assign owner + return HTTP 200 OK to Meta |
| 7 | Trigger AI-UC-001 score async |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Invalid signature → 401 + DevOps alert SYS-UC-008 |
| E2 | Missing phone → GDKD review queue CRM-UC-003 |
| E3 | RE project webhook → map project_id CRM-UC-010 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | Meta leadgen webhook JSON, signature headers |
| Output | lead_id, ingest audit, assignment result |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-004 | Webhook leadgen verify signature + map field VN |
| BR-PLAT-004 | Webhook Meta verify X-Hub-Signature-256 |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |

### META-UC-005 — CAPI event gửi & dedup

> 🟢 Spec thủ công

- **Mã use case:** META-UC-005
- **Tên use case:** CAPI event gửi & dedup
- **Màn hình:** SCR-META-003
- **Actor chính:** System / Tracking-Tech
- **Mục tiêu:** Send Conversions API events with PII hash + event_id dedup
- **Trigger:** CRM stage Won / qualified event hook
- **Pre-condition:** Pixel + CAPI configured; domain verified
- **Post-condition:** Event visible Meta Events Manager; dedup with pixel
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** CAPI service · CRM event hook · Meta Graph API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CRM event hook on qualified/Won stage change |
| 2 | CAPI payload builder hash PII per Meta spec |
| 3 | event_id = hash(lead_id + event_name + date) dedup |
| 4 | Send Conversions API batch |
| 5 | Log response; retry on 5xx with backoff |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Test mode staging → Events Manager test events |
| E2 | Duplicate event_id → Meta dedup skip |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead/customer PII hashed, event_name, event_time, custom_data |
| Output | CAPI response, event_id, retry audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-005 | CAPI event_id dedup hash(lead_id+event_name+date) |
| BR-META-006 | Tracking health green required trước launch gate |

### META-UC-006 — Tracking health & pixel test

> 🟢 Spec thủ công

- **Mã use case:** META-UC-006
- **Tên use case:** Tracking health & pixel test
- **Màn hình:** SCR-META-003
- **Actor chính:** Tracking/Tech
- **Mục tiêu:** Document tracking health pre-launch: pixel, CAPI, match rate
- **Trigger:** Pre-launch checklist or periodic audit
- **Pre-condition:** Pixel installed on client site
- **Post-condition:** Health score documented; fix checklist linked
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GET /meta/tracking/health · POST test event API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Open /meta/tracking per client |
| 2 | View pixel status, CAPI connection, domain verification |
| 3 | Run pixel/CAPI test event button |
| 4 | View match rate, recent event volume |
| 5 | Fix checklist linked to Launch QA SVC-UC-005 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Test event fail → block launch gate until green |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, pixel_id, test_event payload |
| Output | health score, test result, checklist items |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-006 | Tracking health green required trước launch gate |
| BR-SVC-005 | Launch QA critical fail blocks campaign write submit |

### META-UC-007 — Launch Ads wizard

> 🟢 Spec thủ công

- **Mã use case:** META-UC-007
- **Tên use case:** Launch Ads wizard
- **Màn hình:** SCR-META-004, SCR-SVC-001, SCR-SVC-002
- **Actor chính:** Media Buyer
- **Mục tiêu:** Launch campaign qua wizard + governance queue
- **Trigger:** Buyer launch new Meta campaign
- **Pre-condition:** Creative approved SVC-UC-006; Launch QA pass SVC-UC-005
- **Post-condition:** Campaign live on Meta; Meta ids stored; hub mapped
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-003
- **API / Integration:** /meta/ads-ops wizard · Campaign Write queue · Meta Marketing API create

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /meta/ads-ops launch wizard |
| 2 | Chọn objective, budget, audience, creative from hub |
| 3 | Launch QA gate SVC-UC-005 pass confirmation |
| 4 | Submit → Campaign Write queue SVC-UC-007 pending approval |
| 5 | On approve → Meta create API → store external ids |
| 6 | Auto-suggest hub map META-UC-002 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | QA fail → block submit with checklist items |
| E2 | API error → job retry + notify buyer |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | launch payload, creative_ids[], budget, schedule |
| Output | external campaign/adset/ad ids, write job audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-007 | Launch wizard bắt buộc Launch QA + Campaign Write approval |
| BR-SYS-003 | Không launch campaign nếu Launch QA critical fail |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |

### META-UC-008 — Edit campaign có governance

> 🟢 Spec thủ công

- **Mã use case:** META-UC-008
- **Tên use case:** Edit campaign có governance
- **Màn hình:** SCR-META-004, SCR-SVC-002
- **Actor chính:** Media Buyer
- **Mục tiêu:** Edit budget/bid/status via approval queue — no API bypass
- **Trigger:** Buyer request campaign edit on live campaign
- **Pre-condition:** Campaign exists on Meta; write queue configured
- **Post-condition:** Edit audit trail; threshold rules enforced
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** Campaign write edit jobs · Meta Marketing API update

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Buyer chọn Edit on hub campaign row → /meta/ads-ops |
| 2 | Nhập thay đổi budget/bid/status |
| 3 | Budget increase >X% → manager approval required |
| 4 | Submit write queue job → approver review |
| 5 | On approve → Meta API update + audit log |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Emergency edit → GDKD override with reason audit |
| E2 | Reject edit → notify buyer with comment |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, edit fields, reason, approver_id |
| Output | write job status, Meta API response, audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-008 | Campaign edit qua write queue — no direct API bypass prod |
| BR-SVC-007 | Campaign write budget threshold → GDKD approve |

### META-UC-009 — Anomaly detection & alert

> 🟢 Spec thủ công

- **Mã use case:** META-UC-009
- **Tên use case:** Anomaly detection & alert
- **Màn hình:** SCR-META-002, SCR-META-001, SCR-AI-001
- **Actor chính:** System / Media Buyer
- **Actor phụ:** GDKD (digest via AI-UC-019)
- **Mục tiêu:** Detect spend spike, CPL drift, zero delivery → alert
- **Trigger:** Daily metrics scan vs baseline
- **Pre-condition:** Baseline metrics ≥7d; mapped campaigns
- **Post-condition:** Slack/email alert + hub banner; optional AI digest
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** AI-UC-019
- **API / Integration:** anomaly rules engine · alert module · hub banner API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Rules engine scan daily_performance Meta channel |
| 2 | Detect: spend spike, CPL >2σ, zero delivery 24h |
| 3 | Create alert record + hub banner on /meta/facebook-ads |
| 4 | Notify Media Buyer + AM Slack/email |
| 5 | Rollup optional vào AI-UC-019 anomaly digest |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | False positive → dismiss + tune threshold BR-META-009 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | metrics[], baselines, alert rules config |
| Output | alert_ids[], notifications, banner state |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-009 | Anomaly alert khi CPL vượt baseline >2σ |
| BR-AI-019 | Anomaly digest threshold configurable per channel |

### META-UC-010 — Intelligence forecast

> 🟢 Spec thủ công

- **Mã use case:** META-UC-010
- **Tên use case:** Intelligence forecast
- **Màn hình:** SCR-META-002
- **Actor chính:** Media Buyer / AM / GDKD
- **Mục tiêu:** Forecast spend/leads based on historical Meta performance
- **Trigger:** User mở /meta/intelligence forecast tab
- **Pre-condition:** Historical data ≥30 days synced
- **Post-condition:** Forecast chart rendered; scenario budget slider
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /meta/intelligence/forecast · forecast API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /meta/intelligence → Forecast tab |
| 2 | Select client/campaign scope + horizon 7/30/90d |
| 3 | Render spend/leads forecast curve from historical |
| 4 | Scenario budget slider what-if CPL impact |
| 5 | Export forecast CSV for planning |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Data <30d → partial forecast warning |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, campaign_ids[], horizon_days, budget_scenario |
| Output | forecast series[], scenario comparison CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-010 | Forecast requires ≥30d historical data or warning |

### META-UC-011 — Breakdown insights (platform/placement)

> 🟢 Spec thủ công

- **Mã use case:** META-UC-011
- **Tên use case:** Breakdown insights (platform/placement)
- **Màn hình:** SCR-META-002
- **Actor chính:** Media Buyer
- **Mục tiêu:** View Meta insights breakdown by platform, placement, demographics
- **Trigger:** Buyer mở breakdown tab on intelligence
- **Pre-condition:** Breakdown insights synced v8 DDL
- **Post-condition:** Breakdown table visible; export CSV
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /meta/insights/breakdown · breakdown insights API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /meta/intelligence → Breakdown tab |
| 2 | Select breakdown dimensions: platform, placement, age, gender |
| 3 | Render table + chart compare periods |
| 4 | Identify underperforming placements |
| 5 | Export CSV breakdown snapshot |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | API rate limit → cached snapshot with timestamp |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | campaign_id, breakdown_dims[], date_range |
| Output | breakdown table, chart spec, CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-011 | Breakdown insights cache TTL + rate limit fallback |

### META-UC-012 — Pause domain/client spend emergency

> 🟢 Spec thủ công

- **Mã use case:** META-UC-012
- **Tên use case:** Pause domain/client spend emergency
- **Màn hình:** SCR-META-004, SCR-META-001
- **Actor chính:** Admin / GDKD / Media Buyer
- **Mục tiêu:** Emergency pause all active Meta campaigns for client/domain
- **Trigger:** Fraud, client request, billing dispute, compliance
- **Pre-condition:** Emergency cap authorized role
- **Post-condition:** No new spend; campaigns PAUSED on Meta; audit who triggered
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST emergency pause API · Meta batch pause · runbook link

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | GDKD/Admin toggle Emergency pause on client/domain |
| 2 | Confirm modal reason bắt buộc |
| 3 | Queue pause all active campaigns via Meta API batch |
| 4 | Notify AM + client (portal notification optional) |
| 5 | Audit log: who, when, reason, campaigns affected |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Partial API fail → retry failed campaigns list |
| E2 | Resume requires separate approval workflow |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id or domain, pause_reason, actor_id |
| Output | paused campaign ids[], audit record, notifications |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-012 | Emergency pause audit who/when/reason bắt buộc |

### META-UC-013 — Weekly client PDF report

> 🟢 Spec thủ công

- **Mã use case:** META-UC-013
- **Tên use case:** Weekly client PDF report
- **Màn hình:** SCR-PORTAL-003, SCR-META-001
- **Actor chính:** AM / System
- **Mục tiêu:** Scheduler weekly Meta KPI PDF → portal/email
- **Trigger:** Week closed cron RPT-M3
- **Pre-condition:** Reporting period closed; portal module Meta enabled
- **Post-condition:** PDF on portal; client notified SYS-UC-005
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** SYS-005
- **API / Integration:** report worker RPT-M3 · portal download · email delivery

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Scheduler Sunday night aggregate Meta KPI week |
| 2 | Generate PDF template client-safe metrics |
| 3 | Upload artifact to portal /meta or /settings exports |
| 4 | Email client viewer optional |
| 5 | AM review copy before send if manual gate enabled |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Unmapped spend footnote in PDF |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, week period, KPI aggregates |
| Output | PDF URL, delivery audit, portal notification |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-013 | Weekly PDF client-safe — no internal margin/owner fields |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |
| BR-PORTAL-003 | Meta portal CSV client-safe — no internal attribution fields |

### META-UC-014 — Horizon migration signoff

> 🟢 Spec thủ công

- **Mã use case:** META-UC-014
- **Tên use case:** Horizon migration signoff
- **Màn hình:** SCR-META-001, SCR-ADMIN-002
- **Actor chính:** Tech Lead / Admin / Media Buyer
- **Mục tiêu:** Meta API version upgrade checklist + regression sign-off
- **Trigger:** Meta deprecation deadline approaching
- **Pre-condition:** Migration plan approved; staging regression env ready
- **Post-condition:** Signoff doc recorded; prod API version updated
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R3
- **Trace ref:** —
- **API / Integration:** API version config · migration runbook · staging E2E gates

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Review Meta API changelog + deprecation timeline |
| 2 | Run regression test suite on staging new API version |
| 3 | Validate sync, webhook, CAPI, ads-ops write paths |
| 4 | Tech Lead + Buyer sign-off checklist document |
| 5 | Cutover prod API version config + monitor 48h hypercare |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Regression fail → rollback version pin |
| E2 | Partial feature deprecated → document manual workaround |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | target_api_version, regression results, signoff approvers |
| Output | signoff record, config change audit, hypercare log |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-META-014 | API version migration signoff trước deprecation deadline |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-META-001 | Ad account OAuth refresh trước khi hết hạn token | High | Done |
| BR-META-002 | Hub campaign map bắt buộc trước CPL client rollup | High | Done |
| BR-META-003 | CPL/ROAS tính theo last-click attribution default | High | Done |
| BR-META-004 | Webhook leadgen verify signature + map field VN | High | Done |
| BR-META-005 | CAPI event_id dedup hash(lead_id+event_name+date) | High | Done |
| BR-META-006 | Tracking health green required trước launch gate | High | Done |
| BR-META-007 | Launch wizard bắt buộc Launch QA + Campaign Write approval | High | Done |
| BR-META-008 | Campaign edit qua write queue — no direct API bypass prod | High | Done |
| BR-META-009 | Anomaly alert khi CPL vượt baseline >2σ | Medium | Done |
| BR-META-010 | Forecast requires ≥30d historical data or warning | Medium | Done |
| BR-META-011 | Breakdown insights cache TTL + rate limit fallback | Medium | Done |
| BR-META-012 | Emergency pause audit who/when/reason bắt buộc | High | Done |
| BR-META-013 | Weekly PDF client-safe — no internal margin/owner fields | Medium | Done |
| BR-META-014 | API version migration signoff trước deprecation deadline | Medium | Draft |
