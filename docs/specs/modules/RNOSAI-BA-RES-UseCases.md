# RNOSAI BA — Market Research OS Use Cases (MarketResearchModule)

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-RES-UC |
| Phiên bản | 1.0 |
| Ngày xuất | 2026-08-14 |
| Module | MOD-MARKET-RESEARCH |
| Nest module | `MarketResearchModule` |
| Số UC | 38 (RES-UC-001…020 P0 · 021…027 P1 · 030…033 P2 · 040…042 P3 · 050…051 P4 · 060…061 P5) |
| Spec thủ công | 38/38 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Design spec | [`../superpowers/specs/2026-08-14-market-research-os-design.md`](../../superpowers/specs/2026-08-14-market-research-os-design.md) |
| SRS | [`../2026-08-14-market-research-os-srs.md`](../2026-08-14-market-research-os-srs.md) |
| UX/UI | [`../2026-08-14-market-research-os-ui-ux.md`](../2026-08-14-market-research-os-ui-ux.md) |
| Catalog | [`../../use-cases/12-MARKET-RESEARCH-OS.md`](../../use-cases/12-MARKET-RESEARCH-OS.md) |
| Actions | [`../../use-cases/actions/12-RES-ACTIONS.md`](../../use-cases/actions/12-RES-ACTIONS.md) |
| Catalog DV | DV12 `phan-tich-thi-truong` |

---

## 1. Tóm tắt module

**Market Research OS** vận hành insight có truy vết cho deliverable DV12:

**Decision → Research Question → Source → Evidence → Insight (duyệt) → Report Version → Activation.**

AI = copilot (Tavily desk, Deep Research nguồn nháp, Claude soạn). Không auto-publish. Không trộn `/crm/sales?tab=market` (NCTT BĐS).

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Phase | UC |
| --- | --- | --- | --- | --- |
| SCR-RES-001 | Project list | `/crm/research` | P0 | 001, 010, 013 |
| SCR-RES-002 | Wizard G0 | `/crm/research/new` | P0 | 002 |
| SCR-RES-003 | Workspace | `/crm/research/[id]` | P0 | 015 |
| SCR-RES-003a | Brief | `?tab=brief` | P0 | 003 |
| SCR-RES-003b | Sources | `?tab=sources` | P0 | 004, 005, 014, 019, 061, 084 |
| SCR-RES-003c | Evidence | `?tab=evidence` | P0 | 006, 017 |
| SCR-RES-003d | Insights | `?tab=insights` | P0 | 007, 008, 011, 018 |
| SCR-RES-003e | Report | `?tab=report` | P0 | 009, 012 |
| SCR-RES-003f | Activity | `?tab=activity` | P0 | 016, 020 |
| SCR-RES-004 | Insight drawer | `?insight=` | P0 | 007, 008 |
| SCR-RES-005 | Report preview | `/report/[versionId]` | P0 | 009 |
| SCR-RES-006 | Gate dialog | modal | P0 | 008 |
| SCR-RES-007 | Job chip | panel | P0 | 004, 005, 020 |
| SCR-RES-008 | Deep Research modal | modal | P0 | 005 |
| SCR-RES-009 | Evidence form | drawer | P0 | 006 |
| SCR-RES-010 | Flag-off | — | P0 | 013 |
| SCR-RES-020 | Competitors | `?tab=competitors` | P1 | 022 |
| SCR-RES-021 | Insert → plan | `/crm/marketing-plan/[id]` | P1 | 023 |
| SCR-RES-022 | Confidence rubric | drawer | P1 | 021 |
| SCR-RES-030 | Studies | `?tab=studies` | P2 | 030, 060 |
| SCR-RES-031 | Ops KPI | `/crm/research/analytics` | P2 | 033 |
| SCR-RES-040 | Portal report | portal | P3 | 040 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Phase | Status | FR / Story |
| --- | --- | --- | --- | --- | --- |
| RES-UC-001 | Nav Lên kế hoạch + list project | P0 | P0 | Spec ready | FR-NAV-01 · US-NAV-01 |
| RES-UC-002 | Wizard tạo project G0 | P0 | P0 | Spec ready | FR-PRJ-01 · US-AM-01 |
| RES-UC-003 | CRUD Research Questions | P0 | P0 | Spec ready | FR-PRJ-04 · US-AM-02 |
| RES-UC-004 | Chạy Desk Tavily | P0 | P0 | Spec ready | FR-SRC-02 · US-AN-01 |
| RES-UC-005 | Chạy Deep Research | P0 | P0 | Spec ready | FR-SRC-03 · US-AN-02 |
| RES-UC-006 | Verify source / tạo evidence | P0 | P0 | Spec ready | FR-EVD-01 · US-AN-03 |
| RES-UC-007 | Soạn insight + gắn evidence | P0 | P0 | Spec ready | FR-INS-01 · US-AN-04 |
| RES-UC-008 | Lead duyệt insight | P0 | P0 | Spec ready | FR-REV-02 · US-LD-01 |
| RES-UC-009 | Sinh report + xuất DOCX | P0 | P0 | Spec ready | FR-RPT-01 · US-AN-05 |
| RES-UC-010 | Client tenancy | P0 | P0 | Spec ready | FR-RBAC-03 · US-SEC-01 |
| RES-UC-011 | Copilot insight từ evidence | P0 | P0 | Spec ready | FR-AI-03 |
| RES-UC-012 | Copilot report draft | P0 | P0 | Spec ready | FR-AI-04 |
| RES-UC-013 | Feature flag ẩn module | P0 | P0 | Spec ready | FR-NAV-04 |
| RES-UC-014 | Keep / reject source | P0 | P0 | Spec ready | FR-SRC-04 |
| RES-UC-015 | Chuyển trạng thái project | P0 | P0 | Spec ready | FR-PRJ-03 |
| RES-UC-016 | Xem nhật ký Activity / AI runs | P0 | P0 | Spec ready | FR-AI-05 |
| RES-UC-017 | Evidence immutable / supersede | P0 | P0 | Spec ready | FR-EVD-02 · FR-EVD-05 |
| RES-UC-018 | AM duyệt bản khách | P0 | P0 | Spec ready | FR-REV-03 |
| RES-UC-019 | Thêm nguồn thủ công | P0 | P0 | Spec ready | FR-SRC-01 |
| RES-UC-020 | Poll / retry job AI | P0 | P0 | Spec ready | FR-AI-01 |
| RES-UC-021 | Confidence rubric 5 chiều | P1 | P1 | Spec ready | FR-INS-04 · US-AN-10 |
| RES-UC-022 | Competitor + snapshot | P1 | P1 | Spec ready | FR-CI-01 · US-AN-11 |
| RES-UC-023 | Chèn insight vào marketing-plan | P1 | P1 | Spec ready | FR-INT-01 · US-AM-10 |
| RES-UC-024 | Methodology appendix bắt buộc TC/CS | P1 | P1 | Spec ready | FR-RPT-08 · US-LD-10 |
| RES-UC-025 | Tạo project từ service-delivery DV12 | P1 | P1 | Spec ready | FR-PRJ-07 · US-AM-03 |
| RES-UC-026 | Dual-provider triangulation | P1 | P1 | Spec ready | FR-SRC-05 |
| RES-UC-027 | Prefill từ consult/intake | P1 | P1 | Spec ready | FR-PRJ-06 |
| RES-UC-030 | Study survey/IDI + consent | P2 | P2 | Spec ready | FR-STD-01 · US-AN-20 |
| RES-UC-031 | Research Agent pulse | P2 | P2 | Spec ready | FR-CI-04 · US-OPS-20 |
| RES-UC-032 | Exec summary song ngữ | P2 | P2 | Spec ready | FR-RPT-07 |
| RES-UC-033 | Ops KPI analytics | P2 | P2 | Spec ready | FR-INT-03 |
| RES-UC-040 | Portal khách đọc report | P3 | P3 | Spec ready | FR-INT-04 · US-CL-30 |
| RES-UC-041 | Waves tracker | P3 | P3 | Spec ready | FR-PRJ-08 |
| RES-UC-042 | Decision log | P3 | P3 | Spec ready | — |
| RES-UC-050 | Xuất PDF staff + portal | P4 | P4 | Spec ready | FR-RPT-04 · US-CL-30 |
| RES-UC-051 | Cite insight Content OS | P4 | P4 | Spec ready | FR-INT-02 |
| RES-UC-060 | Whisper audio → excerpt + locator | P5 | P5 | Spec ready | FR-STD-02 · FR-STD-03 · NFR-PRI-01/02 |
| RES-UC-061 | SparkToro source candidates | P5 | P5 | Spec ready | FR-CI · BR-RES-09 · BR-RES-11 |
| RES-UC-062 | Import survey codebook CSV | P6 | P6 | Spec ready | FR-STD-01 · BR-RES-02 · BR-RES-11 |
| RES-UC-063 | Van Westendorp lite PRICE_OFFER | P6 | P6 | Spec ready | BR-RES-03 · FR-STD |
| RES-UC-070 | Tìm insight đã duyệt (RAG) | P7 | P7 | Spec ready | FR-INT · BR-RES-06/08/12 · NFR-AI-04 |
| RES-UC-071 | Taxonomy theme + gắn insight | P7 | P7 | Spec ready | BR-RES-06 · UC-071 |
| RES-UC-072 | Inject RAG vào insight copilot | P8 | P8 | Spec ready | FR-AI-03 · BR-RES-06 · UC-011 |
| RES-UC-073 | Portal tìm insight published (RAG) | P12 | P12 | Spec ready | FR-INT-04 · BR-RES-06/08/12 |
| RES-UC-074 | RAG re-embed backfill (OpenAI 256-d) | P13 | P13 | Spec ready | FR-INT · BR-RES-06/11 · NFR-AI-04 |
| RES-UC-075 | Cluster theme theo quý (analytics) | P14 | P14 | Spec ready | FR-INT · BR-RES-06 · UC-071 |
| RES-UC-076 | Portal theme theo quý (analytics) | P15 | P15 | Spec ready | FR-INT-04 · BR-RES-06 · UC-073 |
| RES-UC-077 | Theme QoQ / YoY delta (staff analytics) | P16 | P16 | Spec ready | FR-INT · BR-RES-06 · UC-075 |
| RES-UC-078 | Theme QoQ / YoY delta (portal analytics) | P17 | P17 | Spec ready | FR-INT-04 · BR-RES-06 · UC-076 |
| RES-UC-079 | Insight stale banner (`valid_to`) | P18 | P18 | Spec ready | FR-INS-07 |
| RES-UC-080 | Portal insight stale banner (RAG) | P19 | P19 | Spec ready | FR-INS-07 · UC-079 |
| RES-UC-081 | pgvector dual-write + gated ANN | P20 | P20 | Spec ready | FR-INT · NFR-AI-04 |
| RES-UC-082 | Conjoint lite PRICE_OFFER | P21 | P21 | Spec ready | BR-RES-03 · Design PRICE_OFFER |
| RES-UC-083 | Staff insight stale banner (RAG) | P22 | P22 | Spec ready | FR-INS-07 · UC-079 |
| RES-UC-084 | Talkwalker source candidates (stub) | P23 | P23 | Spec ready | FR-SRC · BR-RES-04/06/08/09/11 |
| RES-UC-085 | Portal report-detail stale banner | P24 | P24 | Spec ready | FR-INS-07 · UC-080 |
| RES-UC-086 | Portal RAG filter «Chỉ hết hạn» | P25 | P25 | Spec ready | FR-INS-07 · UC-079 · UC-080 |
| RES-UC-087 | pgvector prod readiness (VPS extension + health) | P26 | P26 | Spec ready | FR-INT · NFR-AI-04 · UC-081 |
| RES-UC-088 | RAG default excludes stale hits | P27 | P27 | Spec ready | FR-INS-07 · UC-079 · UC-086 |
| RES-UC-090 | pgvector ANN staging gate (flag ∧ ready) | P28 | P28 | Spec ready | FR-INT · NFR-AI-04 · UC-081 · UC-087 |
| RES-UC-089 | PDF export stale footer (staff + portal) | P29 | P29 | Spec ready | FR-INS-07 · UC-079 · UC-085 |
| RES-UC-091 | Staff RAG filter «Chỉ hết hạn» | P30 | P30 | Spec ready | FR-INS-07 · UC-086 · UC-088 |
| RES-UC-092 | Staff DOCX export stale footer | P31 | P31 | Spec ready | FR-INS-07 · UC-089 |
| RES-UC-093 | Bake published_valid_to at portal publish | P32 | P32 | Spec ready | FR-INS-07 · UC-085 · UC-089 |
| RES-UC-094 | Portal + staff show published_valid_to | P33 | P33 | Spec ready | FR-INS-07 · UC-093 |
| RES-UC-095 | Conjoint what-if lite (staff) | P34 | P34 | Spec ready | BR-RES-03 · UC-082 |
| RES-UC-096 | Portal conjoint lite (read-only) | P35 | P35 | Spec ready | BR-RES-03 · UC-082 · UC-095 |
| RES-UC-097 | IVFFlat index fail-soft on embedding_vec | P36 | P36 | Spec ready | FR-INT · UC-081 · UC-087 |
| RES-UC-098 | Live Talkwalker Search API (staging) | P36 | P36 | Spec ready | FR-SRC · UC-084 |
| RES-UC-099 | ISO 20252 gap-check read-only (staff) | P37 | P37 | Spec ready | FR-GOV · Design §6 |
| RES-UC-100 | Persist conjoint what-if history (staff) | P38 | P38 | Spec ready | RES-UC-095 · UC-082 |
| RES-UC-101 | RAG re-embed backfill staging playbook | P39 | P39 | Spec ready | RES-UC-013 · UC-081 · UC-087 · UC-090 |
| RES-UC-102 | Staff ops-web RAG re-embed panel | P40 | P40 | Spec ready | RES-UC-101 · RES-UC-013 |
| RES-UC-103 | Portal report list stale badge | P41 | P41 | Spec ready | RES-UC-085 · FR-INS-07 |
| RES-UC-104 | Staff report version live stale rows | P42 | P42 | Spec ready | RES-UC-085 · RES-UC-094 |
| RES-UC-105 | Staff report version list stale badge | P43 | P43 | Spec ready | RES-UC-103 · RES-UC-104 |
| RES-UC-106 | Staff reports API has_stale_insights | P44 | P44 | Spec ready | RES-UC-104 · RES-UC-105 |
| RES-UC-107 | Staff report version stale filter | P45 | P45 | Spec ready | RES-UC-105 · RES-UC-106 |
| RES-UC-108 | Portal report list stale filter | P46 | P46 | Spec ready | RES-UC-103 · RES-UC-107 |
| RES-UC-109 | Portal reports API stale_only filter | P47 | P47 | Spec ready | RES-UC-108 · RES-UC-103 |

