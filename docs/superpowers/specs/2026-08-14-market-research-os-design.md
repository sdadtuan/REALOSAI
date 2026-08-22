# Design: Market Research OS — Nghiên cứu & Báo cáo Thị trường (DV12)

**Ngày:** 2026-08-14  
**Document ID:** MKT-RES-OS-SPEC-20260814  
**Phiên bản:** 1.0  
**Trạng thái:** Draft — chờ PO / Research Lead / GDKD duyệt trước implementation plan  
**SRS (development-ready):** [`../../specs/2026-08-14-market-research-os-srs.md`](../../specs/2026-08-14-market-research-os-srs.md) — `MKT-RES-OS-SRS-20260814`  
**UX/UI:** [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md) — `MKT-RES-OS-UIUX-20260814`  
**Use cases:** [`../../specs/modules/RNOSAI-BA-RES-UseCases.md`](../../specs/modules/RNOSAI-BA-RES-UseCases.md) · [`../../use-cases/12-MARKET-RESEARCH-OS.md`](../../use-cases/12-MARKET-RESEARCH-OS.md) · [`../../use-cases/actions/12-RES-ACTIONS.md`](../../use-cases/actions/12-RES-ACTIONS.md)  
**Implementation plan P0:** [`../plans/2026-08-14-market-research-os-p0.md`](../plans/2026-08-14-market-research-os-p0.md)  
**App:** `services/ptt-crm-api` · `services/ops-web` · `ptt_worker`  
**Primary surface:** `/crm/research` (nhóm sidebar **Lên kế hoạch**)  
**Dịch vụ catalog:** DV12 — Báo cáo phân tích thị trường (`phan-tich-thi-truong`)  
**Nguồn đầu vào:**
- `Downloads/giai_phap_ai_nghien_cuu_marketing_ptt.md` — stack AI + 6 thực thể + SOP 6 bước
- `Downloads/he-thong-bao-cao-nghien-cuu-thi-truong.pplx.md` — evidence ledger, ISO 20252, ICC/ESOMAR, AAPOR, GDPR/PDPD
- Catalog SPC DV12 (CB/TC/CS), `ops-dv01-dv21-route-map.json` gap: *No standalone market-research deliverable tracker*

---

## Mục lục

