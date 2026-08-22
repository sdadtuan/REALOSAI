# Use Case — Content Marketing OS (ContentMarketingModule)

> **Prefix:** CMKT · **Phiên bản:** 1.0 · **Ngày:** 2026-08-09  
> **Design spec:** [`superpowers/specs/2026-08-09-content-marketing-os-design.md`](../superpowers/specs/2026-08-09-content-marketing-os-design.md)  
> **Video OS (đa kênh, FFmpeg):** [`superpowers/specs/2026-08-20-cmkt-professional-video-os-design.md`](../superpowers/specs/2026-08-20-cmkt-professional-video-os-design.md)  
> **UX/UI spec:** [`2026-08-09-content-marketing-integration-spec.md`](../specs/2026-08-09-content-marketing-integration-spec.md)  
> **BA module:** [`specs/modules/RNOSAI-BA-CMKT-UseCases.md`](../specs/modules/RNOSAI-BA-CMKT-UseCases.md)  
> **Actions:** [`actions/11-CMKT-ACTIONS.md`](actions/11-CMKT-ACTIONS.md)  
> **Plan:** [`superpowers/plans/2026-08-09-content-marketing-os-phase0-3.md`](../superpowers/plans/2026-08-09-content-marketing-os-phase0-3.md)  
> **Parent:** MKTP-UC-008 (Planner Apply) · SVC-UC-003 · `tiep-thi-noi-dung`

---

## Ma trận traceability

| Deliverable | UC | Phase |
|-------------|-----|-------|
| Tab content-os | CMKT-UC-001 | P0 |
| Snapshot ingest | CMKT-UC-002, 003 | P0 |
| Idea bank | CMKT-UC-004, 005 | P0–P1 |
| Items + generate | CMKT-UC-006…010 | P0 |
| Calendar + board | CMKT-UC-011, 012 | P0 |
| Workflow + review | CMKT-UC-013, 014, §22 | P0 |
| Comments + versions | CMKT-UC-016, 017 | P0 |
| Publish | CMKT-UC-021 | P0 |
| Audit + fallback | CMKT-UC-028, 029 | P0 |
| Repurpose | CMKT-UC-018 | P1 |
| SEO/EM bridge | CMKT-UC-019, 020 | P1 |
| Production §23 | CMKT-UC-031…034 | P1 |
| AI Media §24 | CMKT-UC-035…038 | P1–P2 |
| **Video OS đa kênh** | CMKT-UC-036, 039…046 | V1–V3 |
| Intelligence | CMKT-UC-022…026 | P1–P2 |
| Portal | CMKT-UC-030 | P2 |

**API base:** `/api/crm/service-lifecycle/:lifecycleId/content-marketing`  
**UI primary:** `/crm/service-delivery/[id]?tab=content-os`

---

## Phạm vi phase

| Phase | UC | Count |
|-------|-----|-------|
| **P0** | 001…014, 016, 017, 021, 028, 029 | 18 |
| **P1** | 015, 018…020, 022, 023, 027, 031…035, 037, 038 | 14 |
| **P2** | 024…026, 030, 036 | 5 |
| **P3** | Scale / GA | backlog |

---

## Business rules (module)

| Mã | Mô tả |
|----|--------|
| **BR-CMKT-01** | Không `published` khi chưa `approved_internal`. |
| **BR-CMKT-02** | Không auto-post social/email/OA. |
| **BR-CMKT-03** | Reject bắt buộc comment ≥10 ký tự. |
| **BR-CMKT-04** | Không PII KH trong prompt nếu chưa consent lifecycle. |
| **BR-CMKT-05** | `needs_visual` / `video_script` → `production.phase=done` trước publish (P1). |
| **BR-CMKT-06** | AI media job sau text `approved_internal` (carousel draft watermark ngoại lệ). |
| **BR-CMKT-07** | Asset AI: `ai_generated=true` + audit provider/prompt_hash. |
| **BR-CMKT-08** | `visual_status=approved` trước publish khi cần visual (P1). |
| **BR-AI-01** | AI chỉ draft — human publish. |
| **BR-AI-06** | Mọi generate ghi `ai_agent_runs`. |