---

## 2. Chi tiết Use Case — P0

### RES-UC-001 — Nav Lên kế hoạch + list project

> 🟢 Spec thủ công · Critical path nav

- **Mã use case:** RES-UC-001
- **Tên use case:** Mở nhóm sidebar Lên kế hoạch và danh sách Research Project
- **Màn hình:** SCR-RES-001 · OpsNav
- **Actor chính:** AM, Analyst, Lead (có `crm_research.view`)
- **Actor phụ:** Staff `crm_board.view` (thấy nhóm vì Marketing plan)
- **Mục tiêu:** Tách PLAN khỏi EXECUTE; vào queue project đúng client
- **Trigger:** Đăng nhập ops-web; click «Nghiên cứu thị trường»
- **Pre-condition:** `NEXT_PUBLIC_MARKET_RESEARCH=1`; JWT hợp lệ
- **Post-condition:** List filter theo staff client scope; marketing-plan không còn trong «Triển khai dịch vụ»
- **Ưu tiên:** P0
- **Trace ref:** EC-RES-01, EC-RES-07, US-NAV-01
- **API:** `GET /api/v1/research/projects`

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | OpsNav render nhóm **Lên kế hoạch** sau «Bán hàng & Hợp đồng» |
| 2 | Link Research + Marketing plan; nhóm Triển khai không chứa marketing-plan |
| 3 | User mở `/crm/research` |
| 4 | API list `client_id IN scope`; table Client, Title, Type, Status, Sẵn sàng, Owner, Updated |
| 5 | User filter client/status/type/q (query string persist) |
| 6 | Click row → `/crm/research/:id?tab=brief` |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Flag off → ẩn Research (RES-UC-013) |
| E2 | Không `crm_research.view` → ẩn link Research; plan vẫn hiện nếu board |
| E3 | Empty list → empty state + CTA Tạo project |
| E4 | `/crm/sales?tab=market` không đổi (EC-RES-07) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | query: client_id, status, product_type, q, page |
| Output | `{ projects[], total }` — không leak project ngoài scope |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-RES-12 | Cross-tenant không trả title |
| FR-NAV-05 | Không merge UI Sales Market BĐS |

