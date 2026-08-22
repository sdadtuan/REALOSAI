# RNOSAI BA — AI Marketing Planner Use Cases (MarketingAiPlannerModule)

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-MKTP-UC |
| Phiên bản | 1.1 |
| Ngày xuất | 2026-08-08 |
| Module | MOD-MKT-AI-PLANNER |
| Nest module | `MarketingAiPlannerModule` |
| Số UC | 31 |
| Spec thủ công | 24/31 (P0–P3 + P4-01 shipped; **UC-022…031 frozen**) |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/10-MKT-AI-PLANNER.md`](../../use-cases/10-MKT-AI-PLANNER.md) |
| Integration spec | [`2026-08-08-mkt-ai-planner-integration-spec.md`](../2026-08-08-mkt-ai-planner-integration-spec.md) |
| DDL | [`2026-08-08-postgresql-ddl-mkt-ai-planner.sql`](../2026-08-08-postgresql-ddl-mkt-ai-planner.sql) |

---

## 1. Tóm tắt module

Module **AI Marketing Planner** nhúng vào **Triển khai dịch vụ marketing** (`crm_service_lifecycle`), hỗ trợ Solution/AM soạn **TMMT chính thức (R5)** qua wizard AI 5 bước: Brief → Strategy → Campaign → Content → Apply/Export. Human-in-the-loop; không auto-advance lifecycle stage.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Phase | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-MKT-AI-001 | AI Planner Wizard | `/crm/service-delivery/[id]?tab=ai-planner` | P0 | MKTP-UC-001…010 |
| SCR-MKT-AI-001a | Step Brief | same `step=brief` | P0 | MKTP-UC-002 |
| SCR-MKT-AI-001b | Step Strategy | `step=strategy` | P0 | MKTP-UC-003, 006 |
| SCR-MKT-AI-001c | Step Campaign | `step=campaign` | P0 | MKTP-UC-004, 009 |
| SCR-MKT-AI-001d | Step Content | `step=content` | P0 | MKTP-UC-005 |
| SCR-MKT-AI-001e | Step Apply | `step=apply` | P0 | MKTP-UC-007, 008, 010 |
| SCR-MKT-AI-003 | Job progress | panel | P0 | MKTP-UC-003…009 |
| SCR-MKT-AI-004 | TMMT gate banner | panel top | P0 | MKTP-UC-001, 008 |
| SCR-MKT-AI-010 | Presales R5 AI | `/crm/leads/[id]#presales-r5` | P1 | MKTP-UC-015 |
| SCR-MKT-AI-020 | Brand KB | sub=kb | P1 | MKTP-UC-011 |
| SCR-MKT-AI-021 | Budget sim | sub=budget | P1 | MKTP-UC-012 |
| SCR-MKT-AI-022 | Approval | bar | P1 | MKTP-UC-013, 014 |
| SCR-MKT-AI-030 | KPI dashboard | sub=dashboard | P2 | MKTP-UC-016, 018 |
| SCR-MKT-AI-040 | Multi-agent | sub=agents | P3 | MKTP-UC-019, 020, 021 |
| SCR-MKT-AI-041 | Plan depth — strategy & brief | step=strategy, brief | P4 | MKTP-UC-026, 030, 031 |
| SCR-MKT-AI-042 | Scenario compare & collab | step=strategy, budget | P4 | MKTP-UC-027, 029 |
| SCR-MKT-AI-043 | KPI closed-loop | sub=dashboard | P4 | MKTP-UC-028 |
| SCR-PORTAL-MKT-AI | Portal plan summary | portal lifecycle | P4 | MKTP-UC-023 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Phase | Status | Parent SVC |
| --- | --- | --- | --- | --- | --- |
| MKTP-UC-001 | Mở AI Planner context | P0 | P0 | Implemented (staging) | SVC-UC-003 |
| MKTP-UC-002 | Lưu Brief intake | P0 | P0 | Implemented (staging) | SVC-UC-003 |
| MKTP-UC-003 | Sinh chiến lược AI | P0 | P0 | Implemented (staging) | SVC-UC-003 |
| MKTP-UC-004 | Sinh chiến dịch AI | P0 | P0 | Implemented (staging) | SVC-UC-011 |
| MKTP-UC-005 | Sinh lịch nội dung | P0 | P0 | Implemented (staging) | SVC-UC-011 |
| MKTP-UC-006 | Chỉnh sửa draft | P0 | P0 | Implemented (staging) | — |
| MKTP-UC-007 | Quality score | P0 | P0 | Implemented (staging) | — |
| MKTP-UC-008 | Apply TMMT chính thức | P0 | P0 | Implemented (staging) | SVC-UC-003 |
| MKTP-UC-009 | Retry job giữ draft | P0 | P0 | Implemented (staging) | — |
| MKTP-UC-010 | Export PDF/DOCX/XLSX | P0 | P0 | Implemented (staging) | SVC-UC-011 |
| MKTP-UC-011 | Brand KB RAG | P1 | P1 | Implemented (staging) | — |
| MKTP-UC-012 | Budget simulator | P1 | P1 | Implemented (staging) | — |
| MKTP-UC-013 | Approval workflow | P1 | P1 | Implemented (staging) | — |
| MKTP-UC-014 | Version compare | P1 | P1 | Implemented (staging) | — |
| MKTP-UC-015 | Presales R5 bridge | P1 | P1 | Implemented (staging) | CRM-UC-005 |
| MKTP-UC-016 | KPI dashboard | P1 | P2 | Implemented (staging) | SVC-UC-010 |
| MKTP-UC-017 | Optimization copilot | P2 | P2 | Implemented (staging) | — |
| MKTP-UC-018 | KPI drift alert | P2 | P2 | Implemented (staging) | — |
| MKTP-UC-019 | Multi-agent pipeline | P2 | P3 | Implemented (staging) | — |
| MKTP-UC-020 | Industry playbook | P2 | P3 | Implemented (staging) | — |
| MKTP-UC-021 | Governance banner | P2 | P3 | Implemented (staging) | — |
| MKTP-UC-022 | Async multi-agent pipeline | P1 | P4 | **Frozen · backlog** | — |
| MKTP-UC-023 | Portal plan summary read-only | P2 | P4 | **Frozen · backlog** | — |
| MKTP-UC-024 | GA multi-slug rollout | P0 | P4 | Implemented (staging) | — |
| MKTP-UC-025 | Ops monitoring & job SLO | P1 | P4 | **Frozen · backlog** | — |
| MKTP-UC-026 | Plan depth — strategy & brief | P0 | P4 | **Frozen · backlog** | SVC-UC-003 |
| MKTP-UC-027 | Plan depth — scenario & collab | P1 | P4 | **Frozen · backlog** | — |
| MKTP-UC-028 | Plan depth — KPI closed-loop | P2 | P4 | **Frozen · backlog** | MKTP-UC-016 |
| MKTP-UC-029 | Section comments & PPTX export | P2 | P4 | **Frozen · backlog** | MKTP-UC-027 |
| MKTP-UC-030 | Content variants & creative brief | P2 | P4 | **Frozen · backlog** | MKTP-UC-026 |
| MKTP-UC-031 | Brief readiness score | P2 | P4 | **Frozen · backlog** | MKTP-UC-026 |

