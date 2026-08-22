# CSKH Enterprise E0→E5 — Implementation Plan (12 tuần)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai tuần tự wave E0→E5 — từ home SLA widgets đến predictive alerts, LLM triage, playbook closed-loop, và GDKD 8-KPI enterprise sign-off.

**Architecture:** Mở rộng module `cskh-board`, `leads-funnel`, `ai-intelligence` hiện có — không microservice mới. Compose APIs từ `CskhBoardService`, `LeadsFunnelService`, `AiNbaService`. SSE alerts qua Nest `@Sse()`. Frontend widgets trên `/` và toast host trong `StaffPageShell`.

**Tech Stack:** NestJS (`ptt-crm-api`), Next.js ops-web, PostgreSQL, Jest, Playwright E2E, bash gate scripts.

**Spec:** [`docs/superpowers/specs/2026-08-04-cskh-enterprise-ai-wave-design.md`](../specs/2026-08-04-cskh-enterprise-ai-wave-design.md)

## Global Constraints

- **BR-AI-01:** Không auto-send Zalo/email/call — `sla-auto-task` chỉ tạo activity/reminder nội bộ.
- **BR-AI-04:** Rollout qua `PTT_AI_COPILOT_ROLLOUT_MODE=pilot|team|all` — không bỏ guard hoàn toàn.
- **BR-AI-05:** Score override GDKD → ghi `ai_score_feedback`.
- **PII:** Prod `PTT_AI_LOG_PII=0`, `PTT_AI_LOG_PROMPTS=0`.
- **Audit:** Mọi LLM call → `ai_agent_runs`.
- **SLA targets:** first_call ≥85%, b2 ≥80%, close ≥24h ≥70%, breach backlog ≤0, review age max <24h, copilot DAU ≥60%, NBA ≥35%, VND fill ≥90%.
- **Branch pattern:** `feat/cskh-e{N}-*` → gate PASS → merge `main`.
- **Không entity SQLite mới** — PG only.

---

## File map (toàn wave)

| File | Phase | Responsibility |
|------|-------|----------------|
| `ptt-crm-api/src/cskh-board/home-summary.util.ts` | E0 | Aggregate home KPI slice |
| `ptt-crm-api/src/cskh-board/cskh-board.controller.ts` | E0,E2,E3 | home-summary, sla-predictions, shift-handoff routes |
| `ops-web/src/components/home/HomeCskhWidgetRow.tsx` | E0 | Home widgets |
| `ops-web/src/app/page.tsx` | E0 | Wire widgets |
| `ops-web/src/app/crm/page.tsx` | E0 | Launcher badges |
| `ptt-crm-api/src/ai-intelligence/guards/staff-ai-copilot.guard.ts` | E1 | Rollout mode |
| `ptt-crm-api/src/ai-intelligence/ai-nba.service.ts` | E1 | LLM primary |
| `ptt-crm-api/src/cskh-board/sla-predict.util.ts` | E2 | Breach predictor |
| `ptt-crm-api/src/cskh-board/sla-alert.service.ts` | E2 | SSE stream |
| `ops-web/src/components/crm/SlaAlertToastHost.tsx` | E2 | In-app alerts |
| `ptt-crm-api/src/cskh-board/cskh-shift-handoff.util.ts` | E3 | Handoff report |
| `ptt-crm-api/src/leads-funnel/review-queue-llm.service.ts` | E3 | LLM triage |
| `ops-web/src/components/crm/CskhShiftHandoffPanel.tsx` | E3 | Handoff UI |
| `ptt-crm-api/src/playbooks/playbook-closed-loop.util.ts` | E4 | Playbook rank |
| `ptt-crm-api/migrations/*_ai_score_feedback.sql` | E4 | Feedback table |
| `ptt-crm-api/src/ai-intelligence/lead-score.engine.ts` | E4 | Score v2 |
| `scripts/cskh_enterprise_e5_gate.sh` | E5 | Final gate |
| `docs/runbooks/cskh-enterprise-ops-runbook.md` | E5 | Ops runbook |

---

## Phase E0 — Home widgets + CRM badges (tuần 1–2)

**Branch:** `feat/cskh-e0-home-widgets`  
**Gate:** `scripts/cskh_e0_home_gate.sh`

### Task E0-1: Home summary util + API

**Files:**
- Create: `services/ptt-crm-api/src/cskh-board/home-summary.util.ts`
- Create: `services/ptt-crm-api/src/cskh-board/home-summary.util.spec.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.service.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.module.ts`