---

### RES-UC-002 — Wizard tạo project G0

- **Mã use case:** RES-UC-002
- **Tên use case:** Tạo Research Project (wizard 5 bước)
- **Màn hình:** SCR-RES-002
- **Actor chính:** AM (`crm_research.create`)
- **Actor phụ:** Analyst
- **Mục tiêu:** Ghi brief đúng câu hỏi kinh doanh, không “làm báo cáo ngành”
- **Trigger:** CTA **Tạo project**
- **Pre-condition:** Cap create; client trong scope
- **Post-condition:** Project `status=intake`; ≥1 RQ; audit `created_by`
- **Ưu tiên:** P0
- **Trace ref:** EC-RES-02, US-AM-01, US-AM-02, G0
- **API:** `POST /api/v1/research/projects`

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Bước 1: chọn `client_id`, title (≥8), `dv12_tier` CB/TC/CS |
| 2 | Bước 2: chọn 1 `product_type` (10 cards) |
| 3 | Bước 3: `decision_statement` ≥20 ký tự |
| 4 | Bước 4: geo[] (default VN), languages[] (vi), risk_class |
| 5 | Bước 5: ≥1 `question_vi`; sort_order |
| 6 | Submit 201 → redirect workspace Brief |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu client / type / decision <20 / 0 RQ → 400 `validation_error` inline |
| E2 | Client ngoài scope → không hiện trong combobox |
| E3 | Hủy → list, không tạo nháp server (P0 không autosave wizard) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, title, product_type, dv12_tier, decision_statement, geo, languages, risk_class, questions[] |
| Output | project { id, status: intake } |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-RES-01a | `designed` cần ≥1 RQ (wizard P0 đã bắt ≥1) |

---

### RES-UC-003 — CRUD Research Questions

- **Màn hình:** SCR-RES-003a
- **Actor chính:** AM, Analyst (`edit`)
- **Trigger:** Tab Brief — thêm/sửa/xóa/sắp xếp RQ
- **API:** `POST /projects/:id/questions` · `PATCH/DELETE /questions/:id`
- **Post-condition:** RQ cập nhật; xóa cấm nếu đã có evidence

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở Brief; bảng RQ |
| 2 | Thêm dòng `question_vi` |
| 3 | Sửa / kéo sort_order |
| 4 | Xóa RQ chưa có evidence |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | DELETE khi có evidence → 409; tooltip «Đã có evidence — không xóa» |
| E2 | Project `approved`/`distributed` → RQ read-only (sửa = Lead huỷ/version — P0 khóa edit RQ) |

---

### RES-UC-004 — Chạy Desk Tavily

- **Màn hình:** SCR-RES-003b, SCR-RES-007
- **Actor chính:** Analyst (`run`)
- **Mục tiêu:** Source candidates có URL, `ai_generated=true`
- **API:** `POST /projects/:id/run-desk` · poll `GET /projects/:id/jobs/:runId`
- **Worker:** `research_desk_collect`
- **Trace ref:** EC-RES-03, US-AN-01, BR-RES-10, BR-RES-11

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn RQ trên tab Sources |
| 2 | Bấm **Chạy Desk Tavily** |
| 3 | 202 `run_id`; chip pending; credit +1… tới cap 12 |
| 4 | Worker Tavily search+extract; prompt không chứa PII lead |
| 5 | Complete: insert `crm_research_sources` nháp; Activity log |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu `TAVILY_API_KEY` → run `failed` `tavily_unconfigured`; banner vàng; project không crash |
| E2 | Job cùng question `pending\|running` → 409 `job_in_flight` |
| E3 | Hết credit → 400; UI «Đã dùng 12/12 Tavily» |
| E4 | Timeout/network → failed + Retry (RES-UC-020) |

---

### RES-UC-005 — Chạy Deep Research

- **Màn hình:** SCR-RES-008, SCR-RES-007
- **Actor chính:** Analyst (`run`)
- **Mục tiêu:** Outline + source nháp; **không** tạo Insight published
- **API:** `POST /projects/:id/run-deep`
- **Worker:** `research_deep_research`
- **Trace ref:** EC-RES-09, US-AN-02, BR-RES-06, BR-RES-08

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Bấm **Chạy Deep Research** → modal cảnh báo nguồn nháp |
| 2 | Chọn RQ; xác nhận |
| 3 | Job timeout `RESEARCH_DEEP_TIMEOUT_SEC` (900) |
| 4 | Output sources `ai_generated=true` + outline trong `output_json` |
| 5 | UI: bảng nguồn; **không** card insight mới |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | `RESEARCH_DEEP_PROVIDER=off` → nút ẩn |
| E2 | Timeout → `failed`; không treo worker |
| E3 | Provider error → failed graceful |

---

### RES-UC-006 — Verify source / tạo evidence

- **Màn hình:** SCR-RES-003c, SCR-RES-009
- **Actor chính:** Analyst (`edit`)
- **API:** `POST /projects/:id/evidence` · `POST /evidence/:id/verify`
- **Trace ref:** US-AN-03, BR-RES-02

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Từ source keep=true, **Tạo evidence** |
| 2 | Nhập locator bắt buộc; excerpt **hoặc** value+unit+base; period; geo; pii_class |
| 3 | Lưu `qc_status=pending` |
| 4 | **Verify** → checksum; `verified`; lock nội dung |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu locator → 400 |
| E2 | Claim số thiếu unit/base/period/geo → 400 BR-RES-02 |
| E3 | Regex gợi ý PII trong excerpt → confirm `pii_class` |

---

### RES-UC-007 — Soạn insight + gắn evidence

- **Màn hình:** SCR-RES-003d, SCR-RES-004
- **Actor chính:** Analyst
- **API:** `POST /projects/:id/insights` · `POST /insights/:id/attach-evidence` · `POST /insights/:id/submit-review`
- **Trace ref:** US-AN-04, BR-RES-01, FR-INS-05

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tạo insight: statement + observation/interpretation/implication/recommendation |
| 2 | Gắn ≥1 evidence `verified` |
| 3 | Status `evidence_attached` → `analyst_verified` khi submit |
| 4 | `confidence_rationale` bắt buộc trước submit-review |
| 5 | `ai_generated` nếu từ copilot (RES-UC-011) |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Submit 0 evidence → 400 `insight_gate`; dialog |
| E2 | Chỉ gắn evidence `pending` → không tính verified |

---

### RES-UC-008 — Lead duyệt insight

- **Màn hình:** SCR-RES-004, SCR-RES-006
- **Actor chính:** Research Lead (`approve`)
- **API:** `POST /insights/:id/approve`
- **Trace ref:** EC-RES-04, EC-RES-11, US-LD-01, BR-RES-07

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Lead mở insight `analyst_verified` / `peer_reviewed` |
| 2 | Review evidence chips + rationale |
| 3 | Duyệt `approved_internal` + comments |
| 4 | Ghi `crm_research_reviews` + artifact_hash |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Gate fail → dialog messages[] |
| E2 | `reviewer == created_by` → 403 `cannot_self_approve` |
| E3 | Reject → status `rejected` + comments bắt buộc |
| E4 | `risk_class=low` cho phép skip peer (SRS 4.3) |

---

### RES-UC-009 — Sinh report + xuất DOCX

- **Màn hình:** SCR-RES-003e, SCR-RES-005
- **Actor chính:** Analyst (`edit` generate) · AM/Lead (`export`)
- **API:** `POST /projects/:id/reports` · `GET /reports/:id/versions/:versionId/export`
- **Trace ref:** EC-RES-05, US-AN-05, BR-RES-05

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn insight ≥ `approved_internal` |
| 2 | Tạo version: snapshot cover, exec, findings[], recs[], methodology stub, evidence_index |
| 3 | Preview HTML |
| 4 | Xuất DOCX; hash version; audit export |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 insight đủ status → CTA disabled + title |
| E2 | Sửa sau approve → version++ không overwrite |
| E3 | Thiếu cap export → ẩn nút Xuất |

---

### RES-UC-010 — Client tenancy

- **Actor chính:** System + mọi staff
- **Trigger:** Mọi GET/PATCH research
- **Trace ref:** EC-RES-06, BR-RES-12

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Guard: `client_id` project ∈ staff client scope |
| 2 | List tự filter |
| 3 | GET id ngoài scope → **403** body không có title |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Internal worker key: chỉ job của project đã enqueue |

---

