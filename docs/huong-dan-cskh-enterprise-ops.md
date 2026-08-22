# Hướng dẫn sử dụng & triển khai — CSKH Enterprise Ops (Spa Meta 24h + AI Wave E0–E5)

> **Phiên bản:** 1.0 · **Ngày:** 2026-08-04  
> **Đối tượng:** CSKH rep, Team Lead, GDKD, Platform/DevOps  
> **Phạm vi:** Lead spa **vận hành** từ Meta Lead Ads (`spa_operational`) — SLA 15p / 4h / 24h + AI copilot/NBA/closed-loop  
> **URL staff:** `https://rs.pttads.vn` (alias `https://ops.pttads.vn`)  
> **Spec tham chiếu:**  
> - [`superpowers/specs/2026-08-04-cskh-enterprise-ai-wave-design.md`](superpowers/specs/2026-08-04-cskh-enterprise-ai-wave-design.md) — thiết kế wave E0–E5  
> - [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](SPEC_AI_REVENUE_OPERATING_SYSTEM.md) §4.2.1 · §8.2 · §26.3 — master spec RNOSAI  
> - [`runbooks/cskh-spa-lead-meta-24h-sop.md`](runbooks/cskh-spa-lead-meta-24h-sop.md) — SOP rep hàng ngày (A4)  
> - [`runbooks/cskh-enterprise-ops-runbook.md`](runbooks/cskh-enterprise-ops-runbook.md) — runbook ngắn on-call  
>
> **Lưu ý:** Module này **không** áp dụng lead B2B agency mới (prospect PTT). Luồng đó dùng Pre-sales → Proposal → Convert Customer.

---

## Mục lục

