# Runbook CSKH Enterprise — Spa Meta 24h + AI Wave E0–E5

**Phiên bản:** 1.0 · **Ngày:** 2026-08-04  
**Phạm vi:** Lead spa Meta 24h (`spa_operational`) — CSKH rep, Team Lead, GDKD, Platform  
**Gate cuối:** `bash scripts/cskh_enterprise_e5_gate.sh`

> **Canonical (đầy đủ):** [`huong-dan-cskh-enterprise-ops.md`](../huong-dan-cskh-enterprise-ops.md) — setup VPS, wave E0–E5, màn hình, gate  
> SOP hàng ngày rep: [cskh-spa-lead-meta-24h-sop.md](./cskh-spa-lead-meta-24h-sop.md)  
> Sign-off GDKD tuần 12: [cskh-enterprise-e5-signoff.md](../templates/cskh-enterprise-e5-signoff.md)

---

## 1. Luồng 4 tầng (E0 → E5)

| Tầng | Wave | Vai trò chính | Artifact |
|------|------|---------------|----------|
| **Home** | E0 | Rep / GDKD | `/` widgets · `GET /api/crm/cskh-board/home-summary` |
| **Board + AI prod** | E1 | Rep + GDKD rollout | Copilot rollout · NBA LLM primary |
| **Predictive SLA** | E2 | Rep + Team Lead | SSE alerts · auto-task nội bộ (BR-AI-01) |
| **Smart ops** | E3 | Team Lead + GDKD | Shift handoff · review queue LLM triage |
| **Closed-loop** | E4 | GDKD + AI Product | Score v2 feedback · playbook auto-rank |
| **Sign-off** | E5 | GDKD | 8 KPI gate · runbook này · template ký |

**BR-AI-01:** Không auto-send khách — draft, note nội bộ, handoff markdown only.  
**BR-AI-04:** Copilot theo `PTT_AI_COPILOT_ROLLOUT_MODE` (pilot / team / all).

---

## 2. Home dashboard (E0)

**URL:** `/` (ops-web)

Widgets poll `home-summary` mỗi 60s:

- Lead Meta mới hôm nay → `/crm/leads?status=moi`
- SLA breach / warning → `/crm/cskh-board?sla_filter=breach`
- Review queue pending → `/crm/leads/review-queue`
- Copilot DAU (khi bật) → `/crm/ai/insights`

**GDKD verify hàng ngày:** số breach home khớp board · review queue max age < 24h.

---

## 3. CSKH board & predictive SLA (E1–E2)

**URL:** `/crm/cskh-board`

| Chức năng | Hành vi |
|-----------|---------|
| Tier SLA 15p / 4h / 24h | Filter breach · warning · bulk assign |
| Breach backlog panel | Target 0 cuối ca |
| Risk column (E2) | Sắp breach từ `sla-predictions` |
| SSE toasts (E2) | High/imminent · poll fallback 60s |
| Shift handoff (E3) | Copy markdown cuối ca |

**Alert policy (Team Lead):**

1. Toast high/imminent → rep xử lý trong 5 phút hoặc reassign.
2. Nếu SSE fail → poll vẫn chạy; không block ops.
3. `POST /api/v1/leads/:id/sla-auto-task` chỉ tạo **note nội bộ** — không gửi khách.

---

## 4. Shift handoff cuối ca (E3)

**API:** `GET /api/crm/cskh-board/shift-handoff`  
**UI:** Panel trên board (GDKD / cap assign)

Handoff markdown gồm:

- Breach backlog + gate pass/fail
- Open SLA theo tier
- Review queue pending + max age
- Top 5 breach leads

**Quy trình Team Lead cuối ca:**

1. Mở panel → **Copy markdown** → paste Slack nội bộ ca sau.
2. Nếu breach backlog > 0 → bulk assign hoặc escalate GDKD trước hết ca.
3. Link review queue nếu pending > 0 hoặc max age ≥ 24h.

---

## 5. Review queue LLM triage (E3)