**Interfaces:**
- Produces: `buildHomeSummary(input: { boardRows, reviewMetrics, adoption? }): HomeSummaryResponse`

- [ ] **Step 1: Write failing test**

```typescript
// home-summary.util.spec.ts
import { buildHomeSummary } from './home-summary.util';

describe('buildHomeSummary', () => {
  it('counts breach and warning from board rows', () => {
    const out = buildHomeSummary({
      boardRows: [
        { id: 1, sla_tiers: [{ tier: 'first_call_15m', sla_state: 'breach' }] },
        { id: 2, sla_tiers: [{ tier: 'b2_complete_4h', sla_state: 'warning' }] },
      ] as any,
      reviewMetrics: { pending_count: 3, max_age_hours: 12 },
    });
    expect(out.sla.breach_count).toBe(1);
    expect(out.sla.warning_count).toBe(1);
    expect(out.review_queue.pending_count).toBe(3);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/cskh-board/home-summary.util.spec.ts -v`

- [ ] **Step 3: Implement util + service method + `GET /api/crm/cskh-board/home-summary`**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/cskh-board/home-summary*
git commit -m "feat(cskh): add home summary API for SLA widgets"
```

### Task E0-2: Home widgets UI

**Files:**
- Create: `services/ops-web/src/components/home/HomeCskhWidgetRow.tsx`
- Modify: `services/ops-web/src/app/page.tsx`
- Modify: `services/ops-web/src/lib/api.ts`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: `fetchHomeSummary(token): Promise<HomeSummaryResponse>`

- [ ] **Step 1:** Add `fetchHomeSummary` + types in `api.ts`
- [ ] **Step 2:** Build `HomeCskhWidgetRow` — 4 cards: lead mới hôm nay, SLA breach, review queue, copilot DAU (hidden if AI off)
- [ ] **Step 3:** Wire `page.tsx` — poll 60s
- [ ] **Step 4:** Quick links: Lead, CSKH board, GDKD enterprise
- [ ] **Step 5:** Build verify: `cd services/ops-web && npm run build`
- [ ] **Step 6: Commit**

### Task E0-3: CRM launcher badges

**Files:**
- Modify: `services/ops-web/src/app/crm/page.tsx`

- [ ] **Step 1:** Poll `fetchHomeSummary` or review count — badge on CSKH board + review queue cards
- [ ] **Step 2:** Commit

### Task E0-4: Gate script

**Files:**
- Create: `scripts/cskh_e0_home_gate.sh`

- [ ] **Step 1:** Gate checks: home-summary spec, page.tsx imports widget, api.ts fetcher
- [ ] **Step 2:** Run gate — expect PASS
- [ ] **Step 3:** Commit + merge E0

---

## Phase E1 — AI prod rollout (tuần 3–4)

**Branch:** `feat/cskh-e1-ai-prod`  
**Gate:** `scripts/rnos_r1_prod_pilot_gate.sh` + acceptance ≥30%

### Task E1-1: Rollout mode guard

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/guards/staff-ai-copilot.guard.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/guards/staff-ai-copilot.guard.spec.ts`
- Modify: `deploy/env.ai.example`

**Interfaces:**
- Produces: `AiIntelligenceConfig.copilotRolloutMode: 'pilot' | 'team' | 'all'`
- Produces: `AiIntelligenceConfig.copilotTeamCaps: string[]` (default `['crm_leads']`)

- [ ] **Step 1:** Add env `PTT_AI_COPILOT_ROLLOUT_MODE`, `PTT_AI_COPILOT_TEAM_CAPS`
- [ ] **Step 2:** Guard: `team` = user has any team cap; `all` = copilot enabled only
- [ ] **Step 3:** Tests for pilot/team/all paths
- [ ] **Step 4:** Commit

### Task E1-2: NBA LLM primary

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-nba.service.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/lead-nba-llm.util.ts`
- Modify: `deploy/env.ai.example`

- [ ] **Step 1:** When `PTT_AI_NBA_LLM_PRIMARY=1`, try LLM first for SLA actions (`log_call`, `complete_b2`, `set_chot_audit`, `set_lost_reason`)
- [ ] **Step 2:** Fallback to `LeadSlaCareService.getSlaNbaForLead()` on timeout/error
- [ ] **Step 3:** Jest test mock LLM primary path
- [ ] **Step 4:** Commit

### Task E1-3: Dismiss reason analytics

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts`
- Modify: `services/ops-web/src/components/ai/NbaAcceptancePanel.tsx`

