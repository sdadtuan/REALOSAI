# Content Marketing OS — Kế hoạch Coding (Vertical Slices · Dùng được thật)

> **Coding execution (vertical slices · UAT-gated):** [`2026-08-09-content-marketing-coding-milestones.md`](./2026-08-09-content-marketing-coding-milestones.md) — **M0–M6 DONE** · **M7+:** [`2026-08-09-content-marketing-m7-m12-professionalization.md`](./2026-08-09-content-marketing-m7-m12-professionalization.md)

**Goal:** Ship `ContentMarketingModule` + tab **Content Board** sao cho Content team **làm việc thật** trên retainer `tiep-thi-noi-dung` — không chỉ scaffold Nest module / empty React panel.

**Architecture:** Vertical slices: mỗi milestone = BE endpoints **ghi/đọc DB thật** + FE màn hình **tương tác được** + smoke script **assert business outcome**. Pattern copy từ `marketing-ai-planner/` (controller prefix, guards, job worker, `ai_agent_runs`).

**Tech Stack:** NestJS `ptt-crm-api`, Next.js `ops-web`, PostgreSQL `cmkt_*`, env `PTT_CONTENT_MARKETING_*`, caps `crm_content.*`, bash smoke.

## Global Constraints

- **BR-CMKT-01:** Không `published` khi chưa `approved_internal`.
- **BR-CMKT-02:** Không auto-post social/email/OA.
- **BR-AI-01:** AI chỉ draft — human approve/send/publish.
- **API prefix:** `api/crm/service-lifecycle/:lifecycleId/content-marketing/*`
- **Pilot slug:** `PTT_CONTENT_MARKETING_SLUGS=tiep-thi-noi-dung`
- **Không circular import** Planner ↔ Content — ingest chỉ đọc applied plan / snapshot frozen.
- **Cấm anti-pattern:** endpoint trả `{ ok: true }` không side-effect; FE tab hiện placeholder “Coming soon”; job worker poll không apply output vào `body_json`.

---

## 0. Nguyên tắc triển khai (đọc trước khi code)

### 0.1. Definition of “Done” cho coding task

Một task chỉ **DONE** khi đủ 4 điều:

| # | Tiêu chí | Cách verify |
|---|----------|-------------|
| 1 | **User-visible** | Actor SP/Lead/QA thao tác được trên UI hoặc curl smoke |
| 2 | **Persisted** | Data còn sau F5 / query DB |
| 3 | **Guarded** | Thiếu cap / sai channel+format → 403/400 có message |
| 4 | **Tested** | Unit spec cho util/workflow + smoke step assert JSON |

### 0.2. Thứ tự ưu tiên file (tránh làm FE trước BE rỗng)

```
DDL apply → Repository (SQL thật) → Service (business rules) → Controller + Guards
→ ops-web lib/content-os-api.ts → Panel + sub-views → smoke script
```

### 0.3. Map milestone ↔ UAT P0 (18 bước)

| Milestone | User outcome (1 câu) | UAT steps covered |
|-----------|----------------------|-------------------|
| **M0** | DB + flags + caps tồn tại; API health trả lifecycle hợp lệ | — (infra) |
| **M1** | Mở Content Board, tạo idea/item thủ công, Kanban thấy card | 1–2, 4 (manual), 5 (convert, body thủ công), 12 (matrix UI) |
| **M2** | Import snapshot Planner → ideas/pillars populate | 3–4 |
| **M3** | AI draft + variants + chọn variant + version history | 6–8 |
| **M4** | Submit → Review queue → Approve → Calendar → Publish → Audit | 9–11, 13–16, 18 |
| **M5** | P1: Repurpose, SEO/EM bridge, Production handoff §23 | 17 + P1 walkthrough 9–10 |
| **M6** | P1: AI image/carousel + visual approve §24 | P1 walkthrough 1–8 |

**P0 sign-off = M4 smoke PASS + 18 bước UAT staging.**

---

## 1. Baseline copy (bắt buộc đọc trước khi viết code)

