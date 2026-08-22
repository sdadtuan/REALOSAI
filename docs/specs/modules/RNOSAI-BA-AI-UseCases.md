# RNOSAI BA — AI Revenue OS Use Cases

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-AI-UC |
| Phiên bản | 2.3 |
| Ngày xuất | 2026-08-01 |
| Module | MOD-AI |
| Số UC | 20 |
| Spec thủ công | 20/20 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Catalog gốc | [`docs/use-cases/09-AI-REVENUE-OS.md`](../../use-cases/09-AI-REVENUE-OS.md) |

---

## 1. Tóm tắt module

Module AI Revenue OS cung cấp Copilot trên lead/deal, lead scoring async, forecast commit, anomaly digest cross-channel, workflow AI nodes và audit đầy đủ qua `ai_agent_runs`. **BR-AI-01:** Không auto-send outbound — mọi draft phải được user duyệt trước khi copy/gửi thủ công.

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Status | UC liên quan |
| --- | --- | --- | --- | --- |
| SCR-CRM-002 | Chi tiết Lead | /crm/leads/[id] | Done | CRM-UC-002, AI-UC-001, AI-UC-002, AI-UC-003, AI-UC-004 |
| SCR-CRM-006 | Dự báo doanh thu (Forecast) | /crm/forecast | Done | AI-UC-013 |
| SCR-CRM-007 | Sức khỏe khách hàng (Health) | /crm/health | Done | AI-UC-017 |
| SCR-CRM-013 | Pipeline Sales | /crm/sales | In progress | CRM-UC-009 |
| SCR-AI-001 | AI Insights / Copilot analytics | /crm/ai/insights | Done | AI-UC-005, AI-UC-009 |
| SCR-AI-002 | NL Analytics Query | /crm/ai/query | Done | AI-UC-016 |
| SCR-AI-003 | Manager Coach Digest | /crm/ai/coach | Done | AI-UC-018 |
| SCR-AI-004 | Automation Workflows | /crm/automation | Done | AI-UC-020 |
| SCR-AI-005 | Playbook RAG | /crm/playbooks | Done | AI-UC-020 |
| SCR-ADMIN-001 | Admin AI Runs | /admin/ai/runs | Done | AI-UC-009 |
| SCR-ADMIN-002 | Admin AI Agents | /admin/ai/agents | Done | AI-UC-010 |
| SCR-ADMIN-003 | Admin AI Tools | /admin/ai/tools | Done | AI-UC-020 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Status | Spec |
| --- | --- | --- | --- | --- |
| AI-UC-001 | Lead score async sau ingest | High | Done | Thủ công |
| AI-UC-002 | Copilot — Lead brief | High | Done | Thủ công |
| AI-UC-003 | Copilot — Summarize activity | High | Done | Thủ công |
| AI-UC-004 | Follow-up draft + approve | High | Done | Thủ công |
| AI-UC-005 | Xem score + explainability | High | Done | Thủ công |
| AI-UC-006 | Manager override score | Medium | Done | Thủ công |
| AI-UC-007 | Dismiss recommendation + reason | Medium | Done | Thủ công |
| AI-UC-008 | Timeline enrich cho AI context | High | Done | Thủ công |
| AI-UC-009 | AI audit / agent run trace | High | Done | Thủ công |
| AI-UC-010 | Pilot gate / feature flag | High | Done | Thủ công |
| AI-UC-011 | NBA trên deal stalled | High | Done | Thủ công |
| AI-UC-012 | Deal score | Medium | Done | Thủ công |
| AI-UC-013 | Forecast commit | Medium | Done | Thủ công |
| AI-UC-014 | Renewal agent workflow | Medium | Done | Thủ công |
| AI-UC-015 | Pipeline risk & smart reminder | Medium | Done | Thủ công |
| AI-UC-016 | NL analytics curated | Low | Done | Thủ công |
| AI-UC-017 | Churn & CS health score | Medium | Done | Thủ công |
| AI-UC-018 | Manager coach weekly digest | Low | Done | Thủ công |
| AI-UC-019 | Channel CPL/ROAS anomaly digest | Low | Done | Thủ công |
| AI-UC-020 | Workflow AI node simulate + publish | Medium | Done | Thủ công |

---

## 2. Chi tiết Use Case

