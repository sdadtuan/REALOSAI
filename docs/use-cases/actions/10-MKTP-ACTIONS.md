# Chi tiết hành động — AI Marketing Planner (MKTP)

> **UC gốc:** [`../10-MKT-AI-PLANNER.md`](../10-MKT-AI-PLANNER.md)  
> **Spec:** [`specs/2026-08-08-mkt-ai-planner-integration-spec.md`](../../specs/2026-08-08-mkt-ai-planner-integration-spec.md) · **Prototype:** [`design/figma-prototypes/mkt-ai-planner-scr-001-prototype.html`](../../design/figma-prototypes/mkt-ai-planner-scr-001-prototype.html)  
> **SVC parent:** [`02-SVC-ACTIONS.md`](02-SVC-ACTIONS.md) · **AI audit:** [`09-AI-ACTIONS.md`](09-AI-ACTIONS.md)  
> **Phiên bản:** 1.1 · **Coverage:** MKTP-UC-001…010 (P0 UAT) + P3 walkthrough + **P4 frozen UC-022…031** (actions backlog)

---

## Walkthrough UAT — Happy path onboard → TMMT gate (45 ph)

**Mục tiêu khách hàng:** *"Solution hoàn TMMT chính thức bằng AI Planner trong một buổi — gate pass → AM chuyển Deliver."*

**Actors:** Solution Strategist (SP), AM (observer), QA

**Dữ liệu test:** Lifecycle `#123` stage `onboard` · service `meta-lead-gen` · client ABC Logistics

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | `/login` | Đăng nhập cap `crm_mkt_ai.generate` | credentials | JWT | ✓ flag on |
| 2 | SP | `/crm/service-delivery` | Mở card lifecycle test | — | Detail load | ✓ stage onboard |
| 3 | SP | `/crm/service-delivery/123?tab=ai-planner` | Tab **AI Planner** | — | Gate banner đỏ 4/12 | ✓ MKTP-UC-001 |
| 4 | SP | Step 1 Brief | Review prefill consult | brand, budget 80M | Fields filled | ✓ |
| 5 | SP | Same | Sửa **Thách thức** nếu cần | textarea | Autosave toast | ✓ MKTP-UC-002 |
| 6 | SP | Same | **Tiếp tục →** | — | Step 2 Strategy | ✓ brief ok |
| 7 | SP | Step 2 | **Sinh chiến lược AI** | — | Job running → ✓ 42s | ✓ MKTP-UC-003 |
| 8 | SP | Same | Verify 4 core prof sections có text | — | ICP, persona, pain | ✓ EC-MKT-AI-02 |
| 9 | SP | Same | Sửa 1 dòng **Thị trường mục tiêu** | textarea | Draft saved | ✓ MKTP-UC-006 |
| 10 | SP | Same | **Tiếp tục →** | — | Step 3 Campaign | ✓ |
| 11 | SP | Step 3 | **Sinh chiến dịch AI** | — | ≥2 campaign cards | ✓ MKTP-UC-004 |
| 12 | SP | Same | **Tiếp tục →** | — | Step 4 Content | ✓ |
| 13 | SP | Step 4 | Review lịch 30 ngày | — | Calendar chips | ✓ MKTP-UC-005 |
| 14 | SP | Same | **Tiếp tục →** | — | Step 5 Apply | ✓ |
| 15 | SP | Step 5 | Verify Quality ≥70 | — | Score 78/100 | ✓ MKTP-UC-007 |
| 16 | SP | Same | **Apply vào TMMT** → tick review → **Xác nhận** | checkbox | Toast apply OK | ✓ MKTP-UC-008 |
| 17 | SP | Same | Gate banner → xanh | — | Gate TMMT ✓ | ✓ EC-MKT-AI-03 |
| 18 | SP | Tab TMMT | Verify fields đồng bộ | — | Same text as draft | ✓ |
| 19 | SP | Step 5 | **PDF Kế hoạch** | — | Download .pdf | ✓ MKTP-UC-010 |
| 20 | AM | Tab Workflow | **Chuyển → Triển khai** | — | Stage deliver | ✓ SVC-UC-003 |
| 21 | QA | DB | `mkt_ai_jobs` ≥4 succeeded | lifecycle_id | audit rows | ✓ BR-MKTP-03 |