### RES-UC-011 — Copilot insight từ evidence

- **Actor chính:** Analyst (`run`)
- **API / job:** `research_insight_draft`
- **Trace ref:** FR-AI-03, NFR-AI-03, BR-RES-06

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn evidence_ids verified |
| 2 | **Gợi ý insight (Claude)** |
| 3 | Prompt **chỉ** excerpt/value các ID đó — không web thêm |
| 4 | Tạo insight `draft` `ai_generated=true` |
| 5 | Analyst sửa rồi RES-UC-007 |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 evidence → nút disabled |
| E2 | LLM fail → failed run; không insight rỗng |

---

### RES-UC-012 — Copilot report draft

- **Job:** `research_report_draft`
- **Input:** insight_ids `approved_internal+`
- **Output:** `content_snapshot` draft; Analyst/AM edit trước RES-UC-009
- **Cấm:** Deep Research ghi report

---

### RES-UC-013 — Feature flag ẩn module

- **Màn hình:** SCR-RES-010
- **Trigger:** `PTT_MARKET_RESEARCH_ENABLED=0` hoặc FE flag 0
- **Hành vi:** Nav ẩn; API 404 `market_research_disabled`; deep link empty VI
- **Trace ref:** EC-RES-08, NFR-OPS-01

---

### RES-UC-014 — Keep / reject source

- **API:** `PATCH /sources/:id` `{ keep: true\|false }`
- **Luồng:** Analyst tick Keep trên nguồn AI/thủ công; reject ẩn khỏi default filter (filter «Đã bỏ»)
- **Không** xóa row (audit)

---

### RES-UC-015 — Chuyển trạng thái project

- **API:** `PATCH /projects/:id` `{ status, note }`
- **Happy P0:** intake→designed (≥1 RQ)→collecting→synthesizing (≥1 insight analyst_verified+)→drafting→in_review→approved (Lead)→distributed
- **Mọi lúc:** `cancelled` (AM/Lead)
- **E1:** `invalid_transition` 409 + lý do UI
- **Cấm** lùi `approved` — chỉ version report mới

---

### RES-UC-016 — Nhật ký Activity / AI runs

- **Màn hình:** SCR-RES-003f
- **GET workspace** gồm reviews + `crm_research_ai_runs`
- **Hiển thị:** provider, model, prompt_version, credits, status, error
- **Trace ref:** EC-RES-12, NFR-SEC-04 (redact PII trong output log)

---

### RES-UC-017 — Evidence immutable / supersede

- **Trace ref:** EC-RES-10, FR-EVD-02
- **PATCH** excerpt/value/locator/source_id khi `verified` → 409 `evidence_immutable`
- **Supersede:** tạo evidence mới; old `qc_status=superseded`, `superseded_by=new_id`
- **Insight** gắn evidence cũ: banner stale; Analyst gắn ID mới trước duyệt lại

---

### RES-UC-018 — AM duyệt bản khách

- **API:** approve `target_status=approved_client_facing`
- **Pre:** `approved_internal`
- **Actor:** AM (wording) hoặc Lead
- **SoD:** AM không duyệt method nếu là creator phân tích — Lead đã duyệt internal
- **Post:** insight đủ điều kiện vào report khách

---

### RES-UC-019 — Thêm nguồn thủ công

- **API:** `POST /projects/:id/sources`
- **Fields:** type, title, publisher, url, published_at, accessed_at, geo, license, reliability_tier, question_id
- **`ai_generated=false`**
- **URL Ad Library** → `source_type=ad_creative` (P0 cho phép tay)

---

### RES-UC-020 — Poll / retry job AI

- **Poll:** 2s → 5s backoff; max Deep 15 phút
- **Retry:** POST cùng question khi status failed; idempotency key mới nếu input đổi
- **Rời trang:** job tiếp tục; chip hiện lại khi vào Sources/Activity
- **NFR-AI-01:** fail không fail project

---

## 3. Chi tiết Use Case — P1

### RES-UC-021 — Confidence rubric 5 chiều

- **Màn hình:** SCR-RES-022
- **Thay** textarea-only: UI 5 slider (sample / source quality / recency / triangulation / bias)
- **Lưu** `confidence_json`; rationale vẫn bắt buộc
- **BR-RES-03:** UI không hiện chữ “95% confidence” trừ method thống kê

### RES-UC-022 — Competitor + snapshot

- **Màn hình:** SCR-RES-020
- **CRUD** competitor + aliases; snapshot fact JSON **whitelist** + `source_id` bắt buộc
- **Hypothesis** đánh dấu khác fact
- **BR-RES-09:** Similarweb/Semrush `reliability_tier≤medium` + limitation note

### RES-UC-023 — Chèn insight vào marketing-plan

- **Màn hình:** SCR-RES-021
- **Chỉ** insert `insight_id` (không copy text)
- **Cùng** `client_id`; insight `approved_client_facing` hoặc `approved_internal` (chốt P1: internal+ cho plan nội bộ)
- **Plan không** edit insight gốc

### RES-UC-024 — Methodology appendix bắt buộc TC/CS

- **Export** TC/CS blocked nếu methodology snapshot thiếu population/source plan/limitation
- **CB P0** stub đủ EC-RES-05; P1 siết TC/CS

### RES-UC-025 — Tạo từ service-delivery DV12

- **CTA** trên lifecycle slug `phan-tich-thi-truong`
- **Prefill** client_id, lifecycle_id, title
- **US-AM-03**

### RES-UC-026 — Dual-provider triangulation

- **Chạy** 2 Deep provider trên RQ trọng
- **Keep** URL xuất hiện ≥1 lần **hoặc** Lead accept single-source cap Medium

### RES-UC-027 — Prefill consult/intake

- **Wizard** bước 1: nếu client có consult — industry, competitors gợi ý RQ
- **User confirm** từng dòng

---

## 4. Chi tiết Use Case — P2–P5

### RES-UC-030 — Study survey/IDI + consent

- Study: method, n, field_dates, mode, instrument_version
- Evidence `study_id` + transcript locator
- Consent record tách PII; retention 24 tháng
- P0 **không** lưu transcript thô

### RES-UC-031 — Research Agent pulse

- Cron watchlist competitor/trend
- Alert Ops; **không** auto insight published

### RES-UC-032 — Exec summary song ngữ

- Block EN trên report; Lead duyệt bản dịch LLM

### RES-UC-033 — Ops KPI analytics

- `GET /analytics/ops`: cycle time, evidence completeness, activation
- Màn SCR-RES-031

### RES-UC-040 — Portal khách đọc report

- RLS client; watermark; expiry; read-only
- **Cấm** auto-publish chưa duyệt

### RES-UC-041 — Waves tracker

- Project `TRACKER` + wave dates; compare snapshot

### RES-UC-042 — Decision log

- G9: action owner sau readout; link insight_id

### RES-UC-050 — Xuất PDF staff + portal

- Staff `GET …/export?format=pdf` → `%PDF-`; default/docx vẫn DOCX
- Portal `GET …/reports/:versionId/export.pdf` watermark; Beta 403 không title

### RES-UC-051 — Cite insight Content OS

- `POST /content-items/:itemId/insights` freeze `insight_ids`; không copy statement
- PATCH brief strip inbound `market_research`; giữ cite cũ

### RES-UC-060 — Whisper audio → excerpt + locator

- `POST /api/v1/research/projects/:id/studies/:studyId/whisper` multipart `file`; cap `run`
- Consent còn hạn bắt buộc; thiếu / hết hạn → 400 `consent_required` / `consent_expired`
- Evidence `excerpt` ≤ 500 + locator `T-mm:ss`; excerpt > 500 → 400 `raw_transcript_forbidden`
- Không persist transcript thô / `audio_uri`; complete payload = `excerpt_ids` only
- MIME `audio/mpeg|audio/wav|audio/mp4|audio/x-m4a`; ≤ 25 MB; xóa file tạm trong `finally`

### RES-UC-061 — SparkToro source candidates

- `POST /api/v1/research/projects/:id/run-sparktoro` body `{ question_id }`; cap `run`
- Query = `question_vi` + geo only (BR-RES-11); PII → 400
- Sources `publisher=SparkToro`, `reliability_tier` ∈ {low, medium} + `limitation_note`; tier `high` → 400 `reliability_capped`
- Flag/key off → `200 {ok:true, note:sparktoro_disabled}`; `GET /health` `sparktoro_enabled` false → ẩn CTA
- Flag+key on (P9): HTTP live `POST /v3/describe/create` + `GET /v3/websites` → sources; ghi `credits_used` + `report_id` trên run
- **Cấm** `createInsight` / `createReport` / publish-portal từ job này