1. [Tóm tắt sản phẩm & quyết định kiến trúc](#1-tóm-tắt-sản-phẩm--quyết-định-kiến-trúc)
2. [Bối cảnh khách hàng lớn toàn cầu](#2-bối-cảnh-khách-hàng-lớn-toàn-cầu)
3. [Ba hướng tiếp cận (đã chốt A)](#3-ba-hướng-tiếp-cận-đã-chốt-a)
4. [Information Architecture — sidebar Lên kế hoạch](#4-information-architecture--sidebar-lên-kế-hoạch)
5. [Danh mục sản phẩm nghiên cứu (product types)](#5-danh-mục-sản-phẩm-nghiên-cứu-product-types)
6. [Chuẩn nghề & governance](#6-chuẩn-nghề--governance)
7. [Quy trình 10 gate G0–G10](#7-quy-trình-10-gate-g0g10)
8. [Khung phân tích cho khách hàng global](#8-khung-phân-tích-cho-khách-hàng-global)
9. [Mô hình dữ liệu](#9-mô-hình-dữ-liệu)
10. [AI Research Copilot & Agent](#10-ai-research-copilot--agent)
11. [Tích hợp RNOSAI hiện có](#11-tích-hợp-rnosai-hiện-có)
12. [API contract](#12-api-contract)
13. [UX workspace](#13-ux-workspace)
14. [Báo cáo & deliverable](#14-báo-cáo--deliverable)
15. [RBAC, tenancy, privacy](#15-rbac-tenancy-privacy)
16. [KPI & acceptance](#16-kpi--acceptance)
17. [Lộ trình khả thi P0→P4](#17-lộ-trình-khả-thi-p0p4)
18. [Buy vs build & ngân sách công cụ](#18-buy-vs-build--ngân-sách-công-cụ)
19. [Rủi ro](#19-rủi-ro)
20. [Out of scope](#20-out-of-scope)
21. [Traceability](#21-traceability)

---

## 1. Tóm tắt sản phẩm & quyết định kiến trúc

### 1.1. Mục tiêu

**Market Research OS** là hệ thống vận hành insight có truy vết cho PTT Agency: từ **câu hỏi kinh doanh** → **bằng chứng nguyên tử** → **Insight đã duyệt** → **báo cáo khách hàng** → **quyết định / activation**.

File Word/PDF **không phải kho dữ liệu**. Báo cáo là *view* sinh từ Insight đã `Approved Client-facing`, mỗi claim định lượng có Evidence ID, nguồn, `as_of_date`, geography, đơn vị, mẫu/base.

Đối tượng dùng:

| Persona | Việc chính |
|---------|------------|
| AM | Brief, scope, wording khách, phân phối, activation |
| Research Analyst | Thu thập, QC, evidence, insight draft, báo cáo |
| Research Lead | Method, confidence, release sign-off |
| Privacy/Legal (fractional) | Consent, PII, cross-border |
| Client sponsor (portal sau) | Đọc report đã duyệt, không sửa method |

### 1.2. Quyết định đã chốt

| Quyết định | Lý do |
|------------|--------|
| **Sidebar nhóm mới «Lên kế hoạch»** | Tách PLAN (nghiên cứu + marketing plan) khỏi EXECUTE (triển khai DV, creative, campaign write) |
| **Route độc lập `/crm/research`** | Không nhét DV12 vào tab Market của `/crm/sales` (NCTT BĐS) |
| **Giữ `crm_sales_market_research`** | Module KD BĐS (khu vực, loại hình, giá) — khác taxonomy DV12 |
| **Evidence-first, không report-first** | Chuẩn Kantar/Ipsos/AAPOR: không insight không evidence |
| **AI = copilot, human owner bắt buộc** | ICC/ESOMAR 2025; BR-AI-01 RNOSAI |
| **Canonical IDs thuộc PTT** | Vendor (Tavily, Semrush, Qualtrics…) chỉ là connector |
| **Module Nest mới `MarketResearchModule`** | Tránh phình Sales / MarketingPlan / LMP |

### 1.3. North-star

**Tỷ lệ quyết định marketing trọng yếu của khách (global hoặc VN) dùng Insight đã duyệt và truy vết được** — không phải số report xuất ra.

---

## 2. Bối cảnh khách hàng lớn toàn cầu

Khách hàng lớn (MNC, brand regional APAC, tập đoàn VN niêm yết, quỹ / holding) mua nghiên cứu theo chuẩn **agency mạng** (Kantar, Ipsos, NielsenIQ, GfK, McKinsey Consumer, BCG Brand) chứ không theo “file tổng hợp ChatGPT”. Module phải nói được cùng ngôn ngữ với họ.

### 2.1. Cách họ mua nghiên cứu

| Loại hợp đồng | Đặc trưng | Hệ thống phải hỗ trợ |
|---------------|-----------|----------------------|
| **Custom ad-hoc** | 1 câu hỏi, 4–8 tuần, 1 report | Project + gates + 1 Report Version |
| **Tracker / brand health** | Wave tháng/quý, cùng instrument | Wave ID, comparable metrics, chart time-series |
| **Always-on CI / social** | Alert + pulse | Trend Signal + SLA triage |
| **Syndicated / desk** | Mua số liệu + diễn giải | Source license + as_of + geography |
| **Multi-country** | Cùng protocol, N thị trường | Market dimension, currency, language, weighting note |

### 2.2. Kỳ vọng CMO / Insights Director global

1. **Decision statement** rõ (sẽ làm gì sau report).  
2. **Methodology appendix** đủ để bên thứ ba review (AAPOR disclosure).  
3. **Không overclaim** mẫu convenience thành “đại diện người Việt / người ASEAN”.  
4. **So sánh được theo thời gian** (tracker) và **theo thị trường** (VN vs TH vs ID).  
5. **Insight gắn action owner** (Brand, Media, Shopper, Digital, Innovation).  
6. **Data residency & DPA** nếu có PII / panel / interview.  
7. **Embargo / expiry** — report Q2 không được trích ở Q4 nếu tracker đã supersede.

### 2.3. Ba lớp thị trường PTT phục vụ

| Lớp | Ví dụ | Độ sâu MVP |
|-----|--------|------------|
| **L1 Vietnam-first** | Brand VN, SME→mid | P0–P1 đầy đủ |
| **L2 Regional APAC** | Brand HQ SG/HK, fieldwork VN+1 | P1 geography + language + currency |
| **L3 Global / multi-hub** | Tracker 5+ nước, panel Kantar/Ipsos | P2 connector + RLS portal; PTT không tự trở thành panel company |

P0 **không** giả vờ là Nielsen. P0 **có** đủ provenance để PTT đứng trước Insights Director của Unilever/Vinamilk/Shopee mà không bị hỏi “số này lấy ở đâu”.

---

## 3. Ba hướng tiếp cận (đã chốt A)

| | A — Evidence OS (chọn) | B — Máy viết báo cáo | C — Vendor-first |
|--|------------------------|----------------------|------------------|
| SoT | Postgres PTT: Project / Evidence / Insight / Report Version | DOCX template + LLM | Brandwatch + Qualtrics |
| Ưu | Truy vết, reuse, QA gate, khớp LMP Tavily | Ship 1 tuần | Coverage social/survey sẵn |
| Nhược | 4–6 tuần số hoá | Hallucination, không audit | Lock-in, chưa có taxonomy PTT |
| Phù hợp global | Có — đúng cách Kantar nội bộ làm repository | Không | Chỉ khi bake-off xong |

**A thắng** vì hai file nguồn và ISO/ESOMAR cùng kết luận: tool thay được, **IDs + taxonomy + approval** thì không.

---

## 4. Information Architecture — sidebar Lên kế hoạch

### 4.1. Nhóm nav mới

Trong `OpsNav` / `buildSections`, **tách** khỏi `CRM · Triển khai dịch vụ`:

```
Lên kế hoạch                    (defaultOpen: true)
  ├─ Nghiên cứu thị trường      /crm/research          ★ mới (DV12)
  ├─ Kế hoạch marketing         /crm/marketing-plan    (kéo từ Triển khai DV)
  └─ (sau) AI Planner           /crm/service-delivery?tab=ai-planner  — không nhân đôi ở P0
```

`CRM · Triển khai dịch vụ` giữ: Triển khai DV, SOP, Launch QA, Creative Hub, Campaign Write, Ops catalog/tasks.

Cap xem nhóm: `crm_research.view` **hoặc** `crm_board.view` (marketing-plan hiện dùng board). P0: `crm_research.*` mới; fallback `crm_sales_market.view` chỉ để migrate, **không** trộn UI.

### 4.2. Routes

| Route | Việc |
|-------|------|
| `/crm/research` | Queue project: filter client, status, risk, wave |
| `/crm/research/new` | Wizard brief G0 |
| `/crm/research/[id]` | Workspace 6 pane (Brief, Sources, Evidence, Insights, Report, Activity) |
| `/crm/research/[id]/report/[versionId]` | Preview + export DOCX/PDF |
| `/crm/marketing-plan/[id]` | Nút «Kéo Insight đã duyệt» từ Research Project cùng client |

Feature flag: `PTT_MARKET_RESEARCH_ENABLED` / `NEXT_PUBLIC_MARKET_RESEARCH=1`.

---

## 5. Danh mục sản phẩm nghiên cứu (product types)

Mỗi `Research Project` bắt buộc `product_type`. Template, gate, SLA, giá DV12 map theo type.

### 5.1. Bộ sản phẩm chuẩn (global practice)

| Code | Tên | Câu hỏi kinh doanh | Khung phân tích | Deliverable chính |
|------|-----|--------------------|-----------------|-------------------|
| `CAT_REVIEW` | Category / market assessment | Thị trường lớn cỡ nào, tăng trưởng, cấu trúc? | PESTEL + TAM/SAM/SOM + value chain | Exec 8–12 trang + appendix nguồn |
| `COMP_LAND` | Competitive landscape | Ai thắng/thua trên thông điệp, giá, kênh? | 5 Forces rút gọn + positioning map + SOV proxy | Competitor cards + matrix |
| `CONSUMER` | Consumer / shopper insight | Jobs-to-be-done, pain, language thật? | JTBD + jobs map + quote evidence | Insight cards + verbatim (đã mask) |
| `SEG_STP` | Segmentation / targeting | Ai là priority segment? | STP + persona (không synthetic) | Segment cards + sizing assumption |
| `BRAND_HEALTH` | Brand funnel / equity | Awareness → loyalty dịch chuyển ra sao? | Funnel + NPS/equity drivers | Wave dashboard + narrative |
| `PRICE_OFFER` | Pricing / offer test | Giá / gói nào win? | Van Westendorp / conjoint lite (P2) | Recommendation + limitation |
| `CAMPAIGN` | Creative / campaign eval | Ads/concept có vào được brief? | ABCD / communication check | Scorecard + quote |
| `TREND_SCAN` | Trend & cultural scan | Tín hiệu nào emerging 6–18 tháng? | Signal registry + persistence | Trend cards + counter-signal |
| `GTM` | Go-to-market / opportunity | Vào kênh nào, message nào? | Opportunity × confidence × effort | Priority roadmap 90 ngày |
| `TRACKER` | Always-on pulse | Có gì đổi tuần/tháng này? | Watchlist + alert | 1-pager pulse |

Map DV12:

| Tier DV12 | Product types mặc định | Wave |
|-----------|------------------------|------|
| CB | `CAT_REVIEW` + `COMP_LAND` (desk) | 1 shot |
| TC | + `CONSUMER` (survey hoặc 6–8 IDI) + `TREND_SCAN` | Cập nhật quý |
| CS | + `SEG_STP` + sizing + qual+quant | 5–8 tuần; optional tracker |

### 5.2. Cấu trúc storyline báo cáo (decision-first)

Không viết theo thứ tự công cụ (Tavily rồi Semrush rồi survey). Viết theo **câu hỏi**:

1. Executive answer (1–2 trang) — pyramid principle.  
2. Decision & scope (geo, audience, period, exclusions).  
3. Findings theo research question (MECE).  
4. Evidence visual + implication.  
5. Segment / competitor / trend.  
6. Recommendations: impact × confidence × effort.  
7. Risks, unknowns, next research.  
8. Methodology appendix (AAPOR-style).  
9. Evidence index (ID → locator).

---

## 6. Chuẩn nghề & governance

PTT **không cần ISO 20252 ngay**. PTT **bắt buộc** các nguyên tắc vận hành tương đương MVP:

| Neo | Áp dụng trong OS |
|-----|------------------|
| ISO 20252:2019 | Planning → execution → supervision → reporting; vocabulary thống nhất |
| ICC/ESOMAR 2025 | Human oversight AI, social media ethics, không synthetic respondent |
| AAPOR Disclosure | Appendix: population, sample, mode, field dates, n, weighting, QC |
| MRS / Insights Association | Conflict, client confidentiality, no silent edit after approval |
| NIST AI RMF | Log model/prompt/version; evaluate unsupported claim |
| PDPD VN (01/01/2026) + GDPR/CCPA khi cross-border | Consent, purpose, retention, DPA vendor |

**Hard rules (release gate):**

1. `Insight.status ∈ {Approved Client-facing, Published}` chỉ khi có ≥1 Evidence verified, confidence rationale, owner, approval Lead.  
2. Claim định lượng: `value + unit + base + period + geography + source`.  
3. Cấm chữ “95% confidence” trừ khi là inference thống kê đúng.  
4. Cấm suy “mentions Facebook = người Việt Nam”.  
5. Sửa sau duyệt = Report Version mới + hash; không silent edit.  
6. AI draft không được `Published`.

---

## 7. Quy trình 10 gate G0–G10

Ánh xạ SOP 6 bước (file PTT) vào 10 gate (file hệ thống báo cáo). State machine project:

`intake → designed → collecting → qc → analyzing → synthesizing → drafting → in_review → approved → distributed → archived`

| Gate | Công việc | Artifact | Owner | Exit |
|------|-----------|----------|-------|------|
| **G0 Intake** | Decision statement, RQ, geo, audience, budget, NDA, success metric | Project + RQs | AM + Lead | Sponsor duyệt brief |
| **G1 Design** | product_type, method mix, sample/source plan, privacy class | Protocol | Analyst + Lead | Lead duyệt method |
| **G2 Pilot** | Desk query thử, social query 100–300, instrument dry-run | Pilot log | Analyst | Không blocker |
| **G3 Collection** | Secondary, CI, social, survey, IDI | Sources + studies | Analyst | Coverage hoặc deviation approved |
| **G4 QC** | Dedupe, PII mask, bot/speeder, source validate | Clean set + QC log | Analyst | Checklist pass |
| **G5 Analysis** | Tables, themes, competitor matrix, triangulation | Analysis notes | Analyst | Reproducible |
| **G6 Insight** | Atomic insight what–why–so what–now what | Insight cards | Senior / Lead | Evidence + confidence |
| **G7 Draft report** | Storyline + numbers sync | Report Version draft | Analyst + AM | Traceability 100% |
| **G8 QA & approval** | Method + citation + editorial + privacy | Review records | Lead + AM | 0 Critical / 0 High chưa accept |
| **G9 Distribute** | Quyền, readout, decision log, embargo | Distribution + actions | AM | Owner action ghi nhận |
| **G10 Learn** | Reuse, expire, post-mortem, KPI | Archive | ResearchOps | Retention applied |

SLA (giờ làm việc) — rút từ file hệ thống, điều chỉnh agency vừa:

| Hạng mục | Target |
|----------|--------|
| Intake ack | 4h |
| Scoping/estimate | 2 ngày |
| Evidence verify | ≤1 ngày sau capture |
| Peer review report chuẩn | 2 ngày |
| Correction critical sau release | ack 2h; bản sửa ≤1 ngày |

---

## 8. Khung phân tích cho khách hàng global

Analyst chọn khung trong G1; UI hiện checklist field — không bắt buộc mọi khung mọi project.

### 8.1. Macro & category

- **PESTEL** (Political, Economic, Social, Technology, Environment, Legal) — mỗi yếu tố = Insight hoặc Evidence, không đoạn văn rỗng.  
- **TAM / SAM / SOM** — bắt buộc ghi method (top-down industry report vs bottom-up accounts × ARPU). Cấm một số không nguồn.  
- **Category structure:** premium / mass / value; offline / ecom / D2C; modern trade vs GT (VN).

### 8.2. Cạnh tranh

- Watchlist: aliases, HQ country, VN presence, channels.  
- Snapshot: price, message, promo, hiring, ad library, SEO/traffic **proxy** (Similarweb/Semrush = ước lượng, ghi limitation).  
- Tách **fact** / **interpretation** / **hypothesis**.

### 8.3. Consumer

- JTBD: job, circumstance, struggle, desired outcome.  
- Verbatim chỉ từ transcript/survey đã consent; locator bắt buộc.  
- Funnel brand: awareness, familiarity, consideration, preference, usage, loyalty — **chỉ khi có đo**.

### 8.4. Confidence rubric (bắt buộc)

Điểm 0–4 từng chiều, lưu riêng:

| Chiều | Trọng số |
|-------|----------|
| Source quality (S) | 0.25 |
| Fit & coverage (F) | 0.20 |
| Triangulation (T) | 0.25 |
| Analytical robustness (A) | 0.20 |
| Recency & stability (R) | 0.10 |

`score = 0.25S+0.20F+0.25T+0.20A+0.10R` → Low <2.0 / Medium 2.0–2.9 / High 3.0–3.5 / Very High >3.5.  
**Override xuống** nếu conflict, sample lỗi, không mở được evidence.

Insight state:

`Draft → Evidence Attached → Analyst Verified → Peer Reviewed → Approved Internal → Approved Client-facing → Published → Superseded | Expired | Rejected`

---

## 9. Mô hình dữ liệu

Postgres schema `crm_research_*`. Không nhồi vào SQLite sales.

### 9.1. Thực thể P0 (ship)

| Table | Vai trò |
|-------|---------|
| `crm_research_projects` | Gói 1 quyết định + product_type + client_id + lifecycle/service_instance DV12 + geo[] + languages[] + risk_class + status |
| `crm_research_questions` | RQ có thứ tự, linked decision |
| `crm_research_sources` | Registry: type, title, publisher, url, accessed_at, published_at, geo, license, reliability_tier, snapshot_uri, content_hash |
| `crm_research_competitors` | Hồ sơ + aliases; link client ngành |
| `crm_research_competitor_snapshots` | observed_at, fact JSON (whitelist), source_id |
| `crm_research_studies` | Survey/Interview container: method, instrument_version, n, field_dates, mode, weighting_note |
| `crm_research_evidence` | **Atomic:** source/study, locator, excerpt/value, unit, base, captured_at, pii_class, qc_status, checksum — **immutable sau verified** |
| `crm_research_insights` | statement, observation, interpretation, implication, recommendation, audience, confidence_json, valid_from/to, status |
| `crm_research_insight_evidence` | N–M |
| `crm_research_trend_signals` | topic, metric, baseline, current, velocity, lifecycle |
| `crm_research_reviews` | object_type/id, reviewer, checklist_version, decision, artifact_hash |
| `crm_research_reports` | project, template, status |
| `crm_research_report_versions` | version, content_snapshot JSON, generated_by, hash, embargo, expiry |
| `crm_research_ai_runs` | prompt_version, model, input_hash, output, actor — tái dùng pattern `ai_agent_runs` |

### 9.2. Thực thể P1+

| Table | Khi nào |
|-------|---------|
| `crm_research_waves` | Tracker |
| `crm_research_decisions` | Activation / impact |
| `crm_research_consents` | Vault PII tách; pseudonym only trên insight |
| `crm_research_taxonomy` | Theme tags, synonym |
| `crm_research_social_queries` | Version query listening |

### 9.3. Integrity

```
Project 1—N Question / Source / Study / Competitor / Report
Source|Study 1—N Evidence
Evidence N—M Insight
Insight N—M Trend / ReportVersion / Decision
Released Insight 1—N Review
```

`client_id` trên mọi bảng gốc. RLS/cap theo client giống agency hub.

### 9.4. Không merge với

- `crm_sales_market_research` — BĐS. Optional: link `related_sales_market_id`.  
- `khtn_market_research_json` trên marketing plan — P1: freeze snapshot Insight IDs, không copy paste text.  
- LMP `crm_lead_meeting_prep` — research **lead** B2B; có thể *cite* Source nếu cùng domain công ty, không chia sẻ PII lead vào report khách DV12.

---

## 10. AI Research Copilot & Agent

### 10.0. Nguyên tắc chọn AI (không một model làm tất cả)

| Lớp | Việc | Họ AI / tool |
|-----|------|----------------|
| **Deep Research** | Tự duyệt nhiều nguồn web, lập outline, trích dẫn | OpenAI Deep Research, Gemini Deep Research, Perplexity Deep Research |
| **Search + extract** | Query có kiểm soát, lấy snippet/URL vào Evidence | **Tavily** (đã có LMP), Perplexity Sonar API |
| **Reasoning / writing** | Brief, method, insight, report — **không bịa số** | Claude 4.x Sonnet/Opus, GPT-4.1 / o3 |
| **Specialist** | CI, social, survey, transcript | Semrush, Similarweb, SparkToro, Qualtrics, Dovetail, Whisper/Fathom |
| **Academic** | Paper, meta-analysis (CS / healthcare / tech) | Elicit, Consensus, Semantic Scholar |

**Cấm:** một Deep Research viết thẳng báo cáo khách. Output Deep Research = **Source candidates** → Analyst verify → Evidence → Insight.

**Đã có trên RNOSAI:** Tavily collect, OpenAI (`OPENAI_MODEL`), Anthropic (intake/lifecycle), Apify FB (cần token). P0 ưu tiên **Tavily + Claude (tổng hợp) + OpenAI Deep Research (desk chuyên sâu)** — không mua Brandwatch.

### 10.0.1. AI theo từng gate G0–G10

| Gate | Việc con người | AI **chính** (khuyến nghị) | AI **bổ trợ** | Không dùng AI để |
|------|----------------|----------------------------|---------------|-------------------|
| **G0 Intake** | Chốt quyết định, ngân sách, NDA | **Claude Sonnet** — biến brief AM thành decision statement + 3–7 research questions MECE | GPT-4.1 nếu Claude down | Tự bịa quy mô thị trường |
| **G1 Design** | Chọn method, sample, rủi ro | **Claude Opus** — critique protocol, sampling frame, bias, privacy class | NotebookLM trên PDF SOP nội bộ | Tự duyệt method (Lead vẫn ký) |
| **G2 Pilot** | Test query, instrument | **Tavily** 3–5 query thử + precision log | Perplexity Pro (AM soi citation) | Kết luận từ 5 URL đầu |
| **G3a Desk / secondary** | Thu thập ngành, đối thủ, số liệu công khai | **OpenAI Deep Research** *hoặc* **Gemini Deep Research** (chạy 15–30 phút/RQ) → danh sách nguồn | **Tavily search+extract** (pipeline RNOSAI, credit cap); **Perplexity Deep Research** khi cần citation dày | Coi số Deep Research là audited fact |
| **G3b Competitive intel** | Watchlist, ad, SEO, giá | **Semrush / Similarweb** (ước lượng — ghi limitation) + Meta Ad Library | Claude tóm tắt snapshot thành fact/hypothesis tách cột | Gọi Similarweb là “traffic thật” |
| **G3c Social / culture** | Hội thoại công khai | P0: Tavily site:facebook/tiktok/news **công khai**; P1: SparkToro (audience); P2: Talkwalker/Brandwatch | Speak AI / native export | “Người Việt nghĩ rằng…” từ mentions |
| **G3d Qual (IDI/FGD)** | Phỏng vấn | **Whisper / Fathom / Grain** transcript; **Dovetail** hoặc Claude coding *gợi ý* theme | Perspective AI / Remesh chỉ khi N lớn (CS) | Synthetic respondent / quote không có timecode |
| **G3e Quant (survey)** | Bảng hỏi, field | P0: Forms + Claude review bias/double-barrel; P2: **Qualtrics** ExpertReview | Attest/Quantilope khi tracker global | MOE trên mẫu convenience |
| **G3f Trend** | Tín hiệu emerging | **Google Trends** + **Exploding Topics / Glimpse** | Gemini Deep Research “what’s emerging 6 months” | Forecast không có horizon/threshold |
| **G4 QC** | PII, bot, nguồn chết | Classifier nhỏ: **GPT-4.1-mini** PII/URL-dead/duplicate | Presidio/regex nội bộ | Xoá raw khi QC fail — chỉ reject + log |
| **G5 Analysis** | Bảng, theme, triangulation | **Claude Opus** trên Evidence pack (RAG); **Code Interpreter / Python** cho bảng số | Elicit nếu cần paper | Phân tích ngoài Evidence ID |
| **G6 Insight** | Atomic insight + confidence | **Claude Sonnet** — điền khung Observation / Interpretation / Implication / Recommendation **chỉ từ evidence_ids** | GPT o3 khi cần lập luận đối nghịch (counter-evidence) | Publish draft AI |
| **G7 Report** | Storyline decision-first | **Claude Sonnet** — viết từ Insight `Approved Internal` | GPT-4.1 EN exec summary (Lead duyệt) | Deep Research viết cả report |
| **G8 QA** | Citation, overclaim | **Perplexity** spot-check claim↔URL; Claude “devil’s advocate” | Gold-set script nội bộ | Auto-approve |
| **G9 Activation** | Action owner | Claude gợi ý RACI Brand/Media/Content từ recommendation | — | Tự gán việc cho khách |
| **G10 Learn** | Reuse, expire | Embeddings + search Insight đã Published (P2 RAG) | Cluster theme theo quý | Retrain model trên data khách |

### 10.0.2. Ba “máy Deep Research” — khi nào máy nào

| Máy | Điểm mạnh | Dùng cho | Hạn chế với khách global |
|-----|-----------|----------|---------------------------|
| **OpenAI Deep Research** | Multi-hop, outline tốt, API agent | CAT_REVIEW, GTM, COMP_LAND desk | Có thể ít nguồn VN; phải verify; DPA/no-training |
| **Gemini Deep Research** | Grounding Google, báo cáo dài, Trends/News | TREND_SCAN, category VN+global news | Dễ trộn báo chí với số official |
| **Perplexity Deep Research / Sonar** | Citation từng câu, Pro Search | G2/G8 verify, AM soi nguồn | Depth kém OpenAI trên bài 20+ nguồn |

**P0 mặc định:** 1 RQ → 1 job Deep Research (OpenAI **hoặc** Gemini, flag `RESEARCH_DEEP_PROVIDER`) + Tavily extract URL job trả về. Analyst tick “keep as Source”.

**P1:** chạy **2 provider song song** trên RQ trọng (triangulation máy) — chỉ giữ URL xuất hiện ≥1 lần **hoặc** Lead accept single-source với confidence cap Medium.

### 10.0.3. Model writing nội bộ (đã có key pattern)

| Việc | Model | Lý do |
|------|-------|--------|
| Desk JSON → Source rows | gpt-4.1-mini / gpt-4o-mini | Rẻ, structured output |
| Insight + report tiếng Việt | **Claude Sonnet** (`ANTHROPIC_API_KEY` đã dùng intake) | Văn phong, tuân instruction, ít overclaim hơn mini |
| Method critique G1/G8 | **Claude Opus** | Dài, bắt bias |
| Counter-argument | **o3 / o4-mini** | Reasoning |
| Transcript EN→VI | Claude hoặc GPT-4.1 | Human spot-check jargon |

### 10.1. Copilot (P0) — đồng bộ LMP

Tái sử dụng `ptt_crm/lead_meeting_prep/collect.py` (Tavily) với **credit cap riêng** `MAX_TAVILY_CREDITS_PER_RESEARCH` (mặc định 12/project). Prompt **cấm** SĐT/email/tên người.

Năm skill copilot (file PTT mục 4), bắt buộc citation:

1. Secondary industry scan  
2. Competitive compare  
3. Public conversation themes (chỉ URL công khai; không Facebook login scrape)  
4. Trend scan  
5. Insight synthesis **chỉ từ Evidence IDs đã attach** — retrieval-only, không “fill gaps”

Mỗi output = `Draft` Source hoặc Insight, `ai_generated=true`, chờ Analyst verify.

### 10.2. Research Agent (P2)

Cron: watchlist competitor + trend. Alert kiểu Ops (`crm_ops/alerts`) khi:

- Đối thủ đổi giá/message (snapshot diff)  
- Trend velocity > threshold  

Không auto-publish Insight.

### 10.3. Guardrails

- Temperature thấp; grounded citations.  
- Gold set tiếng Việt (teencode, sarcasm) trước khi bật social sentiment.  
- Unsupported-claim rate trên gold set <2% trước GA.  
- PII leak = 0 (DLP scan transcript).

---

## 11. Tích hợp RNOSAI hiện có

| Module | Hướng tích hợp |
|--------|----------------|
| **Service delivery DV12** | Tạo Research Project từ lifecycle; task G0–G10 map SOP component DV12-C01/C02/C03 |
| **Marketing plan** | «Insert approved insights»; plan không edit Insight gốc |
| **Content OS** | Brief sáng tạo cite `insight_id` — KPI *reuse* |
| **SEO Research** | Keyword ≠ market insight; cho phép *link* source Semrush đã có, không duplicate UI |
| **Meta Intelligence / Ads** | CI: Ad Library URL thành Source type `ad_creative` |
| **LMP / Tavily / Apify** | Connector desk + optional FB **page công khai**; Apify fail = skip |
| **Intake / Consult brief** | Sau B2B win DV12: prefill industry, competitors từ consult |
| **Playbooks** | Prompt templates version hóa (`research_prompt_version`) |
| **Portal khách** | P3: read-only report + watermark + expiry |

---

## 12. API contract

Prefix `/api/v1/research`. Guard `StaffOrInternalKey` + `crm_research.*`.

| Method | Path | Việc |
|--------|------|------|
| GET | `/projects` | List filter client/status/product_type |
| POST | `/projects` | G0 create |
| GET/PATCH | `/projects/:id` | Workspace |
| POST | `/projects/:id/run-desk` | Enqueue Tavily collect |
| POST | `/projects/:id/sources` | Manual source |
| POST | `/projects/:id/evidence` | Attach evidence |
| POST | `/projects/:id/insights` | Draft insight |
| POST | `/insights/:id/submit-review` | Peer/Lead |
| POST | `/insights/:id/approve` | Lead; AM `approve_client_facing` |
| POST | `/projects/:id/reports` | Generate version from approved insights |
| GET | `/reports/:id/export` | DOCX (reuse Deal Room pack pattern) |
| GET | `/analytics/ops` | Cycle time, evidence completeness, activation |

Enqueue worker job `research_desk_collect` song song `lead_meeting_prep` — **không** block ingest lead.

---

## 13. UX workspace

Chi tiết màn hình, wireframe, component, cap-first, microcopy: [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md).

Trang `/crm/research/[id]` — 6 tab, analog Sales Cockpit:

| Tab | P0 |
|-----|----|
| Brief | Decision, RQ, geo, product_type, DV12 tier, SLA |
| Sources | List + badge reliability + «Chạy desk AI» |
| Evidence | Ledger; filter by RQ; không xoá verified |
| Insights | Cards: statement, confidence chip, evidence count, status |
| Report | Storyline blocks kéo Insight; preview; export |
| Activity | Reviews, AI runs, distribution |

Danh sách `/crm/research`: cột Client, Type, Status, Close readiness kiểu % evidence, Owner, Updated.

Mobile: list + insight cards; không soạn report trên mobile P0.

---

## 14. Báo cáo & deliverable

### 14.1. Template P0 (DOCX)

Block cố định, map field:

- Cover: client, confidential, embargo, version, as_of  
- Exec answer  
- Findings (1 block / RQ)  
- Recommendations table  
- Methodology appendix  
- Evidence index  

Sinh từ `report_versions.content_snapshot`. Chart P0: bảng Markdown/HTML; BI P2.

### 14.2. Ngôn ngữ

`languages[]` trên project. P0: `vi` primary, `en` exec summary optional (AM dịch hoặc LLM + Lead duyệt). P1: dual-language locked fields.

### 14.3. Đơn vị & tiền tệ

Mọi số tiền: `amount + currency + fx_as_of`. GDP/market size: ghi nguồn World Bank / Statista / Euromonitor / hiệp hội ngành — **không** trộn USD/VND im lặng.

---

## 15. RBAC, tenancy, privacy

### 15.1. Caps mới `crm_research`

| Action | Ai |
|--------|-----|
| `view` | AM, Analyst, Lead, GDKD |
| `create` / `edit` | AM, Analyst |
| `run` | Analyst, Lead (desk AI) |
| `approve` | Research Lead (method) |
| `export` | AM, Lead |
| `configure` | ResearchOps / data_config |

AM **không** tự approve method của project mình phân tích nếu không có second approver (segregation). GDKD `crm_leads.assign` **không** thay Lead duyệt method — chỉ override rủi ro thương mại (scope/giá).

### 15.2. Privacy baseline

- Classification: public / internal / confidential / PII.  
- Transcript: mask SĐT/email trước khi vào Evidence excerpt.  
- Vector/RAG P2: **chỉ** corpus Approved + permitted.  
- Retention: raw interview 24 tháng hoặc theo DPA; insight anonymized giữ lâu hơn.  
- Cross-border: flag `data_residency`; không gửi panel PII vào LLM vendor nếu contract cấm training.

---

## 16. KPI & acceptance

### 16.1. Scorecard (rút gọn file hệ thống)

| Nhóm | KPI | Mục tiêu pilot |
|------|-----|----------------|
| Quality | % released insight có evidence chain | 100% |
| Quality | Post-release critical correction | 0 |
| Speed | Time-to-first-evidence (desk) | <1 ngày làm việc (CB) |
| Speed | Report cycle CB | ≤10 ngày làm việc sau brief duyệt |
| Adoption | Insight gắn decision/action | >40% sau 6 tháng |
| Reuse | Approved insight được cite ở plan/content | >20% sau 6 tháng |
| AI | Unsupported claim gold set | <2% |
| Privacy | PII leak | 0 |

### 16.2. Acceptance P0

| ID | Criteria |
|----|----------|
| EC-RES-01 | Sidebar «Lên kế hoạch» hiện Research + Marketing plan |
| EC-RES-02 | Tạo project DV12 gắn client + product_type |
| EC-RES-03 | Desk Tavily → Source; fail graceful nếu thiếu key |
| EC-RES-04 | Không approve insight thiếu evidence |
| EC-RES-05 | Export DOCX có appendix + evidence index |
| EC-RES-06 | User client A không GET project client B |
| EC-RES-07 | Sales Market BĐS vẫn chạy độc lập |
| EC-RES-08 | Feature flag off → 404/hide nav |

Pilot: **2 project thật** — (A) Monthly competitor pulse desk, (B) Campaign/concept + 6–8 IDI hoặc survey Forms.

---

## 17. Lộ trình khả thi P0→P4

Khớp file PTT (A thủ công → D full-stack) và file hệ thống (12 tuần evidence-first).

| Phase | Thời gian | Phạm vi | Exit |
|-------|-----------|---------|------|
| **P0 Foundation** | 3–4 tuần | Nav nhóm Lên kế hoạch; DDL; G0/G3/G6/G8 tối thiểu; Tavily desk; Insight+Evidence; DOCX CB | EC-RES-01…08 |
| **P1 Pilot ops** | +4 tuần | Competitor snapshots; confidence rubric UI; review entity; methodology appendix; map DV12-C01..C03; kéo Insight vào marketing-plan | First-pass ≥60%; 2 project thật |
| **P2 Integrate** | +6 tuần | Studies survey/interview; Apify FB page nếu token; pulse Agent; bilingual exec; ops KPI dashboard | −20% giờ analyst desk |
| **P3 Client-grade** | Tháng 4–6 | Portal RLS, watermark, tracker waves, decision log | Usefulness ≥4/5 |
| **P4 Global scale** | Tháng 7–12 | Qualtrics/panel bake-off, RAG approved corpus, forecast registry, ISO 20252 gap-check | Reuse >20%; activation >40% |

**Không** mua Brandwatch/Quantilope ở P0.

---

## 18. Buy vs build & ngân sách công cụ

| Năng lực | P0 | P2+ |
|----------|----|-----|
| Desk secondary | **Build** + Tavily (đã có LMP) | Perplexity Pro optional |
| CI traffic/SEO | Link thủ công Semrush | API Semrush/Similarweb + limitation text |
| Social | Không (hoặc Apify page metrics) | Bake-off Talkwalker/Brandwatch — scorecard 100đ (file hệ thống §2.3) |
| Survey | Google/Microsoft Forms + codebook | Qualtrics khi có retainer tracker |
| Qual coding | Tay + Evidence excerpt | Dovetail/Condens nếu ≥4 IDI/tháng |
| LLM | OpenAI/Anthropic qua `lmp_llm_client` pattern | Enterprise DPA, no-training |
| DOCX | Build (Deal Room pack) | Giữ |

Chi phí công cụ P0: **~$0–20/tháng** nếu tái Tavily. P1 SparkToro/Trends: tùy. Không CapEx social enterprise trước bake-off.

---

## 19. Rủi ro

| Rủi ro | Kiểm soát |
|--------|-----------|
| Insight không evidence | Hard gate API + UI |
| Hallucination | Retrieval-only synthesis; gold set |
| Overclaim social/sample | Wording templates; Lead review |
| Trộn BĐS sales market với DV12 | Route/table tách |
| Cross-client leak | client_id + cap + test |
| Vendor lock-in | Canonical IDs; export snapshot |
| Stale insight | `valid_to` + banner |
| Phạm vi “global” quá lớn P0 | L1 Vietnam-first; L3 chỉ P4 |

---

## 20. Out of scope

- Tự vận hành national probability panel  
- Conjoint đầy đủ / market simulator (P4+)  
- Auto-publish report lên portal khách không duyệt  
- Scraping group Facebook / nội dung sau login  
- Thay thế `/seo/research` hoặc `/crm/sales?tab=market`  
- Chứng nhận ISO 20252 năm đầu  

---

## 21. Traceability

| Nguồn | Đưa vào spec |
|-------|----------------|
| PTT AI giải pháp §3 SOP 6 bước | G0–G10 |
| PTT AI §5 6 thực thể | §9 + Evidence/Review/Report Version |
| PTT AI §4 prompts | Copilot skills §10.1 |
| Hệ thống báo cáo §1–7 | Gates, rubric, KPI, privacy, roadmap |
| SPC DV12 CB/TC/CS | Product types + duration |
| Route-map DV12 gap | Module standalone `/crm/research` |
| Quyết định user 2026-08-14 | Sidebar **Lên kế hoạch** (option A) |
| SRS MKT-RES-OS-SRS-20260814 | FR/US/DDL/API/wireframe/NFR/P0 AC — file `docs/specs/2026-08-14-market-research-os-srs.md` |
| UX/UI MKT-RES-OS-UIUX-20260814 | 22 SCR + component + cap-first — `docs/specs/2026-08-14-market-research-os-ui-ux.md` |
| BA RES-UC 001…042 | `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` + catalog + actions |

---

## Phụ lục A — Maturity

| Level | Mục tiêu thời điểm |
|-------|-------------------|
| L1 Ad hoc | Hiện tại (file rời, sales market BĐS) |
| L2 Repeatable | Cuối P1 |
| L3 Managed | Cuối P2 |
| L4 Integrated | P3–P4 |
| L5 Adaptive | Năm 2 (forecast calibrated) |

## Phụ lục B — Checklist 30 ngày (ops, không code)

- Chỉ định Research Lead approver + ResearchOps owner (0.5 FTE).  
- Chọn 2 pilot.  
- Ban hành “no evidence, no insight”.  
- Gold set 30 URL ngành VN.  
- Review DPA Tavily/OpenAI.  

---

*Spec này biến hai tài liệu nghiên cứu (AI stack PTT + hệ thống báo cáo chuẩn ISO/ESOMAR) thành thiết kế module trên RNOSAI, đủ để viết implementation plan P0 sau khi PO / Research Lead / GDKD duyệt.*