**URL:** `/crm/leads/review-queue`  
**API:** `GET /api/v1/leads/review-queue/ai-summaries?mode=llm` (fallback rules)

GDKD QA hàng tuần:

- Priority P1–P5 hợp lý với hours_waiting
- Gợi ý owner có workload_note
- Audit `review_queue_triage` trong `/admin/ai/runs`

---

## 6. AI habits (E1 + E4)

### Copilot rollout

```
PTT_AI_COPILOT_ENABLED=1
PTT_AI_COPILOT_ROLLOUT_MODE=team   # hoặc pilot | all
PTT_AI_NBA_LLM_PRIMARY=1
```

### Score v2 closed-loop (E4)

```
PTT_AI_SCORE_V2=1
```

- GDKD override → `ai_score_feedback` row
- Lead chốt/lost → backfill outcome
- Score v2 = rules v1 ±5 điểm từ feedback

### Playbook auto-rank (E4)

- `GET /api/v1/ai/playbooks/ranked?context=cskh_sla`
- NBA RAG ưu tiên chunk rank cao (chốt ≤24h rate)

---

## 7. GDKD weekly review (8 KPI)

**URL:** `/crm/gdkd-enterprise`  
**API:** `GET /api/crm/gdkd-enterprise/kpi?days=7`

| KPI | Target | Drill |
|-----|--------|-------|
| first_call_15m | ≥85% | Board tier 15p |
| b2_4h | ≥80% | Board tier 4h |
| close_24h | ≥70% | Board tier 24h |
| breach_backlog | ≤0 cuối ca | Board breach filter |
| review_queue_age | max <24h | Review queue inbox |
| copilot_dau | ≥60% | AI insights |
| nba_acceptance | ≥35% | NBA panel |
| roas_vnd_fill | ≥90% VND | Closed-loop chốt |

Mỗi tile có `pass` và `gate_pass` (boolean | null).

**Weekly checklist GDKD:**

1. Mở KPI dashboard → ghi snapshot vào [sign-off template](../templates/cskh-enterprise-e5-signoff.md).
2. Drill tile fail → owner + deadline tuần tới.
3. Review playbook A/B narrative trên board closed-loop panel.
4. Audit score override tuần (AI-UC-006) nếu `PTT_AI_SCORE_V2=1`.
5. Chạy gate staging: `bash scripts/cskh_enterprise_e5_gate.sh`.

---

## 8. Deploy & verify

```bash
# Wave gates (từng phase)
bash scripts/cskh_e0_home_gate.sh
bash scripts/cskh_e1_ai_prod_gate.sh
bash scripts/cskh_e2_sla_predict_gate.sh
bash scripts/cskh_e3_handoff_gate.sh
bash scripts/cskh_e4_playbook_gate.sh

# Enterprise sign-off (chain tất cả + jest + docs)
bash scripts/cskh_enterprise_e5_gate.sh

# E2E full stack (optional)
OPS_E2E_SKIP_SERVER=0 bash scripts/playwright_ops_cskh_enterprise_e5_e2e.sh
```

**Migration E4 (PG):** `services/ptt-crm-api/migrations/20260804100000_ai_score_feedback.sql`

---

## 9. Escalation

| Tình huống | Hành động |
|------------|-----------|
| Breach backlog > 0 cuối ca | Team Lead bulk assign · GDKD sign-off exception ghi rõ lý do |
| Review queue max ≥24h | GDKD release hoặc reassign · không để qua 48h |
| Copilot DAU <60% | Training rep · kiểm tra rollout mode / caps |
| Gate E5 FAIL | Platform fix phase gate trước · không ký enterprise |

---

## Tham chiếu

- [Hướng dẫn CSKH Enterprise (VPS + UI)](../huong-dan-cskh-enterprise-ops.md) — **canonical**
- [Spec wave E0–E5](../superpowers/specs/2026-08-04-cskh-enterprise-ai-wave-design.md)
- [Plan triển khai](../superpowers/plans/2026-08-04-cskh-enterprise-e0-e5.md)
- [env.ai.example](../../deploy/env.ai.example)
