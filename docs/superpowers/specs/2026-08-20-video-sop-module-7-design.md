# Design: Module 7 — Video SOP Studio (PTT-SA-M7-VIDEO → RNOSAI)

**Ngày:** 2026-08-20  
**Document ID:** RNOSAI-M7-VIDEO-SOP-20260820  
**Phiên bản:** 1.0  
**Trạng thái:** Spec kiến trúc + nghiệp vụ — chờ plan / DDL  
**Nguồn BA:** `Video AI (RNOSAI).docx` — *PTT-SA-M7-VIDEO v1.0* (20/08/2026)  
**SOP gốc:** `SOP san xuat video chuyen nghiep.docx`  
**Studio cặp:** [`2026-08-20-cmkt-video-dual-studio-design.md`](./2026-08-20-cmkt-video-dual-studio-design.md)  
**Không gồm:** Studio Social / FFmpeg V1 — [`2026-08-20-cmkt-professional-video-os-design.md`](./2026-08-20-cmkt-professional-video-os-design.md)

Tài liệu này **thiết kế module lập trình được trên RNOSAI** theo đúng BA đính kèm: use case, luồng, entity, màn hình, BR, ADR. Không thay thế BA; BA là nguồn nghiệp vụ. Đây là bản **neo code** (route, cap, bảng, sprint).

---

## 1. Tên gọi & phạm vi

| Trong BA | Trong RNOSAI |
|----------|----------------|
| Module 7 — Sản xuất Video AI | **Video SOP Studio** (`video-cinematic`) |
| Video Project | Bảng `vd_projects` + hub `/crm/video` |
| Client Review Portal | `portal-web` magic link (mở rộng card Content) |

**Đây không phải module Shop/e-commerce.** File đính kèm là Module 7 sản xuất video. Module này = studio **chiến dịch SOP** (4 cổng). Video tuần FFmpeg là module **khác**.

### 1.1. Trong phạm vi v1.0 (khớp BA §1.4)

Vòng đời Brief → Script → Shotlist → Keyframe → Clip → Master → Delivery; LLM có template; Leonardo; Kling + Runway adapter; Topaz job; 4 gate checklist; Cost Ledger; Client Review; Asset lineage; dashboard sản xuất.

### 1.2. Ngoài phạm vi v1.0 (khớp BA)

NLE trong trình duyệt; auto grade/mix; multi-tenant bán ngoài; TTS VO (v1.1 — Social studio đã có TTS riêng); auto-post TikTok/Meta.

### 1.3. Khác Social FFmpeg (bắt buộc)

| | SOP Module 7 | Social FFmpeg |
|--|--------------|---------------|
| Đơn vị | `vd_projects` + Shot + Take | Content item + 4 beat |
| UI | 16 màn SC-01…16, hub `/crm/video` | Media AI tab |
| QC | Gate 1–4 + override cấp | Visual QA file |
| Provider | Leonardo, Kling, Runway, Topaz | TTS, Pexels, FFmpeg |
| Thời gian | 9–18 giờ / 30s | Vài phút |

Cấm import `video-social` ↔ `video-cinematic` (EC-DUAL-06).

---

## 2. Vị trí RNOSAI (thay sơ đồ M1–M6 của BA)

BA giả định Module 1–6 generic. Map thật:

| BA | RNOSAI thực tế | Chiều |
|----|----------------|-------|
| M1 Khách hàng | `crm` client / agency client | `vd_projects.client_id` đọc |
| M2 Dự án | **Service lifecycle** `/crm/service-delivery/[id]` | `lifecycle_id`; deadline/owner kế thừa |
| M3 Task / KPI | Task lite / staff KPI (nếu có) | Gate → task duyệt; V1 có thể notify in-app nếu task module mỏng |
| M4 Tài chính | Payroll/finance lite — **không** MISA | Cost Ledger nội bộ; export Excel/CSV cho kế toán khi đóng project |
| M5 Dashboard | HR/CRM hub + Intelligence | Widget Video SOP trên `/crm/video` + optional `/crm/hr` không trộn |
| M6 Nghiên cứu AI | **Market Research OS** | Brief gắn `insight_ids[]` đã approved (BR-01 nên ≥1, không bắt buộc cứng) |