#### Nhánh E1 — Job failed step 3
Bước 11 fail → **Thử lại** → success; strategy draft bước 8 vẫn còn (EC-MKT-AI-05).

#### Tiêu chí nghiệm thu walkthrough
- [ ] 21 bước pass staging
- [ ] Gate TMMT pass sau bước 16
- [ ] Export filename có client slug
- [ ] SP + PO sign EC-MKT-AI checklist

---

## MKTP-UC-001 — Mở AI Planner context

**Mục tiêu:** *"Mở lifecycle — thấy ngay trạng thái TMMT và tiến trình AI."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | `/crm/service-delivery/[id]` | Click tab **AI Planner** | — | Panel load | ✓ cap view |
| 2 | System | `GET .../ai-planner/context` | Assemble context | lifecycle_id | JSON payload | ✓ |
| 3 | SP | Banner | Read gate status | — | pass/fail VI | ✓ |
| 4 | SP | Stepper | Step 1 active | — | Brief form | ✓ |
| 5 | SP | Job panel | View job history | — | Rows or empty | ○ |
| 6 | SP | Link | **Mở tab TMMT →** (optional) | — | Tab switch | ○ |

#### Tiêu chí nghiệm thu
- [ ] Flag off → tab hidden
- [ ] Context ≤2s p95 staging

---

## MKTP-UC-002 — Lưu Brief intake

**Mục tiêu:** *"Brief đầy đủ trước khi gọi AI — lỗi field rõ ràng tiếng Việt."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 1 | Review prefill từ consult | — | Info callout | ✓ |
| 2 | SP | Same | Điền **Ngân sách tháng** | 80000000 | Valid number | ✓ |
| 3 | SP | Same | Chọn **Mục tiêu** radio Lead | — | Selected | ✓ |
| 4 | SP | Same | Blur field → autosave | — | PATCH brief | ✓ |
| 5 | System | DB | Upsert `mkt_ai_briefs` | brief_json | row | ✓ |
| 6 | SP | Same | Xóa field bắt buộc → **Tiếp tục** | — | Inline error scroll | ✓ EC-MKT-AI-01 |
| 7 | SP | Same | Điền lại → **Tiếp tục** | — | Step 2 | ✓ validation ok |

#### Tiêu chí nghiệm thu
- [ ] Missing field message VI actionable
- [ ] 1 brief row per lifecycle UNIQUE

---

## MKTP-UC-003 — Sinh chiến lược AI

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 2 | **Sinh chiến lược AI** | — | Button disabled during run | ✓ |
| 2 | System | `POST .../jobs/strategy` | Queue job | brief_id | job_id | ✓ |
| 3 | SP | Job panel | Watch Strategy row | — | running → ✓ | ✓ |
| 4 | System | Orchestrator | LLM + map TMMT keys | — | output_json | ✓ |
| 5 | System | DB | Update `mkt_ai_drafts` | sf + prof | draft row | ✓ |
| 6 | SP | Accordion | Expand **Phân khúc ICP** | — | AI text editable | ✓ |
| 7 | SP | Same | **Sinh lại ↻** with edits | confirm | New job | ○ |

#### Tiêu chí nghiệm thu
- [ ] 4 core prof keys non-empty after success
- [ ] `mkt_ai_jobs.job_type=strategy_generate`

---

## MKTP-UC-004 — Sinh chiến dịch AI

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 3 | **Sinh chiến dịch AI** | — | Job queued | ✓ |
| 2 | System | `POST .../jobs/campaigns` | — | strategy draft | campaigns[] | ✓ |
| 3 | SP | Cards | Review Meta Lead Gen + Google | — | budget % visible | ✓ |
| 4 | SP | Same | **+ Thêm thủ công** | name, channels | New card | ○ |
| 5 | SP | Same | **Chỉnh sửa** campaign | fields | PATCH campaign | ○ |

---