| Pattern | Source file | Áp dụng |
|---------|-------------|---------|
| Module + controller prefix | `marketing-ai-planner.module.ts`, `marketing-ai-planner.controller.ts` | `content-marketing.*` |
| Job worker poll | `marketing-ai-job-worker.service.ts` | `content-job-worker.service.ts` |
| Guards caps | `guards/staff-marketing-ai-planner.guard.ts` | `guards/staff-content-*.guard.ts` |
| Channel validation util + spec | (mới) | `content-marketing-channel.util.ts` |
| FE tab wiring | `service-delivery/[id]/page.tsx` + `mkt-ai-planner-flags.ts` | `content-os` tab |
| DDL apply | `scripts/apply_pg_ddl_mkt_ai_planner.sh` | `apply_pg_ddl_content_marketing.sh` |
| Planner applied plan read | `marketing-ai-planner.service.ts` `getAppliedPlan` / snapshot | `content-plan-snapshot.service.ts` |

---

## 2. Milestone M0 — Nền tảng DB + flags + caps (Day 1)

**User outcome:** Dev/staging có schema; staff có cap; `GET .../content-marketing/context` trả counts thật (0 nếu chưa data).

### Task M0-1: DDL PostgreSQL

**Files:**
- Create: `docs/specs/2026-08-09-postgresql-ddl-content-marketing.sql`
- Create: `scripts/apply_pg_ddl_content_marketing.sh`

**Nội dung DDL (spec §8):** `cmkt_plan_snapshots`, `cmkt_content_pillars`, `cmkt_content_ideas`, `cmkt_content_items` (+ status CHECK), `cmkt_content_item_versions`, `cmkt_content_item_derivations`, `cmkt_calendar_slots`, `cmkt_content_comments`, `cmkt_content_metrics`, `cmkt_content_jobs`, indexes `(lifecycle_id, status)`, FK → `crm_service_lifecycle`, channel+format CHECK §12.

**DoD:**
- [ ] Script apply idempotent (IF NOT EXISTS / migration-safe theo pattern repo)
- [ ] `\d cmkt_content_items` có constraint `cmkt_content_items_channel_format_check`

**Verify:**
```bash
cd RNOSAI && bash scripts/apply_pg_ddl_content_marketing.sh
psql "$DATABASE_URL" -c "\dt cmkt_*"
```

### Task M0-2: App config flags

**Files:**
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`

**Env:**
```
PTT_CONTENT_MARKETING_ENABLED=1
PTT_CONTENT_MARKETING_FE=1
PTT_CONTENT_MARKETING_SLUGS=tiep-thi-noi-dung
PTT_CONTENT_MARKETING_AI_ENABLED=1   # M3+
PTT_CONTENT_MARKETING_APPROVAL_REQUIRED=1
```

**DoD:**
- [ ] `isContentMarketingEnabled(lifecycleSlug)` — false nếu flag off hoặc slug không trong list
- [ ] Unit hoặc smoke assert flag off → controller 404/disabled

### Task M0-3: RBAC caps seed

**Caps (spec §7):** `crm_content.view | write | generate | approve_internal | assign | publish | qa | production | admin`

**Files:** theo pattern repo caps (grep `crm_mkt_ai` trong migrations/seed SQL hoặc staff roles JSON)

**DoD:**
- [ ] Role Content Writer có `view, write, generate`
- [ ] Role QA có `view, qa, approve_internal`
- [ ] Role Lead có thêm `assign, publish, admin`

**Verify:** login test user → `staffMe` caps chứa `crm_content.view`

### Task M0-4: Module skeleton **có GET context thật**

**Files:**
- Create: `content-marketing.module.ts`, `content-marketing.controller.ts`, `content-marketing.repository.ts`, `content-marketing.service.ts`, `content-marketing.types.ts`, `content-marketing.constants.ts`
- Create: `guards/staff-content-view.guard.ts` (+ write/generate/approve/publish)
- Modify: `app.module.ts`

**Implement tối thiểu:**
- `GET /context` → `{ lifecycle_id, enabled, snapshot: null|summary, counts: { ideas, items_by_status, in_review_sla_breach }, flags }`
- Repository: `countIdeasByLifecycle`, `countItemsByStatus` — SQL thật

**DoD:**
- [ ] Không endpoint stub `{}`
- [ ] Guard: `crm_board.view` + `crm_content.view`
- [ ] Flag off → 403 `{ error: 'module_disabled' }`

**Verify:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/crm/service-lifecycle/$L/content-marketing/context" | jq '.counts'
```

---

## 3. Milestone M1 — Content Board manual ops (Days 2–5)