Content Board: picker **Video chiến dịch (SOP)** → `POST vd/projects` + optional `cmkt_item_id` để calendar/publish caption sau Gate 4.

---

## 3. Quyết định kiến trúc RNOSAI (ADR BA + khóa thêm)

Giữ nguyên ADR-01…10 của BA. Bổ sung:

| Mã | Quyết định |
|----|------------|
| **ADR-R1** | Nest **`VideoSopModule`** sibling `ContentMarketingModule`, không nhét vào `ContentOsMediaStudio` |
| **ADR-R2** | Prefix bảng `vd_*`; API `/api/v1/vd/...` |
| **ADR-R3** | Hub UI `/crm/video` + deep link từ lifecycle `?tab=video-sop&project=` |
| **ADR-R4** | FFmpeg trong module này **chỉ** `IMediaOps` (probe, proxy, loudness, editor package zip) — không stitch B-roll |
| **ADR-R5** | Secret provider = env / secret manager; **không** ghi API key vào `vd_providers` |
| **ADR-R6** | v1.0 queue = Nest worker + `cmkt`-style `setImmediate` / Redis nếu đã có; hàng đợi logic tách `q.image` / `q.video.kling` / `q.video.runway` dù physical queue một Redis |

---

## 4. Personas → cap RNOSAI

BA §6. Map cap mới (section `crm_vd`):

| Vai BA | Cap |
|--------|-----|
| AM | `crm_vd.project` view/edit |
| Creative Lead | `crm_vd.gate1` approve · `crm_vd.gate3` approve |
| Art Director | `crm_vd.bible` edit · `crm_vd.gate2` approve |
| Copywriter | `crm_vd.script` edit |
| AI Artist | `crm_vd.keyframe` edit |
| Motion Artist | `crm_vd.motion` edit |
| Editor | `crm_vd.post` edit |
| QC | `crm_vd.qc` edit |
| Production Manager | `crm_vd.budget` edit · `crm_vd.project` edit |
| Admin | `crm_vd.admin` |
| Client | portal magic link — không cap CRM |

Override gate: actor có cap gate **cấp trên** (Lead override Art = `gate1` hoặc `project` PM) + `override_reason` ≥ 10 ký tự.

---

## 5. Use case (giữ mã BA, prefix VD)

Nhóm A–E của BA = **VD-UC-01…32**. Không đánh lại 049–053 (dual-studio) — map:

| Dual-studio | BA Module 7 |
|-------------|----------------|
| UC-047 Picker | Tạo/chọn `vd_project` (VD-UC-01) |
| UC-048 Clone studio | Clone script → project social **khác** (ngoài M7) |
| UC-049 G1 | VD-UC-03…07 + Gate 1 |
| UC-050 G2 | VD-UC-08…13 + Gate 2 |
| UC-051 G3 | VD-UC-14…19 + Gate 3 |
| UC-052 G4 | VD-UC-20…23 + Gate 4 |
| UC-053 Escalate 4K | VD-UC-20 + Editor Package (BA ADR-08: dựng ngoài) |

Toàn bộ mô tả actor / pre / post **theo BA §2.3** — không rút.

User story US-VD01…10 = acceptance narrative cho UAT S10.

---

## 6. Luồng (state machine — nguồn chân lý)

### 6.1. `vd_projects.stage`

```
brief_draft → brief_ready → ideation → scripting → shotlist_ready
  → [GATE 1] → keyframing → [GATE 2] → animating → [GATE 3]
  → post_production → [GATE 4] → delivered → archived
```

`status` song song: `active | on_hold | cancelled`.

Bảo vệ chuyển stage = BR-01, 04, 05, 07, 12 đúng BA. **Service chặn**, không chỉ ẩn nút (AC-01).

### 6.2. `vd_shots.status`

```
draft → prompts_ready → keyframe_pending → keyframe_approved
  → clip_draft → clip_final → clip_selected → posted
  └─ take_fail_count≥5 → blocked → plan_b → clip_draft
```