## MKTP-UC-005 — Sinh lịch nội dung

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 4 | Auto-load after job or **Sinh lịch** | — | Calendar grid | ✓ |
| 2 | SP | Sub-tab | **Ad copy** | — | Variant table | ○ |
| 3 | SP | Calendar | Click day 12 | — | Drawer copy edit | ✓ |
| 4 | SP | Drawer | Sửa CTA | text | debounce save | ✓ |

---

## MKTP-UC-007 — Quality score

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 5 | Enter step — auto quality job | — | Score card | ✓ |
| 2 | SP | Same | Read 6 criteria checklist | — | 5/6 checked | ✓ |
| 3 | SP | Same | Score 78 → Apply enabled | — | Green label | ✓ |
| 4 | SP | Same | (Test) score <60 scenario | — | Apply disabled | ✓ BR-MKTP-05 |

---

## MKTP-UC-008 — Apply TMMT

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 5 | **Apply vào TMMT chính thức** | — | Modal diff | ✓ |
| 2 | SP | Modal | Tick review checkbox | — | Confirm enabled | ✓ |
| 3 | SP | Modal | **Xác nhận Apply** | — | POST apply | ✓ |
| 4 | System | API | PATCH official marketing-plan | merge keys | 200 | ✓ |
| 5 | SP | Banner | Gate refresh | — | Green if pass | ✓ EC-MKT-AI-03 |
| 6 | AM | Tab TMMT | Spot-check 4 core fields | — | Match draft | ✓ |

---

## MKTP-UC-009 — Retry job (failed)

**Mục tiêu:** *"Campaign job fail — không mất chiến lược đã sinh."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 3 | **Sinh chiến dịch AI** (simulate fail) | — | Job failed 504 | ✓ test |
| 2 | SP | Job panel | Read error message | — | Red Campaign row | ✓ |
| 3 | SP | Step 2 | Navigate back | — | Strategy text intact | ✓ EC-MKT-AI-05 |
| 4 | SP | Job panel | **Thử lại** | — | New job running | ✓ |
| 5 | SP | Step 3 | Success | — | Campaign cards | ✓ |

---

## MKTP-UC-010 — Export

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 5 | **PDF Kế hoạch** | — | File download | ✓ |
| 2 | SP | Same | **DOCX** | — | File download | ✓ |
| 3 | SP | Same | **Excel KPI tree** | — | .xlsx | ✓ |
| 4 | System | DB | Insert `mkt_ai_exports` | format | audit row | ✓ EC-MKT-AI-04 |
| 5 | AM | (test) | Export without cap | — | 403/disabled | ✓ cap |

---

## Phase 2 actions (summary)

| UC | Key steps |
|----|-----------|
| MKTP-UC-011 | Upload PDF → indexing → RAG toggle → citation chip on regenerate |
| MKTP-UC-012 | Run budget sim → select scenario → apply to campaigns |
| MKTP-UC-013 | Submit approval → MKT Lead **Duyệt** → export unlock |
| MKTP-UC-014 | Open version drawer → diff → rollback draft |
| MKTP-UC-015 | Lead R5 **AI draft** → promote → lifecycle prefill |

*Chi tiết bước Phase 2 bổ sung khi ship MKT-AI-10…14.*

---

## MKTP-UC-020 — Industry playbook template (Phase 3)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | AI Planner → Brief | Mở tab Brief | — | Dropdown **Industry template** hiện playbook theo `service_slug` | ✓ `PTT_MKT_AI_PLAYBOOKS_ENABLED=1` |
| 2 | SP | Same | **Áp dụng template** Meta Lead-gen | — | Brief prefill (objective, geo, pain); `_playbook_slug` lưu | ✓ |
| 3 | SP | Same | (Tuỳ chọn) **Ghi đè toàn bộ** | confirm | Brief fields overwrite từ JSON playbook | ○ |
| 4 | SP | Strategy/Campaign | **Sinh chiến lược / campaign** | — | Prompt có block playbook hints + KPI templates | ✓ |
| 5 | SP | Apply / Quality | Chạy job Quality | — | Score ≥70 (playbook gate) | ✓ |
| 6 | SP | Tab Launch QA | **Khởi tạo Launch QA** | — | 200 nếu score ≥70; 409 `mkt_ai_quality_launch_qa_gate` nếu thấp | ✓ `PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE=1` |
| 7 | SP | Launch QA | Đọc banner gate | — | Link `?tab=ai-planner&step=apply` | ✓ governance banner |
| 8 | AM | Brief | Governance notes | — | 3 bullet BR-MKTP-01 / quality gate | ✓ `PTT_MKT_AI_GOVERNANCE_BANNER=1` |