### RES-UC-062 — Import survey codebook CSV

- `POST /api/v1/research/projects/:id/import-survey` multipart `file` + `format=codebook|vw`; cap `edit`
- Codebook → study survey + evidence `value+unit+base` (+ period/geo); PII cell → 400 `survey_pii_forbidden` (0 evidence)
- Thiếu value/unit/base → 400 (BR-RES-02); ExpertReview = source note, không auto-insight
- Fixture: `scripts/fixtures/research-codebook.sample.csv` (2–4 hàng, không PII)
- **Cấm** `createInsight` / `createReport` / publish-portal / `xlsx`

### RES-UC-063 — Van Westendorp lite PRICE_OFFER

- `GET /api/v1/research/projects/:id/van-westendorp` cap `view` → `{ summary }`
- `POST /api/v1/research/projects/:id/van-westendorp` body `{ study_id? }` cap `edit`
- Không `PRICE_OFFER` → 400 `vw_not_price_offer`; n < 4 → 400 `vw_insufficient_n`
- Bảng too_cheap / cheap / expensive / too_expensive + `limitation_note`; không MOE / 95%
- Fixture VW: `scripts/fixtures/research-vw.sample.csv` (4 respondents)
- **Cấm** `createInsight` / market simulator / conjoint

### RES-UC-062/063 — Qualtrics stub (không live)

- `POST /api/v1/research/projects/:id/run-qualtrics` cap `run`
- Flag/key off (default) → `200 {ok:true, note:qualtrics_disabled}`; flag+key on vẫn stub (không enqueue, không HTTP Qualtrics)
- `GET /health` `qualtrics_enabled` = flag **và** key; không trả `QUALTRICS_API_KEY`
- FE: ẩn CTA trừ khi `shouldShowQualtricsButton(qualtrics_enabled, canRun)`

### RES-UC-070 — Tìm insight đã duyệt (RAG)

- `GET /api/v1/research/insights/search?q=&theme_code=&client_id=&limit=` cap `view`
- Flag off → `200 {hits:[], note:rag_disabled}`; ô tìm ẩn khi `shouldShowRagSearch` false
- Empty q → 400 `rag_query_required`; draft / chưa duyệt bản khách không hit
- PII skip embed (`shouldSkipRagEmbed`); approve vẫn 200
- Cross-tenant → 403 `{error:forbidden}` không `statement`
- Banner: `Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight.`
- **Cấm** `createInsight` / `createResearchInsight` từ search staff; portal search = **RES-UC-073**
- OpenAI embeddings **optional staging**: khi `rag_openai_embed_enabled=true` (flag `RESEARCH_RAG_OPENAI_EMBED_ENABLED` + `OPENAI_API_KEY`); default local-hash 64-d
- `GET /health` thêm `rag_openai_embed_enabled`, `rag_embed_model` (`openai` | `local`); không trả key
- Dim mismatch (hash 64 vs OpenAI 256) → skip row; re-approve để re-embed

### RES-UC-071 — Taxonomy theme + gắn insight

- `GET /api/v1/research/taxonomy` cap `view` → seed PRICE…GEO
- `POST /api/v1/research/taxonomy` · `PATCH /taxonomy/:id` cap `configure`; thiếu configure → 403
- `POST /insights/:id/themes` · `DELETE /insights/:id/themes/:taxonomyId` cap `edit`
- Attach trả insight **cùng** `statement` (không sửa nội dung)
- Trang `/crm/research/taxonomy` ẩn trừ `hasCap(configure)`; banner `Gắn theme — không sửa nội dung insight.`
- Search `theme_code` lọc code hoặc synonym (case-insensitive)
- **Cấm** `createInsight` trên path attach; không conjoint

### RES-UC-073 — Portal tìm insight published (RAG)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/insights/search?q=&theme_code=&limit=` · `GET /api/v1/portal/research/health`
- **Corpus:** chỉ `published` cùng `client_id` JWT — **không** `approved_client_facing`, **không** draft
- Flag off → `200 {hits:[], note:rag_disabled}`; ô tìm ẩn khi `rag_enabled=false`
- Empty q → 400 `rag_query_required`
- PII query + OpenAI live → `{hits:[], note:rag_skipped_pii}`; 0 HTTP vendor
- OpenAI query fail → `{hits:[], note:rag_embed_failed}`
- Cross-tenant → 0 hit; JSON **không** `statement` client khác
- Banner: `Chỉ insight đã published cùng khách. Không tìm draft. Không tạo insight.`
- **Cấm** `createInsight` / publish-portal từ search; **cấm** link staff CRM từ portal UI

### RES-UC-075 — Cluster theme theo quý (analytics)

- **Actor chính:** AM, Analyst, Lead (`crm_research.view`)
- **API:** `GET /api/v1/research/analytics/themes?client_id=&year=`
- **Corpus:** `approved_client_facing` \| `published` — **không** draft
- **Bucket:** quý theo `date_trunc('quarter', i.updated_at)`; đếm insight distinct theo `theme_code` từ `crm_research_insight_themes`
- **Tenancy:** filter JWT client scope; optional `client_id` (403 ngoài scope)
- **Màn hình:** `/crm/research/analytics` — bảng Q1–Q4; click theme → prefill RAG search (`RES-UC-070`) khi flag on
- Banner: `Chỉ insight đã duyệt bản khách / published. Đếm theo theme gắn trên insight, bucket theo quý (updated_at).`
- **Cấm** `createInsight`; không portal widget; không Talkwalker / conjoint / pgvector

### RES-UC-076 — Portal theme theo quý (analytics)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/analytics/themes?year=`
- **Corpus:** chỉ `published` cùng `client_id` JWT — **không** `approved_client_facing`, **không** draft
- **Bucket:** quý theo `date_trunc('quarter', i.updated_at)`; đếm insight distinct theo `theme_code`
- **Màn hình:** `/research` (portal-web) — bảng Q1–Q4; click theme → prefill portal RAG (`RES-UC-073`) khi flag on
- Banner: `Chỉ insight đã published cùng khách. Đếm theo theme gắn trên insight, bucket theo quý (updated_at).`
- **Cấm** `createInsight`; **cấm** link staff CRM; không Talkwalker / conjoint / pgvector

### RES-UC-077 — Theme QoQ / YoY delta (staff analytics)

- **Actor chính:** AM, Analyst, Lead (`crm_research.view`)
- **API:** `GET /api/v1/research/analytics/themes?client_id=&year=` — payload rows thêm `prev_qoq_count`, `prev_yoy_count`, `delta_qoq_pct`, `delta_yoy_pct`
- **QoQ:** quý trước trong cùng năm (Q1 → null)
- **YoY:** cùng quý năm `year-1`
- **Δ:** `null` khi prior count = 0 hoặc không có dữ liệu
- **Màn hình:** `/crm/research/analytics` — subtext Δ dưới mỗi ô quý
- **Cấm** endpoint mới; không portal; không Talkwalker / conjoint / pgvector

### RES-UC-078 — Theme QoQ / YoY delta (portal analytics)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/analytics/themes?year=` — payload rows thêm `prev_qoq_count`, `prev_yoy_count`, `delta_qoq_pct`, `delta_yoy_pct`
- **Corpus:** chỉ `published` cùng `client_id` JWT
- **QoQ:** quý trước trong cùng năm (Q1 → null)
- **YoY:** cùng quý năm `year-1`
- **Δ:** `null` khi prior count = 0 hoặc không có dữ liệu
- **Màn hình:** `/research` (portal-web) — subtext Δ dưới mỗi ô quý
- **Cấm** endpoint mới; không ops-web; không Talkwalker / conjoint / pgvector

### RES-UC-079 — Insight stale banner (`valid_to`)

- **Actor chính:** AM, Analyst, Lead (`crm_research.view` / edit insight)
- **API:** insight rows từ project workspace / patch / approve — thêm `is_stale: boolean`
- **Rule:** `is_stale = true` khi `valid_to` có giá trị và `valid_to < today` (UTC); `valid_to === today` → false
- **Màn hình:** tab Insight project — banner trên card + drawer; filter «Chỉ hết hạn»
- Banner: `Insight đã hết hạn (valid_to). Cập nhật hiệu lực trước khi dùng cho báo cáo / khách.`
- **Cấm** endpoint mới; không DDL; không portal; không Talkwalker / conjoint / pgvector

