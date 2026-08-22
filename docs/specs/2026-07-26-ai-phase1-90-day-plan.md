# AI Phase 1 — Kế hoạch 90 ngày (Phase 0 + R1)

> **Phiên bản:** 1.0 · **Ngày:** 2026-07-26  
> **Horizon:** 90 ngày (~12 tuần) · **Wave:** Phase 0 (tuần 1–4) + R1 AI Assist (tuần 5–12)  
> **Master spec:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) §0.4, §23  
> **Kế hoạch triển khai:** [`2026-07-26-rnosai-system-implementation-plan.md`](2026-07-26-rnosai-system-implementation-plan.md)  
> **DDL:** [`2026-07-26-postgresql-ddl-revenue-os-ai.sql`](2026-07-26-postgresql-ddl-revenue-os-ai.sql)  
> **Deliverables:** RNOS-01…08, RNOS-16 (partial), RNOS-39, RNOS-40  

---

## Mục lục

1. [Mục tiêu 90 ngày](#1-mục-tiêu-90-ngày)
2. [Phạm vi IN / OUT](#2-phạm-vi-in--out)
3. [Team & vai trò](#3-team--vai-trò)
4. [Tiên quyết & môi trường](#4-tiên-quyết--môi-trường)
5. [Lộ trình theo tuần](#5-lộ-trình-theo-tuần)
6. [Backlog theo deliverable (RNOS)](#6-backlog-theo-deliverable-rnos)
7. [API & UI checklist](#7-api--ui-checklist)
8. [Kiểm thử & nghiệm thu](#8-kiểm-thử--nghiệm-thu)
9. [Baseline KPI & đo lường](#9-baseline-kpi--đo-lường)
10. [Rủi ro & phụ thuộc](#10-rủi-ro--phụ-thuộc)
11. [Pilot go-live (tuần 12)](#11-pilot-go-live-tuần-12)

---

## 1. Mục tiêu 90 ngày

**Outcome:** CSKH pilot **dùng AI mỗi ngày** trên lead detail — summary, score giải thích, draft follow-up có approve — với **100% audit**.

| # | Mục tiêu | Chỉ số thành công (tuần 12) |
|---|----------|------------------------------|
| G1 | Data sẵn sàng cho AI | ≥80% lead pilot có source + attribution |
| G2 | Copilot usable | Copilot DAU ≥60% team pilot |
| G3 | Lead score v1 | Score visible ≤30s sau lead created (async) |
| G4 | Giảm nhập liệu | Time-to-log giảm ≥25% (survey + telemetry) |
| G5 | Trust & compliance | 100% LLM calls có `ai_agent_runs`; không PII trong prompt log prod |
| G6 | AI adoption | Acceptance rate ≥35% trên draft/summary |

**Không mục tiêu 90 ngày:** NBA deal, forecast MAPE, ML XGBoost, chatbot Page, NL SQL, multi-agent.

---

## 2. Phạm vi IN / OUT

### 2.1. IN (ship trong 90 ngày)

| Hạng mục | Mô tả |
|----------|-------|
| DDL Revenue OS AI | ✅ `2026-07-26-postgresql-ddl-revenue-os-ai.sql` |
| Nest `ai-intelligence` module | summarize, score/lead, audit |
| Copilot panel | Sidebar `/crm/leads/[id]` |
| Lead score v1 | Rules engine + explainability |
| Activity summary | Note/call log → summary + extract |
| Follow-up draft | Zalo/email draft → approve (không auto-send) |
| Timeline v1 | Ghi `customer_timeline_events` từ activity + webhook meta |
| Event `tenant.lead.scored` | domain_events outbox |
| E2E + runbook | RNOS-39, RNOS-40 |

### 2.2. OUT (defer R2+)

| Hạng mục | Wave |
|----------|------|
| Deal score, NBA card | R2 |
| OpenSearch, vector RAG | R2 |
| Workflow builder UI | R2 |
| Forecast, churn, renewal agent | R3 |
| PWA mobile (ưu tiên sau copilot nếu slip) | R1 stretch |
| Chatbot Facebook Page | — |

---

## 3. Team & vai trò

| Vai trò | Trách nhiệm Phase 1 | FTE ước lượng |
|---------|---------------------|---------------|
| **Tech lead / Backend** | Nest module, scoring rules, events, PG repos | 0.5–1 |
| **Full-stack** | Copilot UI ops-web, API client, approve flow | 0.5–1 |
| **LLM / AI product** | Prompts, golden cases, eval gate | 0.25–0.5 |
| **QA** | E2E, load P95 summary, UAT checklist | 0.25 |
| **CSKH pilot lead** | UAT, feedback accept/dismiss | 0.1 |
| **Platform / DevOps** | Env keys, DDL staging/prod, runbook | 0.1 |

**Pilot team:** 5–8 CSKH trên ops-web production hoặc staging mirror prod.

---

## 4. Tiên quyết & môi trường

### 4.1. Infrastructure

| Item | Staging | Production pilot |
|------|---------|------------------|
| PostgreSQL DDL applied | `./scripts/apply_pg_ddl_revenue_os_ai.sh` | Same + backup trước apply |
| `DATABASE_URL` Nest | ✅ | ✅ |
| LLM provider API key | `AI_LLM_API_KEY` | Vault, không commit |
| Feature flag | `PTT_AI_COPILOT_ENABLED=1` | Pilot cohort only |

### 4.2. Env vars đề xuất (Nest)

```bash
# ai-intelligence module
PTT_AI_COPILOT_ENABLED=0          # 1 = bật UI + API
PTT_AI_LLM_PROVIDER=openai          # hoặc azure / anthropic
PTT_AI_LLM_MODEL=gpt-4o-mini        # summarize/score v1
PTT_AI_LLM_TIMEOUT_MS=8000
PTT_AI_LOG_PII=0                    # prod: 0 bắt buộc
PTT_AI_SCORE_ASYNC=1                # job queue cho score sau ingest
```

### 4.3. Code locations (target)

| Layer | Path |
|-------|------|
| Nest module | `services/ptt-crm-api/src/ai-intelligence/` |
| Controller | `ai-intelligence.controller.ts` → `/api/v1/ai/*` |
| PG repos | `ai-*.repository.ts` |
| Worker job | `ptt_jobs/handlers/ai_lead_score.py` (optional) hoặc Nest queue |
| ops-web UI | `services/ops-web/src/components/LeadCopilotPanel.tsx` |
| Lead page | `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| API client | `services/ops-web/src/lib/api.ts` |
| E2E | `services/ops-web/e2e/ai-copilot.spec.ts` |
| Runbook | `docs/runbooks/ai-service-operations.md` |

---

## 5. Lộ trình theo tuần

### Phase 0 — Data foundation (Tuần 1–4)

#### Tuần 1 — DDL & module skeleton

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| Apply DDL staging | Platform | RNOS-01 | Migration `2026-07-26-revenue-os-ai` OK |
| Scaffold `AiIntelligenceModule` + health route | Backend | RNOS-02 | `GET /api/v1/ai/health` 200 |
| PG repository: `ai_agent_runs` insert | Backend | RNOS-05 | Unit test insert |
| Document env vars trong deploy example | Platform | RNOS-40 | `deploy/env.ai.example` |

#### Tuần 2 — Audit path & timeline schema

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| `AiAuditService` — wrap mọi LLM call | Backend | RNOS-05 | prompt_hash + latency logged |
| `CustomerTimelineRepository` — insert/read | Backend | RNOS-16 | API internal insert activity→timeline |
| Hook lead activity create → timeline event | Backend | RNOS-16 | Activity mới có timeline row |
| Golden prompt fixtures (10 cases VN) | AI product | — | File trong `tests/fixtures/ai/` |

#### Tuần 3 — Attribution & events

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| Enrich timeline từ Meta/Zalo lead webhook metadata | Backend | RNOS-16 | `event_source=meta|zalo` on ingest |
| Lead score job stub (rules only, no LLM) | Backend | RNOS-04 | Score row on manual trigger |
| Publish `tenant.lead.scored` → `domain_events` | Backend | RNOS-08 | Event in outbox |
| Baseline report SQL: attribution % | AI product | G1 | Snapshot số liệu tuần 3 |

#### Tuần 4 — Phase 0 gate

| Task | Owner | Done when |
|------|-------|-----------|
| Timeline completeness audit | QA | ≥70% lead pilot có ≥1 timeline event |
| Attribution audit | QA | ≥80% lead có source |
| Staging soak | Platform | No DDL migration errors 7d |
| **Gate Phase 0** | Tech lead | Sign-off checklist §8.1 pass |

---

### R1 — AI Assist (Tuần 5–12)

#### Tuần 5 — `POST /ai/summarize`

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| Implement summarize endpoint (note/call body) | Backend | RNOS-03 | JSON schema output validated |
| Prompt v1 in `ai_prompts` seed | AI product | — | `use_case=summarize_activity` |
| Load test P95 ≤5s (staging) | QA | §19.1 | Report attached |

#### Tuần 6 — Lead score v1

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| `POST /ai/score/lead` rules engine | Backend | RNOS-04 | explainability_json populated |
| Async score on `tenant.lead.created` consumer | Backend | RNOS-08 | ≤30s score visible |
| `GET /ai/scores?entity_type=lead&entity_id=` | Backend | RNOS-04 | ops-web can poll |
| Score factors doc for CSKH | AI product | — | 1-pager tiếng Việt |

**Score v1 formula (rules):**

```text
score = clamp(0, 100,
  base_source(channel, campaign_mapped)
  + sla_bonus(first_contact_within_15m)
  + value_bonus(estimated_deal_value)
  - duplicate_penalty
  - stale_penalty(hours_since_created)
)
```

#### Tuần 7 — Copilot UI shell

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| `LeadCopilotPanel` component | Full-stack | RNOS-06 | Renders on lead detail |
| Feature flag gating | Full-stack | — | Hidden when flag off |
| Display score + explainability chips | Full-stack | RNOS-06 | Readable VN labels |
| Summarize button → loading → result | Full-stack | RNOS-06 | Error state handled |

#### Tuần 8 — Follow-up draft + approve

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| `POST /ai/recommendation` type=follow_up_draft | Backend | RNOS-07 | Stores `ai_recommendations` |
| UI: Generate draft → edit → Approve / Dismiss | Full-stack | RNOS-07 | BR-AI-01 enforced |
| Approve copies to activity note (not send) | Full-stack | RNOS-07 | Audit `accepted_by` |
| Track dismiss reason (optional) | Full-stack | RNOS-29 partial | Status updated |

#### Tuần 9 — Lead Brief & integration hardening

| Task | Owner | Done when |
|------|-------|-----------|
| Lead Brief (5 bullets) prompt + UI section | AI + FS | On page load optional fetch |
| Wire campaign/CPL context from `crm_leads.meta_json` | Backend | Brief mentions source |
| Rate limit `/ai/*` per user | Backend | 429 after threshold |
| Retry + idempotency on score job | Backend | No duplicate scores 5m window |

#### Tuần 10 — E2E & security

| Task | Owner | RNOS | Done when |
|------|-------|------|-----------|
| Playwright E2E: lead → score → summarize → draft approve | QA | RNOS-39 | CI green |
| Verify no PII in prompt logs (prod config) | Platform | §19.1 | Config review signed |
| RBAC: CSKH only own leads copilot | Backend | — | 403 on other owner |
| Runbook draft | Platform | RNOS-40 | Rollback model/prompt steps |

#### Tuần 11 — Pilot prep

| Task | Owner | Done when |
|------|-------|-----------|
| UAT checklist walkthrough with CSKH lead | QA | §8.2 signed |
| Training 30 phút: copilot + approve flow | CSKH lead | Attendance log |
| Baseline survey time-to-log (pre) | AI product | Form before pilot |
| Enable flag pilot cohort only | Platform | 5–8 users |

#### Tuần 12 — Pilot go-live & review

| Task | Owner | Done when |
|------|-------|-----------|
| Pilot week (monitor DAU, errors, acceptance) | All | Daily standup 15m |
| Post-pilot metrics vs baseline | AI product | G2–G6 report |
| **Gate R1** | Tech lead | §8.3 pass |
| Backlog R2 prioritization | Product | NBA + OpenSearch top |

---

## 6. Backlog theo deliverable (RNOS)

| ID | Tuần target | Definition of Done |
|----|-------------|-------------------|
| **RNOS-01** | 1 | DDL applied staging + prod plan |
| **RNOS-02** | 1 | Module registered in `app.module.ts` |
| **RNOS-03** | 5 | Summarize API + schema validation |
| **RNOS-04** | 6 | Score API + rules + explainability |
| **RNOS-05** | 1–2 | 100% calls → `ai_agent_runs` |
| **RNOS-06** | 7 | Copilot panel on lead detail |
| **RNOS-07** | 8 | Draft + approve/dismiss |
| **RNOS-08** | 6 | Event + async consumer |
| **RNOS-16** | 2–3 | Timeline from activity + webhook |
| **RNOS-39** | 10 | E2E CI |
| **RNOS-40** | 10 | Runbook published |

---

## 7. API & UI checklist

### 7.1. API (Nest `/api/v1/ai`)

| Method | Path | Tuần | Request | Response |
|--------|------|------|---------|----------|
| GET | `/ai/health` | 1 | — | `{ status, model }` |
| POST | `/ai/summarize` | 5 | `{ entity_type, entity_id, text, context? }` | `{ summary, extracted }` |
| POST | `/ai/score/lead` | 6 | `{ lead_id }` | `{ score, confidence, explainability }` |
| GET | `/ai/scores` | 6 | `entity_type, entity_id` | `{ data: [...] }` |
| POST | `/ai/recommendation` | 8 | `{ type: follow_up_draft, ... }` | `{ id, text, status }` |
| PATCH | `/ai/recommendations/:id` | 8 | `{ status: accepted\|dismissed }` | `{ data }` |
| GET | `/ai/recommendations` | 8 | `entity_type, entity_id, status?` | list |

**Response envelope:** `{ data, meta: { request_id }, errors: [] }` (spec §12.5).

### 7.2. UI — Lead Copilot Panel

| UI element | Behavior |
|------------|----------|
| **Score card** | Score 0–100 + chips explain (+/− factors) |
| **Lead brief** | Button "Tóm tắt nhanh" → 5 bullets |
| **Summarize activity** | Select activity or paste note → summary |
| **Draft follow-up** | Generate → textarea editable → **Duyệt** / Bỏ |
| **Low confidence** | Banner if confidence < 0.6 (BR-AI-02) |
| **Loading / error** | Skeleton + retry; không block CRM core |

**Wireframe (ASCII):**

```text
┌─ Lead #12345 ─────────────────────┬─ AI Copilot ─────────────┐
│ Status · Owner · Source Meta      │ Score: 78 [hot]          │
│ ... existing CRM form ...         │ + Meta campaign mapped   │
│                                   │ − Chưa gọi (2h)          │
│ Activities                        │ [Tóm tắt nhanh]          │
│ ...                               │ [Soạn follow-up]         │
└───────────────────────────────────┴──────────────────────────┘
```

---

## 8. Kiểm thử & nghiệm thu

### 8.1. Gate Phase 0 (cuối tuần 4)

- [ ] DDL migration applied staging
- [ ] ≥70% timeline completeness (pilot sample n≥50 leads)
- [ ] ≥80% leads có `source` + `channel`
- [ ] `ai_agent_runs` insert works (health check call)
- [ ] No regression CRM lead ingest

### 8.2. Gate UAT pilot (tuần 11)

- [ ] CSKH walkthrough 8 bước ([actions doc TODO](../use-cases/actions/09-AI-ACTIONS.md))
- [ ] Summarize P95 ≤5s staging
- [ ] Approve draft không gửi outbound tự động
- [ ] Override score ghi `overridden_by` (stretch tuần 11)

### 8.3. Gate R1 (cuối tuần 12) — spec §19.1

| # | Criteria | Method |
|---|----------|--------|
| 1 | Lead created → score ≤30s | E2E + prod metrics |
| 2 | Summary P95 ≤5s | Load test |
| 3 | Draft requires approve | Manual + E2E |
| 4 | 100% AI calls audited | SQL `COUNT agent_runs` |
| 5 | No PII prompt logs prod | Config + spot check |
| 6 | Copilot on `/crm/leads/[id]` | UAT sign-off |

---

## 9. Baseline KPI & đo lường

**Chốt baseline tuần 3** (trước bật copilot tuần 11):

| Metric | Cách đo | Baseline (điền) | Target tuần 12 |
|--------|---------|-----------------|----------------|
| Lead response ≤15p | CSKH board SLA | TBD | ≥90% |
| Time-to-log (phút) | Survey + `created_at` activity delta | TBD | −25% |
| Copilot DAU | `ai_agent_runs` distinct actor | 0 | ≥60% pilot |
| AI acceptance | accepted / (accepted+dismissed) | — | ≥35% |
| Attribution coverage | SQL % leads mapped | TBD | ≥80% |

**SQL mẫu — attribution:**

```sql
SELECT
  COUNT(*) FILTER (WHERE source <> '' AND channel <> '') * 100.0 / NULLIF(COUNT(*), 0) AS pct_attributed
FROM crm_leads
WHERE created_at >= NOW() - INTERVAL '90 days';
```

---

## 10. Rủi ro & phụ thuộc

| Rủi ro | Mức | Mitigation |
|--------|-----|------------|
| LLM latency >5s | Cao | Async summarize; shorter prompt; fallback truncate |
| Prompt quality tiếng Việt | Trung bình | Golden cases; human review tuần 5–6 |
| Timeline trống → brief kém | Cao | Phase 0 gate bắt buộc |
| CSKH không adopt | Cao | Pilot nhỏ; training; measure DAU daily |
| Duplicate score jobs | Trung bình | Idempotency key per lead per 5m |
| PII leak logs | Cao | `PTT_AI_LOG_PII=0`; redact phone/email in prompt |
| Slip 90d | Trung bình | Cut PWA; cut Lead Brief; core = score+summarize+draft |

**Phụ thuộc ngoài team:**

- Meta/Zalo webhook stable (lead ingest)
- LLM API quota/billing approved
- Pilot CSKH manager time tuần 11

---

## 11. Pilot go-live (tuần 12)

> **Playbook vận hành CSKH 90 ngày (flag, KPI dashboard, weekly review):** [`docs/runbooks/cskh-ai-pilot-90-day-playbook.md`](../runbooks/cskh-ai-pilot-90-day-playbook.md)

### 11.1. Rollout steps

1. Apply DDL production (maintenance window + backup).
2. Deploy Nest + ops-web với `PTT_AI_COPILOT_ENABLED=0`.
3. Smoke test staging checklist §8.3.
4. Enable flag cho 5–8 user IDs pilot.
5. Monitor `#ai-alerts` Slack (hoặc log dashboard) 48h.
6. Daily review: DAU, error rate, acceptance, CSKH feedback.

### 11.2. Rollback

| Trigger | Action |
|---------|--------|
| Error rate >5% AI calls | Set `PTT_AI_COPILOT_ENABLED=0` |
| PII in logs | Disable module + fix redaction |
| LLM provider outage | Copilot shows degraded; score rules-only mode |

Chi tiết: `docs/runbooks/ai-service-operations.md` (RNOS-40, tuần 10).

### 11.3. Sau tuần 12 → R2 preview

| Ưu tiên R2 | RNOS |
|------------|------|
| Next best action card | RNOS-10 |
| OpenSearch CRM | RNOS-11 |
| Deal score | RNOS-09 |
| AI acceptance feedback analytics | RNOS-29 |

---

## Phụ lục — Tuần ↔ Calendar (ví dụ start 2026-07-28)

| Tuần | Ngày | Milestone |
|------|------|-----------|
| 1 | 28/07 – 03/08 | DDL + module skeleton |
| 2 | 04/08 – 10/08 | Audit + timeline |
| 3 | 11/08 – 17/08 | Events + score stub |
| 4 | 18/08 – 24/08 | **Gate Phase 0** |
| 5 | 25/08 – 31/08 | Summarize API |
| 6 | 01/09 – 07/09 | Lead score v1 |
| 7 | 08/09 – 14/09 | Copilot UI |
| 8 | 15/09 – 21/09 | Follow-up draft |
| 9 | 22/09 – 28/09 | Lead brief + hardening |
| 10 | 29/09 – 05/10 | E2E + runbook |
| 11 | 06/10 – 12/10 | UAT + training |
| 12 | 13/10 – 19/10 | **Pilot + Gate R1** |

---

*Tài liệu triển khai Phase 1 — đồng bộ với RNOSAI Master Spec v2.0*