---

## MKTP-UC-019 — Multi-agent pipeline (Phase 3)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | AI Planner → Pipeline AI | Mở step **Pipeline AI** | — | 4 agent chips + playbook dropdown | ✓ `PTT_MKT_AI_MULTI_AGENT_ENABLED=1` |
| 2 | SP | Same | Brief hợp lệ + chọn playbook | — | Nút **Chạy pipeline AI** enabled | ✓ |
| 3 | SP | Same | **Chạy pipeline AI** | — | Parent job `multi_agent` + 4 child jobs | ✓ BR-MKTP-03 |
| 4 | System | API | Tuần tự strategy → campaign → content → quality | — | Draft đầy đủ; job panel cập nhật | ✓ |
| 5 | SP | Job panel | Xem parent **Pipeline AI · parent** | — | Child jobs riêng từng loại | ✓ |
| 6 | SP | Same | (Test fail step 3) **Chạy từ bước hiện tại** | start_from_step | Partial — giữ draft bước 1–2 | ✓ EC-MKT-AI-05 |
| 7 | SP | Same | Link **Xem trace admin →** | — | `/admin/ai/agents?plan=mkt_ai` | ✓ |
| 8 | SP | Context | `GET multi-agent/status` | — | Step states succeeded/failed/pending | ✓ |

---

## MKTP-UC-021 — Governance banner (Phase 3 · WS-P3-03)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | AI Planner (mọi step) | Mở tab AI Planner | — | Banner **Governance** sticky trên cùng | ✓ `PTT_MKT_AI_GOVERNANCE_BANNER=1` |
| 2 | SP | Same | Đọc checkbox gate | — | ☑ Campaign Quality Score gate trước Launch QA | ✓ `PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE=1` |
| 3 | SP | Same | Đọc governance notes | — | 3 bullet BR-MKTP-01 / quality / campaign count | ✓ playbook JSON |
| 4 | SP | Tab Launch QA | Mở Launch QA | — | Cùng banner Governance + link Apply | ✓ |
| 5 | SP | Launch QA | Score &lt;70 → **Khởi tạo Launch QA** | — | Nút disabled + banner vàng | ✓ |
| 6 | SP | Apply step | Chạy job Quality ≥70 | — | Banner chuyển xanh ✓ đạt | ✓ |
| 7 | AM | Context API | `GET .../context` | — | `flags.playbook_governance_enabled` + `governance{}` | ✓ |
| 8 | System | Smoke | `smoke_mkt_ai_planner_context.sh` | LIFECYCLE_ID=1 | OK governance block | ✓ |

---

## MKTP-UC-024 — GA multi-slug rollout (Phase 4 · WS-P4-01)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | DevOps | VPS / `.env` | Set `PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen,bds-lead-gen,seo-retainer` | — | API không 403 slug | ✓ |
| 2 | DevOps | Seed | `./scripts/seed_mkt_ai_uat_lifecycle.sh` | — | 3 lifecycle + brief + official plan | ✓ |
| 3 | QA | Shell | `./scripts/smoke_mkt_ai_multi_slug.sh` | — | Context 200 ×3 + governance block | ✓ |
| 4 | SP | Service delivery | Mở lifecycle BĐS (`bds-lead-gen`) | tag `mkt-ai-seed-bds` | Tab AI Planner + playbook BĐS | ✓ |
| 5 | SP | Same | Mở lifecycle SEO (`seo-retainer`) | tag `mkt-ai-seed-seo` | Playbook SEO prefill | ✓ |
| 6 | PO | Runbook | Ký `mkt-ai-phase3-signoff.md` | — | UC-019…021 signed | ✓ |
| 7 | DevOps | Prod pilot | `deploy/env.mkt-ai-prod-pilot.example` + `deploy_mkt_ai_planner_prod_pilot.sh` | gate + 7d monitor | Rollback ≤5 phút | ✓ WS-P4-01-T7 |
| 8 | DevOps | Rollback test | `PTT_MKT_AI_PLANNER_ENABLED=0` | — | Tab ẩn + API 404 disabled | ✓ |