### AI-UC-001 — Lead score async sau ingest

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-001
- **Tên use case:** Lead score async sau ingest
- **Màn hình:** SCR-CRM-001, SCR-CRM-002
- **Actor chính:** System (worker, scoring engine)
- **Actor phụ:** CSKH (consumer UI)
- **Mục tiêu:** Tính score 0–100 + explainability sau lead ingest
- **Trigger:** Lead mới created hoặc tenant.lead.created
- **Pre-condition:** DDL applied; AiIntelligenceModule registered; pilot flag on
- **Post-condition:** ai_scores có bản ghi; audit run id traceable ≤30s
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-04, RNOS-08
- **API / Integration:** POST /api/v1/ai/score/lead · GET /api/v1/ai/scores

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Lead ingest hoàn tất (CRM-UC-001, PLAT-UC-004/005) |
| 2 | Outbox emit tenant.lead.created (RNOS-08) |
| 3 | Worker consume → POST /api/v1/ai/score/lead |
| 4 | Rules engine tính score + explainability[] (+/− factors) |
| 5 | Persist ai_scores + ai_agent_runs |
| 6 | Copilot panel refresh score ≤30s (poll/SSE) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Duplicate score 5 phút → idempotency skip/update same row |
| E2 | Thiếu attribution → score chạy; flag − Chưa map campaign |
| E3 | Job fail → retry 3x; UI Score đang cập nhật |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, tenant_id, source metadata, timeline snapshot |
| Output | score 0–100, explainability[], run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-002 — Copilot — Lead brief

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-002
- **Tên use case:** Copilot — Lead brief
- **Màn hình:** SCR-CRM-002
- **Actor chính:** CSKH / Sales
- **Mục tiêu:** Tóm tắt nhanh lead 5 bullet tiếng Việt trên copilot panel
- **Trigger:** Mở lead detail hoặc bấm Tóm tắt nhanh
- **Pre-condition:** Copilot PTT_AI_COPILOT_ENABLED=1; user owner hoặc GDKD
- **Post-condition:** Brief hiển thị; không auto thay CRM core fields
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-06
- **API / Integration:** POST /api/v1/ai/summarize (context=lead_brief)

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSKH mở /crm/leads/[id] |
| 2 | Sidebar AI Copilot load score card (AI-UC-005) |
| 3 | Bấm Tóm tắt nhanh → gather lead fields, last 5 activities, timeline, meta_json |
| 4 | LLM trả 5 bullet: who, need, source, risk, next step |
| 5 | User Copy hoặc Dismiss; ghi ai_agent_runs + ai_insights type=lead_brief |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Lead mới không activity → brief từ form fields + source |
| E2 | Rate limit 429 → toast thử lại sau 1 phút |
| E3 | Non-owner CSKH → 403 (BR-AI-004) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, activities[], timeline[], meta_json |
| Output | brief bullets[], run_id, confidence |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-004 | CSKH chỉ copilot lead owner=me; GDKD/Admin xem team |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-003 — Copilot — Summarize activity

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-003
- **Tên use case:** Copilot — Summarize activity
- **Màn hình:** SCR-CRM-002
- **Actor chính:** CSKH
- **Mục tiêu:** Tóm tắt activity dài thành summary có cấu trúc
- **Trigger:** Chọn activity timeline hoặc paste note vào copilot
- **Pre-condition:** Activity text ≥50 ký tự hoặc user paste note
- **Post-condition:** Summary hiển thị; activity gốc không overwrite
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-03, RNOS-06
- **API / Integration:** POST /api/v1/ai/summarize

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSKH chọn activity trên timeline hoặc paste vào copilot textarea |
| 2 | Bấm Tóm tắt → POST /api/v1/ai/summarize |
| 3 | Response: summary + extracted intent/objections/next_action |
| 4 | User chấp nhận → copy summary vào note mới (optional one-click) |
| 5 | Audit ai_agent_runs; P95 ≤5s staging |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Summary sai → user edit thủ công; dismiss không bắt buộc reason |
| E2 | Empty text → validation 400 |
| E3 | confidence < 0.6 → banner BR-AI-003 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | entity_type=lead, entity_id, text |
| Output | summary, extracted fields, run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-003 | confidence < 0.6 → banner cảnh báo; không ẩn score |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-004 — Follow-up draft + approve

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-004
- **Tên use case:** Follow-up draft + approve
- **Màn hình:** SCR-CRM-002
- **Actor chính:** CSKH
- **Mục tiêu:** Sinh draft follow-up; user duyệt trước khi dùng — KHÔNG auto-send
- **Trigger:** Bấm Soạn follow-up trên copilot panel
- **Pre-condition:** Lead context B1/B2+; BR-AI-01 enforced
- **Post-condition:** ai_recommendations status accepted|dismissed; không outbound send
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-06, RNOS-07
- **API / Integration:** POST /api/v1/ai/recommendation · PATCH /api/v1/ai/recommendations/:id

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CSKH bấm Soạn follow-up → chọn kênh gợi ý Zalo/email/note |
| 2 | POST /api/v1/ai/recommendation type=follow_up_draft |
| 3 | LLM trả draft message → textarea editable |
| 4 | CSKH chỉnh sửa nội dung |
| 5 | Duyệt → PATCH accepted → copy activity/clipboard — không gửi API outbound |
| 6 | Hoặc Bỏ → dismissed + reason (AI-UC-007) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Low confidence → banner BR-AI-02 trước duyệt |
| E2 | Approve ≠ Send — audit accepted_by timestamp |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, channel_hint, tone preference |
| Output | draft_text, recommendation_id, confidence, run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-004 | CSKH chỉ copilot lead owner=me; GDKD/Admin xem team |
| BR-AI-007 | Dismiss draft bắt buộc chọn preset reason |

### AI-UC-005 — Xem score + explainability

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-005
- **Tên use case:** Xem score + explainability
- **Màn hình:** SCR-CRM-002, SCR-AI-001
- **Actor chính:** CSKH / GDKD
- **Mục tiêu:** Hiển thị score 0–100 + explainability factors trên copilot
- **Trigger:** Mở lead detail copilot panel
- **Pre-condition:** Score đã chạy (AI-UC-001) hoặc pending
- **Post-condition:** User hiểu vì sao score cao/thấp (≥3 factors khi đủ data)
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-04, RNOS-06
- **API / Integration:** GET /api/v1/ai/scores?entity_type=lead&entity_id=

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Panel hiển thị score 0–100 + label hot/warm/cold |
| 2 | Chips explain: + Meta mapped, − Chưa gọi (2h), … |
| 3 | GET scores trả history; latest highlighted |
| 4 | Tooltip confidence %; banner nếu < 0.6 |
| 5 | Link Xem lịch sử score (optional drawer) |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Chưa có score → skeleton + Đang tính… ≤30s |
| E2 | Override active → badge GDKD điều chỉnh (AI-UC-006) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | entity_type, entity_id |
| Output | score, explainability_json[], history[] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-003 | confidence < 0.6 → banner cảnh báo; không ẩn score |
| BR-AI-005 | Explainability hiển thị ≥3 factors khi đủ data attribution |

