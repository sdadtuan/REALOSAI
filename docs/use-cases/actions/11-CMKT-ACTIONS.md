# Chi tiết hành động — Content Marketing OS (CMKT)

> **UC gốc:** [`../11-CONTENT-MARKETING.md`](../11-CONTENT-MARKETING.md)  
> **UX/UI:** [`specs/2026-08-09-content-marketing-integration-spec.md`](../../specs/2026-08-09-content-marketing-integration-spec.md)  
> **Design:** [`superpowers/specs/2026-08-09-content-marketing-os-design.md`](../../superpowers/specs/2026-08-09-content-marketing-os-design.md)  
> **BA:** [`specs/modules/RNOSAI-BA-CMKT-UseCases.md`](../../specs/modules/RNOSAI-BA-CMKT-UseCases.md)  
> **Parent SVC:** [`02-SVC-ACTIONS.md`](02-SVC-ACTIONS.md) · **Planner:** [`10-MKTP-ACTIONS.md`](10-MKTP-ACTIONS.md)  
> **Phiên bản:** 1.0 · **Coverage:** CMKT-UC-001…014, 021 (P0 UAT) + P1 walkthrough + §22 Review + §24 Media

---

## Walkthrough UAT P0 — Retainer tuần 1 (60 ph)

**Mục tiêu:** *"Sau Planner Apply — Content team import snapshot, sản xuất 1 bài Facebook + 1 blog, Leader duyệt, lên lịch, mark publish."*

**Actors:** SP Writer, Lead SP (Leader), QA  
**Data test:** Lifecycle `#L` stage `deliver` · slug `tiep-thi-noi-dung` · TMMT đã Apply

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | `/login` | Đăng nhập cap content | credentials | JWT | ✓ flags on |
| 2 | SP | `/crm/service-delivery/L` | Tab **Content Board** | — | Context load | ✓ CMKT-UC-001 |
| 3 | Lead | Banner | **Import từ Planner** | merge | Toast ideas>0 | ✓ CMKT-UC-002 |
| 4 | Lead | Ideas | Review pillars/ideas | — | List populated | ✓ CMKT-UC-004 |
| 5 | SP | Ideas | **Convert** idea → item FB | facebook/social_post | Drawer open | ✓ CMKT-UC-006 |
| 6 | SP | Drawer Body | **Generate draft** | tone, short | Job ✓ body | ✓ CMKT-UC-007 |
| 7 | SP | Variants | **Generate variants** | count 3 | ≥3 hooks | ✓ CMKT-UC-008 |
| 8 | SP | Body | Chọn variant 2; sửa 1 dòng | edit | Version saved | ✓ CMKT-UC-009 |
| 9 | SP | Workflow | **Submit review** | — | status in_review | ✓ CMKT-UC-012 |
| 10 | QA | Review queue | Mở item SLA sort | — | Drawer review | ✓ CMKT-UC-014 |
| 11 | QA | Drawer | **Approve internal** | confirm | approved_internal | ✓ §22 |
| 12 | SP | Ideas | Convert blog idea | website/blog | Item draft | ✓ §12 matrix |
| 13 | SP | Blog item | Generate + submit + QA approve | — | approved | ✓ |
| 14 | Lead | Calendar | Drag 2 items vào tuần | dates | scheduled | ✓ CMKT-UC-011 |
| 15 | SP | FB item | **Copy caption** (manual) | — | clipboard | ✓ §12.5 |
| 16 | SP | FB item | **Mark published** | URL optional | published | ✓ CMKT-UC-021 |
| 17 | SP | Blog item | **→ SEO pipeline** | — | chip SEO | ○ P1 CMKT-019 |
| 18 | QA | Audit | `GET .../audit` | — | ai_run rows | ✓ CMKT-UC-028 |

#### Tiêu chí nghiệm thu P0
- [ ] 18 bước pass staging
- [ ] Reject thiếu comment → 400 (test riêng)
- [ ] Invalid channel+format blocked UI
- [ ] Smoke `smoke_content_marketing_p0.sh` PASS