**User outcome:** *"Không cần AI — team vẫn quản lý idea, convert item Facebook/blog, sửa body, xem Kanban."*

**UAT partial:** Steps 1–2, 4 (manual ideas), 5, 12.

### Task M1-1: Channel registry util

**Files:**
- Create: `content-marketing-channel.util.ts`
- Create: `content-marketing-channel.util.spec.ts`

**Implement:** `assertValidChannelFormat(channel, format)`, `listFormatsForChannel`, `copyActionsForChannel` (§12.5 manual copy vs bridge)

**DoD:**
- [ ] Spec cover: `facebook+social_post` OK; `facebook+blog` throw; `website+blog` OK
- [ ] Dùng trong POST items + convert idea

### Task M1-2: Ideas CRUD

**Files:**
- Create: `content-idea.service.ts`
- Extend: `content-marketing.repository.ts`, `content-marketing.controller.ts`

**Endpoints:** `GET/POST/PATCH /ideas`, `POST /ideas/:id/convert`

**Business:**
- Convert: tạo `cmkt_content_items` status `draft`, copy title/hook, set channel+format từ body, idea → `converted`
- `assertValidChannelFormat` trước insert

**DoD:**
- [ ] POST idea → GET list thấy item
- [ ] Convert → item id trả về; idea status `converted`
- [ ] Invalid pair → 400 `{ error: 'invalid_channel_format' }`

### Task M1-3: Items CRUD + manual body

**Files:**
- Create: `content-item.service.ts`

**Endpoints:** `GET /items`, `GET /items/:id`, `POST /items`, `PATCH /items/:id`

**body_json shape:** `{ markdown, html, variants: [] }` — PATCH manual ghi version (`change_reason: manual`)

**DoD:**
- [ ] PATCH body → row trong `cmkt_content_item_versions`
- [ ] GET item trả `body_json` + `status`

### Task M1-4: FE — Tab + Overview + Ideas + Board

**Files:**
- Create: `services/ops-web/src/lib/content-marketing-flags.ts`
- Create: `services/ops-web/src/lib/content-os-api.ts`
- Create: `services/ops-web/src/components/content-os/ContentOsPanel.tsx`
- Create: `ContentOsOverview.tsx`, `ContentOsIdeasView.tsx`, `ContentOsBoardView.tsx`, `ContentItemDrawer.tsx` (body editor markdown)
- Modify: `service-delivery/[id]/page.tsx` — tab `content-os`, query `?tab=content-os`

**UX (spec SCR-CMKT-001…004):**
- Sub-nav: Overview | Ideas | Board | (Calendar disabled until M4)
- KPI strip từ `GET /context`
- Ideas: filter status, nút Convert mở drawer chọn channel+format (matrix dropdown filtered)
- Board: columns theo `status` (draft, in_review, approved_internal, scheduled, published)

**DoD:**
- [ ] Flag off → tab ẩn
- [ ] Cap thiếu → message rõ
- [ ] Convert + save body → reload thấy card trên Board
- [ ] Invalid channel+format → UI block + toast

**Verify (manual):** UAT steps 1–2, 5 (skip Generate), 12 với body thủ công

### Task M1-5: Smoke M1

**Files:**
- Create: `scripts/smoke_content_marketing_m1.sh`

**Script steps:**
1. Login internal key / JWT
2. POST idea manual
3. POST convert → facebook/social_post
4. PATCH item body markdown
5. GET items assert status draft + body non-empty

**Gate:** `bash scripts/smoke_content_marketing_m1.sh` exit 0

---

## 4. Milestone M2 — Planner snapshot ingest (Days 6–8)

**User outcome:** *"Sau TMMT Apply — Lead bấm Import từ Planner, Ideas/Pillars đầy từ snapshot frozen."*

**UAT:** Steps 3–4.

### Task M2-1: Plan snapshot service

**Files:**
- Create: `content-plan-snapshot.service.ts`
- Create: `content-brand-context.service.ts` (đọc brand từ snapshot_json / KB refs)

**Endpoints:**
- `GET /plan-snapshot`
- `POST /plan-snapshot/ingest` body `{ marketing_plan_id, mode, import_calendar, import_pillars }`
- `POST /plan-snapshot/seal`