### AI-UC-006 — Manager override score

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-006
- **Tên use case:** Manager override score
- **Màn hình:** SCR-CRM-002
- **Actor chính:** GDKD / Head Sales
- **Mục tiêu:** GDKD điều chỉnh score thủ công có audit
- **Trigger:** Score sai nghiệp vụ; cần ưu tiên thủ công
- **Pre-condition:** Cap crm_gdkd hoặc admin; score hiện tại visible
- **Post-condition:** Override traceable; không xóa score history
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R1
- **Trace ref:** UI-R1-08
- **API / Integration:** POST /api/v1/ai/score/lead/override

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | GDKD mở lead copilot → Điều chỉnh score |
| 2 | Nhập score mới 0–100 + lý do bắt buộc ≥10 ký tự |
| 3 | API tạo ai_scores source=manual_override, overridden_by, override_reason |
| 4 | UI badge override; explainability giữ factors gốc + note |
| 5 | Audit ai_agent_runs action=override |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Admin revert → restore auto score từ rules engine |
| E2 | Reason <10 chars → validation 400 |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | lead_id, new_score, override_reason, overridden_by |
| Output | ai_scores override row, audit run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-006 | Override score: 0–100 + reason ≥10 ký tự + audit trail |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-007 — Dismiss recommendation + reason

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-007
- **Tên use case:** Dismiss recommendation + reason
- **Màn hình:** SCR-CRM-002, SCR-AI-001
- **Actor chính:** CSKH
- **Mục tiêu:** Dismiss draft/brief/summary không hữu ích với preset reason
- **Trigger:** User bấm Bỏ trên recommendation card
- **Pre-condition:** Recommendation exists status=pending
- **Post-condition:** Recommendation archived; metrics adoption dismiss rate
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-29
- **API / Integration:** PATCH /api/v1/ai/recommendations/:id

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User bấm Bỏ trên copilot recommendation card |
| 2 | Modal chọn preset reason: sai tone / sai fact / không cần / khác |
| 3 | PATCH status=dismissed, dismiss_reason |
| 4 | Card ẩn khỏi pending list |
| 5 | Aggregate dismiss analytics trên SCR-AI-001 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Optional skip reason pilot → default other |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | recommendation_id, dismiss_reason preset |
| Output | updated recommendation, analytics event |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-007 | Dismiss draft bắt buộc chọn preset reason |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-008 — Timeline enrich cho AI context

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-008
- **Tên use case:** Timeline enrich cho AI context
- **Màn hình:** SCR-CRM-009, SCR-CRM-002
- **Actor chính:** System
- **Actor phụ:** Platform worker
- **Mục tiêu:** Ghi customer_timeline_events phục vụ AI context builder
- **Trigger:** Activity log, webhook meta, status change
- **Pre-condition:** Phase 0 data gate ≥70% timeline completeness target
- **Post-condition:** Copilot context đầy đủ; score explainability chính xác hơn
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-16
- **API / Integration:** customer_timeline_events DDL · domain event consumers

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | CRM activity create → ghi customer_timeline_events |
| 2 | Webhook lead meta → event lead.ingested + attribution snapshot |
| 3 | Status change → event payload from/to |
| 4 | AI context builder đọc timeline khi summarize/score/brief |
| 5 | Metric: % lead có ≥1 timeline event trong 24h |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Backfill job one-time từ crm_activities legacy |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | entity events: activity, webhook, status |
| Output | timeline_event rows[], completeness metric |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-008 | Timeline event bắt buộc cho activity/webhook/status change |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-009 — AI audit / agent run trace

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-009
- **Tên use case:** AI audit / agent run trace
- **Màn hình:** SCR-ADMIN-001
- **Actor chính:** Admin / Compliance
- **Actor phụ:** Tech lead
- **Mục tiêu:** 100% AI calls auditable qua ai_agent_runs
- **Trigger:** Tra cứu incident, nghiệm thu G5 gate R1
- **Pre-condition:** AiIntelligenceModule logging enabled
- **Post-condition:** Filter/search runs by request_id, entity, user
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-09
- **API / Integration:** GET /admin/ai/runs · table ai_agent_runs

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mỗi AI call → insert ai_agent_runs model, tokens, latency, status, request_id |
| 2 | Admin mở /admin/ai/runs |
| 3 | Filter entity_id, date, user, action type |
| 4 | Drill-down: không hiển thị prompt PII prod (AI_LOG_PROMPTS=0) |
| 5 | Cross-link lead detail run id debug staging only |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Missing run → incident P1 AI pipeline down |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | filter: request_id, entity_id, date_range, action |
| Output | run list[], run detail metadata |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-010 — Pilot gate / feature flag

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-010
- **Tên use case:** Pilot gate / feature flag
- **Màn hình:** SCR-ADMIN-002, SCR-CRM-002
- **Actor chính:** Super Admin / Product
- **Actor phụ:** CSKH pilot cohort
- **Mục tiêu:** Pilot copilot isolated cohort; rollback safe
- **Trigger:** Tuần 11–12 go-live pilot
- **Pre-condition:** Env flags configured; cohort user ids defined
- **Post-condition:** Pilot metrics G2–G6 collected; non-pilot unaffected
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R1
- **Trace ref:** RNOS-39, RNOS-40
- **API / Integration:** PTT_AI_COPILOT_ENABLED env · tenant feature flags

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Set PTT_AI_COPILOT_ENABLED=1 + cohort 5–8 CSKH user ids |
| 2 | Non-pilot: copilot panel hidden; API 403/404 |
| 3 | Monitor DAU, error rate, acceptance rate tuần 12 |
| 4 | Rollback flag off → CRM core unaffected (RNOS-40 runbook) |
| 5 | Gate R1 sign-off §8.3 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Partial rollout → per-tenant flag |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | feature flag config, cohort user_ids[] |
| Output | pilot metrics dashboard, gate evidence |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-010 | Pilot flag off → copilot hidden; CRM core unaffected |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-011 — NBA trên deal stalled

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-011
- **Tên use case:** NBA trên deal stalled
- **Màn hình:** SCR-CRM-013, SCR-CRM-002
- **Actor chính:** AM / Sales
- **Actor phụ:** System (Pipeline Risk Agent), GDKD
- **Mục tiêu:** Next-best-action khi deal stalled ≥7 ngày
- **Trigger:** Daily scan RNOS-23 hoặc stage change detect stall
- **Pre-condition:** Timeline có data; deal score optional (AI-UC-012)
- **Post-condition:** Task CRM created hoặc recommendation dismissed
- **Ưu tiên:** P0
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-10, RNOS-29
- **API / Integration:** POST ai_recommendations type=nba · playbook RAG RNOS-12

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Daily job detect stall → ai_recommendations type=nba |
| 2 | NBA card trên /crm/sales pipeline drawer hoặc copilot |
| 3 | Gợi ý: gọi lại / gửi proposal / escalate GDKD + cite playbook |
| 4 | Sales Chấp nhận → tạo task CRM + activity template |
| 5 | Bỏ → reason → RNOS-29 feedback loop |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Low confidence → banner BR-AI-02; vẫn cho accept |
| E2 | Deal vừa Won → không emit NBA |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | deal_id, stall_days, pipeline context |
| Output | nba recommendation, task_id?, status |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-011 | NBA không emit trên deal Won hoặc vừa close |
| BR-AI-007 | Dismiss draft bắt buộc chọn preset reason |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-012 — Deal score

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-012
- **Tên use case:** Deal score
- **Màn hình:** SCR-CRM-013
- **Actor chính:** Sales / GDKD
- **Mục tiêu:** Score deal 0–100 trên pipeline Kanban
- **Trigger:** Pipeline stage advance / quote created
- **Pre-condition:** Deal in pipeline with activity history
- **Post-condition:** Score visible on Kanban card + deal drawer
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-09
- **API / Integration:** POST /api/v1/ai/score/deal

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Stage change hoặc proposal attach trigger score job |
| 2 | POST /api/v1/ai/score/deal |
| 3 | Score + explain: aging, activity count, quote value, ads touch |
| 4 | Kanban card mini-bar trên /crm/sales |
| 5 | GDKD override pattern AI-UC-006 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | New deal no history → default warm score + flag |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | deal_id, stage, quote_value, activity_count |
| Output | deal score, explainability[], run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-012 | Deal score recompute on stage advance hoặc quote attach |
| BR-AI-006 | Override score: 0–100 + reason ≥10 ký tự + audit trail |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-013 — Forecast commit

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-013
- **Tên use case:** Forecast commit
- **Màn hình:** SCR-CRM-006
- **Actor chính:** GDKD / Finance
- **Mục tiêu:** Commit forecast snapshot immutable cho planning
- **Trigger:** Daily 07:00 ICT job hoặc cuối tháng planning
- **Pre-condition:** Pipeline data synced; Forecast Agent ran
- **Post-condition:** revenue_forecast_snapshots.committed_by set; MAPE trackable
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R3
- **Trace ref:** RNOS-17, RNOS-18
- **API / Integration:** POST /api/v1/ai/forecast · PATCH commit snapshot

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Forecast Agent → POST /api/v1/ai/forecast → snapshot draft |
| 2 | GDKD mở /crm/forecast — pipeline weighted vs AI delta |
| 3 | Review explain factors: stage, seasonality, stall count |
| 4 | Bấm Cam kết → ghi committed_by immutable snapshot |
| 5 | Leadership export PDF / hub widget |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | MAPE >20% prior month → banner cảnh báo trước commit |
| E2 | Re-commit → new snapshot row; prior preserved |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | forecast period, pipeline snapshot, AI model output |
| Output | committed snapshot id, PDF export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-013 | Forecast commit immutable snapshot per period |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-014 — Renewal agent workflow

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-014
- **Tên use case:** Renewal agent workflow
- **Màn hình:** SCR-CRM-009, SCR-AGENCY-001
- **Actor chính:** AM / System (Renewal Agent)
- **Mục tiêu:** Draft renewal outreach T-90/T-60/T-30 contract milestones
- **Trigger:** Lifecycle Retain / contract end date thresholds
- **Pre-condition:** Contract exists CRM-UC-011; health score optional AI-UC-017
- **Post-condition:** Renewal task created; draft reviewed by AM — no auto-send
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R3
- **Trace ref:** RNOS-20
- **API / Integration:** Renewal Agent workflow · retain tab /agency/clients/[id]

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Workflow trigger trên lifecycle Retain contract end date |
| 2 | Renewal card trên agency client retain tab + health score ref |
| 3 | Agent draft renewal email/Zalo → AM review (BR-AI-01) |
| 4 | AM Duyệt → task follow-up; không auto-send |
| 5 | Track renewal outcome Won/Lost → feedback loop |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Client already renewed → cancel workflow |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | contract_id, end_date, health_score, client context |
| Output | renewal draft, task_id, outcome |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-014 | Renewal draft AM review — không auto-send outbound |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-015 — Pipeline risk & smart reminder

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-015
- **Tên use case:** Pipeline risk & smart reminder
- **Màn hình:** SCR-CRM-013, SCR-AI-003
- **Actor chính:** System / GDKD / Sales
- **Mục tiêu:** Detect at-risk deals và suggest smart reminder tasks
- **Trigger:** Daily scan RNOS-23; SLA breach pipeline stage
- **Pre-condition:** Pipeline Risk Agent configured
- **Post-condition:** GDKD notified; optional task created on confirm
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-23
- **API / Integration:** Pipeline Risk Agent daily job · smart reminder API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Pipeline Risk Agent scan → deals at-risk list |
| 2 | Notify GDKD inbox + optional Slack |
| 3 | Smart reminder task auto-suggest — user confirm create |
| 4 | Link alert → deal copilot / NBA (AI-UC-011) |
| 5 | Track reminder completion SLA |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | User dismiss alert → tune sensitivity |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | pipeline snapshot, risk rules, SLA config |
| Output | at_risk_deals[], notifications, task suggestions |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-015 | Pipeline risk alert → user confirm trước khi tạo task |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-016 — NL analytics curated

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-016
- **Tên use case:** NL analytics curated
- **Màn hình:** SCR-AI-002
- **Actor chính:** GDKD / CEO
- **Mục tiêu:** Curated NL query read-only — không free SQL
- **Trigger:** Mở /crm/ai/query hoặc Cmd+K palette
- **Pre-condition:** Cap ai_analytics.query; curated catalog ~50 câu hỏi
- **Post-condition:** Chart/table + narrative VN returned; CRM unchanged
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave R3
- **Trace ref:** RNOS-22
- **API / Integration:** POST /api/v1/ai/query

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | User chọn câu hỏi preset hoặc gõ trong whitelist intent |
| 2 | POST /api/v1/ai/query → chart/table + narrative VN |
| 3 | Read-only — không mutate CRM |
| 4 | Export CSV snapshot |
| 5 | Audit query run in ai_agent_runs |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Out of scope → Câu hỏi ngoài phạm vi — chọn từ danh sách |
| E2 | Insufficient data → empty chart + explanation |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | curated question id or whitelisted intent text |
| Output | chart spec, narrative text, CSV export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-016 | NL query curated whitelist — không free SQL mutate |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-017 — Churn & CS health score

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-017
- **Tên use case:** Churn & CS health score
- **Màn hình:** SCR-CRM-007, SCR-CRM-009
- **Actor chính:** AM / CSKH / CS Lead
- **Mục tiêu:** Health score churn risk per customer/account
- **Trigger:** Ticket spike, NPS drop, usage signal, scheduled recompute
- **Pre-condition:** Customer converted; BR-AI-017 — chỉ customer post-convert
- **Post-condition:** Score visible /crm/health; trigger renewal if below threshold
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R3
- **Trace ref:** RNOS-19
- **API / Integration:** POST /api/v1/ai/score/churn · GET /crm/health

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | POST /api/v1/ai/score/churn per client/account |
| 2 | Display on /crm/health + customer detail tab |
| 3 | Explain: ticket volume, sentiment, payment delay |
| 4 | Threshold breach → link renewal workflow AI-UC-014 |
| 5 | AM action plan task optional |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | New customer <30d → insufficient data badge |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | customer_id, tickets[], payment history, usage signals |
| Output | health_score 0–100, explainability[], alerts[] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-017 | Health score chỉ tính customer đã convert |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-018 — Manager coach weekly digest

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-018
- **Tên use case:** Manager coach weekly digest
- **Màn hình:** SCR-AI-003
- **Actor chính:** GDKD / Head Sales
- **Mục tiêu:** Weekly aggregate coaching insights — no auto personnel action
- **Trigger:** Weekly job Thứ 2 08:00 ICT
- **Pre-condition:** Team activity ≥1 week data
- **Post-condition:** Email + dashboard cards delivered
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave R3
- **Trace ref:** RNOS-21
- **API / Integration:** Manager Coach Agent cron · GET /crm/ai/coach

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Manager Coach Agent aggregate: SLA breach, acceptance rate, top dismiss reasons |
| 2 | Generate digest narrative VN |
| 3 | Email GDKD + render cards /crm/ai/coach |
| 4 | Drill-down → lead/deal examples read-only |
| 5 | No auto personnel action — insights only |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Low activity week → shortened digest |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | team_id, week metrics, adoption stats |
| Output | digest email, dashboard cards, run_id |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-018 | Manager coach digest — insights only, no auto HR action |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |

### AI-UC-019 — Channel CPL/ROAS anomaly digest

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-019
- **Tên use case:** Channel CPL/ROAS anomaly digest
- **Màn hình:** SCR-AI-001, SCR-META-001, SCR-ZALO-001
- **Actor chính:** GDKD / Media Buyer / System
- **Mục tiêu:** Cross-channel anomaly narrative Meta+Zalo+Google
- **Trigger:** CPL spike / zero lead 24h on mapped campaigns
- **Pre-condition:** Channel metrics ≥7d baseline; BR-AI-019 threshold configurable
- **Post-condition:** Digest on insights + hub banners; budget recommend read-only
- **Ưu tiên:** P2
- **Sprint/Wave:** Wave R4
- **Trace ref:** RNOS-28
- **API / Integration:** Channel AI job · anomaly digest API

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Channel AI job compare Meta+Zalo+Google daily_performance |
| 2 | Detect CPL >2σ, zero leads 24h, ROAS drop |
| 3 | Narrative banner SCR-AI-001 anomaly panel |
| 4 | Hub banners /meta/facebook-ads + /zalo/zalo-ads |
| 5 | Link drill → leads affected + copilot context; budget recommend read-only |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Insufficient baseline → skip channel |
| E2 | False positive dismiss → tune per-channel threshold |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | channel metrics[], baselines, thresholds per channel |
| Output | anomaly digest entries[], hub banner flags |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-019 | Anomaly digest threshold configurable per channel |
| BR-META-009 | Anomaly alert khi CPL vượt baseline >2σ |
| BR-ZALO-017 | Alert CPL > target hoặc zero leads 24h |