---

## Phase 4 actions — frozen backlog (UC-022…031)

> **Trạng thái:** PO freeze 2026-08-08 · Plan [`2026-08-08-mkt-ai-planner-phase4.md`](../../superpowers/plans/2026-08-08-mkt-ai-planner-phase4.md) · BA matrix `RNOSAI-BA-MKTP-UseCases.md` §1.2  
> **Chưa ship:** checklist `[ ]` — cập nhật khi WS đóng.

| UC | Tên | WS | Priority |
|----|-----|-----|----------|
| MKTP-UC-022 | Async multi-agent pipeline | P4-03 | P1 |
| MKTP-UC-023 | Portal plan summary read-only | P4-05 | P2 |
| MKTP-UC-025 | Ops monitoring & job SLO | P4-06 | P1 |
| MKTP-UC-026 | Plan depth — strategy & brief | P4-02 | P0 |
| MKTP-UC-027 | Plan depth — scenario & collab | P4-04 | P1 |
| MKTP-UC-028 | Plan depth — KPI closed-loop | P4-09 | P2 |
| MKTP-UC-029 | Section comments & PPTX export | P4-04 | P2 |
| MKTP-UC-030 | Content variants & creative brief | P4-02 | P2 |
| MKTP-UC-031 | Brief readiness score | P4-02 | P2 |

---

## MKTP-UC-022 — Async multi-agent pipeline (Phase 4 · WS-P4-03)

**Mục tiêu:** *"Chạy pipeline 4 agent không timeout HTTP — poll job đến khi xong."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Pipeline AI | Brief hợp lệ + chọn playbook | — | Nút **Chạy pipeline AI** enabled | ✓ `PTT_MKT_AI_MULTI_AGENT_ASYNC=1` |
| 2 | SP | Same | **Chạy pipeline AI** (async default) | `{ async: true }` | HTTP **202** + `job_id`, status `pending` | ✓ MKTP-UC-022 |
| 3 | System | Worker | Pick parent `pending` → `running` | parent_job_id | Child steps tuần tự | ✓ BR-MKTP-03 |
| 4 | SP | Job panel | Poll context / `GET multi-agent/status` mỗi 2s | — | Parent row + child jobs cập nhật | ✓ |
| 5 | SP | Same | Pipeline hoàn tất ≤10 phút stub | — | status `succeeded` hoặc `partial` | ✓ no 504 |
| 6 | SP | Same | Double-click **Chạy** khi đang chạy | — | 409 conflict | ✓ |
| 7 | SP | Same | (Test fail step 3) **Chạy từ bước hiện tại** | start_from_step | Partial — giữ draft 1–2 | ✓ EC-MKT-AI-05 |
| 8 | QA | Shell | `./scripts/smoke_mkt_ai_multi_agent_async.sh` | LIFECYCLE_ID=1 | Exit 0 | ✓ |

#### Tiêu chí nghiệm thu
- [x] POST async không block HTTP >2s p95
- [x] Sync fallback khi `async=false` hoặc flag off
- [x] Parent + ≥4 child rows audit `mkt_ai_jobs`

---

## MKTP-UC-023 — Portal plan summary read-only (Phase 4 · WS-P4-05)

**Mục tiêu:** *"Client xem tóm tắt kế hoạch AI — không chỉnh, không Apply."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | Client | Portal lifecycle | Mở card dịch vụ | portal JWT | Detail load | ✓ `PTT_MKT_AI_PORTAL_SUMMARY=1` |
| 2 | Client | Summary card | Đọc excerpt chiến lược + campaign count | — | Redacted text ≤500 chars | ✓ MKTP-UC-023 |
| 3 | Client | Same | Click **Mở planner (staff)** | — | Deep link ops-web (staff only) | ✓ |
| 4 | System | API | `GET /portal/.../ai-planner/summary` | lifecycle_id | `MktAiPortalSummary` JSON | ✓ scope guard |
| 5 | QA | (test) | Client JWT lifecycle khác | — | 403 | ✓ |
| 6 | QA | (test) | Full draft JSON qua portal | — | Không expose | ✓ PII redaction |