> **Freeze PO 2026-08-08:** UC-022…031 locked theo [`2026-08-08-mkt-ai-planner-phase4.md`](../../superpowers/plans/2026-08-08-mkt-ai-planner-phase4.md). Actions: [`10-MKTP-ACTIONS.md`](../../use-cases/actions/10-MKTP-ACTIONS.md) §Phase 4.

---

## 2. Chi tiết Use Case (P0 — ship target)

### MKTP-UC-008 — Apply TMMT chính thức

> 🟢 Spec thủ công · **Critical path**

- **Mã use case:** MKTP-UC-008
- **Tên use case:** Apply draft AI vào TMMT chính thức
- **Màn hình:** SCR-MKT-AI-001e, SCR-SVC-004 (tab TMMT)
- **Actor chính:** Solution Strategist
- **Actor phụ:** AM (review), System
- **Mục tiêu:** Merge AI draft vào `crm_marketing_plans` official; pass TMMT gate
- **Trigger:** User bấm Apply sau quality score đạt ngưỡng
- **Pre-condition:** Draft tồn tại; official plan row on lifecycle; quality ≥60; cap edit
- **Post-condition:** TMMT fields updated; validation refreshed; optional version snapshot
- **Ưu tiên:** P0
- **Sprint/Wave:** MKT-AI Phase 1 (tuần 1–6)
- **Trace ref:** EC-MKT-AI-03, BR-MKTP-01, BR-MKTP-07
- **API / Integration:** `POST /api/v1/service-lifecycle/:id/ai-planner/apply` · PATCH marketing-plan

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | UI hiển thị diff preview các TMMT keys sẽ ghi đè |
| 2 | User xác nhận đã review nội dung AI |
| 3 | API merge `strategy_framework_json` + `target_market_prof_json` vào official plan |
| 4 | Ghi job `apply_to_tmmt` + audit export optional |
| 5 | Trả `tmmt_validation` — UI banner cập nhật pass/fail |
| 6 | User chuyển tab TMMT xác nhận hoặc sửa tay phần còn thiếu |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Validation vẫn fail sau apply → banner đỏ; user sửa tab TMMT |
| E2 | Chưa có official plan → 409 hướng dẫn promote presales |
| E3 | Quality <60 → Apply button disabled (BR-MKTP-05) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lifecycle_id, strategy_framework{}, target_market_prof{}, confirm_overwrite |
| Output | plan payload, validation{ ok, messages[], filled_count } |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-MKTP-01 | Không auto-merge — bắt buộc confirm Apply |
| BR-MKTP-07 | Workflow Deliver gate dùng `validateOfficialTmmt` unchanged |

