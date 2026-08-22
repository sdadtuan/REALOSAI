# PR Checklist — RNOS ↔ UC ↔ UI ↔ UAT

> **Phiên bản:** 1.1 · **Ngày:** 2026-07-26  
> **Cập nhật:** GAP-AI-01…05 shipped · handoff §18.2 sync · AI-UC-006 override block  
> **Dùng cho:** Pull request triển khai Revenue OS + AI (ưu tiên R1)  
> **GitHub:** https://github.com/sdadtuan/RNOSAI · [PR template](https://github.com/sdadtuan/RNOSAI/blob/main/.github/pull_request_template.md) · [New RNOS issue](https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml) · [Setup labels](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/github-setup.md)  
> **Traceability:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) · [`SPEC_UI_UX_AI_REVENUE_OS.md`](../SPEC_UI_UX_AI_REVENUE_OS.md) · [`use-cases/09-AI-REVENUE-OS.md`](../use-cases/09-AI-REVENUE-OS.md) · [`use-cases/actions/09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md)

---

## Cách dùng

1. **Author:** điền [A. Metadata PR](#a-metadata-pr) + tick checklist RNOS tương ứng ([D](#d-checklist-theo-rnos-r1--phase-0)).
2. **Reviewer:** xác nhận UC/UI/UAT map đúng; không merge nếu thiếu BR-AI hoặc audit.
3. **QA (khi có):** chạy bước UAT liên quan trên staging; ghi PR link vào UAT sign-off.
4. **Một PR = một RNOS chính** (khuyến nghị). PR gộp nhiều RNOS → liệt kê tất cả và tick từng block.

**Quy tắc merge AI R1:**

- Không merge BE LLM/score nếu chưa có `ai_agent_runs` insert (RNOS-05).
- Không merge UI copilot nếu thiếu `AiFeatureGate` + BR-AI-01 (không nút send).
- Không merge prod pilot nếu chưa pass smoke + runbook rollback (RNOS-40).

---

## A. Metadata PR

| Trường | Giá trị (author điền) |
|--------|-------------------------|
| **PR title** | `RNOS-XX: …` |
| **Wave** | Phase 0 / R1 / R2 / … |
| **RNOS chính** | RNOS-__ |
| **RNOS phụ** (nếu có) | |
| **Workstream** | DATA / BE / FE / PLATFORM / QA |
| **Author** | |
| **Reviewer** | |
| **Staging verified** | [ ] Yes · URL/log: |

### Ma trận traceability (điền dòng RNOS chính)

| RNOS | UC | Actions § | UI spec § | UAT / Gate |
|------|-----|-----------|-----------|------------|
| | | | | |

> Tra nhanh: [C. Ma trận RNOS R1](#c-ma-trận-nhanh-rnos--uc--ui--uat-r1)

---

## B. Checklist chung (mọi PR AI)

### Author

- [ ] PR title bắt đầu `RNOS-XX:` hoặc liệt kê RNOS trong description
- [ ] Không commit secret (`AI_LLM_API_KEY`, `.env` prod)
- [ ] Unit/integration test cho logic mới hoặc ghi rõ lý do skip
- [ ] Feature flag: AI off = CRM/ops **không regression** (smoke lead ingest)
- [ ] Strings UI tiếng Việt (nếu có thay đổi ops-web)
- [ ] Cập nhật doc nếu đổi API contract / env var (90-day plan hoặc runbook)

### Reviewer

- [ ] Map RNOS → UC → UI khớp ma trận [C](#c-ma-trận-nhanh-rnos--uc--ui--uat-r1)
- [ ] BR-AI-01…05 không bị vi phạm (xem [F](#f-business-rules-bắt-buộc))
- [ ] RBAC: CSKH chỉ lead `owner=me` trên copilot (BR-AI-04)
- [ ] Không PII trong log prod (`PTT_AI_LOG_PII=0` / `AI_LOG_PROMPTS=0`)

### QA (staging, khi applicable)

- [ ] Smoke path liên quan pass
- [ ] Bước UAT actions § tương ứng (link screenshot/log)
- [ ] `ai_agent_runs` COUNT khớp số lần gọi AI (nếu PR chạm LLM/score)

---

## C. Ma trận nhanh RNOS ↔ UC ↔ UI ↔ UAT (R1 + Phase 0)

| RNOS | Deliverable | UC | Actions | UI § / ID | UAT / Gate |
|------|-------------|-----|---------|-----------|------------|
| **RNOS-01** | DDL AI + behavior tables | AI-UC-008 | §008 | — (data) | Gate Phase 0 · DDL staging |
| **RNOS-02** | `AiIntelligenceModule` skeleton | AI-UC-009 | §009 | §6 tree · gate | `GET /api/v1/ai/health` 200 |
| **RNOS-03** | `POST /ai/summarize` | AI-UC-003 | §003 | UI-R1-04 · §6.2 | Pilot §4–5 · P95 ≤5s |
| **RNOS-04** | `POST /ai/score/lead` | AI-UC-001, 005 | §001, §005 | UI-R1-02 · §6.2 | Pilot §3 · score ≤30s |
| **RNOS-05** | AI audit (`ai_agent_runs`) | AI-UC-009 | §009 | UI-R1-09 · §6 | Pilot §8 · 100% calls |
| **RNOS-06** | Copilot panel UI | AI-UC-002, 005 | §002, §005 | UI-R1-01…03 · §6, §16 | Pilot §3–4 |
| **RNOS-06b** | GDKD override score | AI-UC-006 | §006 | UI-R1-08 | E2E AI-UC-006 · badge override |
| **RNOS-07** | Follow-up draft + approve | AI-UC-004 | §004 | UI-R1-05 · §9 HITL | Pilot §6–7 · BR-AI-01 |
| **RNOS-08** | Event + async score consumer | AI-UC-001 | §001 | UI-R1-06 · §10 | UC-001 bước 2–7 |
| **RNOS-16** | Timeline enrichment | AI-UC-008 | §008 | — (context) | Gate Phase 0 timeline ≥70% |
| **RNOS-39** | E2E Playwright | All P0 R1 | Pilot 8 bước | §18.2 handoff | CI green · `ai-copilot.spec.ts` |
| **RNOS-40** | Runbook + env + pilot flag | AI-UC-010 | §010 | §17 rollout | Rollback drill · env.ai.example |

**Gate R1 (master §19.1):** score ≤30s · summarize P95 ≤5s · approve before send · audit 100% · no PII logs · copilot on lead detail.

---

## D. Checklist theo RNOS (R1 + Phase 0)

> Tick block tương ứng RNOS trong PR. Copy block vào PR description nếu cần.

---

### RNOS-01 — PostgreSQL DDL

**UC:** AI-UC-008 · **Actions:** [§008](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-008--timeline-enrich-cho-ai-context) · **Spec:** master §12.1 · **Plan:** tuần 1

| | Check |
|---|-------|
| ☐ | Script/migration khớp [`2026-07-26-postgresql-ddl-revenue-os-ai.sql`](../specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql) |
| ☐ | Apply **staging** trước; backup plan ghi trong PR |
| ☐ | Bảng tối thiểu: `ai_agent_runs`, `ai_scores`, `ai_recommendations`, `customer_timeline_events`, … |
| ☐ | Không breaking change CRM tables hiện có |
| ☐ | `./scripts/apply_pg_ddl_revenue_os_ai.sh` chạy OK |
| ☐ | `./scripts/rnos01_pg_ddl_gate.sh` → `.local-dev/rnos01-gate-report.json` `"ok": true` |
| ☐ | Runbook [`rnos01-ddl-apply.md`](../runbooks/rnos01-ddl-apply.md) reviewed |

**Reviewer:** Gate Phase 0 checklist · timeline table exists.

---

### RNOS-02 — `AiIntelligenceModule` skeleton

**UC:** AI-UC-009 · **Actions:** [§009](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-009--ai-audit--agent-run-trace) · **UI:** §6.1 `AiFeatureGate` (stub) · **Path:** `services/ptt-crm-api/src/ai-intelligence/`

| | Check |
|---|-------|
| ☐ | Module registered in `app.module.ts` |
| ☐ | `GET /api/v1/ai/health` → 200 JSON `{ status: "ok" }` |
| ☐ | RBAC guard wired (staff JWT) |
| ☐ | Folder structure: `module`, `controller`, `services/`, `dto/` |
| ☐ | Unit test module bootstrap |

**UAT:** không bắt buộc walkthrough; health smoke đủ.

---

### RNOS-03 — `POST /ai/summarize`

**UC:** AI-UC-003 · **Actions:** [§003](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-003--copilot--summarize-activity) · **UI:** UI-R1-04 · §6.2 · **Path:** `ai-intelligence.controller.ts`, summarize service

| | Check |
|---|-------|
| ☐ | `POST /api/v1/ai/summarize` — contexts: `lead_brief`, activity body |
| ☐ | Output schema validated (bullets VN / summary + extracted) |
| ☐ | Mọi call qua `AiAuditService` → `ai_agent_runs` (RNOS-05) |
| ☐ | P95 ≤5s staging (hoặc ghi metric trong PR) |
| ☐ | Rate limit / error 429 handled |
| ☐ | Không log raw prompt prod |

**UAT:** Pilot walkthrough bước 4–5 · Actions §003 tiêu chí nghiệm thu.

---

### RNOS-04 — `POST /ai/score/lead`

**UC:** AI-UC-001, AI-UC-005 · **Actions:** [§001](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-001--lead-score-async-sau-ingest), [§005](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-005--xem-score--explainability) · **UI:** UI-R1-02 · §6.2

| | Check |
|---|-------|
| ☐ | Rules engine v1 (0–100) + `explainability_json` (+/− factors) |
| ☐ | `GET /api/v1/ai/scores?entity_type=lead&entity_id=` |
| ☐ | Persist `ai_scores` + audit run |
| ☐ | Idempotency window 5 phút (E2 UC-001) |
| ☐ | Thiếu attribution vẫn score + flag explain |
| ☐ | GDKD override: `POST /api/v1/ai/scores/lead/override` + `overridden_by` (AI-UC-006) |

**UAT:** Pilot §3 · score visible ≤30s from lead create (with RNOS-08).

---

### RNOS-05 — AI audit log

**UC:** AI-UC-009 · **Actions:** [§009](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-009--ai-audit--agent-run-trace) · **UI:** UI-R1-09 (admin, có thể PR riêng)

| | Check |
|---|-------|
| ☐ | `AiAuditService` wrap **100%** LLM + score calls |
| ☐ | Fields: `request_id`, `prompt_hash`, latency, model, `use_case`, status |
| ☐ | Unit test insert `ai_agent_runs` |
| ☐ | BR-AI-05: no PII in stored prompt when prod flag off |
| ☐ | Failed runs logged with error code |

**UAT:** Pilot §8 · SQL COUNT ≥ số API calls trong session.

---

### RNOS-06 — Copilot panel UI

**UC:** AI-UC-002, AI-UC-005 · **Actions:** [§002](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-002--copilot--lead-brief), [§005](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-005--xem-score--explainability) · **UI:** §6, §16 · **Path:** `services/ops-web/src/components/LeadCopilotPanel.tsx`, `/crm/leads/[id]/page.tsx`

| | Check |
|---|-------|
| ☐ | `AiFeatureGate` — flag off → panel hidden |
| ☐ | Layout 3 cột ≥1280px; drawer <1280 (§5.2) |
| ☐ | Component tree §6.1: ScoreCard, LeadBrief, Summarize, ErrorBoundary |
| ☐ | `lib/ai-api.ts` client wired |
| ☐ | Loading skeleton · empty · error states (§10) |
| ☐ | Score + explain chips VN labels |
| ☐ | `ConfidenceBanner` when score confidence < 0.6 (BR-AI-02) |
| ☐ | Owner check — 403 lead khác (BR-AI-04) |
| ☐ | GDKD cap: nút **Điều chỉnh score** + modal (AI-UC-006 / UI-R1-08) |

**UAT:** Pilot §3–4 · UI handoff [`SPEC_UI_UX` §18.2](../SPEC_UI_UX_AI_REVENUE_OS.md#182-handoff-checklist-r1).

---

### RNOS-06b — GDKD override score (AI-UC-006)

**UC:** AI-UC-006 · **Actions:** [§006](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-006--manager-override-score) · **UI:** UI-R1-08 · **Path:** `ScoreOverrideModal.tsx`, `ScoreCard.tsx`, override API

| | Check |
|---|-------|
| ☐ | `POST /api/v1/ai/scores/lead/override` — score 0–100, reason ≥10 chars |
| ☐ | Guard `crm_leads.assign` hoặc `ai_admin.view` (BR-AI-05) |
| ☐ | Persist `ai_scores` với `overridden_by`, `override_reason`, `model_name=manual_override` |
| ☐ | Audit `OVERRIDE_SCORE` + event `LeadScoreOverridden` |
| ☐ | UI badge **GDKD điều chỉnh** + explain factor `gdkd_override` |
| ☐ | E2E block `AI-UC-006` trong `ai-copilot.spec.ts` green |

**UAT:** Actions §006 bước 1–8 · GDKD non-owner lead read/override per cap.

---

### RNOS-07 — Follow-up draft + approve

**UC:** AI-UC-004 · **Actions:** [§004](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-004--copilot--soạn-follow-up-draft) · **UI:** UI-R1-05 · §9 HITL

| | Check |
|---|-------|
| ☐ | `POST /api/v1/ai/recommendation` type=`follow_up_draft` |
| ☐ | UI: Generate → edit textarea → **Duyệt** / **Bỏ** |
| ☐ | **BR-AI-01:** không nút gửi Zalo/email/SMS; approve → activity note / clipboard only |
| ☐ | `PATCH` recommendation `accepted_by` + audit |
| ☐ | Dismiss không bắt buộc reason (R1) |

**UAT:** Pilot §6–7 · manual verify no outbound webhook after approve.

---

### RNOS-08 — Event `tenant.lead.scored` + consumer

**UC:** AI-UC-001 · **Actions:** [§001](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-001--lead-score-async-sau-ingest) bước 2–6 · **UI:** UI-R1-06 pending skeleton

| | Check |
|---|-------|
| ☐ | Emit `tenant.lead.created` → consumer queue/job |
| ☐ | Consumer calls score API async |
| ☐ | Optional emit `tenant.lead.scored` |
| ☐ | Lead created → UI score ≤30s (E2E metric) |
| ☐ | Retry 3x on fail · UI "Score đang cập nhật" |
| ☐ | Không regression CRM ingest latency |

**UAT:** UC-001 tiêu chí nghiệm thu · master §19.1 #1.

---

### RNOS-16 — Unified timeline enrichment

**UC:** AI-UC-008 · **Actions:** [§008](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-008--timeline-enrich-cho-ai-context) · **Plan:** tuần 2–3

| | Check |
|---|-------|
| ☐ | Activity create → `customer_timeline_events` row |
| ☐ | Meta/Zalo webhook metadata → timeline (`event_source`) |
| ☐ | Repository read API for summarize context |
| ☐ | Completeness ≥70% on pilot sample (Gate Phase 0) |

**UAT:** Gate Phase 0 · không bắt buộc pilot 8 bước riêng.

---

### RNOS-39 — E2E Playwright

**UC:** All P0 R1 · **Actions:** [Pilot 8 bước](../use-cases/actions/09-AI-ACTIONS.md#pilot-walkthrough--8-bước-uat-tuần-11) · **UI:** §18.2

| | Check |
|---|-------|
| ☐ | `ai-copilot.spec.ts` (hoặc tương đương) trong CI |
| ☐ | Flow: login pilot → lead detail → score → brief → summarize → draft approve |
| ☐ | Assert no send button / outbound |
| ☐ | AI-UC-006: override API + modal + badge **GDKD điều chỉnh** |
| ☐ | Bootstrap applies `domain_events.idempotency_key` (LeadScoreOverridden emit) |
| ☐ | Staging env vars documented in test README |
| ☐ | CI green on PR branch |

**UAT:** toàn bộ 8 bước pilot PASS trên staging.

---

### RNOS-40 — Runbook + env + pilot flag

**UC:** AI-UC-010 · **Actions:** [§010](../use-cases/actions/09-AI-ACTIONS.md#ai-uc-010--pilot-gate--feature-flag) · **UI:** §17 rollout · **Doc:** [`runbooks/ai-service-operations.md`](../runbooks/ai-service-operations.md)

| | Check |
|---|-------|
| ☐ | `deploy/env.ai.example` đầy đủ vars (§8.3 implementation plan) |
| ☐ | `PTT_AI_COPILOT_ENABLED`, `PTT_AI_PILOT_USER_IDS` documented |
| ☐ | Runbook rollback model/prompt/flag |
| ☐ | Rollback drill executed (log link) |
| ☐ | Pilot cohort list in runbook (5–8 UUID) |

**UAT:** Actions §010 · user ngoài cohort → panel ẩn.

---

## E. Mẫu PR body (GitHub)

Copy vào PR description; xóa section không liên quan.

```markdown
## RNOS ↔ UC ↔ UI ↔ UAT

| RNOS | UC | Actions | UI | UAT |
|------|-----|---------|-----|-----|
| RNOS-__ | AI-UC-___ | §___ | §___ / UI-R1-__ | Pilot §__ / Gate __ |

**Wave:** R1 · **Workstream:** BE / FE / …

## Thay đổi

- …

## Checklist author

- [ ] RNOS block ticked (link doc section)
- [ ] Tests: …
- [ ] Staging: …
- [ ] Feature flag off → no regression
- [ ] BR-AI-01…05 reviewed

## Checklist reviewer

- [ ] Traceability map OK
- [ ] Audit 100% if LLM/score touched
- [ ] UI §6/§9 if ops-web touched

## UAT / QA

- [ ] Actions §___ steps: …
- [ ] Screenshot / `ai_agent_runs` query: …

## Rollback

- Flag OFF / redeploy prev / …
```

---

## F. Business rules bắt buộc

| ID | Rule | PR verify |
|----|------|-----------|
| **BR-AI-01** | Không auto-send outbound | UI không nút Send; approve → note only |
| **BR-AI-02** | confidence < 0.6 → banner | `ConfidenceBanner` visible |
| **BR-AI-03** | 100% calls → `ai_agent_runs` | SQL + unit test |
| **BR-AI-04** | CSKH copilot lead owner=me | 403 lead khác |
| **BR-AI-05** | No PII prompt logs prod | env + code review |

---

## G. RNOS R2+ (tham chiếu ngắn)

| RNOS | UC (target) | UI §7 | Ghi chú PR |
|------|-------------|-------|------------|
| RNOS-09 | AI-UC-012 | R2 kanban | Deal score |
| RNOS-10 | AI-UC-011 | UI-R2-01 | NBA card |
| RNOS-11 | — | — | OpenSearch |
| RNOS-13–15 | AI-UC-020 | UI-R2-04 | Workflow builder |
| RNOS-17–18 | AI-UC-013 | §5.4, UI-R3 | Forecast |
| RNOS-19 | AI-UC-017 | R3 health | Churn |
| RNOS-20 | AI-UC-014 | R3 renewal | Agent workflow |
| RNOS-22 | AI-UC-016 | Cmd+K R3 | NL query |
| RNOS-29 | AI-UC-018 | insights inbox | Feedback loop |

PR R2+ mở rộng block [D](#d-checklist-theo-rnos-r1--phase-0) theo cùng format khi Gate R1 pass.

---

## H. PR ngoài AI (CRM / Channel / Portal)

Dùng checklist module tương ứng — **không** bắt buộc RNOS AI:

| Module | Actions file | Gap ref |
|--------|--------------|---------|
| CRM | [`01-CRM-ACTIONS.md`](../use-cases/actions/01-CRM-ACTIONS.md) | GAP doc |
| Meta | [`03-META-ACTIONS.md`](../use-cases/actions/03-META-ACTIONS.md) | |
| Zalo | [`04-ZALO-ACTIONS.md`](../use-cases/actions/04-ZALO-ACTIONS.md) | |
| Platform | [`07-PLAT-ACTIONS.md`](../use-cases/actions/07-PLAT-ACTIONS.md) | |

PR template tối thiểu: **UC-XXX** · actions § · smoke route · regression note.

---

## I. Tài liệu liên quan

| Doc | Nội dung |
|-----|----------|
| **GitHub repo** | https://github.com/sdadtuan/RNOSAI |
| [github-setup.md](https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/github-setup.md) | Issues, labels, workflow |
| [`2026-07-26-rnosai-system-implementation-plan.md`](../specs/2026-07-26-rnosai-system-implementation-plan.md) | Workstreams, gate, tuần 1 |
| [`2026-07-26-ai-phase1-90-day-plan.md`](../specs/2026-07-26-ai-phase1-90-day-plan.md) | Deliverable tuần-by-tuần |
| [`ACTION-GAP-ANALYSIS.md`](../use-cases/ACTION-GAP-ANALYSIS.md) | GAP-AI snapshot · GAP-AI-R1-01…03 polish |

### GAP-AI snapshot (sync với code — 2026-07-26)

| ID | Trạng thái | Evidence |
|----|------------|----------|
| GAP-AI-01…05 | ✅ Shipped | Copilot, score, draft, `/admin/ai/runs`, override @ `d2f07b8` |
| GAP-AI-R1-01 | ○ Open | Trust footer §4.6 |
| GAP-AI-R1-02 | ○ Open | Sort leads by score (stretch) |
| GAP-AI-R1-03 | ○ Open | Gate R1 prod sign-off RNOS-40 |

---

*PR Checklist v1.1 — cập nhật khi thêm RNOS hoặc đổi Gate R1.*
