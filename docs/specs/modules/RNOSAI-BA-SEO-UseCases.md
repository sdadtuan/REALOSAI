# RNOSAI BA — SEO/AEO Enterprise Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-SEO-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-SEO |
| Số UC | 14 |
| Spec thủ công | 14/14 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/04-SEO-AEO.md`](../../use-cases/04-SEO-AEO.md) |

---

## 1. Tóm tắt module

Module SEO/AEO: workspace onboard, GSC/GA4 OAuth sync, keyword research, content pipeline với governance, technical audit, AEO scan, rank tracker, client PDF và ClickHouse BI export.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-SEO-001 | SEO Hub | /seo/hub | Done | SEO-UC-001, SEO-UC-012 |
| SCR-SEO-002 | SEO Content Pipeline | /seo/content | Done | SEO-UC-005, SEO-UC-006 |
| SCR-SEO-016 | Chi tiết SEO Content (staff) | /seo/content/[id] | Done | SEO-UC-005, SEO-UC-006, PORTAL-UC-007 |
| SCR-SEO-003 | SEO Research | /seo/research | Done | SEO-UC-004 |
| SCR-SEO-004 | SEO Technical Audit | /seo/technical | Done | SEO-UC-007 |
| SCR-SEO-005 | SEO Reports | /seo/reports | Done | SEO-UC-013 |
| SCR-SEO-006 | SEO Governance | /seo/governance | Done | SEO-UC-006 |
| SCR-SEO-007 | SEO AEO Scan | /seo/aeo | Done | SEO-UC-008 |
| SCR-SEO-008 | Rank Tracker | /seo/ranks | Done | SEO-UC-011 |
| SCR-SEO-009 | Freshness Queue | /seo/freshness | Done | SEO-UC-010 |
| SCR-SEO-010 | SEO BI / ClickHouse | /seo/bi | In progress | SEO-UC-014 |
| SCR-SEO-011 | CMS Publish Webhook | /seo/cms | Done | SEO-UC-009 |
| SCR-SEO-012 | SEO Client Workspaces | /seo/clients | Done | SEO-UC-001 |
| SCR-SEO-017 | Chi tiết SEO Client Workspace | /seo/clients/[id] | Done | SEO-UC-001, SEO-UC-002, SEO-UC-003 |
| SCR-SEO-013 | SEO Strategy | /seo/strategy | Done | SEO-UC-004 |
| SCR-SEO-014 | SEO Gate A (prod cutover) | /seo/gate-a | Done | SYS-UC-009 |
| SCR-SEO-015 | SEO Authority / E-E-A-T | /seo/authority | Done | SEO-UC-007 |
| SCR-SEO-018 | SEO Automations & Alerts | /seo/automations | Done | SEO-UC-011, PLAT-UC-007 |
| SCR-SEO-019 | SEO Experiments | /seo/experiments | Done | SEO-UC-004 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| SEO-UC-001 | Onboard client SEO workspace | High | Done | Thủ công |
| SEO-UC-002 | OAuth GSC & sync | High | Done | Thủ công |
| SEO-UC-003 | OAuth GA4 & sync | High | Done | Thủ công |
| SEO-UC-004 | Research → import keywords | High | Done | Thủ công |
| SEO-UC-005 | Content pipeline stage advance | High | Done | Thủ công |
| SEO-UC-006 | Governance block publish | High | Done | Thủ công |
| SEO-UC-007 | Technical audit & issue fix | High | Done | Thủ công |
| SEO-UC-008 | AEO scan & coverage | Medium | Done | Thủ công |
| SEO-UC-009 | CMS publish webhook | Medium | Done | Thủ công |
| SEO-UC-010 | Freshness queue refresh | Medium | Done | Thủ công |
| SEO-UC-011 | Rank tracker capture | Medium | Done | Thủ công |
| SEO-UC-012 | Executive hub drill-down | High | Done | Thủ công |
| SEO-UC-013 | Client PDF report export | High | Done | Thủ công |
| SEO-UC-014 | ClickHouse BI export | Medium | In progress | Thủ công |

---

## 2. Chi tiết Use Case

### SEO-UC-001 — Onboard client SEO workspace

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-001
- **Tên use case:** Onboard client SEO workspace
- **Màn hình:** SCR-SEO-001, SCR-AGENCY-001
- **Actor chính:** SEO Strategist / AM
- **Mục tiêu:** Tạo SEO workspace gắn client_id sẵn sàng OAuth
- **Trigger:** HĐ có gói SEO/AEO SYS-UC-001
- **Pre-condition:** Customer active; PTT_SEO_ENABLED=1
- **Post-condition:** Workspace ready; hub tile visible /seo/hub
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-001
- **API / Integration:** POST /seo/workspaces · /seo/hub client tile

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tạo SEO workspace gắn client_id |
| 2 | Nhập primary domain, locale, competitors |
| 3 | Assign strategist owner |
| 4 | Hub /seo/hub hiển thị client tile |
| 5 | Enable OAuth steps SEO-UC-002/003 on checklist |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Domain mismatch later → block GSC sync SEO-UC-002 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, domain, locale, competitor list |
| Output | workspace_id, hub tile config |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-001 | SEO workspace isolated per client tenant |
| BR-SVC-002 | Onboard checklist bắt buộc trước go-live module |

### SEO-UC-002 — OAuth GSC & sync

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-002
- **Tên use case:** OAuth GSC & sync
- **Màn hình:** SCR-SEO-001
- **Actor chính:** SEO Strategist / Tracking-Tech
- **Mục tiêu:** Google Search Console OAuth + daily sync queries/pages
- **Trigger:** Workspace created; strategist connects GSC
- **Pre-condition:** Domain verification aligned with workspace domain
- **Post-condition:** GSC data in warehouse; sync status on hub
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GSC OAuth callback · sync job daily

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Initiate Google Search Console OAuth |
| 2 | Select property matching workspace domain |
| 3 | Worker sync queries, pages, coverage daily |
| 4 | Hub shows sync status + last run timestamp |
| 5 | Errors surfaced on hub health widget |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Property mismatch → block sync; fix domain verification |
| E2 | Token revoked → re-auth banner |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | workspace_id, gsc_property_id, oauth tokens |
| Output | sync_state, gsc metrics rows[], error log |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-002 | GSC property must match workspace domain before sync |

### SEO-UC-003 — OAuth GA4 & sync

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-003
- **Tên use case:** OAuth GA4 & sync
- **Màn hình:** SCR-SEO-001
- **Actor chính:** SEO Strategist
- **Mục tiêu:** GA4 OAuth + sync sessions, landing pages, conversions
- **Trigger:** GSC connected; strategist links GA4
- **Pre-condition:** GA4 property access granted
- **Post-condition:** GA4 linked; combined GSC+GA4 reports available
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** GA4 OAuth · analytics sync worker

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Initiate GA4 OAuth flow |
| 2 | Select property matching client site |
| 3 | Worker sync sessions, landing pages, conversions |
| 4 | Combine GSC+GA4 attribution on hub reports |
| 5 | Display sync health on /seo/hub |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Property access denied → 403 with setup guide |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | workspace_id, ga4_property_id, oauth tokens |
| Output | analytics sync rows[], combined report datasets |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-003 | GA4 property linked for combined attribution reports |

### SEO-UC-004 — Research → import keywords

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-004
- **Tên use case:** Research → import keywords
- **Màn hình:** SCR-SEO-003
- **Actor chính:** SEO Strategist
- **Mục tiêu:** Import keyword set với intent, cluster, priority
- **Trigger:** Research brief ready
- **Pre-condition:** SEO workspace active
- **Post-condition:** Keyword set versioned; pipeline topics assigned
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /seo/keywords/import · /seo/research

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Keyword research tool export hoặc CSV import |
| 2 | Tag intent, cluster, priority per keyword |
| 3 | Assign keywords to content pipeline topics |
| 4 | Capture baseline rank SEO-UC-011 |
| 5 | Version keyword set per import batch |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | CSV invalid columns → row-level error report |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | CSV/research export, tagging metadata |
| Output | keyword set version id, pipeline assignments |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-004 | Keyword import CSV template validate required columns |

### SEO-UC-005 — Content pipeline stage advance

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-005
- **Tên use case:** Content pipeline stage advance
- **Màn hình:** SCR-SEO-002, SCR-PORTAL-006
- **Actor chính:** SEO Strategist / Content Writer
- **Mục tiêu:** Advance content Brief → Draft → Review → Client approval → Published
- **Trigger:** Content item created or stage action
- **Pre-condition:** Content item exists in pipeline
- **Post-condition:** Audit trail per stage; SLA tracked
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** PATCH /seo/content/:id/stage · pipeline API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Create content item: Brief → Draft → Review |
| 2 | Advance stage with checklist per transition |
| 3 | Submit client approval portal PORTAL-UC-007 |
| 4 | Governance check SEO-UC-006 before publish |
| 5 | Scheduled → Published via SEO-UC-009 webhook |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client reject → return Draft with comment |
| E2 | Governance fail → block advance to Scheduled |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | content_id, target_stage, checklist confirmations |
| Output | stage audit[], SLA timestamps, approval status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-005 | Content pipeline stage advance requires checklist per step |
| BR-SEO-006 | Governance block publish — no bypass without admin override |
| BR-PORTAL-007 | SEO content approval advances pipeline stage |

### SEO-UC-006 — Governance block publish

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-006
- **Tên use case:** Governance block publish
- **Màn hình:** SCR-SEO-006, SCR-SEO-002
- **Actor chính:** Compliance / System
- **Mục tiêu:** Pre-publish evaluation block thin content, banned terms, E-E-A-T
- **Trigger:** Content advance to Scheduled/Publish
- **Pre-condition:** Governance rules active per client vertical
- **Post-condition:** No publish without pass or admin override
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST governance evaluate · /seo/governance rules CRUD

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Pre-publish evaluation job runs on content item |
| 2 | Check: thin content, missing meta, banned terms, E-E-A-T flags |
| 3 | Block → writer must fix; log evaluation result |
| 4 | Pass → allow CMS publish SEO-UC-009 |
| 5 | Admin override with audit reason optional pilot |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Rule update mid-flight → re-evaluate on next advance |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | content_id, governance rule set version |
| Output | evaluation pass/fail, violation list[], override audit? |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-006 | Governance block publish — no bypass without admin override |

### SEO-UC-007 — Technical audit & issue fix

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-007
- **Tên use case:** Technical audit & issue fix
- **Màn hình:** SCR-SEO-004
- **Actor chính:** SEO Strategist / Tracking-Tech
- **Mục tiêu:** Crawl audit → issue backlog → fix verify re-crawl
- **Trigger:** Scheduled crawl or manual audit run
- **Pre-condition:** Site domain reachable from crawler
- **Post-condition:** Issue backlog prioritized P0/P1/P2; closed issues verified
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** —
- **API / Integration:** POST /seo/technical/audit · issue fix workflow

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Run technical crawl audit on primary domain |
| 2 | Generate issue list: 404, canonical, CWV, indexation |
| 3 | Assign fix to dev/client owner |
| 4 | Track status Open → In progress → Fixed |
| 5 | Re-crawl verify closed; update hub health score |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Crawl blocked robots.txt → warn strategist |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | domain, crawl config, issue assignments |
| Output | audit report id, issue backlog[], fix verification |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-007 | Technical audit issues prioritized P0/P1/P2 backlog |

### SEO-UC-008 — AEO scan & coverage

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-008
- **Tên use case:** AEO scan & coverage
- **Màn hình:** SCR-SEO-007
- **Actor chính:** SEO Strategist
- **Mục tiêu:** Scan AI answer surfaces; gap analysis vs competitors
- **Trigger:** AEO targets defined; periodic scan schedule
- **Pre-condition:** AEO module enabled; competitor list from workspace
- **Post-condition:** Coverage score visible; action items in hub
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** POST /seo/aeo/scan · coverage reports

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Define AEO target queries and competitor set |
| 2 | Run scan SGE/snippets/AI answer surfaces |
| 3 | Gap analysis vs competitors on hub |
| 4 | Generate action items linked content pipeline |
| 5 | Track coverage score trend over time |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Scan API limit → queue retry |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | target queries[], competitors[], scan scope |
| Output | coverage score, gap report, action items[] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-008 | AEO coverage scan configurable per client vertical |

### SEO-UC-009 — CMS publish webhook

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-009
- **Tên use case:** CMS publish webhook
- **Màn hình:** SCR-SEO-002
- **Actor chính:** System
- **Mục tiêu:** Publish content to client CMS via webhook connector
- **Trigger:** Content stage Scheduled → publish time reached
- **Pre-condition:** CMS webhook configured; governance pass SEO-UC-006
- **Post-condition:** Published URL stored; freshness queue SEO-UC-010
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** CMS connector webhook · publish confirm callback

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Scheduler triggers publish at scheduled_at |
| 2 | Webhook POST to client CMS WordPress/custom |
| 3 | Confirm HTTP 200 from CMS |
| 4 | Update content status Published + live URL |
| 5 | Optional sitemap ping; trigger freshness tracking |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | CMS 5xx → retry 3x; alert strategist |
| E2 | Partial publish → rollback status Draft |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | content_id, CMS endpoint, payload HTML/markdown |
| Output | published_url, publish audit, CMS response |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-009 | CMS publish webhook retry 3x on 5xx |
| BR-SEO-006 | Governance block publish — no bypass without admin override |

### SEO-UC-010 — Freshness queue refresh

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-010
- **Tên use case:** Freshness queue refresh
- **Màn hình:** SCR-SEO-002
- **Actor chính:** SEO Strategist
- **Mục tiêu:** Queue stale URLs >90d; track refresh before/after metrics
- **Trigger:** Daily job flags stale content
- **Pre-condition:** Published URLs with last_updated metadata
- **Post-condition:** Refresh queue populated; metrics tracked post-refresh
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** GET /seo/content/freshness-queue · refresh workflow

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Job flag URLs stale >90 days without meaningful update |
| 2 | Strategist reviews freshness queue on /seo/content |
| 3 | Suggest refresh actions per URL |
| 4 | Assign writer → advance pipeline refresh branch |
| 5 | Track before/after GSC/GA4 metrics |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | URL removed → mark archived skip refresh |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | stale url list, refresh plan, assigned writer |
| Output | refresh tasks[], metric delta report |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-010 | Freshness queue stale threshold default 90 days |

### SEO-UC-011 — Rank tracker capture

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-011
- **Tên use case:** Rank tracker capture
- **Màn hình:** SCR-SEO-001, SCR-SEO-003
- **Actor chính:** System / SEO Strategist
- **Mục tiêu:** Daily rank pull for keyword set; delta alerts
- **Trigger:** Cron daily rank job
- **Pre-condition:** Keywords tracked from SEO-UC-004
- **Post-condition:** Rank history stored; charts on workspace
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** —
- **API / Integration:** rank tracker job · keyword detail charts

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Daily job pull ranks for tracked keyword set |
| 2 | Store rank history per keyword URL pair |
| 3 | Compute delta vs prior day/week |
| 4 | Alert strategist on significant drop >N positions |
| 5 | Render charts on /seo/hub client drill-down |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Rank provider timeout → retry slice |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | keyword ids[], locale, device type |
| Output | rank snapshots[], alert events[] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-011 | Rank tracker daily job alert on drop >N positions |

### SEO-UC-012 — Executive hub drill-down

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-012
- **Tên use case:** Executive hub drill-down
- **Màn hình:** SCR-SEO-001
- **Actor chính:** GDKD / AM
- **Mục tiêu:** Hub client health drill ≤3 clicks SYS-UC-007
- **Trigger:** Executive opens /seo/hub
- **Pre-condition:** Hub data synced GSC/GA4/content/issues
- **Post-condition:** PO spec F5 satisfied; drill path audited
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-007, TC-SEO-01
- **API / Integration:** GET /seo/hub · drill-down routes

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở /seo/hub executive tiles client health |
| 2 | Click client tile → client workspace summary |
| 3 | Drill issues / content / rank in ≤3 clicks total |
| 4 | Export snapshot CSV optional |
| 5 | Link portal SEO summary PORTAL-UC-004 read-only subset |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Stale sync → yellow badge on tile |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | hub filters, client_id drill path |
| Output | drill views[], export CSV |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-012 | SEO hub drill-down ≤3 clicks |
| BR-SYS-007 | Executive drill-down ≤3 clicks từ dashboard tile |

### SEO-UC-013 — Client PDF report export

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-013
- **Tên use case:** Client PDF report export
- **Màn hình:** SCR-SEO-005, SCR-PORTAL-006
- **Actor chính:** SEO Strategist / AM
- **Mục tiêu:** Generate client PDF traffic/ranks/content for period
- **Trigger:** Reporting period closed SYS-UC-005
- **Pre-condition:** GSC/GA4/rank data available for period
- **Post-condition:** PDF on portal/email; download logged PORTAL-UC-010
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** SYS-005
- **API / Integration:** POST /seo/reports/pdf · PDF worker · portal artifact

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Select reporting period on /seo/reports |
| 2 | Preview metrics: traffic, ranks, content delivered |
| 3 | Generate PDF client-safe template |
| 4 | Upload to portal /seo or settings exports |
| 5 | Optional email notify client viewer |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Incomplete data period → footnote in PDF |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, period, report template options |
| Output | PDF file URL, delivery audit |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-013 | Client PDF report client-safe metrics only |
| BR-SYS-005 | Client-facing report bắt buộc attribution disclaimer |
| BR-PORTAL-010 | Download signed URL expiry + audit log compliance |

### SEO-UC-014 — ClickHouse BI export

> 🟢 Spec thủ công

- **Mã use case:** SEO-UC-014
- **Tên use case:** ClickHouse BI export
- **Màn hình:** SCR-SEO-005
- **Actor chính:** Admin / BI / Data team
- **Mục tiêu:** Export SEO events to ClickHouse for Grafana dashboards
- **Trigger:** BI pipeline scheduled or manual export
- **Pre-condition:** ClickHouse connected; export policy approved
- **Post-condition:** BI export scheduled; status endpoint green
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R3
- **Trace ref:** —
- **API / Integration:** ClickHouse pipeline · BI status endpoint · Grafana links

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Configure ClickHouse destination + table schema |
| 2 | Export SEO events: content stages, ranks, audits |
| 3 | Schedule incremental sync job |
| 4 | Verify BI status endpoint returns healthy |
| 5 | Link Grafana dashboards for agency leadership |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Schema migration → versioned export job |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | export config, date watermark, event types[] |
| Output | CH row counts, job run id, Grafana dashboard URLs |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-SEO-014 | ClickHouse export incremental watermark required |

---

## 3. Chi tiết Màn hình module

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-SEO-001 | SEO workspace isolated per client tenant | High | Done |
| BR-SEO-002 | GSC property must match workspace domain before sync | High | Done |
| BR-SEO-003 | GA4 property linked for combined attribution reports | High | Done |
| BR-SEO-004 | Keyword import CSV template validate required columns | High | Done |
| BR-SEO-005 | Content pipeline stage advance requires checklist per step | High | Done |
| BR-SEO-006 | Governance block publish — no bypass without admin override | High | Done |
| BR-SEO-007 | Technical audit issues prioritized P0/P1/P2 backlog | High | Done |
| BR-SEO-008 | AEO coverage scan configurable per client vertical | Medium | Done |
| BR-SEO-009 | CMS publish webhook retry 3x on 5xx | Medium | Done |
| BR-SEO-010 | Freshness queue stale threshold default 90 days | Medium | Done |
| BR-SEO-011 | Rank tracker daily job alert on drop >N positions | Medium | Done |
| BR-SEO-012 | SEO hub drill-down ≤3 clicks | Medium | Done |
| BR-SEO-013 | Client PDF report client-safe metrics only | High | Done |
| BR-SEO-014 | ClickHouse export incremental watermark required | Medium | In progress |