### RES-UC-080 — Portal insight stale banner (RAG search)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/insights/search` — mỗi hit thêm `valid_to`, `is_stale`
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/research` — banner dưới hit RAG stale
- Banner: `Insight này có thể đã lỗi thời (hết hiệu lực). Liên hệ account manager để được cập nhật.`
- **Cấm** endpoint mới; không DDL; không ops-web; không ẩn hit stale

### RES-UC-081 — pgvector dual-write + gated ANN

- **Actor chính:** Analyst / portal (cùng search hiện có)
- **API:** không endpoint mới — `GET …/insights/search` (staff + portal)
- **Flag:** `RESEARCH_RAG_PGVECTOR_ENABLED` default 0
- **DDL:** `vector` extension + `embedding_vec`; apply fail-soft nếu thiếu package
- **Off:** JSONB + `rankRagHits` như P19
- **On:** ANN prefilter same-dim → `rankRagHits`
- **Cấm** bật flag trên prod deploy; không cắt JSONB; không IVFFlat/HNSW; không Talkwalker / conjoint

### RES-UC-082 — Conjoint lite PRICE_OFFER

- `GET /api/v1/research/projects/:id/conjoint` cap `view` → `{ summary }`
- `POST /api/v1/research/projects/:id/conjoint` body `{ study_id? }` cap `edit`
- `POST …/import-survey` `format=conjoint` → evidence locator `C-{id}:task-{n}:{attr}`
- Không `PRICE_OFFER` → 400 `cj_not_price_offer`; n < 4 → `cj_insufficient_n`; n_choices < 4 → `cj_insufficient_choices`
- Bảng level share + recommendation; **cấm** MOE / simulator / `createInsight`
- Fixture: `scripts/fixtures/research-conjoint.sample.csv`

### RES-UC-083 — Staff insight stale banner (RAG search)

- **Actor chính:** AM, Analyst, Lead (`crm_research.view`)
- **API:** `GET /api/v1/research/insights/search` — mỗi hit thêm `valid_to`, `is_stale` (populated when staff `listEmbeddings` returns `valid_to`)
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/crm/research/analytics` + project analytics RAG — banner dưới hit stale
- Banner: reuse P18 staff copy (`INSIGHT_STALE_BANNER`)
- **Cấm** endpoint mới; không DDL; không portal; không ẩn hit stale

### RES-UC-084 — Talkwalker source candidates (stub bake-off)

- **Actor chính:** Analyst (`crm_research.run`)
- **API:** `POST /api/v1/research/projects/:id/run-talkwalker` body `{ question_id }`
- **Flag:** `RESEARCH_TALKWALKER_ENABLED` default 0; health `talkwalker_enabled` = flag **và** `TALKWALKER_ACCESS_TOKEN`
- Flag/token off → `200 {ok:true, note:talkwalker_disabled}`; 0 source; 0 HTTP
- Flag+token on → persist fixture sources `publisher=Talkwalker`, `source_type=social_public`, `note=talkwalker_stub`; **cấm** `createInsight`
- PII `question_vi` → 400
- **Màn hình:** Sources — **Chạy Talkwalker** ẩn khi health off
- Banner: `Nguồn social công khai (stub bake-off) — ghi limitation. Không tự tạo insight.`
- Scorecard: `docs/specs/2026-08-16-talkwalker-brandwatch-bakeoff-scorecard.md`
- **Cấm** live Talkwalker HTTP; **cấm** bật flag/token trên prod deploy; không portal; không Brandwatch connector

### RES-UC-085 — Portal report-detail stale banner

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/reports/:versionId` — mỗi finding/rec object thêm `valid_to`, `is_stale` từ insight **published** cùng khách (live, không đóng băng snapshot)
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/research/[versionId]` — banner dưới finding/rec stale
- Banner: reuse P19 `PORTAL_INSIGHT_STALE_BANNER`
- Insight thiếu / unpublished / khác tenant → `is_stale: false`
- **Cấm** endpoint mới; không DDL; không ops-web; không ẩn dòng; không đổi PDF / `content_snapshot`