- [ ] **Step 1:** `GET /api/v1/ai/analytics/dismiss-reasons?days=7`
- [ ] **Step 2:** UI table top dismiss reasons
- [ ] **Step 3:** Commit + staging deploy with `PTT_AI_COPILOT_ROLLOUT_MODE=team`

---

## Phase E2 — Predictive SLA + alerts (tuần 5–7)

**Branch:** `feat/cskh-e2-sla-predict`  
**Gate:** `scripts/cskh_e2_sla_predict_gate.sh`

### Task E2-1: SLA predict util

**Files:**
- Create: `services/ptt-crm-api/src/cskh-board/sla-predict.util.ts`
- Create: `services/ptt-crm-api/src/cskh-board/sla-predict.util.spec.ts`

**Interfaces:**
- Produces: `predictSlaRisk(row: CskhBoardRow, now?: Date): SlaPredictRow[]`
- Produces: `filterPredictionsByOwner(rows: SlaPredictRow[], ownerId: number): SlaPredictRow[]`

- [ ] **Step 1:** TDD — imminent ≤5m, high ≤10m, medium ≤20m on warning state only
- [ ] **Step 2:** Map tier → suggested_action
- [ ] **Step 3:** Commit

### Task E2-2: Predictions API + safe auto-task

**Files:**
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.service.ts`
- Create: `services/ptt-crm-api/src/leads/sla-auto-task.service.ts`

- [ ] **Step 1:** `GET /api/crm/cskh-board/sla-predictions?owner_id=`
- [ ] **Step 2:** `POST /api/v1/leads/:id/sla-auto-task` — creates activity type `reminder`, body prefixed `SLA auto:`
- [ ] **Step 3:** BR-AI-01 test — no outbound message entities created
- [ ] **Step 4:** Commit

### Task E2-3: SSE alert stream

**Files:**
- Create: `services/ptt-crm-api/src/cskh-board/sla-alert.service.ts`
- Modify: `services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts`

- [ ] **Step 1:** `GET /api/crm/cskh-board/sla-alerts/stream` — `@Sse()`, interval 30s, emit only on delta hash change
- [ ] **Step 2:** Auth: staff token, filter by owner unless GDKD cap
- [ ] **Step 3:** Commit

### Task E2-4: Frontend toast host

**Files:**
- Create: `services/ops-web/src/components/crm/SlaAlertToastHost.tsx`
- Modify: `services/ops-web/src/components/layout/StaffPageShell.tsx`
- Modify: `services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx`
- Modify: `services/ops-web/src/lib/api.ts`

- [ ] **Step 1:** EventSource with poll fallback
- [ ] **Step 2:** Max 3 stacked toasts; dismiss + link to lead
- [ ] **Step 3:** CSKH board column "Risk" badge
- [ ] **Step 4:** E2E stub in `cskh-board.spec.ts` — mock SSE
- [ ] **Step 5:** Commit + gate script

---

## Phase E3 — Smart ops (tuần 8–9)

**Branch:** `feat/cskh-e3-handoff-triage`  
**Gate:** `scripts/cskh_e3_handoff_gate.sh`

### Task E3-1: Shift handoff report

**Files:**
- Create: `services/ptt-crm-api/src/cskh-board/cskh-shift-handoff.util.ts`
- Create: `services/ptt-crm-api/src/cskh-board/cskh-shift-handoff.util.spec.ts`
- Create: `services/ops-web/src/components/crm/CskhShiftHandoffPanel.tsx`
- Modify: `services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx`

**Interfaces:**
- Produces: `buildShiftHandoffReport(rows, reviewMetrics, shift): ShiftHandoffReport`

- [ ] **Step 1:** TDD handoff markdown template
- [ ] **Step 2:** `GET /api/crm/cskh-board/shift-handoff`
- [ ] **Step 3:** UI panel + copy button
- [ ] **Step 4:** Commit

### Task E3-2: Review queue LLM triage

**Files:**
- Create: `services/ptt-crm-api/src/leads-funnel/review-queue-llm.service.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/leads-funnel.controller.ts`
- Modify: `services/ops-web/src/app/crm/leads/review-queue/page.tsx`

- [ ] **Step 1:** `GET /review-queue/ai-summaries?mode=llm` with rules fallback
- [ ] **Step 2:** Audit `review_queue_triage` in `ai_agent_runs`
- [ ] **Step 3:** UI priority badge + suggested owner highlight
- [ ] **Step 4:** Commit

---

## Phase E4 — Closed-loop learning (tuần 10–11)

**Branch:** `feat/cskh-e4-playbook-feedback`  
**Gate:** `scripts/cskh_e4_playbook_gate.sh`

### Task E4-1: ai_score_feedback migration

**Files:**
- Create: `services/ptt-crm-api/migrations/YYYYMMDDHHMMSS_ai_score_feedback.sql`
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-score-feedback.repository.ts`

