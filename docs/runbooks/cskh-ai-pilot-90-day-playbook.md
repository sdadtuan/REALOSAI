# Playbook — Pilot AI 90 ngày cho 1 team CSKH

> **Phiên bản:** 1.0 · **Ngày:** 2026-07-27  
> **Đối tượng:** CSKH lead, GDKD, Platform/DevOps, AI product  
> **Phạm vi:** 1 team CSKH (5–8 người) · Wave R1 Copilot · 12 tuần (~90 ngày)  
> **Production:** `https://ops.pttads.vn`  
> **Liên quan:**  
> - [`2026-07-26-ai-phase1-90-day-plan.md`](../specs/2026-07-26-ai-phase1-90-day-plan.md) — backlog kỹ thuật tuần 1–12  
> - [`rnos-r1-prod-pilot-gate.md`](./rnos-r1-prod-pilot-gate.md) — gate prod sign-off  
> - [`ai-service-operations.md`](./ai-service-operations.md) — vận hành hàng ngày, rollback  
> - [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md) — UAT 8 bước  
> - **Weekly review template:** [`cskh-ai-pilot-weekly-review.md`](../templates/cskh-ai-pilot-weekly-review.md)  
> - **Script báo cáo tuần:** `scripts/cskh_pilot_weekly_report.sh`

---

## Mục lục