### 6.3. Job

`created → queued → running → succeeded | failed | cancelled | stale`  
Retry ≤3 chỉ `transient` / `rate_limit` (BR-10).

Mọi gọi provider = Job. HTTP user **không** await Kling.

---

## 7. Business rules — thực thi code

Copy nguyên BR-01…15 từ BA. Ghi chú RNOSAI:

| BR | Service |
|----|---------|
| BR-01 | `VdBriefService.assertComplete()` — 8 nhóm SOP 1.1 |
| BR-02 | Feasibility FR-R01…10; chặn duration >15s |
| BR-03 | `VdPromptComposer` inject bible snapshot; region khóa |
| BR-04 | Shotlist version + immutable sau Gate 1 |
| BR-05 | `VdStageGuard` trước mọi `createAsset(stage+1)` |
| BR-06 | `VdCostService.reserve()` trước enqueue |
| BR-07 | `clip_final` job chỉ khi có take draft `passed` |
| BR-08 | `take_fail_count` → `blocked` + task Lead |
| BR-09 | DAG nodes cố định |
| BR-10 | `error_class` enum |
| BR-11 | `deleted_at`; retention 12 tháng metadata |
| BR-12 | Gate 4 auto-check blocking |
| BR-13 | Ledger estimated + actual |
| BR-14 | ReviewLink TTL ≤14 ngày, watermark |
| BR-15 | `contains_human` + `ai_disclosure` |

Feasibility rules FR-R01…10 = `vd_feasibility.rules.ts` (unit test từng rule).

---

## 8. Mô hình dữ liệu (logic → bảng)

Prefix `vd_`. BA §5.1 không đổi nghĩa.

| Bảng | Entity BA |
|------|-----------|
| `vd_projects` | VideoProject |
| `vd_briefs` | Brief |
| `vd_ideas` | Idea |
| `vd_scripts` | Script |
| `vd_shots` | Shot |
| `vd_prompts` | Prompt |
| `vd_style_bibles` / `vd_character_bibles` | Bible |
| `vd_assets` / `vd_asset_lineage` | Asset |
| `vd_take_scores` | TakeScore |
| `vd_providers` / `vd_models` | Provider / Model (không chứa secret) |
| `vd_jobs` | Job |
| `vd_llm_runs` | LlmRun |
| `vd_prompt_templates` | PromptTemplate |
| `vd_checklist_templates` / `_items` / `_instances` / `_results` | QC |
| `vd_gates` / `vd_approvals` / `vd_rework_items` | Gate |
| `vd_cost_ledger` / `vd_budgets` | Cost |
| `vd_delivery_packages` | Delivery |
| `vd_review_links` / `vd_review_comments` | Portal |
| `vd_audit_logs` | Audit |
| `vd_benchmarks` | Benchmark |

**Không** DDL đầy đủ ở spec này (BA §11.3). Plan tiếp theo: `postgresql-ddl-vd-sop-s1.sql`.

Quan hệ: Client 1—n Project 1—1 Brief; Project 1—n Script 1—n Shot 1—n Prompt 1—n Asset — đúng BA §5.2.

Object storage path đúng BA §4.4. Tên file SOP chỉ khi **Editor Package**.

---

## 9. Kiến trúc thành phần (Nest)

```
services/ptt-crm-api/src/video-sop/
  video-sop.module.ts
  project/  script/  shot/  bible/  prompt/
  asset/    render/  post/  gate/   cost/
  review/   report/  admin/
  adapters/
    i-text-gen.ts      → openai
    i-image-gen.ts     → leonardo
    i-video-gen.ts     → kling · runway
    i-enhance.ts       → topaz
    i-media-ops.ts     → ffmpeg probe/proxy/loudness/zip
  orchestration/
    dispatcher · webhook · poller · dag · model-router
  rules/
    stage.guard.ts · feasibility.engine.ts · qc-auto.ts
```

L3 không import tên Kling. Router đọc `vd_models.capability_json` (BA §4.2.2–4.2.3).