### AI-UC-020 — Workflow AI node simulate + publish

> 🟢 Spec thủ công

- **Mã use case:** AI-UC-020
- **Tên use case:** Workflow AI node simulate + publish
- **Màn hình:** SCR-AI-004, SCR-AI-005, SCR-ADMIN-003
- **Actor chính:** Admin / AM
- **Mục tiêu:** Drag AI score/summarize nodes vào automation workflow
- **Trigger:** Tạo/sửa workflow /crm/automation
- **Pre-condition:** Workflow designer access; AI tools registered RNOS-33
- **Post-condition:** AI node published; executions audited in ai_agent_runs
- **Ưu tiên:** P1
- **Sprint/Wave:** Wave R2
- **Trace ref:** RNOS-13, RNOS-14, RNOS-15
- **API / Integration:** POST workflow publish · simulate endpoint · playbook RAG PG vectors

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Admin kéo node AI score / AI summarize vào graph (RNOS-14) |
| 2 | Simulate trên sample entity — không mutate prod (RNOS-15) |
| 3 | Review simulate output + latency |
| 4 | Publish workflow → live on trigger event |
| 5 | Audit mọi AI node execution trong ai_agent_runs |
| 6 | Playbook RAG node link SCR-AI-005 vector chunks RNOS-12 |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Simulate fail → block publish |
| E2 | Rollback workflow version → prior graph restored |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | workflow graph JSON, sample entity_id, node config |
| Output | published workflow version, simulate results, run audits |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-020 | Workflow AI node simulate trước publish — no prod mutate |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |

