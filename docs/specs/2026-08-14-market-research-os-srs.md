# SRS — Market Research OS (DV12)

**Tài liệu:** Đặc tả yêu cầu phần mềm (Software Requirements Specification)  
**Document ID:** MKT-RES-OS-SRS-20260814  
**Phiên bản:** 1.0  
**Ngày:** 2026-08-14  
**Trạng thái:** Draft — development-ready cho P0; P1–P4 đặc tả mức FR  
**Parent design:** [`../superpowers/specs/2026-08-14-market-research-os-design.md`](../superpowers/specs/2026-08-14-market-research-os-design.md)  
**UX/UI:** [`2026-08-14-market-research-os-ui-ux.md`](./2026-08-14-market-research-os-ui-ux.md)  
**Use cases:** [`modules/RNOSAI-BA-RES-UseCases.md`](./modules/RNOSAI-BA-RES-UseCases.md) · [`../use-cases/12-MARKET-RESEARCH-OS.md`](../use-cases/12-MARKET-RESEARCH-OS.md)  
**Catalog:** DV12 Báo cáo phân tích thị trường (`phan-tich-thi-truong`)  
**App:** `services/ptt-crm-api` (`MarketResearchModule`) · `services/ops-web` · `ptt_worker`  
**Chuẩn hình thức:** bám SRS PTT Ops v1.0 (8 phần + phụ lục) — IEEE 830 rút gọn, đủ để lập trình.

Giả định đội ngũ đã đọc design spec. Design = nghiệp vụ & kiến trúc; **SRS này = yêu cầu kỹ thuật có acceptance, DDL, API, wireframe.**

---

## Mục lục