---

## CMKT-UC-001 — Mở Content Board context

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor** | SP, Lead, QA, AM |
| **Priority** | P0 |
| **Trigger** | Tab **Content Board** trên service-delivery |

**Preconditions:** `PTT_CONTENT_MARKETING_ENABLED=1`, `NEXT_PUBLIC_CONTENT_MARKETING=1`, cap `crm_content.view`, slug trong allowlist.

**Main flow:**

1. User mở `/crm/service-delivery/:id?tab=content-os`.
2. FE gọi `GET .../content-marketing/context`.
3. UI hiển thị snapshot banner, sub-nav, view mặc định `overview`.
4. KPI strip: counts theo status.

**Postconditions:** Context cached client-side; deep link `view` respected.

**Exceptions:** Flag off → tab hidden. Slug không hợp lệ → tab hidden hoặc empty state hướng dẫn.

---

## CMKT-UC-002 — Ingest Planner snapshot

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor** | Lead SP, SP |
| **Priority** | P0 |
| **Parent** | MKTP-UC-008 |

**Main flow:**

1. User bấm **Import từ Planner** (banner hoặc overview).
2. Modal chọn: merge/replace, import calendar, import pillars.
3. `POST .../plan-snapshot/ingest`.
4. Toast: N ideas, M pillars; warnings nếu có.
5. Redirect `view=ideas`.

**Postconditions:** `cmkt_plan_snapshots` row; ideas/pillars created.

---

## CMKT-UC-006 — Tạo content item

**Main flow:**

1. User **[+ Item]** hoặc convert từ idea.
2. Channel picker (§12) — invalid pairs disabled.
3. `POST .../items` → open drawer.

**Validation:** `assertValidChannelFormat` → 400 `CMKT_INVALID_CHANNEL_FORMAT`.

---

## CMKT-UC-007 — AI generate draft

**Main flow:**

1. User chọn tone, length, goal trong Generate panel.
2. `POST .../items/:id/jobs/draft`.
3. Job panel polling → success → new version.
4. Body editor populated.

**Fallback:** CMKT-UC-029 template nếu LLM fail.

---

## CMKT-UC-014 — Internal approve / reject

**Actors:** QA, Lead SP

**Approve:** `POST .../approve` → `approved_internal`  
**Reject:** `POST .../reject` + comment → `changes_requested`

See §22 Leader Approval Workflow in design spec.

---

## CMKT-UC-021 — Mark published

**Main flow:**

1. Item `scheduled` or `approved_internal` (config).
2. User nhập `published_url` (optional per channel).
3. `POST .../publish` → `published`.

**Gate:** BR-CMKT-01, BR-CMKT-08 (P1).

---

## CMKT-UC-035 — AI generate image (P1)

**Main flow:**

1. Text status `approved_internal`.
2. Tab Media AI → Generate 3 images.
3. Visual QA score displayed.
4. Submit visual review → Leader approve visual.

---

*(UC 003…013, 015…034: chi tiết walkthrough trong [`11-CMKT-ACTIONS.md`](actions/11-CMKT-ACTIONS.md) và [`RNOSAI-BA-CMKT-UseCases.md`](../specs/modules/RNOSAI-BA-CMKT-UseCases.md))*

---

## Acceptance criteria index

| EC | Mô tả | Spec |
|----|-------|------|
| EC-CMKT-01…12 | Functional P0 | Design §17 |
| EC-CMKT-LDR-01…07 | Leader workflow | Design §22.9 |
| EC-CMKT-MEDIA-01…06 | AI media | Design §24.12 |
| EC-CMKT-UX-01…10 | UX | Integration §16 |