---

### MKTP-UC-003 — Sinh chiến lược AI

- **Mã use case:** MKTP-UC-003
- **Actor chính:** Solution Strategist
- **Mục tiêu:** AI sinh khung chiến lược + 12 TMMT prof keys draft
- **API:** `POST .../ai-planner/jobs/strategy`
- **Tables:** `mkt_ai_jobs`, `mkt_ai_drafts`
- **Exit:** EC-MKT-AI-02 — 4 core prof keys filled

*(Chi tiết đầy đủ: [`10-MKT-AI-PLANNER.md`](../../use-cases/10-MKT-AI-PLANNER.md) · Actions: [`10-MKTP-ACTIONS.md`](../../use-cases/actions/10-MKTP-ACTIONS.md) §003)*

---

## 3. API map (MarketingAiPlannerModule)

| Method | Path | UC |
| --- | --- | --- |
| GET | `/context` | MKTP-UC-001 |
| PATCH | `/brief` | MKTP-UC-002 |
| PATCH | `/draft` | MKTP-UC-006 |
| POST | `/jobs/strategy` | MKTP-UC-003 |
| POST | `/jobs/campaigns` | MKTP-UC-004 |
| POST | `/jobs/content` | MKTP-UC-005 |
| POST | `/jobs/quality` | MKTP-UC-007 |
| POST | `/apply` | MKTP-UC-008 |
| POST | `/export` | MKTP-UC-010 |
| POST | `/jobs/:type/retry` | MKTP-UC-009 |
| POST | `/documents` | MKTP-UC-011 |
| POST | `/jobs/budget-simulate` | MKTP-UC-012 |
| GET/POST | `/approvals`, `/comments` | MKTP-UC-013 |
| GET | `/versions`, POST `/versions/:id/restore` | MKTP-UC-014 |
| GET | `/dashboard` | MKTP-UC-016 |
| POST | `/jobs/optimize` | MKTP-UC-017 |
| POST | `/jobs/multi-agent` | MKTP-UC-019, 022 |
| POST | `/jobs/multi-agent` (async 202) | MKTP-UC-022 |
| POST | `/jobs/strategy/regenerate-section` | MKTP-UC-026 |
| POST | `/brief/upload` | MKTP-UC-026, 031 |
| POST | `/jobs/strategy/scenarios` | MKTP-UC-027 |
| POST | `/export/pptx` | MKTP-UC-029 |
| GET/POST | `/section-comments` | MKTP-UC-029 |
| GET | `/portal/.../ai-planner/summary` | MKTP-UC-023 |
| GET | `/kpi-closed-loop` | MKTP-UC-028 |
| POST | `/jobs/optimize/weekly-memo` | MKTP-UC-028 |