---

## Walkthrough UAT P1 — Text + Visual + Media (90 ph)

**Mục tiêu:** *"Carousel FB: duyệt chữ → AI ảnh → duyệt visual → publish."*

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Tạo item `facebook`/`carousel` | ✓ |
| 2 | SP | Generate slide copy + approve text | ✓ CMKT-UC-014 |
| 3 | SP | Tab **Media AI** → Generate carousel slides | ✓ CMKT-UC-035 |
| 4 | System | Visual QA score hiển thị | ✓ CMKT-UC-037 |
| 5 | SP | Submit visual review | ✓ |
| 6 | Lead | Review queue filter Visual | ✓ |
| 7 | Lead | Approve visual | ✓ visual_status |
| 8 | SP | Publish — watermark removed | ✓ EC-CMKT-MEDIA-03 |
| 9 | SP | Repurpose 1 blog → 2 social (wizard) | ✓ CMKT-UC-018 |
| 10 | Design | Escalate human → upload URL | ✓ CMKT-UC-038 |

---

## CMKT-UC-001 — Mở Content Board context

**Mục tiêu:** *"Mở lifecycle — thấy KPI content và trạng thái snapshot Planner."*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | SP | service-delivery | Click **Content Board** | — | Panel load | ✓ cap view |
| 2 | System | GET context | Assemble | lifecycle_id | JSON | ✓ |
| 3 | SP | Overview | Read KPI strip | — | counts | ✓ |
| 4 | SP | Banner | Read snapshot state | — | sealed/import CTA | ✓ |
| 5 | SP | Sub-nav | Switch Ideas/Calendar | — | view change | ✓ |

#### Tiêu chí
- [ ] Flag off → tab hidden
- [ ] Context p95 ≤800ms

---

## CMKT-UC-002 — Ingest Planner snapshot

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | Lead | Click Import từ Planner | ✓ |
| 2 | Lead | Chọn merge + import calendar/pillars | ✓ |
| 3 | System | POST ingest | ✓ |
| 4 | Lead | Review toast warnings | ✓ |
| 5 | SP | Ideas view — verify rows | ✓ EC-CMKT-01 |

---

## CMKT-UC-006 — Tạo content item

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Click + Item | ✓ |
| 2 | SP | Channel Facebook, format social_post | ✓ picker §12 |
| 3 | SP | Chọn pillar + title | ✓ |
| 4 | System | POST items | ✓ |
| 5 | SP | Drawer opens draft | ✓ |

**E1:** facebook + blog disabled in picker — never reaches API.

---

## CMKT-UC-007 — AI generate draft

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Set tone, length, goal | ✓ |
| 2 | SP | Click Generate draft | ✓ |
| 3 | System | Job running UI | ✓ |
| 4 | System | Job succeeded → v1 body | ✓ |
| 5 | SP | Edit body → v2 manual | ✓ versions |

**E1:** Job fail → fallback template CMKT-UC-029 + Retry.

---

## CMKT-UC-008 — Variants ≥3

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Click Generate variants | ✓ |
| 2 | System | ≥3 headline/CTA | ✓ EC-CMKT-02 |
| 3 | SP | Select variant index | ✓ |
| 4 | SP | Apply to body | ✓ |

---

## CMKT-UC-011 — Calendar

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | Lead | Open Calendar view | ✓ |
| 2 | Lead | Drag approved item to date | ✓ |
| 3 | System | PUT calendar slot | ✓ |
| 4 | SP | Item status → scheduled | ✓ |

---

## CMKT-UC-012 — Submit review + Kanban

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Submit review (body non-empty) | ✓ |
| 2 | System | status in_review; card moves column | ✓ |
| 3 | Lead | Board filter In review | ✓ |

**E1:** Empty body → disabled Submit + tooltip.

---

## CMKT-UC-014 — Approve / Reject (§22)