#### Tiêu chí nghiệm thu
- [ ] Portal read-only — không POST generate/apply
- [ ] Summary fields PO-approved (brand, score, excerpt, count)

---

## MKTP-UC-025 — Ops monitoring & job SLO (Phase 4 · WS-P4-06)

**Mục tiêu:** *"DevOps thấy job fail rate và chạy full regression trước GA."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | DevOps | Shell | `./scripts/report_mkt_ai_ops_weekly.sh` | — | Markdown `docs/exports/mkt-ai-ops-*.md` | ✓ |
| 2 | DevOps | Report | Review `mkt_ai_job_failed` by type | — | Alert nếu >5%/h | ✓ MKTP-UC-025 |
| 3 | QA | Shell | `./scripts/run_mkt_ai_planner_full_regression.sh` | staging | P0…P3 + P4 blocks exit 0 | ✓ |
| 4 | QA | UAT extend | P1 RAG, budget, P2 dashboard, P3 multi-agent | API | Timing asserts | ✓ |
| 5 | DevOps | Cron | Weekly report prod | `PTT_MKT_AI_OPS_WEEKLY_REPORT=1` | Email/Slack optional | ○ |
| 6 | PO | Runbook | Ký GA rollout checklist | — | Monitoring live | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Full regression script exit 0 staging
- [ ] Weekly report có fail rate + apply/gate ratio

---

## MKTP-UC-026 — Plan depth — strategy & brief (Phase 4 · WS-P4-02)

**Mục tiêu:** *"Leader soạn TMMT chuyên sâu — regen từng section, KPI tree, risks trước Apply."*  
**Bao gồm partial:** MKTP-UC-030 (variants), MKTP-UC-031 (readiness).

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 1 Brief | **Upload brief** PDF/DOCX | file | Extract fields + missing checklist | ✓ `PTT_MKT_AI_BRIEF_UPLOAD_ENABLED=1` |
| 2 | SP | Same | Đọc **Readiness score** 0–100 | — | Banner vàng nếu &lt;70 | ✓ MKTP-UC-031 |
| 3 | SP | Step 2 Strategy | **Sinh chiến lược AI** (full job) | — | Draft + `reasoning_vi[]` collapsible | ✓ |
| 4 | SP | Same | **Sinh lại ↻** section **SWOT** only | section=swot | PATCH section; phần khác giữ | ✓ MKTP-UC-026 |
| 5 | SP | Same | Regen **ICP**, **Channel**, **Messaging**, **KPI tree** | per section | Job + UI cập nhật | ✓ |
| 6 | SP | Same | Review **KPI tree** north_star → campaign KPIs | — | `kpi_tree_json` editor | ✓ PRD §9.4 |
| 7 | SP | Step 3 Campaign | Thêm **milestones** + **timeline_weeks** | dates, labels | Campaign card extended | ✓ |
| 8 | SP | Step 4 Content | Review **≥3 variants** headline/CTA | — | `variants[]` per campaign | ✓ MKTP-UC-030 |
| 9 | SP | Step 5 | Điền **Risks & assumptions** bắt buộc | textarea | `risks_assumptions_json` | ✓ depth gate |
| 10 | SP | Same | Quality + **Apply** khi depth gate pass | — | 409 nếu thiếu risks/KPI tree | ✓ `PTT_MKT_AI_PLAN_DEPTH_ENABLED=1` |
| 11 | QA | Shell | `./scripts/smoke_mkt_ai_plan_depth.sh` | LIFECYCLE_ID=1 | Exit 0 | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Regenerate section không mất các section khác
- [ ] Apply blocked khi depth enabled + thiếu risks/KPI tree (PO config)
- [ ] Brief upload merge vào `mkt_ai_briefs` UNIQUE lifecycle

---

## MKTP-UC-027 — Plan depth — scenario & collab (Phase 4 · WS-P4-04)