**Implement ingest:**
1. Verify lifecycle có applied plan (query Planner tables — **read-only**, không import `MarketingAiPlannerModule` mutate)
2. Build `snapshot_json`, `source_hash`
3. Upsert pillars; tạo ideas `source=planner_import`, `status=backlog`
4. `mode=replace` archive ideas cũ chưa converted
5. Trả `ideas_created`, `warnings[]`

**DoD:**
- [ ] Ingest lần 2 merge không duplicate title (hoặc warning)
- [ ] Seal → ingest reject 409
- [ ] Không có applied plan → 400 `{ error: 'no_applied_plan' }`

### Task M2-2: FE — Snapshot banner + Import CTA

**Files:**
- Create: `ContentOsSnapshotBanner.tsx`
- Modify: `ContentOsOverview.tsx`, `ContentOsIdeasView.tsx`

**UX:** Banner states: `no_snapshot` | `draft` | `sealed` · nút **Import từ Planner** (Lead cap) · toast `ideas_created`

**DoD:**
- [ ] UAT step 3 pass trên staging lifecycle đã Apply TMMT

### Task M2-3: Smoke M2

**Files:**
- Create/extend: `scripts/smoke_content_marketing_m2.sh`

**Precondition:** lifecycle test có `marketing_ai` applied plan (seed hoặc chạy MKTP smoke trước)

**Assert:** `ideas_created > 0`, GET ideas length ≥ 1

---

## 5. Milestone M3 — AI draft & variants (Days 9–12)

**User outcome:** *"Writer bấm Generate draft / variants — job chạy xong — body điền vào drawer — chọn variant — version lưu."*

**UAT:** Steps 6–8.

### Task M3-1: Generate service + job worker

**Files:**
- Create: `content-generate.service.ts`
- Create: `content-job-worker.service.ts`
- Create: `content-marketing-prompt.util.ts` (§12.4 channel profiles)

**Endpoints:**
- `POST /items/:id/jobs/draft`
- `POST /items/:id/jobs/variants`
- `GET /jobs/:jobId`
- `POST /jobs/:jobId/cancel`

**Pattern (copy MKT-AI):**
1. Insert `cmkt_content_jobs` status `queued`
2. Worker poll → call AI runner → `ai_agent_runs`
3. On success: merge vào `body_json`, insert `cmkt_content_item_versions` (`change_reason: ai_generate`, `ai_run_id`)
4. Job status `succeeded` + `output_json`

**DoD:**
- [ ] Draft job → item.body_json.markdown non-empty
- [ ] Variants job → `body_json.variants.length >= 3`
- [ ] PATCH `selected_variant_idx` + apply text vào markdown
- [ ] Failed job → `error_text`, item không corrupt

**Unit:** mock AI provider — không test integration OpenAI trong unit

### Task M3-2: Brand context injection

**Files:** extend `content-brand-context.service.ts`

**Implement:** RAG optional flag — merge `brand_context_json` + tone từ snapshot vào prompt util

**DoD:**
- [ ] Prompt chứa lifecycle brand name khi snapshot sealed

### Task M3-3: FE — Generate panel + variants picker

**Files:**
- Modify: `ContentItemDrawer.tsx`
- Create: `ContentOsGeneratePanel.tsx`, `ContentOsVariantsPicker.tsx`

**UX (SCR-CMKT-005):** tone/length/goal selects · job polling spinner · variants radio · Apply variant

**DoD:**
- [ ] UAT steps 6–8 pass
- [ ] Version history tab (GET versions) thấy ai_generate row

### Task M3-4: Smoke M3

**Files:** `scripts/smoke_content_marketing_m3.sh`

**Assert:** draft job succeeded; variants ≥ 3; version_no incremented

**Note:** Cần `PTT_CONTENT_MARKETING_AI_ENABLED=1` + AI creds staging

---

## 6. Milestone M4 — Workflow P0 complete (Days 13–18)

**User outcome:** *"QA duyệt trong queue — Lead lên lịch — SP mark published — audit có ai_run rows."*

**UAT:** Steps 9–11, 13–16, 18 + reject test + smoke P0.

### Task M4-1: Workflow service §22

**Files:**
- Create: `content-workflow.service.ts`

**Endpoints:**
- `POST /items/:id/submit-review` → `in_review`, set `in_review_at`
- `POST /items/:id/approve` → `approved_internal` (cap `approve_internal` or `qa`)
- `POST /items/:id/reject` → `changes_requested` — **comment required** → else 400
- `GET /review-queue`, `GET /review-queue/summary`