1. [Tóm tắt & mục tiêu](#1-tóm-tắt--mục-tiêu)
2. [Team & RACI](#2-team--raci)
3. [Lộ trình 12 tuần](#3-lộ-trình-12-tuần)
4. [Feature flag — bật/tắt pilot](#4-feature-flag--bậttắt-pilot)
5. [KPI dashboard — nơi xem & cách đọc](#5-kpi-dashboard--nơi-xem--cách-đọc)
6. [Thói quen hàng ngày CSKH](#6-thói-quen-hàng-ngày-cskh)
7. [Weekly review — quy trình 45 phút](#7-weekly-review--quy-trình-45-phút)
8. [Gate tuần 4 / 8 / 12](#8-gate-tuần-4--8--12)
9. [Escalation & rollback](#9-escalation--rollback)
10. [Sau 90 ngày — mở rộng](#10-sau-90-ngày--mở-rộng)

---

## 1. Tóm tắt & mục tiêu

**Outcome 90 ngày:** Team CSKH pilot **dùng Copilot mỗi ngày** trên lead detail — brief, score, summarize, follow-up draft có duyệt — với adoption và acceptance **đo được**, không phụ thuộc cảm giác.

| ID | KPI | Target tuần 12 | Nguồn chính |
|----|-----|----------------|-------------|
| **G1** | Lead có source + attribution | ≥80% lead team xử lý | Phase 0 gate / hub map |
| **G2** | Copilot DAU | ≥60% pilot (5–8 người) | Adoption dashboard |
| **G3** | Score visible sau lead mới | ≤30s p95 | `ai_agent_runs` + E2E |
| **G4** | Time-to-log | ↓25% (survey tuần 0 vs tuần 10) | CSKH survey |
| **G5** | Audit compliance | 100% LLM → `ai_agent_runs` | SQL probe |
| **G6** | AI acceptance | ≥35% (stretch **≥40%** §0.6) | `/crm/ai/insights` |

**Không mục tiêu 90 ngày:** NBA deal prod, forecast commit, chatbot Page, auto-send Zalo/email.

**Nguyên tắc bất di bất dịch (BR-AI):**

- **BR-AI-01:** AI **không** gửi tin nhắn outbound — chỉ draft → CSKH duyệt/copy.
- **BR-AI-04:** User ngoài pilot cohort → Copilot ẩn / API 403.
- **BR-AI-05:** GDKD override score → ghi nhận làm feedback cho model sau này.

---

## 2. Team & RACI

| Vai trò | Người | Trách nhiệm pilot |
|---------|-------|-------------------|
| **CSKH pilot lead** | 1 người trong team | UAT 8 bước, weekly review host, thu feedback dismiss |
| **CSKH pilot** | 5–8 người | Dùng Copilot ≥1 lead/ngày có activity; accept/dismiss có lý do |
| **GDKD / Manager** | 1 | Weekly review, đọc adoption dashboard, quyết rollback/widen |
| **Platform** | DevOps | Flag, restart, DDL, `#ai-alerts` |
| **AI product** | PM/LLM | Prompt tuning sau weekly review |
| **QA** | 0.25 FTE | Gate tuần 8/12, spot-check BR-AI-01 |

**Pilot cohort file (không commit prod UUID):**

```bash
cp deploy/pilot-cohort.example.json deploy/pilot-cohort.json
# Điền staff_id UUID thật + email
```

Template: [`deploy/pilot-cohort.example.json`](../../deploy/pilot-cohort.example.json)

---

## 3. Lộ trình 12 tuần

| Tuần | Phase | CSKH làm gì | Platform / Product |
|------|-------|-------------|-------------------|
| **1–4** | Phase 0 data | Tiếp tục log activity chuẩn; không Copilot | DDL, timeline, attribution audit |
| **5–6** | R1 prep | Training 30p: score + brief là gì | Summarize API, score v1 |
| **7–8** | R1 soft | Staging walkthrough 8 bước (1 người/team) | Copilot UI staging |
| **9** | R1 UAT | **Cả team** UAT 8 bước trên staging mirror | Fix blocker |
| **10** | **Go-live** | Prod pilot bật — habit 1 lead/ngày | Enable flag §4, monitor 48h |
| **11** | Stabilize | Daily copilot; ghi dismiss reason | Prompt hotfix nếu acceptance thấp |
| **12** | **Gate R1** | Survey time-to-log; ký sign-off | `rnos_r1_prod_pilot_gate.sh` |

**Calendar mẫu (start tuần 1 = 28/07/2026):** xem [90-day plan §Phụ lục](../specs/2026-07-26-ai-phase1-90-day-plan.md).

---

## 4. Feature flag — bật/tắt pilot

### 4.1. Biến môi trường

| Biến | Nest API | ops-web build | Ý nghĩa |
|------|----------|---------------|---------|
| `PTT_AI_COPILOT_ENABLED` | ✅ | `NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED` | `0` = tắt toàn bộ guarded routes |
| `PTT_AI_PILOT_USER_IDS` | ✅ | `NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS` | CSV UUID staff pilot; rỗng = mọi user có cap (staging only) |
| `PTT_AI_LOG_PII` | ✅ | — | Prod **bắt buộc `0`** |
| `PTT_AI_LOG_PROMPTS` | ✅ | — | Prod **bắt buộc `0`** |

Chi tiết: [`deploy/env.ai.example`](../../deploy/env.ai.example)

### 4.2. Pre-flight trước khi bật (tuần 10)

```bash
cd RNOSAI
source deploy/env.local.example   # hoặc env prod trên VPS

# Gate kỹ thuật
bash scripts/rnos_r1_prod_pilot_gate.sh

# Validate cohort JSON
R1_PILOT_COHORT=deploy/pilot-cohort.json bash scripts/rnos_r1_pilot_enable.sh
```

Checklist:

- [ ] DDL RNOS-01 applied (`GET /api/v1/ai/health` → `schema_ready: true`)
- [ ] `rnos_r1_prod_pilot_gate.sh` PASS (hoặc manual sign-off tuần 9)
- [ ] `pilot-cohort.json` có 5–8 UUID khớp `staffMe().id` trên prod
- [ ] UAT 8 bước signed ([`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md))
- [ ] `#ai-alerts` channel có owner on-call 48h

### 4.3. Bật pilot prod (tuần 10 — ngày T0)

```bash
# Dry-run in env snippet
bash scripts/rnos_r1_pilot_enable.sh --apply --cohort deploy/pilot-cohort.json

# Trên VPS — load env rồi restart
set -a && source .local-dev/r1-pilot-env.sh && set +a
sudo systemctl restart ptt-crm-api.service

# Rebuild ops-web với NEXT_PUBLIC_* từ cohort (bắt buộc khớp Nest)
# sudo systemctl restart ptt-ops-web.service
```

**Thông báo team (mẫu Slack):**

> Pilot AI Copilot đã bật cho 5–8 CSKH. Mở lead → tab/sidebar **AI Copilot**. AI **không** tự gửi Zalo — chỉ soạn draft để bạn duyệt. User ngoài danh sách không thấy panel.

### 4.4. Verify sau bật (15 phút)

| Check | Cách verify | Pass |
|-------|-------------|------|
| Pilot user thấy Copilot | Login → `/crm/leads/[id]` | Panel + trust footer |
| Non-pilot không thấy | User khác login | Panel ẩn |
| API guarded | `POST /api/v1/ai/summarize` non-pilot | 403 `pilot_cohort_required` |
| Audit | 1 summarize call | Row mới trong `ai_agent_runs` |

### 4.5. Tắt nhanh (rollback ≤5 phút)

```bash
PTT_AI_COPILOT_ENABLED=0
# + NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=0 trên ops-web rebuild
sudo systemctl restart ptt-crm-api ptt-ops-web
```

Chi tiết: [`ai-service-operations.md` §8](./ai-service-operations.md).

---

## 5. KPI dashboard — nơi xem & cách đọc

### 5.1. Dashboard chính (GDKD + CSKH lead)

**URL:** `https://ops.pttads.vn/crm/ai/insights`

| Khối UI | KPI | Ý nghĩa thực chiến |
|---------|-----|-------------------|
| **Tile grid** | Tỷ lệ chấp nhận AI (7 ngày) | G6 — draft/summary được accept vs dismiss |
| **CopilotAdoptionPanel** | Copilot DAU / pilot denominator | G2 — hôm nay bao nhiêu người trong cohort đã gọi AI |
| **CopilotAdoptionPanel** | AI acceptance vs target ≥40% | §0.6 DoD — gate pass/fail màu xanh/vàng |
| **Trend chart** | DAU theo ngày | Xu hướng adoption — phải **đi lên** từ tuần 10→12 |
| **Pipeline risk** (nếu bật) | Deal at-risk | GDKD — không thuộc R1 gate nhưng hữu ích review |

**Quyền:** cap `crm_kpi_records` view (manager/GDKD). CSKH thường xem Copilot trên lead detail; manager owns insights page.

### 5.2. API (Platform / script tuần)

```bash
# Adoption — DAU + acceptance gates (§0.6)
curl -s -H "Authorization: Bearer $STAFF_TOKEN" \
  "$API/api/v1/ai/analytics/adoption?days=7" | jq .

# Acceptance breakdown — dismiss reasons
curl -s -H "Authorization: Bearer $STAFF_TOKEN" \
  "$API/api/v1/ai/analytics/acceptance?days=7" | jq .
```

Hoặc internal key (cron/script):

```bash
curl -s -H "X-Internal-Key: $PTT_CRM_INTERNAL_KEY" \
  "$API/api/v1/ai/analytics/adoption?days=7"
```

**Response fields quan trọng:**

| Field | Target |
|-------|--------|
| `copilot_dau_rate_pct` | ≥60 |
| `copilot_dau_gate_pass` | `true` |
| `acceptance_rate_pct` | ≥35 (stretch 40) |
| `acceptance_gate_pass` | `true` |
| `pilot_denominator` | = số UUID trong cohort |

### 5.3. Script báo cáo tuần (khuyến nghị)

```bash
cd RNOSAI
source deploy/env.local.example
PILOT_WEEK=10 bash scripts/cskh_pilot_weekly_report.sh
# → .local-dev/cskh-pilot-week-10-report.md
```

Gom: SQL probes G1–G6 + adoption summary + checklist review.

### 5.4. SQL spot-check (Platform)

```sql
-- DAU hôm nay (copilot use cases)
SELECT COUNT(DISTINCT actor_id) AS dau_today
FROM ai_agent_runs
WHERE started_at >= date_trunc('day', NOW())
  AND use_case IN ('summarize','score_lead','follow_up_draft','route_rep','copilot_draft')
  AND actor_id NOT IN ('system','cron','internal');

-- Acceptance 7 ngày
SELECT status, COUNT(*)
FROM ai_recommendations
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1;

-- Summarize P95 (Gate R1 #2)
SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
FROM ai_agent_runs
WHERE use_case IN ('summarize','lead_brief')
  AND started_at >= NOW() - INTERVAL '7 days';
```

### 5.5. Baseline tuần 0 (trước pilot)

CSKH lead điền **trước tuần 10**:

| Metric | Baseline (survey) | Cách đo |
|--------|-------------------|---------|
| Phút trung bình log 1 call | ___ phút | 5 CSKH × 10 call mẫu |
| % lead được gọi trong 15p | ___% | CSKH board export |
| % lead có note đủ context | ___% | Spot audit 20 lead |

Lặp lại survey **tuần 11** để tính G4 (↓25%).

---

## 6. Thói quen hàng ngày CSKH

### Micro-workflow (mỗi lead có tương tác)

1. Mở `/crm/leads/[id]` → xem **score + campaign chip** (biết ưu tiên & nguồn ads).
2. **Lead brief** (5 bullet) trước khi gọi — đặc biệt lead Meta/Zalo.
3. Sau call dài → log activity → **Tóm tắt** activity (không copy tay paragraph).
4. Cần follow-up → **Soạn draft** → sửa → **Duyệt** → copy thủ công sang Zalo (BR-AI-01).
5. Draft không dùng → **Dismiss** + chọn lý do (giúp cải prompt tuần sau).

**Thời lượng mục tiêu:** ≤3 phút AI steps / lead (không tính thời gian gọi).

### Morning huddle team (5 phút — từ tuần 10)

- Hôm qua ai chưa mở Copilot? (DAU thấp)
- 1 dismiss reason phổ biến → chia sẻ trick
- Lead hot score ≥80 chưa ai gọi?

### GDKD morning check (5 phút)

Theo [`ai-service-operations.md` §7.1](./ai-service-operations.md): health API, error rate 24h, LLM status.

---

## 7. Weekly review — quy trình 45 phút

**Tần suất:** Mỗi **thứ Sáu 14:00** (hoặc slot cố định) từ **tuần 10 → tuần 12**, rồi hàng tuần đến hết 90 ngày.

**Tham dự:** CSKH lead, GDKD, AI product (optional), Platform (khi có incident).

### Agenda cố định

| Phút | Mục | Output |
|------|-----|--------|
| 0–5 | Mở — mục tiêu tuần trước | 1 câu pass/fail |
| 5–15 | **Dashboard review** — mở `/crm/ai/insights` + report script | Điền template weekly |
| 15–25 | **Qualitative** — 3 câu hỏi CSKH | Top friction + 1 win |
| 25–35 | **Actions** — prompt / training / tech | Owner + due date |
| 35–40 | **Risk** — rollback? widen cohort? | Quyết định rõ |
| 40–45 | Commit tuần tới | Số lead/CSKH phải dùng Copilot |

### Ba câu hỏi bắt buộc cho CSKH

1. *Draft nào hữu ích nhất tuần này? Vì sao?*
2. *Draft nào vô dụng / sai? Dismiss lý do gì?*
3. *Có lúc nào bạn không tin score không? Case cụ thể?*

### Template ghi chép

Copy mỗi tuần: [`docs/templates/cskh-ai-pilot-weekly-review.md`](../templates/cskh-ai-pilot-weekly-review.md)

Lưu file: `.local-dev/cskh-pilot-reviews/week-NN.md` (gitignore) hoặc Notion/Confluence.

### Ngưỡng hành động sau review

| Tín hiệu | Hành động |
|----------|-----------|
| DAU <40% 2 tuần liên tiếp | Training lại + CSKH lead shadow 1:1 |
| Acceptance <25% | AI product review prompt; không đổi model cùng lúc |
| Acceptance giảm >10pp sau deploy prompt | Rollback prompt version |
| Summarize P95 >5s | Platform ticket — không blame CSKH |
| Error rate AI >5% | Xem §9 escalation |
| DAU ≥60% + acceptance ≥35% | Chuẩn bị widen cohort tuần 13+ |

---

## 8. Gate tuần 4 / 8 / 12

| Gate | Tuần | Automated | Manual |
|------|------|-----------|--------|
| **Phase 0** | 4 | `bash scripts/rnos_phase0_gate.sh` | Timeline ≥70%, attribution ≥80% |
| **R1 staging** | 8 | `bash scripts/rnos39_gate.sh` | UAT 8 bước 1 CSKH |
| **R1 prod pilot** | 12 | `bash scripts/rnos_r1_prod_pilot_gate.sh` | Sign-off JSON + survey G4 |

**Pass tuần 12 = kết thúc pilot 90 ngày R1** → chuyển §10 widen.

---

## 9. Escalation & rollback

| Severity | Triệu chứng | Ai xử lý | SLA |
|----------|-------------|----------|-----|
| **S1** | PII trong log; AI auto-send outbound | Platform + Legal | Tắt flag ngay |
| **S2** | Error rate >5% / LLM down 30p | Platform | Rollback §4.5 |
| **S3** | Acceptance sụt >10pp sau change | AI product | Revert prompt 24h |
| **S4** | CSKH complain UX | CSKH lead + Product | Fix tuần sau |

**Rollback trigger nhanh:** `PTT_AI_COPILOT_ENABLED=0` — CRM vẫn chạy bình thường.

---

## 10. Sau 90 ngày — mở rộng

**Nếu gate tuần 12 PASS:**

1. Widen cohort → full CSKH team (giữ monitor 2 tuần).
2. Bật **lead route ML** (`PTT_AI_LEAD_ROUTING_ML_ENABLED=1`) khi đủ override labels.
3. GDKD tiếp tục weekly review — chuyển focus sang **acceptance ≥40%** (§0.6 DoD v1).
4. Lên kế hoạch **R2** preview: NBA card, deal score ([`90-day plan §11.3`](../specs/2026-07-26-ai-phase1-90-day-plan.md)).

**Nếu FAIL gate:**

- Giữ cohort nhỏ; 4 tuần remediation (prompt + training).
- Không widen; không bật ML routing.
- Root cause doc bắt buộc trước retry gate.

---

## Phụ lục — Quick links

| Tài nguyên | Path |
|------------|------|
| Copilot UI | `/crm/leads/[id]` → `LeadCopilotPanel` |
| Adoption dashboard | `/crm/ai/insights` |
| UAT 8 bước | [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md) |
| Gate R1 | [`rnos-r1-prod-pilot-gate.md`](./rnos-r1-prod-pilot-gate.md) |
| Weekly report script | `scripts/cskh_pilot_weekly_report.sh` |
| Weekly review template | [`cskh-ai-pilot-weekly-review.md`](../templates/cskh-ai-pilot-weekly-review.md) |

---

*Playbook v1.0 — cập nhật khi đổi adoption targets (`ai-adoption-analytics.service.ts`) hoặc copilot contract.*