Queue logic: `q.text` · `q.image` · `q.video.kling` · `q.video.runway` · `q.enhance` · `q.media` · `q.notify`.

---

## 10. API (nhóm — OpenAPI ở bước sau)

Base: `/api/v1/vd`

| Nhóm | Prefix | FR |
|------|--------|-----|
| Projects | `/projects` | UC-01 |
| Brief | `/projects/:id/brief` | FR-7.1 |
| Ideas/Script | `/projects/:id/ideas` `/scripts` | FR-7.2 |
| Shots/Prompts | `/scripts/:id/shots` | FR-7.2.4–5 |
| Bibles | `/projects/:id/bibles` | FR-7.3 |
| Assets/Jobs | `/shots/:id/jobs` `/assets` | FR-7.4–7.5 |
| Gates | `/projects/:id/gates/:n` | FR-7.7 |
| Cost | `/projects/:id/budget` `/costs` | FR-7.8 |
| Library | `/assets/search` | FR-7.9 |
| Review | `/review-links` public `/public/vd/review/:token` | FR-7.10 |
| Admin | `/admin/providers` `/admin/models` `/admin/templates` | FR-7.11 |
| Reports | `/reports/production` | FR-7.12 |

Idempotency: header `Idempotency-Key` = `job_id` khi submit render.

---

## 11. Giao diện — 16 màn (BA §7) → route

| Mã | Màn | Route RNOSAI | Vai |
|----|-----|--------------|-----|
| SC-01 | Project list | `/crm/video` | Tất cả có `crm_vd.project.view` |
| SC-02 | Overview | `/crm/video/[id]` | AM, PM |
| SC-03 | Brief | `/crm/video/[id]/brief` | AM |
| SC-04 | Script Studio | `/crm/video/[id]/script` | Copywriter |
| SC-05 | Bible | `/crm/video/[id]/bible` | Art Director |
| SC-06 | Keyframe Workbench | `/crm/video/[id]/keyframes` | AI Artist, AD |
| SC-07 | Render Console | `/crm/video/[id]/render` | Motion |
| SC-08 | Take Compare | `/crm/video/[id]/takes?shot=` | Motion, QC |
| SC-09 | Post Pipeline | `/crm/video/[id]/post` | Editor |
| SC-10 | Gate Review | `/crm/video/[id]/gates/[n]` | Approver |
| SC-11 | Cost | `/crm/video/[id]/cost` | PM |
| SC-12 | Asset Library | `/crm/video/[id]/library` | AI Artist |
| SC-13 | Delivery | `/crm/video/[id]/delivery` | Editor, AM |
| SC-14 | Client portal | `/portal/video-review/[token]` | Client |
| SC-15 | Admin provider | `/admin/video/providers` | Admin |
| SC-16 | Dashboard | `/crm/video/dashboard` | PM, Lead |

Sidebar: **Video SOP** dưới Nhân sự / hoặc nhóm Sản xuất — chỉ hiện nếu cap `crm_vd.*.view`.

Deep link lifecycle: `/crm/service-delivery/:lid?tab=video-sop` = SC-01 filter `lifecycle_id`.

### 11.1. Luật UI (từ BA story)

- SC-04: 3 cột template | LLM structured | shotlist; badge feasibility trên shot.  
- SC-06: trái shots · giữa grid 4 + zoom 200% + seed · phải Gate 2.  
- SC-07: hiện **credit ước tính** trước submit; xác nhận nếu > ngưỡng.  
- SC-08: 2–4 player sync, 0.25×, form artifact.  
- SC-10: auto-check điền sẵn; Approve / Reject / Override.  
- SC-14: watermark tên + thời gian; không tài khoản CRM.

---

## 12. FR / NFR

Toàn bộ **FR-7.1…7.12** và **NFR-7.1…7.16** của BA là yêu cầu module này. Không cắt.

NFR hàng đợi 200 job: v1.0 staging chấp nhận thấp hơn; AC load = S10. p95 UI 300ms giữ.

---

## 13. Cost & ngân sách