### Approve

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | QA | Open Review queue | ✓ cap |
| 2 | QA | Open item → read diff | ✓ |
| 3 | QA | Approve + confirm modal | ✓ |
| 4 | System | approved_internal + audit | ✓ EC-CMKT-LDR-03 |

### Reject

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | QA | Request changes | ✓ |
| 2 | QA | Comment + reason chip | ✓ |
| 3 | System | changes_requested | ✓ |
| 4 | SP | Edit → submit again | ✓ |

**E1:** Reject no comment → 400 EC-CMKT-LDR-02.

---

## CMKT-UC-013 — Assign SP / QA

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | Lead | Drawer header assign SP | ✓ |
| 2 | Lead | Assign QA | ✓ |
| 3 | SP | Filter board by assignee | ✓ |

---

## CMKT-UC-016 — Comments

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | QA | Add comment on reject | ✓ |
| 2 | SP | Reply in thread | ✓ |
| 3 | AM | Read-only view | ✓ no write |

---

## CMKT-UC-017 — Version history

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Tab Versions | ✓ |
| 2 | SP | Compare v1 AI vs v2 edit | ✓ diff |
| 3 | Leader | Verify ai_run on v1 | ✓ |

---

## CMKT-UC-021 — Mark published

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Click Publish (approved) | ✓ |
| 2 | SP | Enter URL (optional FB) | ✓ |
| 3 | System | status published | ✓ |

**E1:** draft → Publish blocked BR-CMKT-01 toast.  
**E2:** P1 needs_visual without visual approve → blocked BR-CMKT-08.

---

## CMKT-UC-018 — Repurpose (P1)

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Open repurpose wizard from approved blog | ✓ |
| 2 | SP | Select FB x2, LI x1 | ✓ |
| 3 | System | Jobs repurpose | ✓ |
| 4 | Lead | Duyệt từng derived item | ✓ no bulk approve |

---

## CMKT-UC-019 — Bridge SEO (P1)

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Approved blog → **→ SEO pipeline** | ✓ |
| 2 | System | seo_bridge_id set | ✓ |
| 3 | SP | Open /seo/content link | ✓ |
| 4 | SP | On SEO publish → URL sync (poll) | ✓ |

---

## CMKT-UC-035 — AI image (P1)

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | SP | Text approved → tab Media AI enabled | ✓ BR-CMKT-06 |
| 2 | SP | Generate 3 images | ✓ |
| 3 | SP | Preview DRAFT watermark | ✓ |
| 4 | SP | Submit visual review | ✓ |
| 5 | Lead | Approve visual | ✓ |
| 6 | SP | Publish without watermark | ✓ EC-CMKT-MEDIA-03 |

---

## CMKT-UC-038 — Escalate Design (P1)

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | Leader | Visual QA <70 → Escalate Design | ✓ |
| 2 | Design | Production panel upload URL | ✓ |
| 3 | Design | Mark production done | ✓ |
| 4 | Leader | Approve visual | ✓ |

---

## CMKT-UC-028 — Audit

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | QA | Open audit tab/panel | ✓ |
| 2 | QA | Verify generate + approve events | ✓ |
| 3 | QA | ai_run_id present on AI versions | ✓ |

---

## CMKT-UC-029 — Fallback

| # | Actor | Thao tác | Gate |
|---|-------|----------|------|
| 1 | Admin | Disable LLM / force fail | test |
| 2 | SP | Generate draft | ✓ |
| 3 | System | Template body + banner | ✓ EC-CMKT-06 |

---

## Cross-links Planner → Content

| Sau MKTP walkthrough bước | Content action |
|---------------------------|----------------|
| MKTP Apply TMMT (step 16) | Deep link Content Board import |
| MKTP Content step calendar | Ideas overlap — ingest merge |
| MKTP KPI dashboard optimize | Link intelligence view P2 |

---

## Regression checklist (sau mỗi deploy)

- [ ] `smoke_content_marketing_p0.sh` PASS
- [ ] Tab `ai-planner` vẫn hoạt động
- [ ] Flag CMKT off → không regression service-delivery
- [ ] SEO/EM modules không broken khi bridge off
