# Chi tiết hành động — AI Revenue OS (AI)

> **UC gốc:** [`../09-AI-REVENUE-OS.md`](../09-AI-REVENUE-OS.md)  
> **Spec:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) · **UI:** [`SPEC_UI_UX_AI_REVENUE_OS.md`](../../SPEC_UI_UX_AI_REVENUE_OS.md) · **90-day:** [`specs/2026-07-26-ai-phase1-90-day-plan.md`](../../specs/2026-07-26-ai-phase1-90-day-plan.md) §8.2  
> **CRM lead:** [`01-CRM-ACTIONS.md`](01-CRM-ACTIONS.md) · **Platform:** [`07-PLAT-ACTIONS.md`](07-PLAT-ACTIONS.md)  
> **Phiên bản:** 1.3 · **Coverage:** AI-UC-001…022 (R1 ship + R2–R4 target)

---

## Pilot walkthrough — 8 bước UAT (tuần 11)

**Mục tiêu khách hàng:** *"Mở lead, thấy score + lý do, tóm tắt nhanh, soạn follow-up, duyệt — không lo AI tự gửi tin nhắn."*

**Actors:** CSKH pilot, System, QA observer

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/login` | Đăng nhập user thuộc pilot cohort | credentials | JWT + copilot cap | ✓ flag on |
| 2 | CSKH | `/crm/leads` | Mở lead **owner=me**, status Mới/B2 | filter | Lead row | ✓ BR-AI-04 |
| 3 | CSKH | `/crm/leads/[id]` | Xem sidebar **AI Copilot** — score + chips | — | Score 0–100 + explain | ✓ ≤30s from create |
| 4 | CSKH | Copilot panel | **Tóm tắt nhanh** (Lead brief) | — | 5 bullets VN | ✓ RNOS-06 |
| 5 | CSKH | Same | Log call dài → chọn activity → **Tóm tắt** | activity id | summary + extracted | ✓ P95 ≤5s |
| 6 | CSKH | Same | **Soạn follow-up** → chọn Zalo/note | channel hint | Draft in textarea | ✓ |
| 7 | CSKH | Same | Sửa draft → **Duyệt** | edited text | Copied to activity note | ✓ BR-AI-01 no send |
| 8 | QA | DB / admin | Verify `ai_agent_runs` ≥4 rows cho session | request_ids | COUNT match calls | ✓ G5 audit |

#### Nhánh E1 — User không thuộc pilot
Bước 3: Copilot panel **ẩn**; `GET /api/v1/ai/scores` → 403/404.

#### Nhánh E2 — Score chưa sẵn sàng
Bước 3: Skeleton "Đang tính…" → refresh ≤30s ([AI-UC-001](#ai-uc-001--lead-score-async-sau-ingest)).

#### Tiêu chí nghiệm thu (walkthrough)
- [ ] 8 bước pass trên staging mirror prod
- [ ] Không outbound API send sau bước 7
- [ ] Summarize P95 ≤5s (staging load sample)
- [ ] CSKH lead ký UAT §8.2

---

## AI-UC-001 — Lead score async sau ingest

**Mục tiêu khách hàng:** *"Lead mới vào CRM có điểm ưu tiên ngay — CSKH biết gọi ai trước."*

**Actors:** System, CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | `POST /webhooks/meta` hoặc form | Lead ingest | payload | 200 + lead id | ✓ [CRM-UC-001](01-CRM-ACTIONS.md) |
| 2 | System | outbox worker | Emit `tenant.lead.created` | lead_id | event row | ✓ RNOS-08 |
| 3 | System | score consumer | Job `score_lead` | lead_id | queued | ✓ idempotent |
| 4 | System | `POST /api/v1/ai/score/lead` | Rules engine score | lead context | score + explain | ✓ |
| 5 | System | PostgreSQL | Insert `ai_scores`, `ai_agent_runs` | — | rows | ✓ RNOS-05 |
| 6 | System | — | Emit `tenant.lead.scored` (optional) | — | domain event | ○ |
| 7 | CSKH | `/crm/leads/[id]` | Mở lead (owner=me) | — | Copilot score visible | ✓ ≤30s |
| 8 | CSKH | Copilot | Verify chips explain (+/−) | — | Readable VN | ✓ ≥1 factor |
| 9 | CSKH | `/crm/leads` | Sort/filter by score (stretch) | sort=score | Ordered list | ○ R1 stretch |

#### Nhánh E1 — Job fail
Bước 4 retry 3x → UI "Score đang cập nhật" + manual refresh button.

#### Nhánh E2 — Duplicate trong 5 phút
Bước 4 idempotency → single `ai_scores` row updated_at bump.

#### Tiêu chí nghiệm thu
- [ ] Lead created → score visible ≤30s (E2E + prod metric)
- [ ] `ai_agent_runs` mỗi score job
- [ ] Không regression CRM ingest latency

---

## AI-UC-002 — Copilot — Lead brief

**Mục tiêu khách hàng:** *"30 giây nắm lead — không đọc hết timeline."*

**Actors:** CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/crm/leads/[id]` | Mở lead detail | — | CRM + copilot load | ✓ owner |
| 2 | CSKH | Copilot panel | Đọc score card trước | — | Score + chips | ✓ [UC-005](#ai-uc-005--xem-score--explainability) |
| 3 | CSKH | Same | Bấm **Tóm tắt nhanh** | — | Loading skeleton | ✓ |
| 4 | System | `POST /api/v1/ai/summarize` | context=lead_brief | entity_id | 5 bullets | ✓ |
| 5 | CSKH | Same | Đọc bullets: who, need, source, risk, next | — | VN text | ✓ |
| 6 | CSKH | Same | **Copy** to clipboard (optional) | — | Toast copied | ○ |
| 7 | CSKH | Same | **Bỏ** brief card | — | Panel collapsed | ○ |
| 8 | CSKH | Same | Refresh page — brief không auto-regenerate | — | Button available again | ✓ no stale overwrite |

#### Nhánh E1 — Lead mới zero activity
Brief từ form + source; bullet "Chưa có tương tác".

#### Nhánh E2 — Rate limit
Bước 4 → 429 toast "Thử lại sau 1 phút".

#### Tiêu chí nghiệm thu
- [ ] Brief ≤5 bullets tiếng Việt
- [ ] Mention source/campaign khi `meta_json` có data
- [ ] `ai_agent_runs` ghi action=summarize/brief

---

## AI-UC-003 — Copilot — Summarize activity

**Mục tiêu khách hàng:** *"Ghi chú call dài → một đoạn tóm tắt để manager đọc."*

**Actors:** CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/crm/leads/[id]` | **+ Activity** → Call | duration, note ≥50 chars | Timeline row | ✓ |
| 2 | CSKH | Timeline | Chọn activity vừa tạo | row click | Highlight | ✓ |
| 3 | CSKH | Copilot | Bấm **Tóm tắt** (activity mode) | activity id | Loading | ✓ |
| 4 | System | `POST /api/v1/ai/summarize` | text from activity | entity_type=lead | summary + extracted | ✓ |
| 5 | CSKH | Copilot | Review summary + extracted fields | — | intent, objections | ✓ |
| 6 | CSKH | Same | **Chấp nhận** → copy to new note (optional) | — | Note created | ○ |
| 7 | CSKH | Same | Hoặc dismiss — không bắt buộc reason | — | Card closed | ○ |
| 8 | CSKH | Same | Retry nếu error | retry btn | New attempt | ✓ error UX |

#### Nhánh E1 — Paste mode
Bước 3: Paste text vào copilot textarea thay chọn timeline.

#### Tiêu chí nghiệm thu
- [ ] P95 ≤5s staging
- [ ] Activity gốc không bị overwrite
- [ ] Empty text → 400 validation

---

## AI-UC-004 — Follow-up draft + approve

**Mục tiêu khách hàng:** *"AI soạn nháp Zalo/email — tôi duyệt rồi tự gửi, hệ thống không gửi hộ."*

**Actors:** CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/crm/leads/[id]` | Copilot → **Soạn follow-up** | — | Channel picker | ✓ |
| 2 | CSKH | Same | Chọn **Zalo** hoặc **Email** hoặc **Note nội bộ** | channel | — | ✓ |
| 3 | System | `POST /api/v1/ai/recommendation` | type=follow_up_draft | entity_id | recommendation id | ✓ |
| 4 | CSKH | Copilot | Chờ draft → hiển thị textarea | — | Editable text | ✓ |
| 5 | CSKH | Same | Chỉnh sửa nội dung | text | Live edit | ✓ |
| 6 | CSKH | Same | **Duyệt** | — | PATCH accepted | ✓ BR-AI-01 |
| 7 | System | — | Copy to activity note / clipboard | — | Activity row | ✓ no Zalo/ESP API |
| 8 | CSKH | Timeline | Verify note chứa draft đã duyệt | — | Visible | ✓ audit accepted_by |
| 9 | CSKH | Same | (Alt) **Bỏ** → [UC-007](#ai-uc-007--dismiss-recommendation--reason) | reason optional | dismissed | ○ |

#### Nhánh E1 — Low confidence
Banner BR-AI-02 trước bước 6; vẫn cho duyệt.

#### Nhánh E2 — Network fail on PATCH
Toast error; draft preserved in textarea; retry approve.

#### Tiêu chí nghiệm thu
- [ ] Approve không trigger outbound send (manual + E2E)
- [ ] `ai_recommendations.status=accepted` + `accepted_by`
- [ ] Edit before approve reflected in final note

---

## AI-UC-005 — Xem score + explainability

**Mục tiêu khách hàng:** *"Biết vì sao lead 78 điểm — không phải hộp đen."*

**Actors:** CSKH, GDKD

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/crm/leads/[id]` | Load copilot panel | — | Score card | ✓ |
| 2 | CSKH | Score card | Đọc số 0–100 + label hot/warm/cold | — | Color badge | ✓ |
| 3 | CSKH | Same | Đọc chips **+** factors | — | Green chips | ✓ |
| 4 | CSKH | Same | Đọc chips **−** factors | — | Amber chips | ✓ |
| 5 | CSKH | Same | Hover confidence % | — | Tooltip | ✓ |
| 6 | CSKH | Same | Banner nếu confidence < 0.6 | — | Warning BR-AI-02 | ✓ when low |
| 7 | CSKH | Same | **Làm mới score** (manual) | refresh | Updated score | ○ |
| 8 | GDKD | Same lead | Xem score lead team member | — | Read-only or full | ✓ cap GDKD |

#### Nhánh E1 — Pending score
Skeleton + copy "Đang tính…" ≤30s.

#### Tiêu chí nghiệm thu
- [ ] ≥3 explain factors when data sufficient
- [ ] `GET /api/v1/ai/scores` returns latest + history

---

## AI-UC-006 — Manager override score

**Mục tiêu khách hàng:** *"Deal VIP score thấp do thiếu data — GDKD sửa ưu tiên có lý do."*

**Actors:** GDKD

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | GDKD | `/login` | cap GDKD | credentials | JWT | ✓ |
| 2 | GDKD | `/crm/leads/[id]` | Mở lead bất kỳ team | — | Copilot | ✓ BR-AI-04 GDKD |
| 3 | GDKD | Score card | **Điều chỉnh score** | — | Modal | ✓ UI-R1-08 |
| 4 | GDKD | Modal | Nhập score 0–100 | number | validation | ✓ |
| 5 | GDKD | Modal | Nhập **lý do** bắt buộc | text ≥10 chars | — | ✓ |
| 6 | GDKD | Modal | **Lưu** | — | Badge "GDKD điều chỉnh" | ✓ |
| 7 | System | PostgreSQL | `ai_scores` source=manual_override | overridden_by | new row | ✓ |
| 8 | CSKH | Same lead | Thấy score mới + badge | — | Explain + override note | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Override có `overridden_by` + reason
- [ ] History giữ score auto cũ

---

## AI-UC-007 — Dismiss recommendation + reason

**Mục tiêu khách hàng:** *"Góp ý AI sai — dismiss có lý do để cải thiện."*

**Actors:** CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | Copilot | Trên draft/brief card → **Bỏ** | — | Modal optional | ✓ |
| 2 | CSKH | Modal | Chọn reason preset | sai tone / sai fact / không cần | — | ○ |
| 3 | CSKH | Modal | **Xác nhận** | — | PATCH dismissed | ✓ |
| 4 | System | `PATCH /api/v1/ai/recommendations/:id` | status=dismissed | dismiss_reason | 200 | ✓ |
| 5 | CSKH | Copilot | Card biến mất khỏi pending | — | Empty state | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Dismiss không gửi outbound
- [ ] Metrics có thể aggregate dismiss rate

---

## AI-UC-008 — Timeline enrich cho AI context

**Mục tiêu khách hàng:** *"AI hiểu lịch sử lead — score và brief chính xác hơn."*

**Actors:** System, CSKH

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | CSKH | `/crm/leads/[id]` | Log call / note | activity | Timeline CRM | ✓ |
| 2 | System | worker | Mirror → `customer_timeline_events` | payload | event row | ✓ RNOS-16 |
| 3 | System | webhook | Meta lead → timeline `lead.ingested` | meta payload | attribution | ✓ |
| 4 | CSKH | Same | Đổi status B2 | status | event status_change | ✓ |
| 5 | System | AI context builder | Read timeline on score/brief | — | Richer explain | ✓ |
| 6 | QA | SQL/report | Completeness ≥70% pilot sample | n≥50 | metric | ✓ Phase 0 gate |
| 7 | Admin | backfill job (once) | Legacy activities → timeline | batch | count | ○ |
| 8 | CSKH | Copilot | Brief mentions recent activity | — | Bullet ref call | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Activity → timeline event ≤1 min
- [ ] Phase 0 gate ≥70% completeness

---

## AI-UC-009 — AI audit / agent run trace

**Mục tiêu khách hàng:** *"Mọi lần gọi AI truy vết được — compliance yên tâm."*

**Actors:** Admin, Tech lead

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | mọi `/api/v1/ai/*` | Insert `ai_agent_runs` | request_id | row | ✓ RNOS-05 |
| 2 | Admin | `/admin/ai/runs` ⚠ GAP | List runs filter date | date range | table | ⚠ staging SQL OK |
| 3 | Admin | Same | Filter `entity_id` = lead | lead id | subset | ✓ |
| 4 | Admin | Row detail | Xem model, latency, status | — | no prompt PII prod | ✓ BR-AI-05 |
| 5 | Tech | Staging only | Drill request_id ↔ copilot UI | id | match | ✓ dev |
| 6 | QA | SQL | `COUNT(*)` runs = API calls session | — | 100% | ✓ G5 |
| 7 | Compliance | Config review | `AI_LOG_PROMPTS=0` prod | env | signed | ✓ §19.1 #5 |
| 8 | Admin | Export CSV (stretch) | date range | — | file | ○ |

#### Tiêu chí nghiệm thu
- [ ] 100% AI calls có `ai_agent_runs`
- [ ] Prod prompt logs không chứa PII

---

## AI-UC-010 — Pilot gate / feature flag

**Mục tiêu khách hàng:** *"Pilot 5–8 người trước — rollback nhanh nếu lỗi."*

**Actors:** Platform, CSKH pilot, Product

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Platform | env / admin | Set `PTT_AI_COPILOT_ENABLED=1` | — | flag on | ✓ |
| 2 | Platform | cohort config | Add 5–8 user ids pilot | user ids | allowlist | ✓ tuần 11 |
| 3 | CSKH pilot | `/crm/leads/[id]` | Verify copilot visible | — | panel | ✓ |
| 4 | CSKH non-pilot | Same | Verify copilot hidden | — | no panel | ✓ |
| 5 | Product | metrics dashboard | Monitor DAU copilot | daily | chart | ✓ G2 |
| 6 | Product | Same | Acceptance rate drafts | weekly | ≥35% target | ✓ G6 |
| 7 | Platform | incident | Flag off rollback | — | CRM OK | ✓ RNOS-40 |
| 8 | Tech lead | Gate R1 | Sign §8.3 checklist | — | pass/fail | ✓ tuần 12 |

#### Tiêu chí nghiệm thu
- [ ] Rollback flag off ≤5 phút
- [ ] CRM core không regression khi AI off
- [ ] Pilot DAU ≥60% team pilot (G2)

---

## AI-UC-011 — NBA trên deal stalled (R2)

**Mục tiêu khách hàng:** *"Deal đứng im — biết ngay nên gọi lại hay escalate, không để rơi pipeline."*

**Actors:** System, Sales, AM, GDKD

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | worker daily | Pipeline Risk scan ≥7d no activity | deal ids | `ai_recommendations` nba | ✓ RNOS-23 |
| 2 | Sales | `/crm/pipeline` | Mở deal card có badge **NBA** | — | NbaCard visible | ✓ RNOS-10 |
| 3 | Sales | Deal drawer / copilot | Đọc gợi ý + lý do + playbook link | — | VN text | ✓ |
| 4 | Sales | NbaCard | **Chấp nhận** → tạo task | due date | Task row CRM | ✓ |
| 5 | Sales | Same | Optional: mở activity template | — | Pre-filled note | ○ |
| 6 | Sales | Same | Hoặc **Bỏ** + reason | dismiss_reason | PATCH dismissed | ✓ RNOS-29 |
| 7 | GDKD | `/crm/hub` hoặc `/crm/ai/insights` | Xem danh sách stall team | filter team | Table | ○ |
| 8 | QA | PostgreSQL | Verify accept → task id linked | — | Audit trail | ✓ |

#### Nhánh E1 — Low confidence
Banner BR-AI-02 trước bước 4; vẫn cho accept.

#### Tiêu chí nghiệm thu
- [ ] NBA không auto-execute without accept
- [ ] Dismiss ghi reason (R2 full)
- [ ] Playbook cite khi RAG enabled (RNOS-12)

---

## AI-UC-012 — Deal score (R2)

**Mục tiêu khách hàng:** *"Kanban pipeline thấy deal nào sắp rơi — có lý do."*

**Actors:** Sales, System, GDKD

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Sales | `/crm/pipeline` | Kéo stage hoặc attach proposal | stage | Stage saved | ✓ |
| 2 | System | `POST /api/v1/ai/score/deal` | Compute deal score | deal_id | score + explain | ✓ RNOS-09 |
| 3 | Sales | Kanban card | Xem mini score bar + color | — | 0–100 | ✓ UI-R2-02 |
| 4 | Sales | Deal drawer | Mở copilot ScoreCard | — | Full chips | ✓ |
| 5 | Sales | Same | Compare với lead score same account | — | Context | ○ |
| 6 | GDKD | Deal drawer | **Điều chỉnh score** (override) | reason | Badge override | ○ stretch |
| 7 | GDKD | `/crm/pipeline` | Sort by deal score | sort | Ordered | ○ |
| 8 | System | `ai_agent_runs` | Audit score job | — | row | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Score refresh on stage change
- [ ] Explain ≥2 factors when data sufficient

---

## AI-UC-013 — Forecast commit (R3)

**Mục tiêu khách hàng:** *"Cam kết doanh thu tháng có số AI + GDKD chốt — không Excel riêng."*

**Actors:** GDKD, Leadership, System

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | cron 07:00 ICT | Forecast Agent snapshot | pipeline data | `revenue_forecast_snapshots` | ✓ RNOS-17 |
| 2 | GDKD | `/crm/forecast` | Mở dashboard tháng hiện tại | — | KPI cards | ✓ UI-R3-01 |
| 3 | GDKD | Same | Review AI delta vs weighted pipeline | — | Chart + table | ✓ |
| 4 | GDKD | Same | Đọc explain factors (stall, season) | — | Bullets | ✓ |
| 5 | GDKD | ForecastCommitPanel | Nhập **Cam kết** VND | amount | validation | ✓ |
| 6 | GDKD | Same | **Lưu cam kết** | — | `committed_by` | ✓ |
| 7 | Leadership | `/crm/business-dashboard` | Xem committed vs actual T-1 | — | Variance | ✓ P1 |
| 8 | QA | SQL | MAPE prior month vs actual | — | ≤20% target | ✓ §19.3 |

#### Nhánh E1 — MAPE prior >20%
Banner cảnh báo trước bước 6.

#### Tiêu chí nghiệm thu
- [ ] Snapshot immutable after commit
- [ ] Không auto-commit without GDKD

---

## AI-UC-014 — Renewal agent workflow (R3)

**Mục tiêu khách hàng:** *"HĐ sắp hết hạn — AM có nháp renewal, tự gửi sau khi duyệt."*

**Actors:** AM, System, Client (indirect)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | workflow | Trigger T-90/T-60/T-30 contract | contract_id | renewal task | ✓ RNOS-20 |
| 2 | AM | `/agency/clients/[id]` tab Retain | Xem Renewal card + churn ref | — | Health score | ✓ |
| 3 | AM | Same | **Generate renewal draft** | channel | textarea draft | ✓ BR-AI-01 |
| 4 | AM | Same | Edit draft | text | — | ✓ |
| 5 | AM | Same | **Duyệt** | — | task + note | ✓ no auto-send |
| 6 | AM | `/crm/service-delivery/[id]` | Advance lifecycle / log call | — | Timeline | ✓ |
| 7 | AM | Same | Mark renewal Won/Lost | outcome | CRM update | ✓ feedback |
| 8 | GDKD | `/crm/hub` | Monitor renewal pipeline | filter | List | ○ |

#### Tiêu chí nghiệm thu
- [ ] Renewal draft không outbound auto
- [ ] T-90/60/30 triggers fire on test contract

---

## AI-UC-015 — Pipeline risk & smart reminder (R2)

**Mục tiêu khách hàng:** *"Deal at-risk báo GDKD sớm — không surprise cuối tháng."*

**Actors:** System, GDKD, Sales

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | daily job | Scan pipeline risk | — | alert rows | ✓ RNOS-23 |
| 2 | GDKD | `/crm/ai/insights` hoặc inbox | Mở **At-risk deals** | — | List | ✓ |
| 3 | GDKD | Row | Drill → deal drawer | deal_id | Detail + score | ✓ |
| 4 | GDKD | Same | Assign follow-up owner | staff_id | Owner notified | ✓ |
| 5 | Sales | Notification | Mở deal → NBA card | — | [UC-011](#ai-uc-011--nba-trên-deal-stalled-r2) | ✓ |
| 6 | Sales | `/crm/pipeline` | Log activity → clear risk flag | activity | Risk cleared | ✓ |
| 7 | System | — | Smart reminder suggest task | — | Optional task | ○ AI-07 |
| 8 | GDKD | Weekly | Review SLA + stall metrics | — | Coach input | ○ |

#### Tiêu chí nghiệm thu
- [ ] Alert within 24h of stall threshold
- [ ] Drill ≤3 clicks hub → deal

---

## AI-UC-016 — NL analytics curated (R3)

**Mục tiêu khách hàng:** *"CEO hỏi CPL tháng này — trả lời bằng số, không cần BI team."*

**Actors:** GDKD, CEO, System

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | GDKD | `/login` | cap `ai_analytics.query` | — | JWT | ✓ |
| 2 | GDKD | `/crm/ai/query` hoặc Cmd+K | Mở NL analytics | — | Preset list | ✓ RNOS-22 |
| 3 | GDKD | Same | Chọn preset "CPL Meta T-30 theo client" | — | — | ✓ |
| 4 | System | `POST /api/v1/ai/query` | Run curated query | intent_id | table + narrative | ✓ |
| 5 | GDKD | Same | Review chart/table | — | Read-only | ✓ |
| 6 | GDKD | Same | **Export CSV** | — | Download | ○ |
| 7 | GDKD | Same | Thử câu ngoài whitelist | free text | 400 + message | ✓ |
| 8 | QA | Audit | Query logged no PII prod | — | `ai_agent_runs` | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Không mutate CRM from NL query
- [ ] Out-of-scope blocked

---

## AI-UC-017 — Churn & CS health score (R3)

**Mục tiêu khách hàng:** *"Biết client nào sắp churn trước khi hết HĐ."*

**Actors:** AM, CS Lead, System

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | job | `POST /api/v1/ai/score/churn` per client | client_id | health score | ✓ RNOS-19 |
| 2 | AM | `/crm/health` | Sort clients by risk | sort desc | Table | ✓ UI-R3-04 |
| 3 | AM | `/agency/clients/[id]` | Tab health + explain chips | — | Score + factors | ✓ |
| 4 | AM | Same | Open renewal flow if < threshold | — | → [UC-014](#ai-uc-014--renewal-agent-workflow-r3) | ✓ |
| 5 | CS Lead | `/crm/health` | Filter ticket spike clients | — | Subset | ✓ |
| 6 | AM | Same | Log recovery plan activity | note | Timeline | ✓ |
| 7 | GDKD | Dashboard | Weekly churn trend | — | Chart | ○ |
| 8 | QA | Verify | Score uses ticket + payment signals | — | explain_json | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Health score visible on client detail
- [ ] Link to renewal when critical

---

## AI-UC-018 — Manager coach weekly digest (R3)

**Mục tiêu khách hàng:** *"GDKD Monday morning — 5 phút nắm team AI + SLA."*

**Actors:** GDKD, System

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | Mon 08:00 | Generate coach digest | team_id | email + DB row | ✓ RNOS-21 |
| 2 | GDKD | Email / `/crm/ai/coach` | Mở digest tuần | — | Cards: SLA, AI acceptance | ✓ |
| 3 | GDKD | Card SLA breach | Drill → `/crm/cskh-board` | filter | Red rows | ✓ |
| 4 | GDKD | Card AI dismiss | Drill top reasons | — | Table | ✓ |
| 5 | GDKD | Card pipeline | Drill at-risk count | — | [UC-015](#ai-uc-015--pipeline-risk--smart-reminder-r2) | ✓ |
| 6 | GDKD | Same | Export PDF summary | — | File | ○ |
| 7 | GDKD | Same | No auto HR actions | — | Read-only | ✓ |
| 8 | QA | Verify | Digest only aggregate data | — | No PII leak | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Digest delivered weekly
- [ ] Drill-down links work

---

## AI-UC-019 — Channel CPL/ROAS anomaly digest (R4)

**Mục tiêu khách hàng:** *"CPL Meta tăng đột biến — buyer biết ngay và xem lead liên quan."*

**Actors:** Media Buyer, AM, System

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | System | job | Detect CPL spike / zero leads 24h | campaign_ids | anomaly event | ✓ §23.5 |
| 2 | Buyer | `/meta/facebook-ads` | Xem banner narrative AI | client filter | VN summary | ✓ UI-R4-01 |
| 3 | Buyer | Same | Click **Xem lead liên quan** | — | `/crm/leads?campaign=` | ✓ |
| 4 | Buyer | `/zalo/zalo-ads` | Same pattern Zalo | — | Banner | ✓ |
| 5 | AM | `/agency/clients/[id]` | Review with client on call | — | Context | ✓ |
| 6 | Buyer | Meta hub | Read budget recommend (read-only) | — | Suggestion card | ✓ R4 |
| 7 | Buyer | Same | Không auto pause campaign | — | Manual only | ✓ governance |
| 8 | QA | Verify | Narrative matches hub numbers | — | Spot check | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Anomaly banner within 24h detection
- [ ] No auto spend change

---

## AI-UC-020 — Workflow AI node simulate + publish (R2)

**Mục tiêu khách hàng:** *"Automation có bước AI — test trước khi bật prod."*

**Actors:** Admin, Ops

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Admin | `/crm/automation` | **+ Workflow** mới | name | Draft graph | ✓ RNOS-13 |
| 2 | Admin | Canvas | Kéo trigger `lead.created` | — | Node placed | ✓ |
| 3 | Admin | Canvas | Thêm node **AI score lead** | — | AI node | ✓ RNOS-14 |
| 4 | Admin | Same | **Simulate** với sample lead id | lead_id | Output preview | ✓ RNOS-15 |
| 5 | Admin | Same | Verify simulate **không** ghi prod score | — | Read-only | ✓ §19.2 |
| 6 | Admin | Same | **Publish** workflow | confirm | status=active | ✓ |
| 7 | System | — | Live lead → score via workflow | — | `ai_agent_runs` | ✓ |
| 8 | Admin | `/admin/ai/runs` | Audit workflow AI executions | filter workflow | rows | ✓ |

#### Nhánh E1 — Simulate fail
Block publish; show validation errors.

#### Tiêu chí nghiệm thu
- [ ] Simulate gate pass §19.2
- [ ] Published workflow auditable

---

## AI-UC-021 — Multi-agent orchestration trace (R4)

**Mục tiêu khách hàng:** *"Một workflow gọi nhiều AI agent vẫn truy vết được từng bước — biết bước nào thành công hoặc thất bại."*

**Actors:** Admin, System, QA

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Admin | API / workflow | Trigger `lead_intake_v1` | lead id | Orchestration id | ✓ RNOS-31 |
| 2 | System | — | Tạo parent + child `ai_agent_runs` | plan + steps | Linked audit rows | ✓ audit |
| 3 | Admin | `/admin/ai/agents` | Xem trace tree | orchestration id | Parent → child tree | ✓ UI-R4-03 |
| 4 | Admin | Same | Drill child step output | child row | Redacted input/output | ✓ BR-AI-05 |
| 5 | QA | Verify | Required step fail → orchestration failed | failing fixture | Parent failed | ✓ |
| 6 | QA | Verify | Không auto CRM mutate ngoài rule sub-agent | audit + CRM diff | No extra mutation | ✓ BR-AI-01 |

#### Nhánh E1 — Required step thất bại
Orchestrator dừng plan, parent run và orchestration chuyển `failed`; trace giữ child step lỗi.

#### Nhánh E2 — Optional step thất bại
Plan tiếp tục; output ghi `failed_optional_steps`, child run vẫn truy vết được.

#### Tiêu chí nghiệm thu
- [ ] `lead_intake_v1` tạo parent run và ít nhất child `score_lead`
- [ ] `/admin/ai/agents` hiển thị đúng tree, status, latency và payload đã redaction
- [ ] Required step fail làm orchestration fail
- [ ] Không phát sinh outbound send hoặc CRM mutation ngoài rule của sub-agent

---

## AI-UC-022 — External agent tool call (R4)

**Mục tiêu khách hàng:** *"Agent bên ngoài chỉ gọi đúng AI tool được cấp quyền, mọi lần gọi đều truy vết và có thể thu hồi key ngay."*

**Actors:** Admin, External agent, System, QA

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Admin | `/admin/ai/tools` | Xem MCP-style tool catalog | staff JWT | Name, schema, mutating flag | ✓ RNOS-33 |
| 2 | Admin | Same | Tạo scoped API key | client id + tool allowlist | Plaintext key hiển thị một lần | ✓ hash only |
| 3 | External agent | `POST /api/v1/ai/tools/call` | Gọi tool được phép | `X-AI-Tool-Key` + tool input | Tool result | ✓ scoped |
| 4 | System | Tool registry | Kiểm tra client scope + allowlist | key context | Handler được delegate | ✓ governance |
| 5 | System | PostgreSQL | Ghi `ai_agent_runs` + `ai_tool_call_log` | request/correlation id | Hai audit rows liên kết | ✓ 100% audit |
| 6 | External agent | Same API | Gọi tool ngoài allowlist | disallowed tool | `403 tool_not_allowed` | ✓ |
| 7 | Admin | `/admin/ai/tools` | Thu hồi key | key id | Trạng thái Revoked | ✓ |
| 8 | QA | Same API | Gọi lại bằng key đã thu hồi; kiểm tra output | revoked key | `401`; không lộ PII mặc định | ✓ BR-AI-05 |

#### Nhánh E1 — Tool ngoài allowlist
Registry từ chối `403` trước khi chạy handler; lần gọi thất bại vẫn có `ai_agent_runs` và `ai_tool_call_log`.

#### Nhánh E2 — Key đã thu hồi
Guard không xác thực key có `is_active=false` hoặc `revoked_at`; trả `401 invalid_ai_tool_key`.

#### Tiêu chí nghiệm thu
- [ ] Tool catalog trả descriptor có `name`, `description`, `inputSchema`, `mutating`, `requiredCaps`
- [ ] Scoped key gọi được `health_check`; tool ngoài allowlist trả `403`
- [ ] Mọi lần gọi tool có `ai_agent_runs` và `ai_tool_call_log` liên kết bằng `agent_run_id`
- [ ] Key thu hồi trả `401` và plaintext key không được lưu trong database
- [ ] Audit metadata không ghi raw tool input hoặc PII mặc định

---

## Gate nghiệm thu theo wave (spec §19)

| Wave | UC actions bắt buộc UAT | File section |
|------|-------------------------|--------------|
| **R1** | 001–010 + pilot 8 bước | §Pilot walkthrough |
| **R2** | 011, 012, 015, 020 | §011–§020 |
| **R3** | 013, 014, 016, 017, 018 | §013–§018 |
| **R4** | 019, 021, 022 | §019, §021, §022 |

**Trạng thái ship:** R1 actions ready UAT · R2–R4 ⚠ target — UI chưa ship, dùng cho backlog QA khi release.