**Rules:**
- submit: body non-empty (BR)
- approve/reject: không từ `draft` (400 invalid transition)
- SLA sort: `in_review_at` ASC, flag `sla_breach` nếu > 48h config

**DoD:**
- [ ] Reject không comment → 400 (UAT tiêu chí riêng)
- [ ] Review queue chỉ items lifecycle + status `in_review`

### Task M4-2: Calendar service

**Files:**
- Create: `content-calendar.service.ts`

**Endpoints:** `GET /calendar`, `PUT /calendar/slots/:itemId`, `DELETE /calendar/slots/:itemId`

**Rules:** PUT chỉ item `approved_internal` → set status `scheduled`

**DoD:**
- [ ] Drag slot (FE) → PUT → GET calendar có item
- [ ] Item scheduled hiển thị on Calendar view

### Task M4-3: Publish + copy actions §12.5

**Files:** extend `content-item.service.ts`

**Endpoints:** `POST /items/:id/publish`

**Rules (BR-CMKT-01):** reject publish nếu status không `approved_internal|scheduled`

**FE:** nút **Copy caption** (clipboard API) cho facebook/linkedin; **Mark published** + optional URL

**DoD:**
- [ ] Publish từ draft → 400
- [ ] UAT steps 15–16 pass

### Task M4-4: Audit endpoint

**Endpoint:** `GET /audit?limit=` — join `cmkt_content_item_versions.ai_run_id` + `ai_agent_runs`

**DoD:** UAT step 18 — response có ≥1 row sau M3 generate

### Task M4-5: FE — Review queue + Calendar

**Files:**
- Create: `ContentOsReviewQueueView.tsx` (SCR-CMKT-007)
- Create: `ContentOsCalendarView.tsx` (SCR-CMKT-006)
- Modify: `ContentOsPanel.tsx` sub-nav

**DoD:**
- [ ] QA filter SLA · approve/reject modal bắt comment
- [ ] Full P0 walkthrough 18 bước PASS staging

### Task M4-6: Smoke P0 (gate release)

**Files:**
- Create: `scripts/smoke_content_marketing_p0.sh`
- Create: `scripts/run_content_marketing_uat.sh` (optional wrapper)

**Flow end-to-end (automated):**
```
context → ingest (if plan) → convert → draft job → variants → submit
→ approve → calendar PUT → publish → audit GET
```

**Gate:** `[ ] smoke_content_marketing_p0.sh PASS` + `[ ] 18 bước UAT manual PASS`

---

## 7. Milestone M5 — P1 Execute bridges (Days 19–28)

**User outcome:** *"Repurpose blog→social; đẩy SEO/Email pipeline; Design handoff production_json."*

**UAT:** Step 17 + P1 walkthrough 9–10.

### Task M5-1: Repurpose

**Files:** `content-repurpose.service.ts` — `POST /items/:id/repurpose`, job type `repurpose`, lineage `cmkt_content_item_derivations`

**FE:** `ContentOsRepurposeWizard.tsx` (SCR-CMKT-008)

### Task M5-2: SEO bridge

**Files:** `content-seo-bridge.service.ts` — `POST /items/:id/bridge/seo` → set `seo_bridge_id`, chip on item

**Integrate:** gọi service SEO existing (grep `seo-content` create draft)

### Task M5-3: Email bridge

**Files:** `content-email-bridge.service.ts` — tương tự EM module

### Task M5-4: Production handoff §23

**Files:** `content-production.service.ts` — `production_json`, status escalate human, cap `production`

**FE:** tab Production trong drawer

**Smoke:** `scripts/smoke_content_marketing_p1.sh` (repurpose + seo bridge assert)

---

## 8. Milestone M6 — P1 AI Media §24 (Days 29–35)

**User outcome:** *"Carousel: duyệt chữ → AI ảnh → visual QA → Leader duyệt visual → publish."*

### Task M6-1: Media generate

**Files:** `content-media-generate.service.ts`, `content-media-image.provider.ts`

**Jobs:** `image_generate`, `carousel_slides_generate`, `visual_qa_score`

**Columns (migration add):** `visual_status`, `media_json` on items nếu chưa có trong DDL v1 — **alter migration M6**