---

## 3. Chi tiết Màn hình module

### SCR-CRM-002 — Chi tiết Lead

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-CRM-002
- **Tên màn hình:** Chi tiết Lead
- **Route:** /crm/leads/[id]
- **Module:** MOD-CRM + MOD-AI
- **Mục đích:** Quản lý vòng đời lead: activity, funnel, contract, AI copilot
- **Vai trò:** Sales, AM, GDKD (override score)
- **Điều kiện trước:** Lead ID hợp lệ + quyền view
- **Điều kiện sau:** Thay đổi được lưu · copilot phản hồi đúng guard
- **Use case liên quan:** CRM-UC-002, AI-UC-001, AI-UC-002, AI-UC-003, AI-UC-004
- **API liên quan:** GET/PATCH /api/v1/leads/:id · POST /api/v1/ai/score/lead/override · PATCH /api/v1/ai/recommendations/:id
- **Parity ID:** UI-R1-08 · RNOS-06
- **Trạng thái triển khai:** Done — upload file ○
- **Ghi chú:** LeadAttributionChips → Meta hub deep link ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | LeadAttributionChips | Chips | Không | Campaign / CPL attribution |
| 2 | LeadFunnelPanel | Panel | Có | Presales workflow steps |
| 3 | LeadContractPanel | Panel | Không | Hợp đồng / proposal link |
| 4 | LeadCopilotPanel | AI Panel | Không | Score · brief · follow-up draft |
| 5 | ScoreOverrideModal | Modal | Không | GDKD 0–100 + reason ≥10 |
| 6 | DismissReasonModal | Modal | Không | Preset dismiss reason RNOS-29 |
| 7 | Activity timeline | Timeline | Có | Ghi chú · status change |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-001 | Một lead active chỉ một owner primary; dedup phone/email |
| BR-CRM-002 | Chuyển status B2 bắt buộc ghi activity timeline |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy |
| BR-AI-004 | CSKH chỉ copilot lead owner=me; GDKD/Admin xem team |
| BR-AI-006 | Override score: 0–100 + reason ≥10 ký tự + audit trail |