**Mục tiêu:** *"So sánh 2–3 phương án chiến lược và budget trước khi chốt draft."*  
**Partial overlap:** MKTP-UC-029 (comments + PPTX).

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | Step 2 Strategy | **Sinh 2–3 scenarios** | count=3 | `strategy_scenarios[]` | ✓ `PTT_MKT_AI_SCENARIO_COMPARE=1` |
| 2 | SP | Compare UI | Chọn scenario A vs B | — | Diff SWOT/channel/messaging | ✓ MKTP-UC-027 |
| 3 | SP | Budget sim | Chạy **2–5 budget scenarios** side-by-side | amounts | Columns + `rationale_vi` | ✓ |
| 4 | SP | Strategy section | **Comment** trên block ICP | @mention staff | Thread lưu DB | ✓ MKTP-UC-029 |
| 5 | SP | Step 5 Export | **PPTX Kế hoạch** — chọn sections | strategy,campaign | Download .pptx | ✓ MKTP-UC-029 |
| 6 | SP | Brand KB | Upload DOCX/PPTX + **tag** | tag=brand-voice | RAG filter by tag | ✓ PRD §9.3 |
| 7 | QA | Shell | `./scripts/smoke_mkt_ai_plan_depth_wave2.sh` | — | Exit 0 | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Scenario compare không overwrite draft đang chọn
- [ ] PPTX export audit row `mkt_ai_exports`

---

## MKTP-UC-028 — Plan depth — KPI closed-loop (Phase 4 · WS-P4-09)

**Mục tiêu:** *"Sau triển khai — so sánh KPI plan vs thực tế và memo tối ưu hàng tuần."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | KPI dashboard | Mở sub=dashboard | — | Cột **Target (plan)** vs **Actual** | ✓ `PTT_MKT_AI_KPI_CLOSED_LOOP=1` |
| 2 | System | Ingest | Join `kpi_tree_json` targets + Meta/dashboard | — | Delta % per KPI | ✓ MKTP-UC-028 |
| 3 | SP | Same | Alert KPI lệch >ngưỡng | — | Banner + link optimize | ✓ extends UC-018 |
| 4 | System | Cron | **Weekly optimization memo** Monday 09:00 | cron | Staff notification + memo body | ✓ |
| 5 | SP | Step 2 Strategy | **Competitor snapshot** block | brief competitors | `competitor_snapshot_json` | ✓ PRD §10 |
| 6 | SP | Same | **Regenerate** competitor section | — | Updated snapshot | ✓ |
| 7 | QA | Shell | `./scripts/smoke_mkt_ai_plan_depth_wave3.sh` | — | Exit 0 | ✓ |

#### Tiêu chí nghiệm thu
- [ ] Planned targets chỉ từ KPI tree đã Apply
- [ ] Weekly memo không auto-Apply TMMT (BR-MKTP-01)

---

## MKTP-UC-029 — Section comments & PPTX export (Phase 4 · partial · WS-P4-04)

> **Parent UC:** MKTP-UC-027 · Walkthrough chi tiết: §027 bước 4–5.

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Comment staff-only trên strategy/campaign section | ✓ `PTT_MKT_AI_SECTION_COMMENTS=1` |
| 2 | SP | Export PPTX chọn sections | ✓ `PTT_MKT_AI_EXPORT_PPTX=1` |
| 3 | QA | Comment không hiện portal client | ✓ |

---

## MKTP-UC-030 — Content variants & creative brief (Phase 4 · partial · WS-P4-02)

> **Parent UC:** MKTP-UC-026 · Walkthrough chi tiết: §026 bước 8.

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Content step hiển thị ≥3 headline/CTA variants | ✓ |
| 2 | SP | **Regenerate variants** per campaign | ✓ |
| 3 | QA | Variants xuất hiện trong export PDF section content | ✓ |

---

## MKTP-UC-031 — Brief readiness score (Phase 4 · partial · WS-P4-02)

> **Parent UC:** MKTP-UC-026 · Walkthrough chi tiết: §026 bước 1–2.

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Upload brief → score 0–100 hiển thị | ✓ |
| 2 | System | Score &lt;70 → cảnh báo; optional block pipeline AI | ✓ PO config |
| 3 | QA | Score tính từ missing required fields + extract quality | ✓ |