1. [Tổng quan phân hệ](#1-tổng-quan-phân-hệ)
2. [Kiến trúc trên VPS](#2-kiến-trúc-trên-vps)
3. [Triển khai & setup đầy đủ](#3-triển-khai--setup-đầy-đủ)
4. [Bật tính năng theo wave E0→E5](#4-bật-tính-năng-theo-wave-e0e5)
5. [Truy cập & phân quyền](#5-truy-cập--phân-quyền)
6. [Hướng dẫn từng màn hình](#6-hướng-dẫn-từng-màn-hình)
7. [Luồng nghiệp vụ end-to-end](#7-luồng-nghiệp-vụ-end-to-end)
8. [Dữ liệu `crm_lead_activities` & care pipeline](#8-dữ-liệu-crm_lead_activities--care-pipeline)
9. [Jobs, alerts & observability](#9-jobs-alerts--observability)
10. [Xử lý sự cố thường gặp](#10-xử-lý-sự-cố-thường-gặp)
11. [Checklist go-live & sign-off GDKD](#11-checklist-go-live--sign-off-gdkd)
12. [Phụ lục — env, API, gate scripts](#12-phụ-lục--env-api-gate-scripts)

---

## 1. Tổng quan phân hệ

**CSKH Enterprise Ops** là phân hệ vận hành lead spa Meta 24h trên RNOSAI — gồm SLA board, home widgets, AI copilot/NBA, dự báo breach, shift handoff, review queue triage, và GDKD 8 KPI.

### 1.1. Luồng 4 tầng (E0 → E5)

| Tầng | Wave | Vai trò | Màn hình chính |
|------|------|---------|----------------|
| **Home visibility** | E0 | Rep, GDKD | `/` — widgets SLA, review queue, copilot DAU |
| **Board + AI prod** | E1 | Rep, GDKD | `/crm/cskh-board`, copilot trên `/crm/leads/[id]` |
| **Predictive SLA** | E2 | Rep, Team Lead | SSE toast, `sla-predictions`, auto-task nội bộ |
| **Smart ops** | E3 | Team Lead, GDKD | Shift handoff, review queue LLM triage |
| **Closed-loop** | E4 | GDKD, AI Product | Score v2 feedback, playbook auto-rank |
| **Sign-off** | E5 | GDKD | 8 KPI pass/fail, gate enterprise, template ký |

### 1.2. SLA nghiệp vụ (spa Meta)

| Mốc | Target | Bằng chứng CRM |
|-----|--------|----------------|
| Gọi lần đầu | ≤ **15 phút** | Activity **Gọi điện** + `first_call_at` |
| Hoàn thành B2 | ≤ **4 giờ** | Funnel B2 + `care_status` trên `crm_lead_activities` |
| Chốt / Lost | ≤ **24 giờ** | Status `chot` / `lost` + audit note VND |

### 1.3. Module & route

| Nhóm | Route | Wave |
|------|-------|------|
| Home widgets | `/` | E0 |
| Lead care | `/crm/leads`, `/crm/leads/[id]` | Core + E1 |
| CSKH board | `/crm/cskh-board` | Core + E1–E3 |
| Review queue | `/crm/leads/review-queue` | E3 |
| GDKD KPI | `/crm/gdkd-enterprise` | Core + E5 |
| AI insights | `/crm/ai/insights` | E1 |
| Playbooks | `/crm/playbooks` | E4 |

### 1.4. Nguyên tắc vận hành (bắt buộc)

1. **BR-AI-01:** Không auto-send Zalo/email/call — chỉ draft, note nội bộ, handoff markdown.
2. **BR-AI-04:** Copilot theo `PTT_AI_COPILOT_ROLLOUT_MODE` (`pilot` → `team` → `all`).
3. **BR-AI-05:** GDKD override score → ghi `ai_score_feedback` (E4).
4. **Gate cuối:** `bash scripts/cskh_enterprise_e5_gate.sh` PASS trước ký enterprise.

---

## 2. Kiến trúc trên VPS

```
┌─────────────────────────────────────────────────────────────────────┐
│  VPS /var/www/rnosai                                                │
│  ┌──────────────┐     ┌──────────────────────────────────────────┐  │
│  │ ops-web :3200│────▶│ Nest ptt-crm-api :3000                   │  │
│  │ /, /crm/*    │     │  cskh-board · leads-funnel · ai-intel    │  │
│  └──────────────┘     └──────────────┬───────────────────────────┘  │
│         │                             │                             │
│         │ SSE sla-alerts/stream       │ PostgreSQL                  │
│         └─────────────────────────────┤  crm_leads                  │
│                                       │  crm_lead_activities        │
│  ┌──────────────┐                     │  ai_scores, ai_score_feedback│
│  │ ptt_worker   │◀────────────────────┤  ai_agent_runs, ai_recommendations│
│  │ job_queue    │                     └─────────────────────────────┘
│  └──────────────┘                                                   │
│  nginx rs.pttads.vn → ops-web + /api/ → Nest                        │
└─────────────────────────────────────────────────────────────────────┘
         ▲
         │ Meta Lead Ads webhook → intake → crm_leads (status=moi)
```

| Thành phần | Path / URL |
|------------|------------|
| Repo | `/var/www/rnosai` |
| Env | `/var/www/rnosai/.env` (chmod 600) |
| Staff UI | `https://rs.pttads.vn` |
| Nest health | `curl -sf http://127.0.0.1:3000/health` |
| Runbook VPS tổng | [`runbooks/rnosai-vps-operations-guide.md`](runbooks/rnosai-vps-operations-guide.md) |

---

## 3. Triển khai & setup đầy đủ

> Staging trước → gate PASS → soak ≥7 ngày → bật AI từng wave trên prod.

### 3.1. Điều kiện tiên quyết

- [ ] PostgreSQL (`DATABASE_URL`) — source of truth CRM
- [ ] Nest `ptt-crm-api` + ops-web + `ptt_worker` healthy (systemd)
- [ ] Wave B4 DDL đã apply — bảng `crm_leads`, **`crm_lead_activities`** (cột `care_status`, `care_stage_key`, `care_contact_type`)
- [ ] Meta webhook ingest lead spa → `status=moi`, `received_at` set
- [ ] Staff auth PG (`staff_users`) — **không** dùng `PTT_STAFF_STUB_USERS` trên prod
- [ ] Backup trước mọi DDL: `./scripts/backup_ptt_data.sh`

**DDL tham chiếu:**

| Artifact | Mục đích |
|----------|----------|
| [`docs/specs/2026-07-23-wave-b4-funnel-pg-ddl.sql`](specs/2026-07-23-wave-b4-funnel-pg-ddl.sql) | `crm_lead_activities` + care columns |
| [`services/ptt-crm-api/migrations/20260804100000_ai_score_feedback.sql`](../services/ptt-crm-api/migrations/20260804100000_ai_score_feedback.sql) | E4 closed-loop feedback |

### 3.2. Deploy code (routine)

```bash
cd /var/www/rnosai

# 1. Backup
./scripts/backup_ptt_data.sh

# 2. Pull wave E0–E5 (đã merge main)
git pull origin main
git log -1 --oneline

# 3. Nest API
cd services/ptt-crm-api
npm ci && npm run build
sudo systemctl restart ptt-crm-api

# 4. ops-web — giữ NEXT_PUBLIC_PTT_AI_* nếu đang bật copilot
cd /var/www/rnosai/services/ops-web
npm ci
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
# export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
# export NEXT_PUBLIC_PTT_AI_COPILOT_ROLLOUT_MODE=team
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
sudo systemctl restart ptt-ops-web

# 5. Worker (score async, jobs)
sudo systemctl restart ptt-worker

# 6. Verify HTTP
curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"
```

### 3.3. Apply migration E4 (PostgreSQL)

Chạy **một lần** trên staging, verify gate E4, rồi prod:

```bash
cd /var/www/rnosai
source .venv/bin/activate
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb

./scripts/backup_ptt_data.sh

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f services/ptt-crm-api/migrations/20260804100000_ai_score_feedback.sql

psql "$DATABASE_URL" -c "\d ai_score_feedback"
```

### 3.4. Kiểm tra schema care (PG)

```bash
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'crm_lead_activities'
    AND column_name IN ('care_status','care_stage_key','care_contact_type')
  ORDER BY 1;
"
```

Kỳ vọng 3 cột `text`. Nếu thiếu → apply [`2026-07-23-wave-b4-funnel-pg-ddl.sql`](specs/2026-07-23-wave-b4-funnel-pg-ddl.sql).

### 3.5. Merge biến môi trường AI

```bash
# Tham chiếu đầy đủ
grep -E '^PTT_AI_|^NEXT_PUBLIC_PTT_AI_' deploy/env.ai.example

# Merge vào /var/www/rnosai/.env — KHÔNG commit secrets
nano /var/www/rnosai/.env
sudo systemctl restart ptt-crm-api ptt-ops-web ptt-worker
```

Chi tiết AI ops: [`runbooks/ai-service-operations.md`](runbooks/ai-service-operations.md)

### 3.6. Gate sau deploy

```bash
cd /var/www/rnosai
source .venv/bin/activate
set -a && source .env && set +a

bash scripts/cskh_enterprise_e5_gate.sh
```

Gate E5 chain: board gate → E0 → E2 → E3 → E4 → jest → docs.

E2E full stack (optional):

```bash
OPS_E2E_SKIP_SERVER=0 bash scripts/playwright_ops_cskh_enterprise_e5_e2e.sh
```

---

## 4. Bật tính năng theo wave E0→E5

Rollout **tuần tự** — không bật E4 trước khi E1 soak pass.

| Wave | Tính năng | Env bắt buộc | Soak gợi ý |
|------|-----------|--------------|------------|
| **E0** | Home widgets | *(không env AI)* | 3 ngày — widget khớp board |
| **E1** | Copilot rollout + NBA LLM | `PTT_AI_COPILOT_ENABLED=1`, `PTT_AI_COPILOT_ROLLOUT_MODE=team`, `PTT_AI_NBA_LLM_PRIMARY=1` + `NEXT_PUBLIC_*` khớp | 7 ngày — DAU ≥60% pilot team |
| **E2** | SLA predict + SSE + auto-task | Code ship sẵn; verify SSE qua nginx | 7 ngày — toast + poll fallback |
| **E3** | Shift handoff + review LLM | `PTT_AI_LLM_*` + `AI_LLM_API_KEY` | 7 ngày — handoff cuối ca |
| **E4** | Score v2 + playbook rank | `PTT_AI_SCORE_V2=1` + migration `ai_score_feedback` | 14 ngày — override feedback |
| **E5** | Enterprise sign-off | Gate PASS + GDKD template | Tuần 12 |

### 4.1. Ví dụ `.env` staging (E0–E3, chưa score v2)

```bash
PTT_AI_COPILOT_ENABLED=1
PTT_AI_COPILOT_ROLLOUT_MODE=team
PTT_AI_COPILOT_TEAM_CAPS=crm_leads
PTT_AI_NBA_LLM_PRIMARY=1
PTT_AI_SCORE_V2=0
PTT_AI_LLM_PROVIDER=openai
PTT_AI_LLM_MODEL=gpt-4o-mini
AI_LLM_API_KEY=<vault>
PTT_AI_LOG_PII=0
PTT_AI_LOG_PROMPTS=0
```

**ops-web build** (cùng session build):

```bash
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
export NEXT_PUBLIC_PTT_AI_COPILOT_ROLLOUT_MODE=team
export NEXT_PUBLIC_PTT_AI_COPILOT_TEAM_CAPS=crm_leads
```

### 4.2. Bật E4 trên prod

```bash
PTT_AI_SCORE_V2=1
# Sau migration ai_score_feedback
bash scripts/cskh_e4_playbook_gate.sh
```

### 4.3. Rollback nhanh AI

```bash
PTT_AI_COPILOT_ENABLED=0
PTT_AI_NBA_LLM_PRIMARY=0
PTT_AI_SCORE_V2=0
sudo systemctl restart ptt-crm-api ptt-ops-web
```

Drill: `bash scripts/rnos40_rollback_drill.sh` — [`ai-service-operations.md`](runbooks/ai-service-operations.md) §8.

---

## 5. Truy cập & phân quyền

| Vai trò | Cap / quyền | Màn hình |
|---------|-------------|----------|
| **CSKH rep** | `crm_leads` view/write own | Leads, board (own), copilot (rollout) |
| **Team Lead** | `crm_leads` + `assign` | Board all, bulk assign, shift handoff, SSE all |
| **GDKD** | Enterprise caps | `/crm/gdkd-enterprise`, review queue release |
| **Platform** | Admin + internal key | Gates, migration, `/admin/ai/runs` audit |

Copilot guard: `StaffAiCopilotGuard` + `canUseAiCopilot()` ops-web — phải khớp Nest và build-time flags.

---

## 6. Hướng dẫn từng màn hình

### 6.1. Home `/` (E0)

**Ai dùng:** Rep buổi sáng, GDKD snapshot.

Widgets (poll 60s từ `GET /api/crm/cskh-board/home-summary`):

| Widget | Drill-down |
|--------|------------|
| Lead Meta mới hôm nay | `/crm/leads?status=moi` |
| SLA breach / warning | `/crm/cskh-board?sla_filter=breach` |
| Review queue pending | `/crm/leads/review-queue` |
| Copilot DAU | `/crm/ai/insights` |

**GDKD:** số breach home phải khớp board; review max age < 24h.

### 6.2. Lead detail `/crm/leads/[id]`

**Rep checklist** (chi tiết SOP): [`cskh-spa-lead-meta-24h-sop.md`](runbooks/cskh-spa-lead-meta-24h-sop.md)

| Panel | Thao tác |
|-------|----------|
| Gọi / Activity | Loại **Gọi điện** — bắt buộc ≤15p |
| Funnel B2 | Gửi báo cáo Liên hệ OK → Hoàn thành B2 (ghi `care_status`) |
| Trạng thái | `moi` → `da_lien_he` → `hen_gap` / `dang_tu_van` → `chot` / `lost` |
| Copilot (E1) | NBA accept/dismiss — **không** auto-send |
| Audit chốt | Ghi **VND** trong audit note (ROAS closed-loop) |

### 6.3. CSKH board `/crm/cskh-board`

| Chức năng | Cách dùng |
|-----------|-----------|
| Filter SLA tier | 15p / 4h / 24h — breach · warning · open |
| Breach backlog | Target **0** cuối ca |
| Risk column (E2) | Lead sắp breach từ predictions |
| Bulk assign | Team Lead — chọn rows → assign owner |
| Shift handoff (E3) | Panel cuối ca → **Copy markdown** → Slack nội bộ |
| Export CSV | `GET .../export` |

**SSE alerts (E2):** toast high/imminent; nếu mất SSE → client poll 60s (không block ops).

### 6.4. Review queue `/crm/leads/review-queue` (E3)

- Inbox lead quá 24h chưa B2 / cần GDKD
- **AI triage:** `GET /api/v1/leads/review-queue/ai-summaries?mode=llm` (fallback rules)
- Badge P1–P5, gợi ý owner
- GDKD QA tuần: priority vs `hours_waiting`, audit `review_queue_triage` tại `/admin/ai/runs`

### 6.5. GDKD enterprise `/crm/gdkd-enterprise`

API: `GET /api/crm/gdkd-enterprise/kpi?days=7`

| KPI ID | Target | Drill |
|--------|--------|-------|
| `first_call_15m` | ≥85% | Board tier 15p |
| `b2_4h` | ≥80% | Board tier 4h |
| `close_24h` | ≥70% | Board tier 24h |
| `breach_backlog` | ≤0 | Board breach filter |
| `review_queue_age` | max <24h | Review queue |
| `copilot_dau` | ≥60% | AI insights |
| `nba_acceptance` | ≥35% | NBA panel |
| `roas_vnd_fill` | ≥90% | Chốt closed-loop |

Mỗi tile có `pass` và `gate_pass`. Snapshot tuần → [`templates/cskh-enterprise-e5-signoff.md`](templates/cskh-enterprise-e5-signoff.md).

### 6.6. Playbooks & NBA (E4)

- Ranked: `GET /api/v1/ai/playbooks/ranked?context=cskh_sla`
- NBA RAG ưu tiên chunk rank cao (chốt ≤24h rate)
- Score v2: GDKD override → row `ai_score_feedback`; chốt/lost → backfill outcome

---

## 7. Luồng nghiệp vụ end-to-end

```
Meta ingest (webhook)
  → crm_leads status=moi, received_at
  → [≤15p] Rep gọi + activity
  → [≤4h] B2 complete (care_status trên crm_lead_activities)
  → da_lien_he → hen_gap | dang_tu_van
  → [≤24h] chot + VND | lost + reason
  → Closed-loop QA / ROAS hub

Song song:
  Team Lead — board breach/warning, bulk assign, shift handoff
  E2 — predict + toast + sla-auto-task (note nội bộ)
  GDKD — 8 KPI weekly + review queue release
```

**Không áp dụng:** panel Hợp đồng → Service Delivery (chỉ lead agency B2B).

---

## 8. Dữ liệu `crm_lead_activities` & care pipeline

Bảng **`crm_lead_activities`** lưu activity + báo cáo chăm sóc B2.

| Cột | Ý nghĩa |
|-----|---------|
| `activity_type` | `call`, `note`, `system`, … |
| `care_status` | VD: `da_lien_he_thanh_cong`, `khong_nghe_may`, `da_phan_loai` |
| `care_stage_key` | `first_contact`, … (CARE_STAGE_KEYS) |
| `care_contact_type` | `phone`, … |
| `lead_status_at_log` | Snapshot status khi ghi |

**Gate B2:** `completeCareStage` đếm activity có `care_status` hoặc `care_contact_type` trước khi advance stage.

SQLite legacy: migration runtime trong `crm_lead_store.py`. PG: Wave B4 DDL.

---

## 9. Jobs, alerts & observability

| Signal | Nguồn | Hành động |
|--------|-------|-----------|
| SLA daily digest | `GET .../sla-daily-digest` | Cron/email 08:00 ICT |
| SSE SLA alerts | `GET .../sla-alerts/stream` | Toast ops-web |
| Auto-task | `POST /api/v1/leads/:id/sla-auto-task` | Note nội bộ only |
| AI audit | `/admin/ai/runs` | `review_queue_triage`, copilot runs |
| Score async | `PTT_AI_SCORE_ASYNC=1` | `ptt_worker` → Nest score API |

**Health buổi sáng** (thêm vào checklist VPS §6.1):

```bash
curl -sf "https://rs.pttads.vn/api/crm/cskh-board/home-summary" -H "Authorization: Bearer $STAFF_JWT" | head -c 200
curl -sf "https://rs.pttads.vn/api/crm/cskh-board/breach-backlog" -H "Authorization: Bearer $STAFF_JWT" | head -c 200
```

---

## 10. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|-------------|------------------------|-------|
| Home widget = 0 nhưng board có breach | Cache poll / auth | Hard refresh; kiểm tra JWT staff |
| SSE toast không hiện | nginx buffer / JWT hết hạn | Poll fallback vẫn chạy; re-login; check Nest logs |
| Copilot 503 | `PTT_AI_COPILOT_ENABLED=0` hoặc rollout | `.env` + rebuild ops-web `NEXT_PUBLIC_*` |
| B2 không complete | Thiếu activity `care_status` | Gửi báo cáo Liên hệ OK trước complete stage |
| Review LLM fallback rules | LLM timeout / key | Check `AI_LLM_API_KEY`, `PTT_AI_LLM_TIMEOUT_MS` |
| Score v2 không đổi | `PTT_AI_SCORE_V2=0` | Bật flag + migration `ai_score_feedback` |
| Gate E5 FAIL | Phase gate lẻ | Chạy từng `cskh_e*_gate.sh` để isolate |

---

## 11. Checklist go-live & sign-off GDKD

### 11.1. Platform go-live

- [ ] Wave B4 DDL + E4 migration applied
- [ ] `git pull` + build Nest + ops-web + restart workers
- [ ] `bash scripts/cskh_enterprise_e5_gate.sh` PASS
- [ ] Meta webhook test lead → `/crm/leads` ≤ 2 phút
- [ ] Staging soak E1 copilot ≥7 ngày
- [ ] Prod env: `PTT_AI_LOG_PII=0`, `PTT_AI_LOG_PROMPTS=0`

### 11.2. GDKD tuần 12 (E5)

- [ ] 8 KPI snapshot → [`cskh-enterprise-e5-signoff.md`](templates/cskh-enterprise-e5-signoff.md)
- [ ] Breach backlog ≤0 cuối mỗi ca (3 ca)
- [ ] Review queue max age <24h
- [ ] Copilot DAU ≥60%, NBA ≥35%, VND fill ≥90%
- [ ] Ký exception nếu tile fail (ghi lý do + owner)

---

## 12. Phụ lục — env, API, gate scripts

### 12.1. API chính (Nest)

| Method | Path | Wave |
|--------|------|------|
| GET | `/api/crm/cskh-board` | Core |
| GET | `/api/crm/cskh-board/home-summary` | E0 |
| GET | `/api/crm/cskh-board/shift-handoff` | E3 |
| GET | `/api/crm/cskh-board/sla-predictions` | E2 |
| GET | `/api/crm/cskh-board/sla-alerts/stream` | E2 SSE |
| GET | `/api/crm/cskh-board/breach-backlog` | Core |
| GET | `/api/crm/gdkd-enterprise/kpi` | Core |
| GET | `/api/v1/leads/review-queue/ai-summaries` | E3 |
| POST | `/api/v1/leads/:id/sla-auto-task` | E2 |
| GET | `/api/v1/ai/playbooks/ranked` | E4 |

### 12.2. Gate scripts

| Script | Wave |
|--------|------|
| `scripts/cskh_e0_home_gate.sh` | E0 |
| `scripts/cskh_e1_ai_prod_gate.sh` | E1 |
| `scripts/cskh_e2_sla_predict_gate.sh` | E2 |
| `scripts/cskh_e3_handoff_gate.sh` | E3 |
| `scripts/cskh_e4_playbook_gate.sh` | E4 |
| `scripts/cskh_enterprise_e5_gate.sh` | E5 chain |
| `scripts/cskh_board_gate.sh` | Board SLA % |

### 12.3. Tài liệu liên quan

| Doc | Mục đích |
|-----|----------|
| [`huong-dan-cskh-enterprise-ops.md`](huong-dan-cskh-enterprise-ops.md) | **Canonical** — doc này |
| [`runbooks/cskh-enterprise-ops-runbook.md`](runbooks/cskh-enterprise-ops-runbook.md) | Runbook ngắn on-call |
| [`runbooks/cskh-spa-lead-meta-24h-sop.md`](runbooks/cskh-spa-lead-meta-24h-sop.md) | SOP rep A4 |
| [`superpowers/plans/2026-08-04-cskh-enterprise-e0-e5.md`](superpowers/plans/2026-08-04-cskh-enterprise-e0-e5.md) | Plan triển khai dev |
| [`deploy/env.ai.example`](../deploy/env.ai.example) | Env AI template |
| [`runbooks/ai-service-operations.md`](runbooks/ai-service-operations.md) | AI copilot ops |
| [`runbooks/rnosai-vps-operations-guide.md`](runbooks/rnosai-vps-operations-guide.md) | VPS tổng |
| [`crm/huong-dan-day-du-lead-den-cham-soc-khach-hang.md`](crm/huong-dan-day-du-lead-den-cham-soc-khach-hang.md) | UAT lead → retain |

---

*CSKH Enterprise Ops v1.0 · đồng bộ wave E0–E5 ship 2026-08-04 · cập nhật khi gate hoặc env thay đổi.*