### RES-UC-086 — Portal RAG filter «Chỉ hết hạn»

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/insights/search?q=` — query `stale_only=1` chỉ trả hit `is_stale=true` (published cùng khách, xếp hạng như P12)
- **Rule:** giống RES-UC-079 (UTC calendar); mặc định không lọc — vẫn hiện banner P19 trên hit stale
- **Màn hình:** `/research` — checkbox «Chỉ hết hạn (N)» dưới ô RAG (clone copy P18 staff Insight tab)
- `stale_only` off → hits bình thường + banner trên hit stale
- `stale_only` on → chỉ hit hết hạn; 0 hit → copy «Không có insight hết hạn khớp tìm kiếm.»
- **Cấm** endpoint mới; không DDL; không ops-web; không ẩn stale mặc định; không đổi ranking khi filter off

### RES-UC-087 — pgvector prod readiness (VPS extension + health)

- **Actor chính:** DevOps / QA
- **Mục tiêu:** Cài `postgresql-*-pgvector` trên VPS; P20 DDL apply thành công; health báo DB sẵn sàng
- **Script:** `scripts/install_pgvector_vps.sh`, `scripts/verify_pgvector_market_research.sh`
- **API:** `GET /api/v1/research/health` và `GET /api/v1/portal/research/health` — thêm `rag_pgvector_ready` (DB probe lúc boot)
- **Phân biệt:** `rag_pgvector_enabled` = env flag (vẫn `false` prod); `rag_pgvector_ready` = extension `vector` + cột `embedding_vec` tồn tại
- **Cấm** bật `RESEARCH_RAG_PGVECTOR_ENABLED` / RAG / OpenAI embed trên prod deploy; **cấm** IVFFlat/HNSW; **cấm** ops-web/portal-web UI

### RES-UC-088 — RAG default excludes stale hits

- **Actor chính:** Analyst (staff RAG/copilot), Client portal (RAG)
- **API:** cùng GET staff/portal insights/search + copilot inject — `rankRagHits` mặc định loại `is_stale=true` trước `limit`
- **Rule:** giống RES-UC-079 (UTC calendar); opt-in stale qua portal `stale_only=1` (UC-086) hoặc staff tab Insight «Chỉ hết hạn» (UC-079)
- **Copilot:** `rag_hits` không chứa insight stale
- **Cấm** endpoint mới; không DDL; không đổi report-detail/PDF; không `include_stale` query mới trong P27

### RES-UC-090 — pgvector ANN staging gate (flag ∧ ready)

- **Actor chính:** DevOps / QA / Analyst (staging UAT)
- **Mục tiêu:** ANN prefilter chỉ chạy khi `RESEARCH_RAG_PGVECTOR_ENABLED=1` **và** `rag_pgvector_ready=true`; dual-write `embedding_vec` cùng điều kiện
- **Fail-soft:** flag on + ready false → JSONB `listEmbeddings` (không query `<=>`)
- **Staging:** `deploy_market_research_p28_vps.sh --enable-pgvector-staging` (không bật RAG/OpenAI embed)
- **Tiền đề:** P26 `install_pgvector_vps.sh` + backfill `embedding_vec` (P13 re-embed hoặc re-approve)
- **Cấm** IVFFlat/HNSW; **cấm** prod pgvector flag trên deploy mặc định; **cấm** drop JSONB column

### RES-UC-089 — PDF export stale footer (staff + portal)

- **Actor chính:** AM, Analyst (staff export); Client portal (PDF download)
- **API:** cùng export PDF — staff `exportReportVersion format=pdf`; portal `exportReportPdf` — footer mọi trang khi ≥1 insight stale (live `valid_to`)
- **Rule:** giống RES-UC-079 (UTC calendar); portal unpublished/khác tenant → không coi stale (P24)
- **Staff lookup:** `listInsightValidToForProject(project_id, insight_ids)`; **Portal lookup:** `listPublishedInsightValidTo` (P24)
- **Copy:** `REPORT_PDF_STALE_FOOTER_STAFF` / `REPORT_PDF_STALE_FOOTER_PORTAL` — rút gọn từ banner P18/P19
- **Cấm** endpoint mới; không DDL; không mutate `content_snapshot`; không footer DOCX; không ops-web/portal-web UI

### RES-UC-091 — Staff RAG filter «Chỉ hết hạn»

- **Actor chính:** AM, Analyst, Lead (`crm_research.view`)
- **API:** `GET /api/v1/research/insights/search?q=` — query `stale_only=1` chỉ trả hit `is_stale=true` (cùng `rankRagHits` P25/P27)
- **Rule:** giống RES-UC-079 (UTC calendar); mặc định vẫn exclude stale (UC-088)
- **Màn hình:** `/crm/research/analytics` + project Insights RAG — checkbox «Chỉ hết hạn» (`data-testid=staff-rag-stale-only`)
- `stale_only` off → chỉ hit còn hiệu lực
- `stale_only` on → chỉ hit hết hạn + banner P22; 0 hit → «Không có insight hết hạn khớp tìm kiếm.»
- **Cấm** endpoint mới; không DDL; không portal; không copilot `stale_only`; không `include_stale`

### RES-UC-092 — Staff DOCX export stale footer

- **Actor chính:** AM, Analyst (staff export DOCX)
- **API:** cùng `exportReportVersion` (default/`format=docx`) — footer OOXML mọi trang khi ≥1 insight stale (live `valid_to`)
- **Rule:** giống RES-UC-079 / UC-089; lookup `listInsightValidToForProject` dùng chung với PDF
- **Copy:** reuse `REPORT_PDF_STALE_FOOTER_STAFF`
- **Cấm** endpoint mới; không DDL; không mutate `content_snapshot`; không portal DOCX; không ops-web UI

### RES-UC-093 — Bake `published_valid_to` at portal publish

- **Actor chính:** Lead (publish portal, không self-approve)
- **API:** cùng `publishPortal(visible=true)` — stamp `findings/recs[].published_valid_to` từ live `valid_to` rồi set visible
- **Rule:** unpublish không xóa bake; re-publish ghi đè theo `valid_to` lúc đó; id miss → `null`
- **Portal GET:** `is_stale` / `valid_to` **live** (P24); `published_valid_to` passthrough snapshot
- **Cấm** dùng bake cho footer/banner; không DDL; không UI mới; không đổi PDF/DOCX

### RES-UC-094 — Portal + staff show `published_valid_to`

- **Actor chính:** Client (portal report-detail), Lead/Analyst (staff report version)
- **UI:** note `Hiệu lực lúc gửi: YYYY-MM-DD` trên finding/rec khi snapshot có ngày bake
- **Rule:** thiếu / null / không phải ngày → không render; `is_stale` / `valid_to` **live** (P24); PDF/DOCX footer **không** dùng bake
- **Cấm** endpoint mới; không DDL; không đổi `publishPortal` / annotate; không IVFFlat / Talkwalker flags

### RES-UC-095 — Conjoint what-if lite (staff)

- **Actor chính:** Analyst / Lead (`crm_research.view`)
- **API:** `POST /api/v1/research/projects/:id/conjoint/what-if` body `{ study_id?, scenario }`
- **Rule:** chỉ `PRICE_OFFER`; đếm AND `n_match / n_choices` trên evidence `C-`; `statistical_inference: false`
- **Màn hình:** tab Conjoint — form what-if + `Khớp mẫu: n / N (p%)`
- **Cấm** persist; **cấm** `createInsight`; **cấm** MOE / logit / portal; không DDL; flags prod không đổi

### RES-UC-096 — Portal conjoint lite (read-only)

- **Actor chính:** Client (portal JWT)
- **API:** `GET /api/v1/portal/research/conjoint` → `{ summary }` latest `crm_research_cj_summaries` JOIN project `client_id` + `PRICE_OFFER`
- **Rule:** không summary → `{ summary: null }` (200); DTO không `created_by` / `title`; `statistical_inference: false`
- **Màn hình:** `/research` — bảng share + gợi ý gói; ẩn khối khi null
- **Cấm** POST compute / what-if; **cấm** `createInsight`; **cấm** MOE / logit; không DDL; không ops-web; flags prod không đổi

### RES-UC-097 — IVFFlat index fail-soft on `embedding_vec`

- **Actor chính:** DevOps / QA (DDL apply + health probe)
- **DDL:** `CREATE INDEX IF NOT EXISTS crm_research_emb_vec_ivf … USING ivfflat` — fail-soft nếu thiếu extension `vector`
- **Health:** `rag_ivfflat_ready` = index tồn tại; **không** bật ANN / flags prod
- **Cấm** drop JSONB; **cấm** bật `RESEARCH_RAG_PGVECTOR_ENABLED` trên deploy mặc định; không UI

### RES-UC-098 — Live Talkwalker Search API (staging)

- **Actor chính:** Analyst (`crm_research.run`) khi flag+token+`TALKWALKER_PROJECT_ID` bật staging
- **API:** cùng `POST …/run-talkwalker` — có project_id → HTTP Search API; thiếu project_id → stub P23
- **Rule:** sources only; PII → 400; HTTP fail → `talkwalker_failed`; health `talkwalker_live_enabled`
- **Cấm** `createInsight`; **cấm** bật flag/token trên prod deploy mặc định; không portal

### RES-UC-099 — ISO 20252 gap-check read-only (staff)

- **Actor chính:** Research Lead / Analyst (`crm_research.view`)
- **API:** `GET /api/v1/research/projects/:id/governance/iso-gap` → checklist `{ items[], summary }` theo 4 phase ISO MVP
- **Rule:** read-only; derive từ artifact hiện có; không «ISO certified»; không leak `title`
- **Màn hình:** ops-web tab **ISO gap** — banner «Gap-check nội bộ»
- **Cấm** mutate project; **cấm** portal widget; **cấm** auto-fix; không DDL; flags prod không đổi

### RES-UC-100 — Persist conjoint what-if history (staff)

- **Actor chính:** Analyst (`crm_research.view` compute; `crm_research.edit` khi `persist=true`)
- **API:** `POST …/conjoint/what-if` body `{ persist?: true }` → insert sau compute; `GET …/conjoint/what-if` → 20 run mới nhất
- **Rule:** `persist` default false (P34 compatible); `statistical_inference: false`; chỉ `PRICE_OFFER`
- **Màn hình:** ConjointPane — checkbox «Lưu kết quả» + bảng lịch sử what-if
- **Cấm** MOE/logit; **cấm** `createInsight`; **cấm** portal; DDL P38 nhỏ

### RES-UC-101 — RAG re-embed backfill staging playbook (pgvector + flags)

- **Actor chính:** PO / LD / Analyst (staging UAT)
- **Ops:** `install_pgvector_vps.sh` (P20+P36) · `deploy_market_research_p39_vps.sh` · `--enable-rag-staging` (3 RAG flags)
- **API (reuse P13):** `GET/POST /api/v1/research/rag/reembed/*` — batch 64-d → 256-d; dual-write `embedding_vec` khi flag∧ready
- **Rule:** prod deploy **không** bật flags; `OPENAI_API_KEY` PO manual; worker restart bắt buộc
- **Runbook:** `docs/runbooks/market-research-rag-staging-backfill.md`
- **Cấm** prod RAG enable mặc định; **cấm** ghi secret deploy; **cấm** ops-web UI re-embed; không DDL mới

### RES-UC-102 — Staff ops-web RAG re-embed panel

- **Actor chính:** Lead / Analyst (`crm_research.configure`) khi staging embed on
- **UI:** `/crm/research/analytics` — panel preview `stale_count` + batch limit + kết quả
- **API (reuse P13):** `GET/POST /api/v1/research/rag/reembed/*` — không endpoint mới
- **Rule:** panel **ẩn** khi `rag_openai_embed_enabled=false` (prod default); cap `configure`
- **Cấm** ghi secret / flip flags từ UI; **cấm** `createInsight`; không portal; không DDL

### RES-UC-103 — Portal report list stale badge

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/reports` — mỗi card thêm `has_stale_insights: boolean` (live `valid_to`, batch lookup)
- **Rule:** giống RES-UC-085/P24 (UTC calendar); insight unpublished / khác tenant → `false`
- **Màn hình:** `/research` — badge vàng trên row khi `has_stale_insights`; **không** ẩn report
- Copy list-level: «Có nội dung có thể đã lỗi thời» — không claim «báo cáo hết hạn»
- Detail P24/PDF P29 **không đổi** hành vi
- **Cấm** endpoint mới; không DDL; không ops-web; **cấm** leak `title` / `statement`

### RES-UC-104 — Staff report version live stale rows

- **Actor chính:** Lead / Analyst (`crm_research.view`) trên tab Báo cáo
- **UI:** `/crm/research/[id]` — banner stale live dưới mỗi finding/rec snapshot (client-side join `project.insights`)
- **Rule:** giống P22/P24 (UTC calendar); **cấm** dùng `published_valid_to` cho stale
- **Reuse:** `InsightStaleBanner` · `insightIsStale` · `ReportStaleInsightList`
- **Cấm** endpoint mới; không DDL; không portal-web; không đổi PDF/DOCX footer

### RES-UC-105 — Staff report version list stale badge

- **Actor chính:** Lead / Analyst (`crm_research.view`) trên tab Báo cáo
- **UI:** dòng meta `v{N}` — badge «Có nội dung có thể đã lỗi thời» khi version có insight stale (client-side join `project.insights`)
- **Rule:** giống P41/P42; P42 detail banners **giữ nguyên**
- **Reuse:** `reportVersionHasStaleInsights` · `StaffReportVersionStaleBadge`
- **Cấm** endpoint mới; không DDL; không portal-web

### RES-UC-106 — Staff reports API has_stale_insights

- **Actor chính:** Lead / Analyst (`crm_research.view`) trên tab Báo cáo
- **API:** mở rộng `GET /api/v1/research/projects/:id/reports` — mỗi `versions[]` thêm `has_stale_insights: boolean` (live tại GET)
- **Rule:** batch `listInsightValidToForProject` + `reportSnapshotHasStaleInsights`; scope project (giống P29 export PDF)
- **UI:** ops-web ưu tiên field API; fallback client join P42 khi thiếu field
- **Cấm** DDL; không portal-web; không bake snapshot

### RES-UC-107 — Staff report version stale filter

- **Actor chính:** Lead / Analyst (`crm_research.view`) trên tab Báo cáo
- **UI:** checkbox «Chỉ version hết hạn (N)» — lọc client-side danh sách version; predicate `staffReportVersionHasStaleInsights` (API-first P44)
- **Rule:** filter chỉ UI list; form tạo version luôn hiện; P42/P43 trên row còn visible
- **Reuse:** `filterStaffReportVersionsByStale` · `countStaffReportVersionsWithStaleInsights`
- **Cấm** endpoint mới; không DDL; không portal-web

### RES-UC-108 — Portal report list stale filter

- **Actor chính:** Client portal user trên `/research`
- **UI:** checkbox «Chỉ báo cáo hết hạn (N)» — lọc client-side danh sách card; predicate `has_stale_insights` từ P41
- **Rule:** filter chỉ UI list báo cáo; theme analytics · RAG · conjoint không đổi; P41 badge · P24 detail giữ nguyên
- **Reuse:** `filterPortalReportCardsByStale` · `shouldShowReportListStaleBadge`
- **Cấm** endpoint mới; không DDL; không ops-web

### RES-UC-109 — Portal reports API stale_only filter

- **Actor chính:** Client portal user trên `/research`
- **API:** mở rộng `GET /api/v1/portal/research/reports` — query `stale_only=1` chỉ trả card `has_stale_insights: true` (live tại GET)
- **Rule:** filter sau batch annotate P41; `parseRagStaleOnlyFlag`; portal-web refetch khi bật checkbox P46; client util fallback
- **Reuse:** `reportSnapshotHasStaleInsights` · `filterPortalReportCardsByStale`
- **Cấm** DDL; không ops-web; không ẩn card khỏi export/detail

### RES-UC-072 — Inject RAG vào insight copilot

- **Actor chính:** Analyst (`run`)
- **API / job:** `POST /api/v1/research/projects/:id/insights/copilot` (`research_insight_draft`)
- **Trace ref:** FR-AI-03, NFR-AI-03, BR-RES-06, RES-UC-011
- **Tham chiếu:** corpus đã duyệt (cùng client)

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn evidence_ids verified |
| 2 | **Gợi ý insight (Claude)** — tham chiếu corpus đã duyệt cùng khách khi flag on |
| 3 | Prompt **chỉ** excerpt/value các ID đó + rag_hits corpus đã duyệt — không web thêm |
| 4 | Tạo insight `draft` `ai_generated=true` (`createInsight` ×1) |
| 5 | Analyst sửa rồi RES-UC-007 |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 evidence → nút disabled |
| E2 | LLM fail → failed run; không insight rỗng |
| E3 | Flag off → `rag_note=rag_disabled` + prompt P0 (không banner) |
| E4 | PII query → `rag_skipped_pii`; vẫn 1 draft |

---

## 5. API map

| Method | Path | UC |
| --- | --- | --- |
| GET | `/api/v1/research/projects` | 001, 010 |
| POST | `/projects` | 002 |
| GET/PATCH | `/projects/:id` | 001, 015 |
| POST | `/projects/:id/questions` | 003 |
| PATCH/DELETE | `/questions/:id` | 003 |
| POST | `/projects/:id/sources` | 019 |
| PATCH | `/sources/:id` | 014 |
| POST | `/projects/:id/run-desk` | 004 |
| POST | `/projects/:id/run-deep` | 005 |
| POST | `/projects/:id/studies/:studyId/whisper` | 060 |
| POST | `/projects/:id/run-sparktoro` | 061 |
| POST | `/projects/:id/import-survey` | 062 |
| GET/POST | `/projects/:id/van-westendorp` | 063 |
| POST | `/projects/:id/run-qualtrics` | 062 |
| POST | `/projects/:id/run-talkwalker` | 084 |
| GET | `/insights/search` | 070 |
| GET | `/api/v1/portal/research/insights/search` | 073 |
| GET | `/api/v1/portal/research/analytics/themes` | 076 |
| GET | `/api/v1/portal/research/health` | 073 |
| GET | `/taxonomy` | 071 |
| POST | `/taxonomy` | 071 |
| PATCH | `/taxonomy/:id` | 071 |
| POST | `/insights/:id/themes` | 071 |
| DELETE | `/insights/:id/themes/:taxonomyId` | 071 |
| GET | `/projects/:id/jobs/:runId` | 020 |
| POST | `/projects/:id/evidence` | 006 |
| POST | `/evidence/:id/verify` | 006 |
| POST | `/projects/:id/insights` | 007 |
| POST | `/projects/:id/insights/copilot` | 011, 072 |
| POST | `/insights/:id/attach-evidence` | 007 |
| POST | `/insights/:id/submit-review` | 007 |
| POST | `/insights/:id/approve` | 008, 018 |
| POST | `/projects/:id/reports` | 009, 012 |
| GET | `/reports/:id/versions/:versionId/export` | 009 |
| GET | `/reports/:id/versions/:versionId/export?format=pdf` | 050 |
| GET | `/api/v1/portal/research/reports/:versionId/export.pdf` | 050 |
| POST | `/content-items/:itemId/insights` | 051 |
| POST | `/internal/research/jobs/:id/complete` | 004, 005, 011, 012 |
| GET | `/analytics/ops` | 033 |
| GET | `/analytics/themes` | 075, 077 |

**Guards:** `StaffOrInternalKeyGuard` + `crm_research.view|create|edit|run|approve|export|configure`  
**Flag off:** 404 `market_research_disabled`

---

## 6. Entity map (DDL)

| Table | UC chính |
| --- | --- |
| `crm_research_projects` | 002, 015 |
| `crm_research_questions` | 003 |
| `crm_research_sources` | 004, 005, 014, 019, 061 |
| `crm_research_evidence` | 006, 017 |
| `crm_research_insights` | 007, 008, 018 |
| `crm_research_insight_evidence` | 007 |
| `crm_research_reviews` | 008, 018 |
| `crm_research_reports` | 009 |
| `crm_research_report_versions` | 009, 012 |
| `crm_research_ai_runs` | 004, 005, 011, 012, 016, 020, 060, 061 |
| `crm_research_competitors` (P1) | 022 |
| `crm_research_studies` (P2) | 030, 060 |
| `crm_research_insight_embeddings` (P7) | 070 |
| `crm_research_taxonomy` (P7) | 071 |
| `crm_research_insight_themes` (P7) | 071 |

---

## 7. Business rules (module)

Toàn bộ BR-RES-01…13 trong SRS Phụ lục B. UI **bắt buộc** surface BR-RES-01, 05, 06, 07, 08, 12.

---

## 8. Traceability P0 acceptance

| EC | UC |
| --- | --- |
| EC-RES-01 | 001 |
| EC-RES-02 | 002, 003 |
| EC-RES-03 | 004 |
| EC-RES-04 | 007, 008 |
| EC-RES-05 | 009 |
| EC-RES-06 | 010 |
| EC-RES-07 | 001 |
| EC-RES-08 | 013 |
| EC-RES-09 | 005 |
| EC-RES-10 | 017 |
| EC-RES-11 | 008 |
| EC-RES-12 | 016 |