- `buffer_factor` mặc định **1,5** (BA 7.8.4). SOP overshoot 2,5× dùng khi **ước shot × take** — PM có thể set 2.5 trên Budget.  
- Cảnh báo 70% / 90% / 100%.  
- Đóng project → CSV/Excel đẩy M4 (không API MISA).  
- AC-04: lệch ≤2% vs dashboard provider.

---

## 14. Client portal

- Magic link, TTL ≤14 ngày (BR-14).  
- Scope `asset_ids[]`.  
- Comment `timecode_ms` (clip) / `pin_x,y` (ảnh).  
- Approve / Request changes → Gate 1 (shotlist snapshot) hoặc Gate 4 (master) tùy `review_links.gate_no`.  
- RLS: token hết hạn → 403 (AC-09).

---

## 15. Lộ trình sprint (2 tuần) — map RNOSAI

| Sprint | BA | RNOSAI deliverable |
|--------|-----|-------------------|
| **S1** | Schema, provider CRUD | DDL `vd_*`, module Nest, SC-01/02 rỗng, audit |
| **S2** | Job engine + 1 image adapter | Leonardo **hoặc** Flux-as-IImageGen nếu chưa có key Leonardo |
| **S3** | Brief + Script + feasibility | SC-03, SC-04, FR-R01…10, M6 insight picker |
| **S4** | Keyframe workbench | SC-05, SC-06, lineage |
| **S5** | Gate 1–2 | SC-10, StageGuard tests |
| **S6** | Kling + Runway + take compare | SC-07, SC-08, BR-07/08 |
| **S7** | Cost ledger | SC-11 |
| **S8** | DAG post + FFmpeg ops + Topaz | SC-09, QC auto |
| **S9** | Editor package + portal | SC-13, SC-14 |
| **S10** | Dashboard + E2E 30s / 7 shot | SC-16, AC-11 |

**Không** đợi Social FFmpeg xong — chỉ cần kernel storage/signed URL nếu đã có; S1 tự có storage facade.

---

## 16. Acceptance (AC-01…12 + Dual)

Toàn bộ AC-01…12 BA. Thêm:

| ID | Tiêu chí |
|----|----------|
| AC-R1 | Job `social_*` không tồn tại trong `vd_jobs` |
| AC-R2 | `/crm/video` ẩn khi thiếu `crm_vd.project.view` |
| AC-R3 | Stage `animating` không tạo được nếu Gate 2 ≠ approved (API test) |
| AC-R4 | Picker Content OS “Video chiến dịch” tạo `vd_projects` row |

KPI mục tiêu = BA §10.3 (pass KF ≥60%, clip ≥40%, take/shot ≤3, credit ≤1.2, vòng KH ≤2, lead ≤3 ngày, override ≤5%).

---

## 17. Rủi ro

RK-01…10 giữ nguyên BA. Runbook 6 tình huống: provider down, hết credit, webhook chết, DAG treo, storage đầy, model deprecated.

---

## 18. Việc **không** làm trong spec này (BA §11.3)

1. DDL + RLS chi tiết  
2. OpenAPI đầy đủ  
3. Adapter spec từng vendor (payload)  
4. Bộ Prompt Template 5 loại video PTT  
5. Test plan / load test  
6. Runbook vận hành dài  

Các mục đó = tài liệu con khi vào sprint tương ứng.

---

## 19. Files chạm khi implement S1

- `services/ptt-crm-api/src/video-sop/**` (mới)  
- `services/ops-web/src/app/crm/video/**` (mới)  
- `services/portal-web/src/app/video-review/[token]` (S9)  
- `docs/specs/postgresql-ddl-vd-sop-s1.sql`  
- Caps seed `crm_vd.*`  
- Sidebar + `docs/huong-dan-su-dung/19-video-sop.md` (khi S3+)  

---

## 20. Changelog

| Ver | Ngày | Nội dung |
|-----|------|----------|
| 1.0 | 2026-08-20 | Thiết kế Module 7 trên RNOSAI theo PTT-SA-M7-VIDEO; tách Social FFmpeg |