### SCR-CRM-006 — Dự báo doanh thu (Forecast)

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-CRM-006
- **Tên màn hình:** Dự báo doanh thu (Forecast)
- **Route:** /crm/forecast
- **Module:** MOD-AI
- **Mục đích:** Commit forecast snapshot theo pipeline
- **Vai trò:** GDKD, Finance
- **Use case liên quan:** AI-UC-013
- **API liên quan:** GET/POST /api/v1/ai/forecast
- **Trạng thái triển khai:** Done — RNOS-17 ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | Forecast chart | Chart | Có | Commit vs target |
| 2 | Commit button | Button | Có | Snapshot forecast period |
| 3 | Scenario selector | Select | Không | Best/base/worst |
| 4 | Deal list | Table | Có | Deals trong forecast |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-013 | Forecast commit immutable snapshot per period |

### SCR-CRM-007 — Sức khỏe khách hàng (Health)

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-CRM-007
- **Tên màn hình:** Sức khỏe khách hàng (Health)
- **Route:** /crm/health
- **Module:** MOD-AI
- **Mục đích:** Churn risk và CS health score
- **Vai trò:** AM, CSKH, GDKD
- **Use case liên quan:** AI-UC-017
- **API liên quan:** GET /api/v1/ai/customer-health
- **Trạng thái triển khai:** Done — RNOS-19 ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | Health score table | Table | Có | Customer · score · trend |
| 2 | Risk badge | Badge | Có | High/medium/low churn |
| 3 | Filter segment | Select | Không | Lọc theo AM/account |
| 4 | Detail link | Link | Có | → /crm/customers/[id] |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-017 | Health score chỉ tính customer đã convert |

### SCR-CRM-013 — Pipeline Sales

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-CRM-013
- **Tên màn hình:** Pipeline Sales
- **Route:** /crm/sales
- **Module:** MOD-CRM — CRM Core
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Mục đích:** Sales ops 6-tab: plans, funnel, partners, training, market, reports
- **Vai trò:** Sales, GDKD
- **Điều kiện trước:** crm_sales_overview OR crm_sales_plans view; funnel tab cần crm_sales_funnel
- **Điều kiện sau:** Tab data reload; pipeline excludes chot/mat
- **Use case liên quan:** CRM-UC-009
- **API liên quan:** GET sales summary/plans/pipeline/partners/trainings/market/reports · POST create*
- **Parity / RNOS:** RNOS-23
- **Trạng thái triển khai:** In progress (deep spec v2.0)
- **Ghi chú:** Pipeline risk + deal score R2

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Navigation | Có | Sidebar |
| 2 | SalesTabSwitcher | Tabs | Có | 6 tabs Plans/Funnel/Partners/Training/Market/Reports |
| 3 | SummaryCounts | KPI | Có | Header counts per tab |
| 4 | SalesPipelineFunnelPanel | Panel | Có | ?deal_id= opens funnel; sort-by-score |
| 5 | PlanListCreate | List+Form | Không | Plans list + create form |
| 6 | PartnerTrainingMarket | List+Form | Không | CRUD lists per tab |
| 7 | ReportsJsonPanel | Panel | Không | Reports JSON + transactions |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-CRM-009 | Pipeline lost reason taxonomy bắt buộc khi stage Lost |

### SCR-AI-001 — AI Insights / Copilot analytics

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-AI-001
- **Tên màn hình:** AI Insights / Copilot analytics
- **Route:** /crm/ai/insights
- **Module:** MOD-AI
- **Mục đích:** Analytics adoption copilot + dismiss reasons + anomaly digest
- **Vai trò:** GDKD, Admin
- **Use case liên quan:** AI-UC-005, AI-UC-007, AI-UC-019
- **Trạng thái triển khai:** Done — RNOS-29 ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | DAU tile | KPI | Có | Copilot daily active users |
| 2 | Acceptance rate | Chart | Có | Draft accepted vs dismissed |
| 3 | Top dismiss reasons | Table | Có | Preset reason breakdown |
| 4 | Anomaly digest | Panel | Không | Channel CPL/ROAS alerts |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-007 | Dismiss draft bắt buộc chọn preset reason |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |
| BR-AI-019 | Anomaly digest threshold configurable per channel |