**Rules (BR-CMKT-06/08):** image job chỉ khi copy `approved_internal`; publish cần `visual_status=approved` khi `format=carousel`

### Task M6-2: FE Media Studio

**Files:** `ContentOsMediaStudio.tsx`, review queue filter Visual

**DoD:** P1 walkthrough 8 bước PASS

---

## 9. Checklist file map (tạo theo milestone)

```
services/ptt-crm-api/src/content-marketing/
├── [M0] module, controller, repository, service, types, constants, guards/*
├── [M1] content-marketing-channel.util(.spec), content-idea.service, content-item.service
├── [M2] content-plan-snapshot.service, content-brand-context.service
├── [M3] content-generate.service, content-job-worker.service, content-marketing-prompt.util
├── [M4] content-workflow.service, content-calendar.service
├── [M5] content-repurpose.service, content-seo-bridge.service, content-email-bridge.service, content-production.service
└── [M6] content-media-generate.service, content-media-image.provider

services/ops-web/src/
├── lib/content-marketing-flags.ts, content-os-api.ts          [M1]
└── components/content-os/*                                     [M1→M6 incremental]

scripts/
├── apply_pg_ddl_content_marketing.sh                           [M0]
├── smoke_content_marketing_m1.sh … m3.sh                       [M1–M3]
├── smoke_content_marketing_p0.sh                               [M4]
└── smoke_content_marketing_p1.sh                               [M5]
```

---

## 10. Testing matrix

| Layer | M1 | M2 | M3 | M4 |
|-------|----|----|----|-----|
| Unit | channel util | ingest hash dedupe | prompt profiles | workflow transitions |
| Integration | ideas CRUD | ingest+planner fixture | job worker mock AI | review+publish guards |
| Smoke | m1.sh | m2.sh | m3.sh | **p0.sh** |
| Manual UAT | partial | +step 3 | +6–8 | **full 18** |

---

## 11. Staging deploy checklist (mỗi milestone)

1. Apply DDL nếu có migration mới
2. Set env flags trên VPS `rs.pttads.vn`
3. Seed caps cho test users
4. Chạy smoke milestone
5. PO sign milestone trước khi bắt milestone kế

**Env block staging P0:**
```bash
PTT_CONTENT_MARKETING_ENABLED=1
PTT_CONTENT_MARKETING_FE=1
PTT_CONTENT_MARKETING_SLUGS=tiep-thi-noi-dung
PTT_CONTENT_MARKETING_AI_ENABLED=1
PTT_CONTENT_MARKETING_APPROVAL_REQUIRED=1
```

---

## 12. Thứ tự thực thi cho agent (session tiếp theo)

1. **M0-1 → M0-4** (DDL + context API)
2. **M1** end-to-end manual ops + smoke m1
3. **M2** ingest Planner
4. **M3** AI jobs
5. **M4** → **STOP cho P0 sign-off**
6. M5/M6 chỉ sau PO approve P0

**Không làm:** Intelligence tab (P2), AI video (P2), portal summary (P2) trước khi M4 PASS.

---

## 13. Traceability nhanh UC → Milestone

| UC | Milestone |
|----|-----------|
| CMKT-UC-001 | M0–M1 |
| CMKT-UC-002 | M2 |
| CMKT-UC-004 | M1–M2 |
| CMKT-UC-006 | M1 |
| CMKT-UC-007–009 | M3 |
| CMKT-UC-011 | M4 |
| CMKT-UC-012–014 | M4 |
| CMKT-UC-021 | M4 |
| CMKT-UC-028 | M4 |
| CMKT-UC-018–019 | M5 |
| CMKT-UC-035–038 | M5–M6 |

---

## 14. Milestone M7 — P0 sign-off & UX polish (Tuần 1–2)

**User outcome:** *"PO ký P0; board/calendar/review trông agency-grade; publish lỗi rõ gate."*

| Task | Files | UC / EC |
|------|-------|---------|
| M7-1 UAT runner | `scripts/run_content_marketing_uat.sh`, `docs/exports/cmkt-uat-results-*.md` | 18 bước P0 |
| M7-2 URL view sync | `ContentOsPanel.tsx`, `useContentOsViewParams.ts` | SCR-001 |
| M7-3 Board badges | `ContentOsBoardCard.tsx`, `ContentOsPanel.tsx` | 012, EC-UX-06 chip |
| M7-4 Calendar grid DnD | `ContentOsCalendarGrid.tsx` | 011 |
| M7-5 Audit tab FE | `ContentOsAuditPanel.tsx`, `content-os-api.ts` | 028 |
| M7-6 Publish gate UX | `ContentOsPanel.tsx` parse ApiError | EC-UX-07 |
| M7-7 Job retry UX | `ContentOsGeneratePanel.tsx` | EC-UX-04, 029 |