**Guards:** `crm_board.view`, `crm_board.edit`, `crm_mkt_ai.view`, `crm_mkt_ai.generate`, `crm_mkt_ai.export`, `crm_mkt_ai.approve`

---

## 4. Entity map (DDL)

| Table | UC chính |
| --- | --- |
| `mkt_ai_briefs` | MKTP-UC-002 |
| `mkt_ai_drafts` | MKTP-UC-003…008 |
| `mkt_ai_jobs` | MKTP-UC-003…009, 012, 017, 019 |
| `mkt_ai_campaigns` | MKTP-UC-004 |
| `mkt_ai_content_assets` | MKTP-UC-005 |
| `mkt_ai_plan_versions` | MKTP-UC-008, 014 |
| `mkt_ai_exports` | MKTP-UC-010 |
| `mkt_ai_documents` / chunks | MKTP-UC-011 |
| `mkt_ai_budget_scenarios` | MKTP-UC-012 |
| `mkt_ai_approvals` / comments | MKTP-UC-013, 029 |
| `mkt_ai_section_comments` | MKTP-UC-029 |
| `mkt_ai_drafts` depth fields (`kpi_tree_json`, `risks_assumptions_json`, …) | MKTP-UC-026…028 |

---

## 5. Acceptance checklist (PO)

| EC | UC | Mô tả |
| --- | --- | --- |
| EC-MKT-AI-01 | MKTP-UC-002 | Brief validation VI |
| EC-MKT-AI-02 | MKTP-UC-003 | 4 core prof filled |
| EC-MKT-AI-03 | MKTP-UC-008 | Apply → gate pass |
| EC-MKT-AI-04 | MKTP-UC-010 | Export OK |
| EC-MKT-AI-05 | MKTP-UC-009 | Retry keeps draft |
| EC-MKT-AI-06 | MKTP-UC-011 | RAG citation |
| EC-MKT-AI-07 | MKTP-UC-016 | Dashboard <3s |
| EC-MKT-AI-08 | MKTP-UC-026 | Depth gate — risks + KPI tree before Apply |
| EC-MKT-AI-09 | MKTP-UC-031 | Brief readiness ≥70 or PO override |
| EC-MKT-AI-10 | MKTP-UC-022 | Async pipeline no HTTP 504 |

**UAT script:** [`actions/10-MKTP-ACTIONS.md`](../../use-cases/actions/10-MKTP-ACTIONS.md) walkthrough 21 bước (P0) + Phase 4 frozen §022…031

---

## 6. Liên kết SVC / CRM

| UC khác | Quan hệ |
| --- | --- |
| SVC-UC-003 | TMMT gate — MKTP accelerator, không thay gate |
| SVC-UC-001 | Stage advance manual sau gate pass |
| SVC-UC-005 | Phase 4 quality gate trước Launch QA |
| CRM-UC-005 | Presales R5 → MKTP-UC-015 bridge |
| AI-UC-* | Shared `ai_agent_runs` audit (BR-AI-03) |

---

*Cập nhật trạng thái implementation khi MKT-AI-02 module ship. **v1.1** — freeze UC-022…031 P4 backlog 2026-08-08.*