### SCR-AI-002 — NL Analytics Query

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-AI-002
- **Tên màn hình:** NL Analytics Query
- **Route:** /crm/ai/query
- **Module:** MOD-AI — AI Revenue OS
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Curated NL query ✅
- **Vai trò:** GDKD, Admin
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-016
- **API liên quan:** GET/POST /api/v1/ai/*
- **Parity / RNOS:** RNOS-22
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Curated NL query ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | NL Analytics Query |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/ai/query |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-016 | NL query curated whitelist — không free SQL mutate |

### SCR-AI-003 — Manager Coach Digest

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-AI-003
- **Tên màn hình:** Manager Coach Digest
- **Route:** /crm/ai/coach
- **Module:** MOD-AI — AI Revenue OS
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Weekly coach digest ✅
- **Vai trò:** GDKD
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-018
- **API liên quan:** GET/POST /api/v1/ai/*
- **Parity / RNOS:** RNOS-21
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Weekly coach digest ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Manager Coach Digest |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/ai/coach |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-018 | Manager coach digest — insights only, no auto HR action |

### SCR-AI-004 — Automation Workflows

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-AI-004
- **Tên màn hình:** Automation Workflows
- **Route:** /crm/automation
- **Module:** MOD-AI — AI Revenue OS
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Workflow AI node ✅
- **Vai trò:** Admin, AM
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-020
- **API liên quan:** GET/POST /api/v1/ai/*
- **Parity / RNOS:** RNOS-13
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Workflow AI node ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Automation Workflows |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/automation |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-020 | Workflow AI node simulate trước publish — no prod mutate |

### SCR-AI-005 — Playbook RAG

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-AI-005
- **Tên màn hình:** Playbook RAG
- **Route:** /crm/playbooks
- **Module:** MOD-AI — AI Revenue OS
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** PG vector chunks ✅
- **Vai trò:** Sales, AM
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-020
- **API liên quan:** GET/POST /api/v1/ai/*
- **Parity / RNOS:** RNOS-12
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** PG vector chunks ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Playbook RAG |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /crm/playbooks |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-020 | Workflow AI node simulate trước publish — no prod mutate |

### SCR-ADMIN-001 — Admin AI Runs

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-ADMIN-001
- **Tên màn hình:** Admin AI Runs
- **Route:** /admin/ai/runs
- **Module:** MOD-ADMIN — Admin Console
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Agent run trace ✅
- **Vai trò:** Super Admin
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-009
- **API liên quan:** GET/POST /api/v1/* — module Admin
- **Parity / RNOS:** RNOS-09
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Agent run trace ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Admin AI Runs |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /admin/ai/runs |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id |
| BR-SYS-010 | Cross-module audit query immutable export compliance role |

### SCR-ADMIN-002 — Admin AI Agents

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-ADMIN-002
- **Tên màn hình:** Admin AI Agents
- **Route:** /admin/ai/agents
- **Module:** MOD-ADMIN — Admin Console
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Orchestrator config ✅
- **Vai trò:** Super Admin
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-010
- **API liên quan:** GET/POST /api/v1/* — module Admin
- **Parity / RNOS:** RNOS-31
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Orchestrator config ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Admin AI Agents |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /admin/ai/agents |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-AI-010 | Pilot flag off → copilot hidden; CRM core unaffected |
| BR-SYS-009 | Staged prod cutover module flag soak ≥3 ngày gate PASS |

### SCR-ADMIN-003 — Admin AI Tools

> 🟢 Spec thủ công

- **Mã màn hình:** SCR-ADMIN-003
- **Tên màn hình:** Admin AI Tools
- **Route:** /admin/ai/tools
- **Module:** MOD-ADMIN — Admin Console
- **Ứng dụng:** ops-web (rs.pttads.vn)
- **Loại màn hình:** list
- **Mục đích:** Tool registry ✅
- **Vai trò:** Super Admin
- **Điều kiện trước:** Đăng nhập ops-web (rs.pttads.vn) + RBAC cap module
- **Điều kiện sau:** API persist + audit event
- **Use case liên quan:** AI-UC-020
- **API liên quan:** GET/POST /api/v1/* — module Admin
- **Parity / RNOS:** RNOS-33
- **Trạng thái triển khai:** Done (v1.0)
- **Owner:** AI
- **Ghi chú:** Tool registry ✅

#### Thành phần UI

| STT | Thành phần | Loại | Bắt buộc | Mô tả |
| --- | --- | --- | --- | --- |
| 1 | OpsNav | Layout | Có | Module sidebar |
| 2 | PageHeader | Header | Có | Admin AI Tools |
| 3 | FilterBar | Toolbar | Không | Search · filter · client scope |
| 4 | DataTable | Table | Có | Danh sách /admin/ai/tools |
| 5 | Pagination | Control | Không | Page size + next/prev |
| 6 | PrimaryAction | Button | Không | Create · Import · Export |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| — | — |

---

## 4. Business Rules module

| BR | Mô tả | Priority | Status |
| --- | --- | --- | --- |
| BR-AI-001 | Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy | High | Done |
| BR-AI-002 | Lead brief tối đa 5 bullet tiếng Việt; không ghi đè CRM fields | High | Done |
| BR-AI-003 | confidence < 0.6 → banner cảnh báo; không ẩn score | High | Done |
| BR-AI-004 | CSKH chỉ copilot lead owner=me; GDKD/Admin xem team | High | Done |
| BR-AI-005 | Explainability hiển thị ≥3 factors khi đủ data attribution | Medium | Done |
| BR-AI-006 | Override score: 0–100 + reason ≥10 ký tự + audit trail | High | Done |
| BR-AI-007 | Dismiss draft bắt buộc chọn preset reason | Medium | Done |
| BR-AI-008 | Timeline event bắt buộc cho activity/webhook/status change | High | Done |
| BR-AI-009 | 100% LLM/score calls ghi ai_agent_runs + request_id | High | Done |
| BR-AI-010 | Pilot flag off → copilot hidden; CRM core unaffected | High | Done |
| BR-AI-011 | NBA không emit trên deal Won hoặc vừa close | Medium | Done |
| BR-AI-012 | Deal score recompute on stage advance hoặc quote attach | Medium | Done |
| BR-AI-013 | Forecast commit immutable snapshot per period | Medium | Done |
| BR-AI-014 | Renewal draft AM review — không auto-send outbound | Medium | Done |
| BR-AI-015 | Pipeline risk alert → user confirm trước khi tạo task | Medium | Done |
| BR-AI-016 | NL query curated whitelist — không free SQL mutate | High | Done |
| BR-AI-017 | Health score chỉ tính customer đã convert | Medium | Done |
| BR-AI-018 | Manager coach digest — insights only, no auto HR action | Medium | Done |
| BR-AI-019 | Anomaly digest threshold configurable per channel | Medium | Done |
| BR-AI-020 | Workflow AI node simulate trước publish — no prod mutate | High | Done |