**Smoke gate:** `p0.sh` + manual UAT checklist signed.

---

## 15. Milestone M8 — Governance (Tuần 3–4)

**User outcome:** *"Lead assign SP/QA; QA comment thread; duyệt có diff."*

| Task | BE | FE |
|------|----|----|
| M8-1 Assign | `PATCH items` fields `assignee_sp`, `assignee_qa` | `ContentOsAssigneePicker.tsx` |
| M8-2 Comments | `GET/POST items/:id/comments` | `ContentOsCommentsPanel.tsx` drawer tab |
| M8-3 Version diff | `GET items/:id/versions/:v1/compare/:v2` | `ContentOsVersionDiff.tsx` |
| M8-4 Review diff | reuse diff in `ContentOsReviewQueueView` | 014 |

**Smoke:** `scripts/smoke_content_marketing_m8_governance.sh`

---

## 16. Milestone M9 — Media production-grade (Tuần 5–7)

**User outcome:** *"Ảnh carousel brand-safe trên CDN; QA rules thật; không picsum."*

| Task | Files |
|------|-------|
| M9-1 Provider adapter | `content-media-image.provider.ts` → Replicate/Flux; env `PTT_CMKT_IMAGE_PROVIDER` |
| M9-2 Asset storage | `content-media-storage.service.ts`, S3 upload, `media_json` CDN URLs |
| M9-3 Watermark | Server-side DRAFT overlay until `visual_status=approved` |
| M9-4 Visual QA rules | `content-visual-qa.service.ts` — contrast stub + extensible checks |
| M9-5 Job async poll FE | `ContentOsMediaStudio.tsx` poll `GET /jobs/:id` |

**Env staging:**
```bash
PTT_CMKT_IMAGE_PROVIDER=replicate
PTT_CMKT_MEDIA_STORAGE=s3
PTT_CMKT_S3_BUCKET=ptt-cmkt-assets
```

**Smoke:** extend `p2_media.sh` assert CDN URL not picsum.

---

## 17. Milestone M10 — Intelligence (Tuần 8–10)

**User outcome:** *"Leader thấy bài nào hiệu quả; gợi ý topic tuần sau."*

| Task | UC |
|------|-----|
| M10-1 Metrics CRUD | 022 — `POST/PATCH /items/:id/metrics` |
| M10-2 Intelligence aggregate | 023 — `GET /intelligence?range=` |
| M10-3 FE Intelligence tab | SCR-005 — `ContentOsIntelligenceView.tsx` |
| M10-4 Topic suggest job | 024 stub — `POST /jobs/topic-suggest` (P2 lite) |

---

## 18. Milestone M11 — Planner glue & export (Tuần 11–12)

| Task | UC |
|------|-----|
| M11-1 Deep link post-Apply | EC-UX-08 — Planner toast → `?tab=content-os&import=planner` |
| M11-2 Pillar UI | 003 — `ContentOsPillarsView.tsx` |
| M11-3 AI 30 ideas | 005 — job `ideas_bulk` |
| M11-4 PDF brief export | 027, 032 — `pdfkit` or existing export service |
| M11-5 SEO URL sync | 019 — poll/webhook from SeoContentModule |

---

## 19. Milestone M12 — P2 client gate & video (Tuần 13–16)

| Task | UC |
|------|-----|
| M12-1 Client gate workflow | 015 — statuses `pending_client`, `client_approved` |
| M12-2 Portal summary | 030 — read-only portal route |
| M12-3 Short video job | 036 — `video_short_generate` worker |
| M12-4 Weekly memo | 026 — optional |

**Kế hoạch chi tiết từng task:** [`2026-08-09-content-marketing-m7-m12-professionalization.md`](./2026-08-09-content-marketing-m7-m12-professionalization.md)

---

*Phiên bản: 1.1 · 2026-08-09 · M0–M6 done · M7+ roadmap added.*