- [ ] **Step 1:** Migration + repository
- [ ] **Step 2:** Hook override endpoint + chot/lost outcome backfill
- [ ] **Step 3:** Commit

### Task E4-2: Score v2 engine

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/lead-score.engine.ts`
- Create: `services/ptt-crm-api/src/ai-intelligence/lead-score.engine.v2.spec.ts`

- [ ] **Step 1:** v2 = v1 + feedback adjustment ±5 points max
- [ ] **Step 2:** Feature flag `PTT_AI_SCORE_V2=1`
- [ ] **Step 3:** Commit

### Task E4-3: Playbook auto-rank

**Files:**
- Create: `services/ptt-crm-api/src/playbooks/playbook-closed-loop.util.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-nba.service.ts` (RAG prefers ranked)
- Modify: `services/ptt-crm-api/src/playbooks/playbooks.controller.ts`

- [ ] **Step 1:** Rank from playbook-ab-metrics chốt rate
- [ ] **Step 2:** `GET /api/v1/ai/playbooks/ranked?context=cskh_sla`
- [ ] **Step 3:** Commit

---

## Phase E5 — Enterprise sign-off (tuần 12)

**Branch:** `feat/cskh-e5-gate`  
**Gate:** `scripts/cskh_enterprise_e5_gate.sh`

### Task E5-1: E2E home widgets

**Files:**
- Create: `services/ops-web/e2e/home-cskh-widgets.spec.ts`

- [ ] **Step 1:** Login → `/` → assert SLA breach card visible, link to cskh-board works
- [ ] **Step 2:** Commit

### Task E5-2: Enterprise gate script

**Files:**
- Create: `scripts/cskh_enterprise_e5_gate.sh`

- [ ] **Step 1:** Chain E0, E2, board gate, jest specs, e2e
- [ ] **Step 2:** Run full gate — expect PASS
- [ ] **Step 3:** Commit

### Task E5-3: Enterprise ops runbook

**Files:**
- Create: `docs/runbooks/cskh-enterprise-ops-runbook.md`
- Modify: `docs/runbooks/cskh-spa-lead-meta-24h-sop.md` (link to enterprise runbook)

- [ ] **Step 1:** Document 4-tier flow, shift handoff, alert policy, GDKD weekly review
- [ ] **Step 2:** Commit

### Task E5-4: GDKD sign-off template

**Files:**
- Create: `docs/templates/cskh-enterprise-e5-signoff.md`

- [ ] **Step 1:** 8 KPI checklist + trend columns + sign-off lines
- [ ] **Step 2:** Commit + tag release note

---

## Self-review (plan vs spec)

| Spec section | Task |
|--------------|------|
| E0 home-summary API | E0-1 |
| E0 widgets §1.1–1.4 | E0-2 |
| E0 launcher badges §2.1 | E0-3 |
| E1 rollout mode | E1-1 |
| E1 NBA LLM primary | E1-2 |
| E2 sla-predict | E2-1 |
| E2 SSE + auto-task | E2-2, E2-3 |
| E2 toast UI | E2-4 |
| E3 shift handoff | E3-1 |
| E3 review queue LLM | E3-2 |
| E4 score feedback | E4-1 |
| E4 score v2 | E4-2 |
| E4 playbook rank | E4-3 |
| E5 gate + runbook | E5-1–E5-4 |

**Placeholder scan:** None — all tasks have file paths and interfaces.

**Type consistency:** `HomeSummaryResponse`, `SlaPredictRow`, `ShiftHandoffReport` defined in spec §5 and referenced in tasks.

---

## Execution calendar

| Tuần | Phase | Merge target |
|------|-------|--------------|
| 1–2 | E0 | `feat/cskh-e0-home-widgets` |
| 3–4 | E1 | `feat/cskh-e1-ai-prod` |
| 5–7 | E2 | `feat/cskh-e2-sla-predict` |
| 8–9 | E3 | `feat/cskh-e3-handoff-triage` |
| 10–11 | E4 | `feat/cskh-e4-playbook-feedback` |
| 12 | E5 | `feat/cskh-e5-gate` |

**Verify mỗi phase:**
```bash
cd services/ptt-crm-api && npx jest --testPathPattern=cskh-board --silent
cd services/ops-web && npm run build
bash scripts/cskh_e{N}_*_gate.sh   # phase gate
```