- [Phần 1. Phạm vi & mục tiêu](#phần-1-phạm-vi--mục-tiêu)
- [Phần 2. Vai trò & User Stories](#phần-2-vai-trò--user-stories)
- [Phần 3. Yêu cầu chức năng](#phần-3-yêu-cầu-chức-năng)
- [Phần 4. Mô hình dữ liệu & DDL](#phần-4-mô-hình-dữ-liệu--ddl)
- [Phần 5. Đặc tả API REST](#phần-5-đặc-tả-api-rest)
- [Phần 6. Wireframe](#phần-6-wireframe)
- [Phần 7. Yêu cầu phi chức năng](#phần-7-yêu-cầu-phi-chức-năng)
- [Phần 8. Tiêu chí chấp nhận MVP (P0)](#phần-8-tiêu-chí-chấp-nhận-mvp-p0)
- [Phụ lục A. Glossary](#phụ-lục-a-glossary)
- [Phụ lục B. Business rules](#phụ-lục-b-business-rules)
- [Phụ lục C. Ma trận UC](#phụ-lục-c-ma-trận-uc)
- [Phụ lục D. AI provider matrix](#phụ-lục-d-ai-provider-matrix)
- [Phụ lục E. Tài liệu liên quan](#phụ-lục-e-tài-liệu-liên-quan)

---

## Phần 1. Phạm vi & mục tiêu

### 1.1. Vấn đề

RNOSAI chưa có module deliverable DV12. Hiện có:

| Artifact | Vì sao không đủ |
|----------|-----------------|
| `/crm/sales` tab Market (`crm_sales_market_research`) | NCTT BĐS (khu vực, loại hình, giá) |
| `/crm/marketing-plan` `khtn_market_research_json` | JSON nhúng plan, không evidence chain |
| `/seo/research` | Keyword SEO/AEO |
| LMP Tavily | Research **lead** B2B, không phải report khách |

Gap route-map: *No standalone market-research deliverable tracker*.

### 1.2. Mục tiêu sản phẩm

Hệ thống vận hành insight có truy vết:

**Decision → Research Question → Source → Evidence → Insight (confidence + approval) → Report Version → Activation.**

Báo cáo DOCX/PDF là *view* của Insight đã `approved_client_facing`. Không insight không evidence không xuất bản.

### 1.3. Phạm vi theo giai đoạn

| Phase | In scope SRS | Ghi chú |
|-------|----------------|---------|
| **P0 MVP** (3–4 tuần) | Nav «Lên kế hoạch»; CRUD project; RQ; Source; Evidence; Insight + gate; Tavily desk; Deep Research job (1 provider); Review Lead; export DOCX CB; flag; tenancy | **Đủ chi tiết để code** |
| **P1** | Competitor snapshot; confidence rubric UI; methodology appendix bắt buộc; map lifecycle DV12; insert insight vào marketing-plan | FR ghi P1 |
| **P2** | Studies (survey/IDI); Research Agent pulse; bilingual exec; ops KPI API | FR ghi P2 |
| **P3** | Portal khách, watermark, waves, decision log | FR ghi P3 |
| **P4** | Qualtrics/panel, RAG, forecast registry | FR ghi P4 — SRS bổ sung khi bake-off |

### 1.4. Ngoài phạm vi (mọi phase trừ khi nêu)

- National probability panel; conjoint đầy đủ; market simulator.
- Auto-publish report lên portal không duyệt.
- Scrape Facebook group / nội dung sau login.
- Thay `/seo/research` hoặc `/crm/sales?tab=market`.
- Chứng nhận ISO 20252 năm đầu.
- GDKD `crm_leads.assign` **không** thay Research Lead duyệt method.

### 1.5. Hệ thống liên quan

| Hệ thống | Quan hệ |
|----------|---------|
| `ptt-crm-api` | Nest module mới `MarketResearchModule` |
| `ops-web` | Routes `/crm/research*` + sửa `OpsNav` |
| `ptt_worker` | Job `research_desk_collect`, `research_deep_research` |
| Tavily | Search + extract (reuse `collect.py` pattern, credit cap riêng) |
| OpenAI / Gemini | Deep Research provider (`RESEARCH_DEEP_PROVIDER`) |
| Anthropic Claude | Brief / insight / report draft |
| `crm_agency_clients` / staff client scope | Tenancy |
| `crm_service_lifecycle` | Optional FK DV12 instance (P1 bắt buộc nếu tạo từ delivery) |

### 1.6. Feature flags & env

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PTT_MARKET_RESEARCH_ENABLED` | `0` | API 404 nếu off |
| `NEXT_PUBLIC_MARKET_RESEARCH` | `0` | Ẩn nav |
| `MAX_TAVILY_CREDITS_PER_RESEARCH` | `12` | Cap / project |
| `RESEARCH_DEEP_PROVIDER` | `openai` | `openai` \| `gemini` \| `off` |
| `RESEARCH_DEEP_TIMEOUT_SEC` | `900` | Timeout job Deep Research |

### 1.7. Định nghĩa thành công P0

1. AM tạo project gắn client + `product_type` + ≥1 RQ.  
2. Analyst chạy desk → Source nháp; verify → Evidence.  
3. Không approve Insight thiếu Evidence verified.  
4. Export DOCX có exec + appendix + evidence index.  
5. User client A không đọc project client B.  
6. Flag off: nav ẩn, API 404.

---

## Phần 2. Vai trò & User Stories

### 2.1. Vai trò

| Vai trò | Cap P0 | Mô tả |
|---------|--------|--------|
| **AM** | `crm_research.view/create/edit/export` | Brief G0, wording khách, phân phối |
| **Research Analyst** | + `run` | Thu thập, evidence, insight draft, report draft |
| **Research Lead** | + `approve` | Method, confidence, release nội dung |
| **ResearchOps / Admin** | `configure` | Taxonomy, flag, prompt version (P1) |
| **GDKD** | `view` (+ assign không = approve method) | Xem, override **thương mại** (scope/giá) |
| **Client sponsor** | Portal P3 | Read-only report đã duyệt |

Segregation: người `edit` insight **không** tự `approve` cùng object trừ khi có second approver (BR-RES-07).

### 2.2. User Stories P0

Mỗi story: mã · vai trò · muốn · để · acceptance.

**US-NAV-01.** Với vai trò staff có `crm_research.view` hoặc `crm_board.view`, tôi muốn nhóm sidebar **Lên kế hoạch** gồm Nghiên cứu thị trường + Kế hoạch marketing, để tách PLAN khỏi triển khai DV.  
**AC:** Nav hiện đúng 2 link; «Kế hoạch marketing» không còn trong «Triển khai dịch vụ»; flag off ẩn cả nhóm Research (plan vẫn theo cap board).

**US-AM-01.** Với vai trò AM, tôi muốn tạo Research Project (wizard G0) gắn Client, DV12 tier, `product_type`, decision statement, geo, language, để bắt đầu đúng câu hỏi kinh doanh.  
**AC:** Thiếu `client_id` hoặc `product_type` hoặc decision < 20 ký tự → 400; tạo xong status=`intake`; ghi audit.

**US-AM-02.** Với vai trò AM, tôi muốn thêm 3–7 Research Questions, để report viết theo câu hỏi không theo tool.  
**AC:** Tối thiểu 1 RQ trước khi chuyển `designed`; sắp xếp `sort_order`.

**US-AN-01.** Với vai trò Analyst, tôi muốn chạy **Desk AI** (Tavily) theo RQ, để có Source candidates có URL.  
**AC:** Job async; thiếu `TAVILY_API_KEY` → status `failed` graceful, project không crash; `ai_generated=true`; credit ≤ cap.

**US-AN-02.** Với vai trò Analyst, tôi muốn chạy **Deep Research** (OpenAI hoặc Gemini) 1 lần/RQ, để có dàn ý + danh sách nguồn sâu.  
**AC:** Timeout theo env; output = sources nháp, **không** tạo Insight `published`; log `crm_research_ai_runs`.

**US-AN-03.** Với vai trò Analyst, tôi muốn verify Source và tạo Evidence (locator, excerpt/value, unit, period, geo), để có ledger bất biến sau verified.  
**AC:** Evidence `verified` không PATCH được các field nội dung (chỉ supersede); thiếu locator → 400.

**US-AN-04.** Với vai trò Analyst, tôi muốn soạn Insight (observation, interpretation, implication, recommendation) gắn ≥1 Evidence, để Lead duyệt.  
**AC:** POST insight không evidence → status tối đa `draft`; submit-review yêu cầu ≥1 evidence `verified`.

**US-LD-01.** Với vai trò Lead, tôi muốn approve Insight lên `approved_internal` / `approved_client_facing`, để khóa nội dung khách.  
**AC:** Approve khi thiếu evidence hoặc thiếu `confidence_rationale` → 400 `insight_gate`; không tự approve insight mình là `created_by` nếu không có `second_approver_id`.

**US-AN-05.** Với vai trò Analyst/AM, tôi muốn sinh Report Version từ Insight `approved_internal+` và export DOCX, để giao khách gói CB.  
**AC:** DOCX có cover, exec, findings theo RQ, recommendations, methodology stub, evidence index; hash version; sửa sau approve = version mới.

**US-SEC-01.** Với vai trò staff client-scoped, tôi chỉ thấy project của client mình, để không lộ data khách lớn.  
**AC:** GET list lọc theo staff client scope; GET id ngoài scope → 404 (không 403 để tránh enumeration) hoặc 403 thống nhất với CRM hiện tại — **chọn 403 + không leak tên** (BR-RES-12).

**US-AM-03.** Với vai trò AM, tôi muốn gắn project với lifecycle DV12 (nếu có), để task delivery và research cùng khách.  
**AC:** P0 field optional; P1: tạo từ `/crm/service-delivery` prefill `lifecycle_id`.

### 2.3. User Stories P1–P3 (mức FR, chưa DDL bắt buộc P0)

| Mã | Tóm tắt | Phase |
|----|---------|-------|
| US-AN-10 | Confidence rubric 5 chiều UI | P1 |
| US-AN-11 | Competitor + snapshot fact/hypothesis | P1 |
| US-AM-10 | Insert Insight ID vào marketing-plan (không copy text) | P1 |
| US-LD-10 | Methodology appendix bắt buộc trước export TC/CS | P1 |
| US-AN-20 | Study survey/IDI + transcript locator | P2 |
| US-OPS-20 | Agent pulse competitor/trend → alert | P2 |
| US-CL-30 | Portal đọc report + watermark + expiry | P3 |

---

## Phần 3. Yêu cầu chức năng

Ưu tiên: **P0** = MVP code ngay; **P1–P4** = backlog có ID.

### 3.1. Nav & IA — FR-NAV

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-NAV-01 | Nhóm sidebar `Lên kế hoạch`: `/crm/research`, `/crm/marketing-plan` | P0 |
| FR-NAV-02 | Gỡ `/crm/marketing-plan` khỏi nhóm Triển khai dịch vụ | P0 |
| FR-NAV-03 | Icon + label «Nghiên cứu thị trường» | P0 |
| FR-NAV-04 | Flag off: ẩn Research; API disabled | P0 |
| FR-NAV-05 | Không đổi `/crm/sales?tab=market` | P0 |

### 3.2. Project & Brief — FR-PRJ

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-PRJ-01 | CRUD project: client_id, title, product_type, dv12_tier, decision_statement, geo[], languages[], risk_class, status, owner_id | P0 |
| FR-PRJ-02 | `product_type` enum §5 design (10 giá trị) | P0 |
| FR-PRJ-03 | State machine project (Phần 4.3); transition có actor + note | P0 |
| FR-PRJ-04 | RQ CRUD, min 1 trước `designed` | P0 |
| FR-PRJ-05 | List filter client, status, product_type, owner; sort updated_at | P0 |
| FR-PRJ-06 | Prefill từ consult/intake (industry, competitors) | P1 |
| FR-PRJ-07 | Tạo từ service-delivery DV12 | P1 |
| FR-PRJ-08 | Waves tracker | P3 |

### 3.3. Sources & Desk AI — FR-SRC

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-SRC-01 | CRUD Source: type, title, publisher, url, published_at, accessed_at, geo, license, reliability_tier, snapshot_uri, hash | P0 |
| FR-SRC-02 | Job Tavily theo RQ; ghi credits | P0 |
| FR-SRC-03 | Job Deep Research 1 provider; sources nháp | P0 |
| FR-SRC-04 | Analyst keep/reject candidate | P0 |
| FR-SRC-05 | Dual-provider triangulation | P1 |
| FR-SRC-06 | Source verified immutable (supersede) | P0 |

### 3.4. Evidence — FR-EVD

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-EVD-01 | Evidence: source_id hoặc study_id, locator, excerpt hoặc value+unit+base, period, geography, pii_class, qc_status | P0 |
| FR-EVD-02 | Verified → immutable nội dung | P0 |
| FR-EVD-03 | Filter theo RQ | P0 |
| FR-EVD-04 | PII mask gợi ý khi excerpt (regex + optional LLM mini) | P0 (regex) / P1 (LLM) |
| FR-EVD-05 | Không xoá verified; chỉ `superseded_by` | P0 |

### 3.5. Insight & confidence — FR-INS

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-INS-01 | Insight fields: statement, observation, interpretation, implication, recommendation, audience, valid_from/to | P0 |
| FR-INS-02 | N–M evidence; submit-review cần ≥1 verified | P0 |
| FR-INS-03 | State machine insight (Phần 4.3) | P0 |
| FR-INS-04 | `confidence_rationale` text P0; rubric 5 chiều P1 | P0/P1 |
| FR-INS-05 | `ai_generated` flag; cấm nhảy tới published | P0 |
| FR-INS-06 | Counter-evidence optional | P1 |
| FR-INS-07 | Banner stale khi `valid_to` < today | P1 |

### 3.6. Review & approval — FR-REV

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-REV-01 | Review record: object_type, object_id, decision, comments, checklist_version, artifact_hash | P0 |
| FR-REV-02 | Lead approve insight / report | P0 |
| FR-REV-03 | AM `approve_client_facing` (wording) tách Lead (method) | P0 |
| FR-REV-04 | SoD: không tự approve object mình tạo | P0 |
| FR-REV-05 | Risk acceptance High phải có note | P1 |

### 3.7. Report — FR-RPT

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-RPT-01 | Generate version từ insight ≥ `approved_internal` | P0 |
| FR-RPT-02 | Snapshot JSON blocks: cover, exec, findings[], recs[], methodology, evidence_index | P0 |
| FR-RPT-03 | Export DOCX | P0 |
| FR-RPT-04 | Export PDF | P1 |
| FR-RPT-05 | Silent edit cấm; version++ | P0 |
| FR-RPT-06 | Embargo / expiry fields | P1 |
| FR-RPT-07 | EN exec summary | P2 |
| FR-RPT-08 | Methodology appendix bắt buộc TC/CS | P1 |

### 3.8. Competitor & trend — FR-CI

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-CI-01 | Competitor master + aliases | P1 |
| FR-CI-02 | Snapshot fact JSON whitelist + source_id | P1 |
| FR-CI-03 | Trend signal + velocity | P2 |
| FR-CI-04 | Agent alert | P2 |

### 3.9. Studies (qual/quant) — FR-STD

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-STD-01 | Study: method, n, field_dates, mode, instrument_version | P2 |
| FR-STD-02 | Transcript span locator | P2 |
| FR-STD-03 | Consent record tách PII | P2 |

### 3.10. Tích hợp — FR-INT

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-INT-01 | Marketing-plan insert insight_id | P1 |
| FR-INT-02 | Content OS cite insight_id | P2 |
| FR-INT-03 | Ops analytics GET cycle time / evidence completeness | P2 |
| FR-INT-04 | Portal report | P3 |

### 3.11. AI jobs — FR-AI

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-AI-01 | `research_desk_collect` worker | P0 |
| FR-AI-02 | `research_deep_research` worker | P0 |
| FR-AI-03 | Copilot draft insight **chỉ** từ evidence_ids (G6) | P0 |
| FR-AI-04 | Copilot draft report từ approved insights (G7) | P0 |
| FR-AI-05 | Log mọi run: provider, model, prompt_version, input_hash | P0 |
| FR-AI-06 | Prompt cấm PII lead (SĐT/email/tên người) | P0 |
| FR-AI-07 | Deep Research không được set insight published | P0 |

### 3.12. RBAC — FR-RBAC

| Mã | Yêu cầu | Ưu tiên |
|----|---------|---------|
| FR-RBAC-01 | Seed caps `crm_research` view/create/edit/run/approve/export/configure | P0 |
| FR-RBAC-02 | Guard mọi endpoint | P0 |
| FR-RBAC-03 | Client scope như agency hub | P0 |

---

## Phần 4. Mô hình dữ liệu & DDL

### 4.1. ERD logic

```
crm_research_projects 1──N questions
                   1──N sources 1──N evidence
                   1──N studies 1──N evidence     (P2)
                   1──N competitors 1──N snapshots (P1)
                   1──N insights N──M evidence
                   1──N reports 1──N versions
                   1──N ai_runs
insights 1──N reviews
reports  1──N reviews
```

### 4.2. Enum

```text
product_type:
  CAT_REVIEW | COMP_LAND | CONSUMER | SEG_STP | BRAND_HEALTH
  | PRICE_OFFER | CAMPAIGN | TREND_SCAN | GTM | TRACKER

dv12_tier: CB | TC | CS

project_status:
  intake | designed | collecting | qc | analyzing | synthesizing
  | drafting | in_review | approved | distributed | archived | cancelled

insight_status:
  draft | evidence_attached | analyst_verified | peer_reviewed
  | approved_internal | approved_client_facing | published
  | superseded | expired | rejected

source_type:
  web | report | news | official | ad_creative | social_public
  | survey | interview | other

reliability_tier: unknown | low | medium | high | official

qc_status: pending | verified | rejected | superseded

pii_class: none | internal | pii_masked | pii_restricted

risk_class: low | medium | high
```

### 4.3. State transitions (P0 enforce)

**Project (happy path P0):**  
`intake → designed` (cần ≥1 RQ)  
`designed → collecting`  
`collecting → synthesizing` (P0 cho phép nhảy, bỏ qc/analyzing bắt buộc)  
`synthesizing → drafting` (cần ≥1 insight `analyst_verified+`)  
`drafting → in_review`  
`in_review → approved` (Lead)  
`approved → distributed`  
Mọi lúc → `cancelled` (AM/Lead). Không lùi `approved` → chỉ version report mới.

**Insight:**  
`draft → evidence_attached` (gắn evidence)  
`evidence_attached → analyst_verified`  
`analyst_verified → peer_reviewed` (optional P0: Lead có thể skip peer nếu `risk_class=low`)  
`peer_reviewed|analyst_verified → approved_internal` (Lead)  
`approved_internal → approved_client_facing` (AM hoặc Lead)  
`approved_client_facing → published` (khi nằm trong report distributed)

### 4.4. DDL P0 (PostgreSQL)

Chạy idempotent qua script `scripts/apply_pg_ddl_market_research.sh`.

```sql
-- Market Research OS P0 — 2026-08-14

CREATE TABLE IF NOT EXISTS crm_research_projects (
  id                    BIGSERIAL PRIMARY KEY,
  client_id             TEXT NOT NULL,
  lifecycle_id          BIGINT,
  title                 TEXT NOT NULL,
  product_type          TEXT NOT NULL,
  dv12_tier             TEXT NOT NULL DEFAULT 'CB',
  decision_statement    TEXT NOT NULL,
  geo                   JSONB NOT NULL DEFAULT '[]',
  languages             JSONB NOT NULL DEFAULT '["vi"]',
  risk_class            TEXT NOT NULL DEFAULT 'low',
  status                TEXT NOT NULL DEFAULT 'intake',
  owner_user_id         BIGINT,
  data_residency        TEXT,
  related_sales_market_id BIGINT,
  created_by            TEXT,
  updated_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_projects_type_chk CHECK (product_type IN (
    'CAT_REVIEW','COMP_LAND','CONSUMER','SEG_STP','BRAND_HEALTH',
    'PRICE_OFFER','CAMPAIGN','TREND_SCAN','GTM','TRACKER')),
  CONSTRAINT crm_research_projects_tier_chk CHECK (dv12_tier IN ('CB','TC','CS')),
  CONSTRAINT crm_research_projects_status_chk CHECK (status IN (
    'intake','designed','collecting','qc','analyzing','synthesizing',
    'drafting','in_review','approved','distributed','archived','cancelled'))
);

CREATE INDEX IF NOT EXISTS crm_research_projects_client_idx
  ON crm_research_projects (client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_research_questions (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  question_vi   TEXT NOT NULL,
  question_en   TEXT,
  analysis_frame TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_sources (
  id                 BIGSERIAL PRIMARY KEY,
  project_id         BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  question_id        BIGINT REFERENCES crm_research_questions(id),
  source_type        TEXT NOT NULL DEFAULT 'web',
  title              TEXT NOT NULL,
  publisher          TEXT,
  url                TEXT,
  published_at       DATE,
  accessed_at        DATE,
  geo                TEXT,
  license_note       TEXT,
  reliability_tier   TEXT NOT NULL DEFAULT 'unknown',
  snapshot_uri       TEXT,
  content_hash       TEXT,
  ai_generated       BOOLEAN NOT NULL DEFAULT false,
  keep               BOOLEAN,
  superseded_by      BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_evidence (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  source_id       BIGINT REFERENCES crm_research_sources(id),
  study_id        BIGINT,
  question_id     BIGINT REFERENCES crm_research_questions(id),
  locator         TEXT NOT NULL,
  excerpt         TEXT,
  value_num       NUMERIC,
  unit            TEXT,
  value_base      TEXT,
  period_note     TEXT,
  geography       TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  pii_class       TEXT NOT NULL DEFAULT 'none',
  qc_status       TEXT NOT NULL DEFAULT 'pending',
  checksum        TEXT,
  created_by      TEXT,
  superseded_by   BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_evidence_qc_chk CHECK (qc_status IN (
    'pending','verified','rejected','superseded')),
  CONSTRAINT crm_research_evidence_src_chk CHECK (source_id IS NOT NULL OR study_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_research_evidence_hash_uq
  ON crm_research_evidence (project_id, checksum) WHERE checksum IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_research_insights (
  id                   BIGSERIAL PRIMARY KEY,
  project_id           BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  statement            TEXT NOT NULL,
  observation          TEXT,
  interpretation       TEXT,
  implication          TEXT,
  recommendation       TEXT,
  audience             TEXT,
  status               TEXT NOT NULL DEFAULT 'draft',
  confidence_rationale TEXT,
  confidence_json      JSONB,
  ai_generated         BOOLEAN NOT NULL DEFAULT false,
  created_by           TEXT,
  valid_from           DATE,
  valid_to             DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_insights_status_chk CHECK (status IN (
    'draft','evidence_attached','analyst_verified','peer_reviewed',
    'approved_internal','approved_client_facing','published',
    'superseded','expired','rejected'))
);

CREATE TABLE IF NOT EXISTS crm_research_insight_evidence (
  insight_id   BIGINT NOT NULL REFERENCES crm_research_insights(id) ON DELETE CASCADE,
  evidence_id  BIGINT NOT NULL REFERENCES crm_research_evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY (insight_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS crm_research_reviews (
  id                 BIGSERIAL PRIMARY KEY,
  project_id         BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  object_type        TEXT NOT NULL,
  object_id          BIGINT NOT NULL,
  reviewer           TEXT NOT NULL,
  role               TEXT NOT NULL,
  decision           TEXT NOT NULL,
  comments           TEXT,
  checklist_version  TEXT,
  artifact_hash      TEXT,
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_reviews_obj_chk CHECK (object_type IN ('insight','report','source','project')),
  CONSTRAINT crm_research_reviews_dec_chk CHECK (decision IN (
    'approve','reject','request_changes','risk_accept'))
);

CREATE TABLE IF NOT EXISTS crm_research_reports (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  template    TEXT NOT NULL DEFAULT 'dv12_cb_v1',
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_report_versions (
  id                BIGSERIAL PRIMARY KEY,
  report_id         BIGINT NOT NULL REFERENCES crm_research_reports(id) ON DELETE CASCADE,
  version           INT NOT NULL,
  content_snapshot  JSONB NOT NULL,
  generated_by      TEXT,
  content_hash      TEXT NOT NULL,
  embargo_until     TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS crm_research_ai_runs (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  question_id     BIGINT REFERENCES crm_research_questions(id),
  job_type        TEXT NOT NULL,
  provider        TEXT NOT NULL,
  model           TEXT,
  prompt_version  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  input_hash      TEXT,
  output_json     JSONB,
  error_message   TEXT,
  credits_used    INT NOT NULL DEFAULT 0,
  actor           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
    'desk_tavily','deep_research','insight_draft','report_draft','pii_scan'))
);

CREATE INDEX IF NOT EXISTS crm_research_ai_runs_project_idx
  ON crm_research_ai_runs (project_id, created_at DESC);
```

**P1 tables (không tạo P0):** `crm_research_competitors`, `crm_research_competitor_snapshots`, `crm_research_trend_signals`.  
**P2:** `crm_research_studies`, `crm_research_consents`, `crm_research_decisions`.

### 4.5. Trigger immutability (P0)

```sql
-- Evidence verified: cấm UPDATE excerpt/value/locator/source_id
-- Implement in service layer P0; DB trigger P1 nếu cần chống bypass SQL.
```

Service **bắt buộc** reject PATCH evidence khi `qc_status=verified` (FR-EVD-02). Trigger SQL = hardening P1.

---

## Phần 5. Đặc tả API REST

Base: `/api/v1/research`  
Auth: `StaffOrInternalKeyGuard` + caps `crm_research.*`  
Content-Type: `application/json`  
Flag off → **404** `{ "error": "market_research_disabled" }`

### 5.1. Catalog endpoint

| Method | Path | Cap | Mô tả |
|--------|------|-----|--------|
| GET | `/projects` | view | List `?client_id&status&product_type&q` |
| POST | `/projects` | create | Body G0 |
| GET | `/projects/:id` | view | Workspace bundle |
| PATCH | `/projects/:id` | edit | Metadata + status transition |
| POST | `/projects/:id/questions` | edit | Add RQ |
| PATCH | `/questions/:id` | edit | |
| DELETE | `/questions/:id` | edit | Cấm nếu đã có evidence |
| POST | `/projects/:id/sources` | edit | Manual source |
| PATCH | `/sources/:id` | edit | keep/reject |
| POST | `/projects/:id/run-desk` | run | `{ question_id }` enqueue Tavily |
| POST | `/projects/:id/run-deep` | run | `{ question_id }` enqueue Deep Research |
| GET | `/projects/:id/jobs/:runId` | view | Poll job |
| POST | `/projects/:id/evidence` | edit | Attach |
| POST | `/evidence/:id/verify` | edit | Set verified + checksum |
| POST | `/projects/:id/insights` | edit | Draft |
| POST | `/insights/:id/attach-evidence` | edit | `{ evidence_ids[] }` |
| POST | `/insights/:id/submit-review` | edit | |
| POST | `/insights/:id/approve` | approve | `{ target_status, comments }` |
| POST | `/projects/:id/reports` | edit | Generate version |
| GET | `/reports/:id/versions/:versionId/export` | export | DOCX `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| GET | `/analytics/ops` | view | P2 |

Internal worker: `POST /internal/research/jobs/:id/complete` (internal key) — pattern LMP.

### 5.2. POST `/projects` body

```json
{
  "client_id": "acme",
  "title": "Category review sữa uống 2026 VN",
  "product_type": "CAT_REVIEW",
  "dv12_tier": "CB",
  "decision_statement": "Quyết định có mở SKU premium Q4 hay không.",
  "geo": ["VN"],
  "languages": ["vi"],
  "risk_class": "medium",
  "lifecycle_id": null,
  "questions": [
    { "question_vi": "Quy mô thị trường sữa uống VN 2025–26?", "sort_order": 1 }
  ]
}
```

**400** nếu `decision_statement` trim length < 20; `product_type` invalid; `client_id` empty.

**201** `{ "ok": true, "project": { "id": 1, "status": "intake", ... } }`

### 5.3. POST `/projects/:id/run-desk`

```json
{ "question_id": 10 }
```

**202** `{ "ok": true, "run_id": 55, "status": "pending" }`  
**409** nếu job cùng question đang `pending|running`.  
**503** Tavily missing: run `failed`, message `tavily_unconfigured` — **không** 500.

### 5.4. POST `/insights/:id/approve`

```json
{ "target_status": "approved_internal", "comments": "Method OK" }
```

**400** `insight_gate` khi:

```json
{
  "error": "insight_gate",
  "messages": ["missing_verified_evidence", "missing_confidence_rationale"]
}
```

**403** `cannot_self_approve` khi `reviewer == created_by` và không có `X-PTT-Second-Approver` (P1; P0: Lead khác creator).

### 5.5. Error codes

| Code | HTTP | Ý nghĩa |
|------|------|---------|
| `market_research_disabled` | 404 | Flag off |
| `not_found` | 404 | |
| `forbidden` | 403 | Cap hoặc client scope |
| `validation_error` | 400 | |
| `insight_gate` | 400 | BR-RES-01 |
| `evidence_immutable` | 409 | PATCH verified |
| `invalid_transition` | 409 | State machine |
| `job_in_flight` | 409 | |
| `tavily_unconfigured` | 200 on run record / 503 enqueue optional | Graceful |

### 5.6. Worker jobs

| Job | Input | Output |
|-----|-------|--------|
| `research_desk_collect` | project_id, question_id | `sources[]` ai_generated |
| `research_deep_research` | project_id, question_id, provider | outline + `sources[]` |
| `research_insight_draft` | project_id, evidence_ids | insight draft |
| `research_report_draft` | project_id, insight_ids | content_snapshot |

Timeout Deep Research: `RESEARCH_DEEP_TIMEOUT_SEC`. Idempotency key: `research:{project_id}:{job_type}:{question_id}:{input_hash}`.

---

Wireframe đầy đủ (mọi tab, modal, empty/error, token, cap-first): [`2026-08-14-market-research-os-ui-ux.md`](./2026-08-14-market-research-os-ui-ux.md).

## Phần 6. Wireframe

### 6.1. SCR-RES-001 — List `/crm/research`

```
┌ Lên kế hoạch / Nghiên cứu thị trường ────────── [+ Tạo project] ┐
│ Filter: [Client ▼] [Status ▼] [Type ▼] [Tìm…]                    │
│                                                                  │
│ Client     Title              Type        Status      Evidence % │
│ Acme       Sữa uống 2026      CAT_REVIEW  collecting  4/12 src   │
│ Beta       Pulse đối thủ      COMP_LAND   intake      —          │
└──────────────────────────────────────────────────────────────────┘
```

Empty state: CTA tạo project + link DV12 SOP.

### 6.2. SCR-RES-002 — Wizard G0 `/crm/research/new`

Bước 1 Client + title + DV12 tier.  
Bước 2 `product_type` cards (10 type).  
Bước 3 Decision statement (textarea, min 20).  
Bước 4 Geo / language.  
Bước 5 RQ list (thêm dòng).  
Submit → `/crm/research/:id?tab=brief`.

### 6.3. SCR-RES-003 — Workspace `/crm/research/[id]`

```
┌ Acme · CAT_REVIEW · CB · collecting ──── Close evidence 33% ──┐
│ [Brief] [Sources] [Evidence] [Insights] [Report] [Activity]    │
│                                                                │
│ Tab Sources:                                                   │
│  [Chạy Desk Tavily] [Chạy Deep Research ▼]                     │
│  ☐ keep  Title                    Tier    AI?   RQ             │
│  ☑       Euromonitor dairy 2025   high    no    Q1             │
│  ☐       (AI) blog xyz            unknown yes   Q1  [Verify]   │
└────────────────────────────────────────────────────────────────┘
```

Deep Research: modal chọn RQ + cảnh báo “chỉ tạo nguồn nháp, không phải số liệu đã audit”.

### 6.4. SCR-RES-004 — Insight card

```
┌ Insight #18  draft | AI ───────────────────────────────────────┐
│ Statement: Premium SKU tăng share ở MT HCM                     │
│ Evidence: EV-12, EV-19                         Confidence: —    │
│ [Observation] [Interpretation] [Implication] [Recommendation]   │
│ [Gửi Lead duyệt]  disabled nếu 0 evidence verified              │
└────────────────────────────────────────────────────────────────┘
```

### 6.5. SCR-RES-005 — Report preview

Cột trái: blocks storyline. Cột phải: Insight đã duyệt (kéo thả P1; P0 checkbox include). Nút **Xuất DOCX**. Sau approved: banner “Sửa = tạo version mới”.

### 6.6. SCR-RES-006 — Gate toast/dialog

Khi bấm Approve: list `messages[]` từ `insight_gate`. Không silent disable không lý do.

### 6.7. Responsive

P0 desktop-first. Mobile: list + insight read. Không wizard report.

---

## Phần 7. Yêu cầu phi chức năng

### 7.1. Bảo mật — NFR-SEC

| Mã | Yêu cầu |
|----|---------|
| NFR-SEC-01 | Mọi API auth staff JWT hoặc internal key |
| NFR-SEC-02 | Client tenancy: query luôn `client_id IN scope` |
| NFR-SEC-03 | Audit: create/update/approve/export/run AI |
| NFR-SEC-04 | Không log excerpt PII đầy đủ vào ai_runs nếu `pii_class!=none` — redact |
| NFR-SEC-05 | Export DOCX chỉ cap `export` |
| NFR-SEC-06 | Prompt desk/deep: cấm đưa SĐT/email/tên người từ CRM lead |

### 7.2. Privacy — NFR-PRI

| Mã | Yêu cầu |
|----|---------|
| NFR-PRI-01 | PDPD VN: purpose = research DV12; retention raw P2 = 24 tháng default |
| NFR-PRI-02 | P0 không lưu transcript thô (P2 studies) |
| NFR-PRI-03 | Vendor LLM: cấu hình no-train khi contract cho phép |

### 7.3. Sẵn sàng & vận hành — NFR-OPS

| Mã | Yêu cầu |
|----|---------|
| NFR-OPS-01 | Flag off: API 404, nav ẩn; không crash ops-web |
| NFR-OPS-02 | Worker job fail → `crm_research_ai_runs.status=failed` + `error_message`; project giữ nguyên |
| NFR-OPS-03 | Deploy script idempotent DDL + restart `ptt-crm-api` / `ptt-ops-web` / `ptt-worker` |
| NFR-OPS-04 | Runbook 1 trang: flag, env, cap Tavily, Deep Research provider |

### 7.4. Độ tin cậy AI — NFR-AI

| Mã | Yêu cầu |
|----|---------|
| NFR-AI-01 | Desk/Deep fail không fail project |
| NFR-AI-02 | Temperature ≤ 0.3 insight/report |
| NFR-AI-03 | Synthesis G6 chỉ evidence_ids trong prompt |
| NFR-AI-04 | Gold set unsupported-claim <2% trước GA P1 |
| NFR-AI-05 | Timeout Deep Research không treo worker (job failed) |

### 7.5. Hiệu năng — NFR-PER

| Mã | Target |
|----|--------|
| NFR-PER-01 | GET list 50 rows p95 < 400ms (cùng region) |
| NFR-PER-02 | GET workspace p95 < 800ms |
| NFR-PER-03 | Desk job p95 < 120s (Tavily cap 12) |
| NFR-PER-04 | Deep Research p95 < 15 phút hoặc failed |
| NFR-PER-05 | DOCX export p95 < 10s (CB, ≤30 insight) |

### 7.6. Quan sát — NFR-OBS

Log structured: `research_project_id`, `job_type`, `provider`, `credits`. Metric: jobs_total, jobs_failed, insight_gate_rejects.

### 7.7. Tương thích

- Postgres cùng `DATABASE_URL` CRM.  
- Không ghi SQLite `crm_sales_market_research`.  
- i18n UI tiếng Việt P0.

### 7.8. A11y / UX

Nút disabled phải có `title` lý do gate. Không rely color-only cho confidence.

---

## Phần 8. Tiêu chí chấp nhận MVP (P0)

### 8.1. Gate kỹ thuật

| ID | Criteria | Đo |
|----|----------|----|
| EC-RES-01 | Sidebar Lên kế hoạch = Research + Marketing plan | UAT nav |
| EC-RES-02 | POST project + RQ | API test |
| EC-RES-03 | Desk Tavily → sources; no key → failed graceful | Staging |
| EC-RES-04 | Approve insight 0 evidence → 400 insight_gate | Jest + UAT |
| EC-RES-05 | DOCX có appendix + evidence index | File check |
| EC-RES-06 | Cross-client GET → 403 | Test 2 user |
| EC-RES-07 | `/crm/sales` market BĐS nguyên | Regression |
| EC-RES-08 | Flag 0 → nav ẩn + API 404 | |
| EC-RES-09 | Deep Research chỉ tạo source nháp | |
| EC-RES-10 | Evidence verified không PATCH excerpt | |
| EC-RES-11 | SoD không tự approve | |
| EC-RES-12 | AI run logged | SQL |

### 8.2. Pilot nghiệp vụ

- Project A: `COMP_LAND` desk, 1 RQ, ≥5 source verified, ≥3 insight approved, 1 DOCX.  
- Project B (có thể P1): `CAMPAIGN` hoặc `CONSUMER` với evidence thủ công (không bắt Deep Research).

### 8.3. Definition of Done P0

- DDL applied staging + VPS script.  
- Caps seeded.  
- Unit: state machine, insight_gate, immutability.  
- Feature flag documented runbook 1 trang.

---

## Phụ lục A. Glossary

| Thuật ngữ | Nghĩa |
|-----------|--------|
| Evidence | Bằng chứng nguyên tử có locator |
| Insight | Kết luận atomic đã gắn evidence |
| Deep Research | Agent web multi-hop (OpenAI/Gemini/Perplexity) |
| Desk | Secondary research (Tavily/DR) |
| DV12 | Báo cáo phân tích thị trường |
| SoD | Segregation of duties |
| TAM/SAM/SOM | Sizing thị trường |
| Tracker | Nghiên cứu lặp wave |

---

## Phụ lục B. Business rules

| Mã | Rule |
|----|------|
| BR-RES-01 | No verified evidence → không `approved_*` / `published` |
| BR-RES-02 | Claim định lượng phải có value+unit+base+period+geo+source |
| BR-RES-03 | Cấm “95% confidence” trừ inference thống kê (validate wording P1) |
| BR-RES-04 | Cấm suy mentions = population |
| BR-RES-05 | Sửa report đã approve = version mới |
| BR-RES-06 | AI draft ≠ published |
| BR-RES-07 | Không tự approve object mình tạo |
| BR-RES-08 | Deep Research output = source candidates only |
| BR-RES-09 | Similarweb/Semrush phải `reliability_tier≤medium` + limitation note (P1) |
| BR-RES-10 | Credit Tavily / project ≤ env cap |
| BR-RES-11 | Prompt không chứa PII lead |
| BR-RES-12 | Cross-tenant: 403, không trả title |
| BR-RES-13 | GDKD assign ≠ method approve |
| BR-RES-01a | `designed` cần ≥1 RQ |

---

## Phụ lục C. Ma trận UC

Chi tiết luồng, màn hình, ngoại lệ: [`modules/RNOSAI-BA-RES-UseCases.md`](./modules/RNOSAI-BA-RES-UseCases.md) · [`../use-cases/12-MARKET-RESEARCH-OS.md`](../use-cases/12-MARKET-RESEARCH-OS.md) · Actions [`../use-cases/actions/12-RES-ACTIONS.md`](../use-cases/actions/12-RES-ACTIONS.md).

| UC | Tên | Phase | FR chính | Story |
|----|-----|-------|----------|-------|
| RES-UC-001 | Nav Lên kế hoạch + list | P0 | FR-NAV-01 | US-NAV-01 |
| RES-UC-002 | Wizard tạo project G0 | P0 | FR-PRJ-01 | US-AM-01 |
| RES-UC-003 | CRUD RQ | P0 | FR-PRJ-04 | US-AM-02 |
| RES-UC-004 | Run desk Tavily | P0 | FR-SRC-02 | US-AN-01 |
| RES-UC-005 | Run Deep Research | P0 | FR-SRC-03 | US-AN-02 |
| RES-UC-006 | Verify source / evidence | P0 | FR-EVD-01 | US-AN-03 |
| RES-UC-007 | Draft insight | P0 | FR-INS-01 | US-AN-04 |
| RES-UC-008 | Approve insight | P0 | FR-REV-02 | US-LD-01 |
| RES-UC-009 | Generate + export DOCX | P0 | FR-RPT-01 | US-AN-05 |
| RES-UC-010 | Client tenancy | P0 | FR-RBAC-03 | US-SEC-01 |
| RES-UC-011 | Copilot insight từ evidence | P0 | FR-AI-03 | — |
| RES-UC-012 | Copilot report draft | P0 | FR-AI-04 | — |
| RES-UC-013 | Feature flag | P0 | FR-NAV-04 | — |
| RES-UC-014 | Keep / reject source | P0 | FR-SRC-04 | — |
| RES-UC-015 | State machine project | P0 | FR-PRJ-03 | — |
| RES-UC-016 | Activity / AI runs | P0 | FR-AI-05 | — |
| RES-UC-017 | Evidence supersede | P0 | FR-EVD-02 | — |
| RES-UC-018 | AM duyệt bản khách | P0 | FR-REV-03 | — |
| RES-UC-019 | Nguồn thủ công | P0 | FR-SRC-01 | — |
| RES-UC-020 | Poll / retry job | P0 | FR-AI-01 | — |
| RES-UC-021 | Confidence rubric | P1 | FR-INS-04 | US-AN-10 |
| RES-UC-022 | Competitor snapshot | P1 | FR-CI-01 | US-AN-11 |
| RES-UC-023 | Insert insight → plan | P1 | FR-INT-01 | US-AM-10 |
| RES-UC-024 | Methodology appendix TC/CS | P1 | FR-RPT-08 | US-LD-10 |
| RES-UC-025 | Tạo từ service-delivery DV12 | P1 | FR-PRJ-07 | US-AM-03 |
| RES-UC-026 | Dual-provider triangulation | P1 | FR-SRC-05 | — |
| RES-UC-027 | Prefill consult/intake | P1 | FR-PRJ-06 | — |
| RES-UC-030 | Studies + consent | P2 | FR-STD-01 | US-AN-20 |
| RES-UC-031 | Pulse agent | P2 | FR-CI-04 | US-OPS-20 |
| RES-UC-032 | Exec song ngữ | P2 | FR-RPT-07 | — |
| RES-UC-033 | Ops KPI analytics | P2 | FR-INT-03 | — |
| RES-UC-040 | Client portal | P3 | FR-INT-04 | US-CL-30 |
| RES-UC-041 | Waves tracker | P3 | FR-PRJ-08 | — |
| RES-UC-042 | Decision log | P3 | — | — |

---

## Phụ lục D. AI provider matrix

(Chuẩn vận hành — chi tiết design §10.0)

| Gate | Provider P0 | Output entity |
|------|-------------|---------------|
| G0 | Claude Sonnet | RQ suggestions (user confirm) |
| G3 desk | Tavily | Source candidates |
| G3 deep | OpenAI Deep Research *or* Gemini | Source candidates + outline |
| G4 | Regex PII; optional mini | Flag pii_class |
| G6 | Claude Sonnet grounded | Insight draft |
| G7 | Claude Sonnet | Report snapshot draft |
| G8 | Perplexity optional P1 | Review comments |

`RESEARCH_DEEP_PROVIDER=off` → ẩn nút Deep Research, desk vẫn chạy.

---

## Phụ lục E. Tài liệu liên quan

| Tài liệu | Vai trò |
|----------|---------|
| Design MKT-RES-OS-SPEC-20260814 | Parent nghiệp vụ |
| `giai_phap_ai_nghien_cuu_marketing_ptt.md` | Stack AI + 6 entity gốc |
| `he-thong-bao-cao-nghien-cuu-thi-truong.pplx.md` | Evidence/ISO/ESOMAR |
| SPC DV12 | Gói CB/TC/CS |
| `ops-dv01-dv21-route-map.json` | Gap tracker |
| SRS PTT Ops v1.0 | Hình thức 8 phần |
| LMP `collect.py` / `lmp_llm_client` | Pattern job AI |
| UX/UI MKT-RES-OS-UIUX-20260814 | Màn hình, wireframe, component |
| BA RES-UC 001…042 | Use case + Actions UAT |

---

*Hết SRS v1.0. Implementation plan P0: [`../superpowers/plans/2026-08-14-market-research-os-p0.md`](../superpowers/plans/2026-08-14-market-research-os-p0.md) — chưa viết code cho đến khi được yêu cầu.*
