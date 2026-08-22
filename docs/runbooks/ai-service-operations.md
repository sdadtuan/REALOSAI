# Runbook — AI Service Operations (Revenue OS R1)

> **RNOS:** RNOS-40 · **Wave:** R1 AI Assist (Phase 0 + 90 ngày)  
> **Kích hoạt khi:** Deploy pilot copilot, sự cố LLM, rollback feature flag, đổi model/prompt, nghiệm thu Gate R1  
> **Console:** ops-web `/crm/leads/[id]` (Copilot panel) · **API:** Nest `GET/POST /api/v1/ai/*`  
> **Spec:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) · **90-day:** [`specs/2026-07-26-ai-phase1-90-day-plan.md`](../specs/2026-07-26-ai-phase1-90-day-plan.md) · **UAT:** [`use-cases/actions/09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md)

---

## Mục lục

1. [Phạm vi & nguyên tắc](#1-phạm-vi--nguyên-tắc)
2. [Kiến trúc & thành phần](#2-kiến-trúc--thành-phần)
3. [Biến môi trường](#3-biến-môi-trường)
4. [Triển khai lần đầu](#4-triển-khai-lần-đầu)
5. [Smoke test & health](#5-smoke-test--health)
6. [Pilot rollout & feature flag](#6-pilot-rollout--feature-flag)
7. [Vận hành hàng ngày](#7-vận-hành-hàng-ngày)
8. [Rollback nhanh](#8-rollback-nhanh)
9. [Rollback model & prompt](#9-rollback-model--prompt)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [SQL & diagnostics](#11-sql--diagnostics)
12. [Gate R1 checklist](#12-gate-r1-checklist)
13. [Tài liệu liên quan](#13-tài-liệu-liên-quan)

---

## 1. Phạm vi & nguyên tắc

### 1.1. Trong phạm vi R1

| Chức năng | API / UI | Ghi chú |
|-----------|----------|---------|
| Lead score async | `POST /api/v1/ai/score/lead` | Rules engine v1 + explainability |
| Activity summarize | `POST /api/v1/ai/summarize` | P95 ≤5s |
| Lead brief | Copilot **Tóm tắt nhanh** | 5 bullets VN |
| Follow-up draft | `POST /api/v1/ai/recommendation` | **Không auto-send** |
| Approve / dismiss | `PATCH /api/v1/ai/recommendations/:id` | BR-AI-01 |
| Audit | `ai_agent_runs` | 100% calls |
| Timeline context | `customer_timeline_events` | RNOS-16 |

### 1.2. Ngoài phạm vi (defer R2+)

Deal score, NBA card, forecast, OpenSearch RAG, chatbot Page, multi-agent, NL SQL.

### 1.3. Business rules bất biến (prod)

| ID | Rule |
|----|------|
| **BR-AI-01** | AI **không** gửi Zalo/email/SMS — draft → user **Duyệt** → copy note / clipboard |
| **BR-AI-02** | `confidence < 0.6` → banner "low confidence" |
| **BR-AI-03** | Mọi LLM/score call → `ai_agent_runs`; retention ≥12 tháng |
| **BR-AI-04** | Prod: `PTT_AI_LOG_PII=0` — không log prompt chứa PII |
| **BR-AI-05** | Override score → `overridden_by` + reason |

---

## 2. Kiến trúc & thành phần

```mermaid
flowchart LR
    subgraph ingest [Lead ingest]
        WH[Webhook Meta/Zalo]
        CRM[CRM lead create]
    end
    subgraph events [Events]
        OUT[tenant.lead.created]
        SCORED[tenant.lead.scored]
    end
    subgraph ai [Nest ai-intelligence]
        API["/api/v1/ai/*"]
        AUDIT[ai_agent_runs]
        SCORE[Rules score]
        LLM[LLM provider]
    end
    subgraph ui [ops-web]
        COP[LeadCopilotPanel]
        LEAD["/crm/leads/id"]
    end
    subgraph pg [PostgreSQL]
        TBL[ai_scores ai_recommendations customer_timeline_events]
    end

    WH --> CRM
    CRM --> OUT
    OUT --> SCORE
    SCORE --> TBL
    SCORE --> SCORED
    LEAD --> COP
    COP --> API
    API --> LLM
    API --> AUDIT
    API --> TBL
```

| Layer | Path (target) |
|-------|----------------|
| Nest module | `services/ptt-crm-api/src/ai-intelligence/` |
| Controller | `ai-intelligence.controller.ts` → `/api/v1/ai/*` |
| Worker (optional) | `ptt_jobs/handlers/ai_lead_score.py` hoặc Nest queue |
| ops-web UI | `services/ops-web/src/components/ai/LeadCopilotPanel.tsx` |
| Lead page | `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| E2E | `services/ops-web/e2e/ai-copilot.spec.ts` |
| DDL | `docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql` |

**Production URLs:**

| Môi trường | Staff | API |
|------------|-------|-----|
| Production | `https://ops.pttads.vn/crm/leads/[id]` | `https://ops.pttads.vn/api/v1/ai/*` |
| Staging | mirror prod | same pattern |

---

## 3. Biến môi trường

**Mẫu đầy đủ:** [`deploy/env.ai.example`](../../deploy/env.ai.example) — copy vào VPS `EnvironmentFile`, không commit secrets.

**Pilot cohort template:** [`deploy/pilot-cohort.example.json`](../../deploy/pilot-cohort.example.json) (5–8 user; điền UUID thật → `pilot-cohort.json` gitignore).

### 3.1. Nest (`ptt-crm-api`)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `PTT_AI_COPILOT_ENABLED` | `0` | `1` = bật guarded `/api/v1/ai/*` (trừ health) |
| `PTT_AI_PILOT_USER_IDS` | *(rỗng)* | CSV staff `sub`; rỗng = mọi staff có cap (staging) |
| `PTT_AI_LLM_PROVIDER` | `openai` | Provider label (audit) |
| `PTT_AI_LLM_MODEL` | `gpt-4o-mini` | Model summarize/brief/draft |
| `PTT_AI_LLM_TIMEOUT_MS` | `8000` | LLM HTTP timeout ms |
| `AI_LLM_API_KEY` | — | Vault; rỗng → stub mode dev |
| `PTT_AI_LOG_PII` | `0` | **Prod bắt buộc 0** (Gate R1 #5) |
| `PTT_AI_LOG_PROMPTS` | `0` | **Prod bắt buộc 0** |
| `PTT_AI_SCORE_ASYNC` | `1` | RNOS-08 async score consumer |
| `PTT_AI_SUMMARIZE_RATE_LIMIT_PER_MIN` | `20` | Per-actor summarize/draft limit |
| `PTT_AI_SUMMARIZE_MIN_TEXT` | `50` | Min chars activity summarize |
| `PTT_CRM_INTERNAL_KEY` | — | **Staging/prod:** bắt buộc để JWT guard + pilot cohort hoạt động (không bypass internal) |
| `PTT_STAFF_JWT_SECRET` | — | Staff JWT verify |

### 3.2. ops-web (build-time)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED` | `0` | Ẩn Copilot panel khi `0` |
| `NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS` | *(rỗng)* | Phải khớp Nest cohort prod pilot |

**Quy tắc:** Khi bật pilot prod, set **cả Nest và ops-web** cùng lúc rồi restart/rebuild.

| Biến | Staging | Production pilot |
|------|---------|------------------|
| `PTT_AI_COPILOT_ENABLED` | `1` | `1` + cohort |
| `PTT_AI_LOG_PII` | `0` | `0` |
| `AI_LLM_API_KEY` | dev key | Vault rotation 90d |

---

## 4. Triển khai lần đầu

### 4.1. Pre-flight

- [ ] Backup PostgreSQL (`pg_dump`) trước DDL
- [ ] CRM lead ingest regression test pass (webhook smoke)
- [ ] LLM billing/quota approved
- [ ] Pilot CSKH list (5–8 user UUID) — xem [`deploy/pilot-cohort.example.json`](../../deploy/pilot-cohort.example.json)

### 4.2. Apply DDL (RNOS-01)

```bash
cd /var/www/ptt   # hoặc repo path trên VPS
export DATABASE_URL='postgresql://USER:PASS@127.0.0.1:5432/ptt_crm'
./scripts/apply_pg_ddl_revenue_os_ai.sh
```

Verify:

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ai_agent_runs','ai_scores','ai_recommendations','customer_timeline_events');
```

Kỳ vọng: **4+ bảng** tồn tại.

### 4.3. Deploy application

1. Deploy Nest `ptt-crm-api` với env §3 — **`PTT_AI_COPILOT_ENABLED=0`** lần đầu.
2. Deploy ops-web (copilot component bundled; ẩn khi flag off).
3. Restart:

```bash
sudo systemctl restart ptt-crm-api.service
sudo systemctl restart ptt-ops-web.service   # tên unit thực tế trên VPS
```

### 4.4. Thứ tự an toàn (tuần 12 pilot)

| Bước | Hành động |
|------|-----------|
| 1 | DDL prod + backup |
| 2 | Deploy code, flag **OFF** |
| 3 | Smoke §5 trên staging |
| 4 | Smoke §5 trên prod (flag off — health only) |
| 5 | Enable pilot cohort §6 |
| 6 | Monitor 48h §7 |

---

## 5. Smoke test & health

### 5.1. Health endpoint

```bash
curl -sS "https://ops.pttads.vn/api/v1/ai/health" | jq .
```

Kỳ vọng: `{ "data": { "status": "ok", "model": "gpt-4o-mini", ... } }` — HTTP 200.

Nếu module disabled (`PTT_AI_COPILOT_ENABLED=0`): có thể trả `503` hoặc `{ status: "disabled" }` — **CRM core vẫn OK**.

### 5.2. Audit insert (RNOS-05)

Staff JWT + test summarize (staging):

```bash
export TOKEN='<staff_jwt>'
curl -sS -X POST "https://ops.pttads.vn/api/v1/ai/summarize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_type":"lead","entity_id":"<LEAD_ID>","text":"Khách hỏi giá gói Meta 3 tháng, budget 50 triệu."}'
```

Verify audit:

```sql
SELECT id, use_case, model_name, status, latency_ms, error_message, started_at
FROM ai_agent_runs
ORDER BY started_at DESC
LIMIT 5;
```

### 5.3. Score async (RNOS-08)

1. Tạo lead test qua webhook hoặc UI.
2. Đợi ≤30s.
3. `GET /api/v1/ai/scores?entity_type=lead&entity_id=<id>` → score + explainability.

### 5.4. E2E automated (RNOS-39)

```bash
# Full local gate (bootstrap + API + Playwright + JSON report)
bash scripts/playwright_ops_ai_copilot_e2e.sh
# → .local-dev/rnos39-e2e-report.json

# Playwright only (services already up)
cd services/ops-web && OPS_E2E_SKIP_SERVER=1 npm run test:e2e:ai-copilot

# CI: .github/workflows/rnos39-ai-copilot-e2e.yml
# Docs: services/ops-web/e2e/README.md
```

### 5.5. RNOS-40 gate & rollback drill

```bash
# Rollback drill only (flag off, cohort block, prompt SQL read)
bash scripts/rnos40_rollback_drill.sh
# → .local-dev/rnos40-rollback-drill.json

# Full gate: artifacts + drill + RNOS-06 UAT smoke
bash scripts/rnos40_gate.sh
# → .local-dev/rnos40-gate-report.json
```

Chạy trước khi bật pilot cohort hoặc ký Gate R1 §12.

**Gate R1 orchestrator (prod pilot):**

```bash
bash scripts/rnos_r1_prod_pilot_gate.sh
# → .local-dev/rnos-r1-prod-pilot-gate-report.json
# Runbook: docs/runbooks/rnos-r1-prod-pilot-gate.md
```

### 5.6. BR-AI-01 verify (manual)

1. Generate follow-up draft trên copilot.
2. **Duyệt**.
3. Confirm: **không** HTTP tới Zalo/ESP; chỉ activity note / clipboard.

---

## 6. Pilot rollout & feature flag

### 6.1. Bật pilot (5–8 CSKH)

**Cách A — env cohort (prod pilot):**

Dùng template [`deploy/pilot-cohort.example.json`](../../deploy/pilot-cohort.example.json) → điền UUID thật:

```bash
PTT_AI_COPILOT_ENABLED=1
PTT_AI_PILOT_USER_IDS=uuid-a,uuid-b,uuid-c,uuid-d,uuid-e
# ops-web rebuild:
# NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
# NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS=uuid-a,uuid-b,...
```

Restart Nest + rebuild/restart ops-web.

**User ngoài cohort:** API `403 pilot_cohort_required`; UI hiển thị gate message (UAT RNOS-40).

**Cách B — flag global (staging):**

```bash
PTT_AI_COPILOT_ENABLED=1
# không set PILOT_USER_IDS → all staff with cap
```

### 6.2. Checklist tuần 11 (UAT)

Chạy **8 bước** trong [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md#pilot-walkthrough--8-bước-uat-tuần-11) — CSKH lead ký.

### 6.3. Monitor 48h đầu

| Metric | Target | Nguồn |
|--------|--------|-------|
| Copilot DAU | ≥60% pilot team | ops telemetry / survey |
| Score latency | ≤30s p95 | `ai_agent_runs` |
| Summarize P95 | ≤5s | `latency_ms` |
| Error rate AI calls | <5% | `status != ok` / total |
| Acceptance rate | ≥35% | `ai_recommendations.status=accepted` |
| CRM ingest | No regression | webhook SLA |

Channel alert: `#ai-alerts` Slack (hoặc log dashboard tương đương).

---

## 7. Vận hành hàng ngày

### 7.1. Morning check (5 phút)

1. `GET /api/v1/ai/health` — green.
2. SQL: AI error rate 24h (§11.2).
3. LLM provider status page (OpenAI/Azure).
4. Queue depth score jobs (nếu async) — backlog <100.

### 7.2. Weekly review (pilot)

**Playbook đầy đủ (90 ngày, flag, dashboard, agenda 45p):** [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md)

**Template ghi chép:** [`cskh-ai-pilot-weekly-review.md`](../templates/cskh-ai-pilot-weekly-review.md)

**Script KPI tuần:**

```bash
PILOT_WEEK=10 bash scripts/cskh_pilot_weekly_report.sh
# → .local-dev/cskh-pilot-week-10-report.md
```

| Review | Action |
|--------|--------|
| Acceptance / dismiss rate | Feed prompt tuning |
| Low-confidence rate | Review BR-AI-02 banner frequency |
| Top errors | Ticket backend |
| Cost (tokens) | Compare vs budget |
| Copilot DAU vs 60% | Training nếu <40% 2 tuần liên tiếp |

### 7.3. Prompt & model changes

**Không** sửa prompt prod trực tiếp trên DB prod. Luồng:

1. Sửa trong `ai_prompts` staging hoặc config versioned.
2. Golden eval ≥10 cases VN pass.
3. Deploy off-peak.
4. Monitor 24h; rollback §9 nếu acceptance giảm >10pp.

---

## 8. Rollback nhanh

### 8.1. Decision matrix

| Trigger | Severity | Hành động ngay | CRM impact |
|---------|----------|----------------|------------|
| Error rate AI >5% / 1h | P1 | `PTT_AI_COPILOT_ENABLED=0` | None |
| PII trong log prod | P1 | Flag off + rotate keys + fix redaction | None |
| LLM provider outage | P2 | Flag off §8.2; score rules vẫn chạy qua `POST /score/lead` | Score manual OK |
| Summarize latency >10s P95 | P2 | Flag off hoặc giảm rate limit | None |
| CSKH report sai fact nghiêm trọng | P1 | Flag off + incident | None |
| Score job backlog >1h | P2 | Pause async; manual hot/warm tags | None |

### 8.2. Procedure — tắt copilot (≤5 phút)

```bash
# Trên VPS — edit env Nest + ops-web
PTT_AI_COPILOT_ENABLED=0

sudo systemctl restart ptt-crm-api.service
sudo systemctl restart ptt-ops-web.service
```

Verify:

- Copilot panel **ẩn** trên `/crm/leads/[id]`.
- Lead create / webhook / CSKH board **bình thường**.
- `POST /api/v1/ai/summarize` → 503 `ai_copilot_disabled` (acceptable)

**Drill tự động:** `bash scripts/rnos40_rollback_drill.sh` (mô phỏng trên port 3010).

### 8.3. Post-rollback (không còn rules-only flag riêng)

- [ ] Thông báo #ai-alerts + CSKH pilot lead
- [ ] Ghi incident + root cause
- [ ] Không xóa `ai_agent_runs` (audit)
- [ ] Plan fix trước khi bật lại flag

---

## 9. Rollback model & prompt

### 9.1. Rollback LLM model

1. Ghi nhận model hiện tại: `PTT_AI_LLM_MODEL`.
2. Set model trước đó (ví dụ `gpt-4o-mini` → snapshot version cũ).
3. Restart `ptt-crm-api`.
4. Smoke §5.1 + §5.2.
5. So sánh acceptance 24h vs baseline.

```bash
# Ví dụ
PTT_AI_LLM_MODEL=gpt-4o-mini-2024-07-18
sudo systemctl restart ptt-crm-api.service
```

**Azure OpenAI:** rollback deployment name trong Azure portal + cập nhật `PTT_AI_LLM_MODEL` / endpoint.

### 9.2. Rollback prompt version

Prompts lưu tại `ai_prompts` (`use_case` + `version`):

```sql
-- Xem prompt active
SELECT use_case, version, is_active, updated_at
FROM ai_prompts
WHERE use_case IN ('summarize', 'lead_brief', 'follow_up_draft')
ORDER BY use_case, version DESC;

-- Activate version trước (ví dụ lead_brief v2 → v1)
BEGIN;
UPDATE ai_prompts SET is_active = false WHERE use_case = 'lead_brief' AND is_active = true;
UPDATE ai_prompts SET is_active = true  WHERE use_case = 'lead_brief' AND version = 1;
COMMIT;
```

Nếu bảng trống, app dùng `DEFAULT_PROMPTS` trong code (`ai-prompts.repository.ts`) — rollback prompt prod = redeploy tag trước hoặc insert version mới.

### 9.3. Rollback scoring rules

Rules có thể trong code (`scoring-rules.ts`) hoặc config JSON:

1. Revert Git commit rules / redeploy tag trước.
2. Optional: re-score pilot leads batch (off-peak job).
3. Document trong incident ticket.

---

## 10. Xử lý sự cố

### 10.1. P1 — PII trong log prod

1. **Ngay:** `PTT_AI_COPILOT_ENABLED=0` (§8.2).
2. Xác nhận `PTT_AI_LOG_PII=0` và `PTT_AI_LOG_PROMPTS=0`.
3. Purge/redact log files nếu có prompt leak (theo policy retention).
4. Rotate `AI_LLM_API_KEY` nếu key exposed in logs.
5. Fix redaction code → deploy staging → prod.
6. Compliance sign-off trước bật lại.

### 10.2. P1 — Error rate >5%

1. Flag off §8.2.
2. Query §11.3 — top `error_code` / provider messages.
3. Check LLM quota, timeout, rate limit 429.
4. Fix hoặc tăng `PTT_AI_LLM_TIMEOUT_MS` tạm thời (max 15000).
5. Re-enable pilot nhỏ (2 users) trước full cohort.

### 10.3. P2 — Score không xuất hiện >30s

1. Check consumer job / Nest queue running.
2. SQL backlog §11.4.
3. Manual `POST /api/v1/ai/score/lead` với staff JWT (admin).
4. Verify `tenant.lead.created` outbox không stuck.

### 10.4. P2 — Summarize chậm / timeout

1. Check `latency_ms` p95 trong `ai_agent_runs`.
2. Giảm input length cap; truncate activity text.
3. Switch model nhẹ hơn (`gpt-4o-mini`).
4. Rate limit abuse — check `PTT_AI_SUMMARIZE_RATE_LIMIT_PER_MIN` (429 responses).

### 10.5. P3 — CSKH dismiss rate cao

Không rollback tự động — product review:

- Golden cases fail? → prompt §9.2
- Wrong facts? → thêm timeline context RNOS-16
- Tone? → adjust system prompt VN formal

---

## 11. SQL & diagnostics

### 11.1. AI calls 24h summary

```sql
SELECT
  DATE_TRUNC('hour', started_at) AS hour,
  use_case,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE status != 'succeeded') AS errors,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)) AS p95_ms
FROM ai_agent_runs
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### 11.2. Error rate (rollback trigger)

```sql
SELECT
  ROUND(100.0 * COUNT(*) FILTER (WHERE status != 'succeeded') / NULLIF(COUNT(*), 0), 2) AS error_pct
FROM ai_agent_runs
WHERE started_at >= NOW() - INTERVAL '1 hour';
```

**Rollback nếu `error_pct > 5`.**

### 11.3. Recent failures

```sql
SELECT id, use_case, model_name, status, error_message, latency_ms, started_at
FROM ai_agent_runs
WHERE status != 'succeeded'
  AND started_at >= NOW() - INTERVAL '6 hours'
ORDER BY started_at DESC
LIMIT 20;
```

### 11.4. Score coverage pilot

```sql
SELECT
  COUNT(DISTINCT l.id) AS leads,
  COUNT(DISTINCT s.entity_id) AS scored,
  ROUND(100.0 * COUNT(DISTINCT s.entity_id) / NULLIF(COUNT(DISTINCT l.id), 0), 1) AS pct_scored
FROM crm_leads l
LEFT JOIN ai_scores s ON s.entity_type = 'lead' AND s.entity_id = l.id::text
WHERE l.created_at >= NOW() - INTERVAL '7 days'
  AND l.client_id = '<PILOT_CLIENT_UUID>';
```

### 11.5. Acceptance rate (G6)

```sql
SELECT
  recommendation_type,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
  COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
  COUNT(*) AS total
FROM ai_recommendations
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1;
```

### 11.6. Audit completeness (Gate R1 #4)

```sql
-- Spot check hôm nay
SELECT COUNT(*) FROM ai_agent_runs WHERE started_at >= CURRENT_DATE;
```

Kỳ vọng: **100%** LLM/score operations có row tương ứng.

### 11.7. Timeline completeness (Phase 0)

```sql
SELECT
  ROUND(100.0 * COUNT(DISTINCT t.entity_id) / NULLIF(COUNT(DISTINCT l.id), 0), 1) AS timeline_pct
FROM crm_leads l
LEFT JOIN customer_timeline_events t
  ON t.entity_type = 'lead' AND t.entity_id = l.id::text
WHERE l.created_at >= NOW() - INTERVAL '30 days';
```

Target Phase 0: **≥70%**.

---

## 12. Gate R1 checklist

Đối chiếu spec §19.1 và 90-day §8.3:

| # | Criteria | Method | Pass |
|---|----------|--------|------|
| 1 | Lead created → score ≤30s | E2E + SQL §11.4 | [ ] |
| 2 | Summary P95 ≤5s | §11.1 | [ ] |
| 3 | Draft requires approve; no auto-send | Manual + E2E §5.5 | [ ] |
| 4 | 100% AI calls audited | §11.6 | [ ] |
| 5 | No PII prompt logs prod | Env review `PTT_AI_LOG_PII=0` | [ ] |
| 6 | Copilot on `/crm/leads/[id]` | UAT 8-step signed | [ ] |

**Sign-off:**

| Role | Name | Date |
|------|------|------|
| Tech lead | | |
| Platform / DevOps | | |
| CSKH pilot lead | | |
| QA | | |

---

## 13. Tài liệu liên quan

| Tài liệu | Mục đích |
|----------|----------|
| [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) | Master spec §5, §12, §15, §19 |
| [`specs/2026-07-26-ai-phase1-90-day-plan.md`](../specs/2026-07-26-ai-phase1-90-day-plan.md) | Lộ trình 12 tuần |
| [`specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql`](../specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql) | DDL |
| [`use-cases/09-AI-REVENUE-OS.md`](../use-cases/09-AI-REVENUE-OS.md) | Use cases |
| [`use-cases/actions/09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md) | UAT bước chi tiết |
| [`vps-production-operations.md`](./vps-production-operations.md) | VPS systemd restart |
| [`vps-full-system-deploy.md`](./vps-full-system-deploy.md) | Deploy greenfield |
| `./scripts/apply_pg_ddl_revenue_os_ai.sh` | Apply DDL |
| [`rnos01-ddl-apply.md`](./rnos01-ddl-apply.md) | **RNOS-01** runbook + gate |
| [`rnos40-ai-gate.md`](./rnos40-ai-gate.md) | **RNOS-40** gate quick reference |
| [`rnos-r1-prod-pilot-gate.md`](./rnos-r1-prod-pilot-gate.md) | **Gate R1** prod pilot sign-off runbook |
| [`cskh-ai-pilot-90-day-playbook.md`](./cskh-ai-pilot-90-day-playbook.md) | **CSKH pilot 90 ngày** — flag, dashboard, weekly review |
| `./scripts/rnos01_pg_ddl_gate.sh` | RNOS-01 DDL gate JSON |
| `./scripts/rnos40_gate.sh` | **RNOS-40** gate + rollback drill + UAT smoke |
| `./scripts/rnos40_rollback_drill.sh` | Rollback drill JSON report |
| `./scripts/playwright_ops_ai_copilot_e2e.sh` | **RNOS-39** Playwright E2E gate |
| `./scripts/rnos39_gate.sh` | RNOS-39 full gate report |
| `./scripts/rnos_r1_prod_pilot_gate.sh` | **Gate R1** orchestrator (RNOS-39 + RNOS-40 + metrics) |
| `./scripts/rnos_r1_metrics_probe.sh` | Gate R1 SQL probes G1–G6 |
| `./scripts/rnos_r1_pilot_enable.sh` | Pilot cohort env enable helper |
| [`deploy/r1-signoff.template.json`](../../deploy/r1-signoff.template.json) | Gate R1 manual sign-off template |
| `services/ops-web/e2e/README.md` | E2E env vars (staging/local) |
| [`deploy/env.ai.example`](../../deploy/env.ai.example) | Env template |
| [`deploy/pilot-cohort.example.json`](../../deploy/pilot-cohort.example.json) | Pilot 5–8 users |

---

*RNOS-40 — Cập nhật khi đổi provider, schema `ai_*`, hoặc copilot UI contract.*
