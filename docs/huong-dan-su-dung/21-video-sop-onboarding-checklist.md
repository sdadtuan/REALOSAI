# Checklist onboarding — Video SOP Studio (Module 7)

> **Phiên bản:** S14 · **Cập nhật:** 2026-08-21  
> **Đối tượng:** AM · Motion · IT/Ops  
> **Tài liệu đầy đủ:** [20-video-sop-huong-dan-day-du.md](./20-video-sop-huong-dan-day-du.md)  
> **Runbook:** [19-video-sop-runbook.md](./19-video-sop-runbook.md)

Checklist theo **vai trò** — tick từng mục khi hoàn thành. Mỗi role có: chuẩn bị trước ngày 1 → ngày 1 → tuần 1 → bàn giao sprint đầu.

---

## Mục lục

1. [Bản đồ phối hợp 3 role](#1-bản-đồ-phối-hợp-3-role)
2. [AM — Account Manager](#2-am--account-manager)
3. [Motion — Motion / Video Artist](#3-motion--motion--video-artist)
4. [IT — IT / Ops / Platform](#4-it--it--ops--platform)
5. [Cap gợi ý theo role (Admin cấp quyền)](#5-cap-gợi-ý-theo-role-admin-cấp-quyền)

---

## 1. Bản đồ phối hợp 3 role

```
AM                          Motion                         IT
│                           │                              │
├─ Lock studio SOP          ├─ Bible / Keyframe            ├─ Flag + env + deploy
├─ Brief 8 nhóm             ├─ Gate 2 (keyframes)        ├─ API keys + webhook
├─ Budget SC-11             ├─ Render draft/final        ├─ Smoke / health
├─ Gate 1 (shotlist) *      ├─ Takes + Gate 3            ├─ Admin providers
├─ Gate 4 + Delivery        ├─ Post enqueue (hỗ trợ)     └─ Runbook on-call
├─ Portal review link       └─ QC kỹ thuật take
└─ Dashboard KPI

* Gate 1 thường AM/Copy lead — Motion tham gia review shotlist
```

| Giai đoạn pipeline | Owner chính | Hỗ trợ |
|--------------------|-------------|--------|
| Khởi tạo project | AM | IT (flag/cap) |
| Brief → Script | AM + Copy | — |
| Bible → Keyframe | Motion / Art | AM (brief) |
| Gate 1 | AM / Copy lead | Motion |
| Gate 2 | Motion / Art lead | AM |
| Render + Takes | Motion | AM (budget) |
| Gate 3 | Motion lead | AM |
| Cost / budget | AM | IT (nếu auth fail) |
| Post pipeline | Motion / Editor | IT (Topaz key) |
| Gate 4 + Delivery | AM | Motion (QC kỹ thuật) |
| Hạ tầng | IT | AM (UAT) |

---

## 2. AM — Account Manager

**Mục tiêu onboarding:** Tự mở project cinematic, quản budget, duyệt gate phía khách hàng, bàn giao portal — **không** cần chạy render motion.

### 2.1. Cap & truy cập cần có

- [ ] Đăng nhập ops-web: https://rs.pttads.vn
- [ ] Cap tối thiểu: `crm_vd.project` **view** + **edit** (hoặc `crm_content` **write**)
- [ ] Cap khuyến nghị thêm: `crm_vd.budget` **edit**, `crm_vd.gate1` **approve**, `crm_vd.qc` **edit**, `crm_content` **view**
- [ ] Thấy menu **Video SOP** trên sidebar CRM
- [ ] Picker **Video chiến dịch (SOP)** **không** bị disabled trên Content Board

*Nếu thiếu cap → nhờ Admin/IT mục [§5](#5-cap-gợi-ý-theo-role-admin-cấp-quyền).*

### 2.2. Ngày 1 — Làm quen UI (≈ 60 phút)

**Đọc nhanh (15 phút)**

- [ ] [§1 Hai studio](./20-video-sop-huong-dan-day-du.md#1-tổng-quan--hai-studio) — phân biệt FFmpeg vs SOP
- [ ] Wireframe: [01 picker](./assets/video-sop/01-content-board-picker.svg) · [02 hub](./assets/video-sop/02-hub-list.svg) · [11 cost](./assets/video-sop/11-cost.svg) · [13 delivery](./assets/video-sop/13-delivery.svg)

**Thao tác thử trên lifecycle test (45 phút)**

- [ ] Mở `/crm/service-delivery/{lifecycle_id}?tab=content-os`
- [ ] Chọn item video có copy **approved_internal**
- [ ] Tab **Media AI** → bấm **Video chiến dịch (SOP)** → xác nhận tạo project
- [ ] Mở hub `/crm/video?lifecycle_id={id}` — thấy project mới
- [ ] Mở overview `/crm/video/{id}` — đọc **stage**, bảng **Jobs**, link nhanh
- [ ] Mở **Brief** → điền 8 nhóm → **Lưu brief** → **Đánh dấu brief sẵn sàng**
- [ ] Mở **Cost** → xem `estimated_total` / `actual_total` → thử **Lưu budget** (`limit_amount`)
- [ ] Mở **Dashboard** `/crm/video/dashboard?lifecycle_id={id}` — đọc 7 KPI

### 2.3. Tuần 1 — Vận hành project thật

**Khởi tạo & brief**

- [ ] Lock studio SOP **trước** khi team chạy job (không đổi studio sau job đầu)
- [ ] Brief đủ 8 nhóm; `insight_ids` để trống nếu chưa có M6
- [ ] Chuyển Copy/Art: brief_ready → script (handoff Slack/ops)

**Budget (BR-06)**

- [ ] Set `limit_amount` + `buffer_factor` trên **Cost SC-11** trước render motion
- [ ] Theo dõi `warn70` / `warn90` — tăng budget trước khi Motion enqueue final
- [ ] Biết xử lý lỗi UI `budget_exceeded` (tăng limit → **Lưu budget**)

**Gate & duyệt**

- [ ] **Gate 1** `/gates/1`: checklist ✓ → **Approve** (shotlist immutable sau approve)
- [ ] Phối hợp Motion **Gate 2** — AM không duyệt keyframe nếu chưa có cap `gate2`
- [ ] **Gate 4** `/gates/4`: QC auto pass → **Approve** → stage `delivered`
- [ ] Biết **Reject** + lý do và **Override** (lý do ≥ 10 ký tự) khi PM cho phép

**Bàn giao khách**

- [ ] **Delivery SC-13** → **Tạo editor package**
- [ ] Điền đúng `contains_human` / `ai_disclosure` trên package
- [ ] **Tạo portal review link (14 ngày)** — gửi link portal cho khách
- [ ] Theo dõi vòng client rounds trên Dashboard

**Đóng project**

- [ ] Project **archived** hoặc **cancelled**
- [ ] **Cost** → **Tải export.xlsx** cho kế toán

### 2.4. Sprint đầu — Sign-off AM

- [ ] Hoàn thành ≥ 1 project end-to-end (lock studio → portal link)
- [ ] Không nhầm studio FFmpeg vs SOP
- [ ] Budget không vượt limit không báo trước
- [ ] Biết escalate IT: job `auth`, module tắt, picker disabled

**Escalate IT khi:** *Module tắt* · picker SOP xám · job failed `auth` · hub trống dù đã lock studio.

---

## 3. Motion — Motion / Video Artist

**Mục tiêu onboarding:** Tự chạy bible → keyframe → render → takes → post — hiểu draft (Runway) vs final (Kling).

### 3.1. Cap & truy cập cần có

- [ ] Cap tối thiểu: `crm_vd.project` **view**, `crm_vd.bible` **edit**, `crm_vd.keyframe` **edit**, `crm_vd.motion` **edit**
- [ ] Cap khuyến nghị: `crm_vd.gate2` **approve**, `crm_vd.gate3` **approve**, `crm_vd.post` **edit**, `crm_vd.script` **view** (hoặc edit nếu chỉnh shotlist)
- [ ] Truy cập overview + Keyframes + Render + Takes + Post

### 3.2. Ngày 1 — Làm quen UI (≈ 90 phút)

**Đọc nhanh (20 phút)**

- [ ] [§6 Quản lý Image](./20-video-sop-huong-dan-day-du.md#6-quản-lý-image-chi-tiết) + [§7 Video nguồn](./20-video-sop-huong-dan-day-du.md#7-video-từ-tất-cả-nguồn)
- [ ] Wireframe: [06 bible](./assets/video-sop/06-bible.svg) · [07 keyframes](./assets/video-sop/07-keyframes.svg) · [09 render](./assets/video-sop/09-render.svg) · [10 takes](./assets/video-sop/10-takes.svg) · [12 post](./assets/video-sop/12-post.svg)

**Thao tác thử trên project test (70 phút)**

- [ ] **Bible SC-05** → **Lưu style** + **Thêm nhân vật** → **Lưu characters** (`{{lock:face}}` nếu cần)
- [ ] **Script SC-04** — xác nhận shotlist đã có (AM/Copy); nếu thiếu shot → phối hợp thêm
- [ ] **Keyframes SC-06** → chọn shot → **Tạo keyframe cho shot** → chờ job `succeeded` trên overview
- [ ] **Gate 2** → checklist ✓ → **Approve** (hoặc nhờ lead có cap gate2)
- [ ] **Render SC-07** → chọn shot → **Enqueue draft motion** (Runway)
- [ ] **Takes SC-08** → xem 0.25x → **Ghi score** `passed` → **Chọn take (clip_selected)**
- [ ] **Render** → **Enqueue final motion** (Kling via Leonardo) — sau draft passed
- [ ] **Gate 3** → Approve khi ≥1 shot `clip_selected`
- [ ] **Post SC-09** → **Enqueue cine_compose** → theo dõi DAG node

### 3.3. Tuần 1 — Quy trình sản xuất

**Pre-flight (mỗi project)**

- [ ] Xác nhận AM đã **Gate 1** approved (shotlist locked)
- [ ] Xác nhận budget còn headroom trên **Cost** (hỏi AM nếu `warn90`)
- [ ] Overview: không có job failed `auth` (thiếu Leonardo/Runway key → báo IT)

**Image / keyframe**

- [ ] Bible khớp brief (palette, lens, lock region)
- [ ] Mỗi shot: ≥1 keyframe `succeeded` trước Gate 2
- [ ] Retry keyframe: chọn shot khác seed / enqueue lại (idempotency tự sinh trên UI)

**Motion draft → final**

- [ ] Luôn **draft** (Runway) trước **final** (Kling) — BR-07
- [ ] Render: tick **Xác nhận vượt ngưỡng budget** khi `needs_confirm`
- [ ] Takes: tối đa 5 fail liên tiếp/shot (BR-08) — đổi prompt/brief thay vì spam enqueue

**Gate 3 → Post**

- [ ] Mọi shot cần thiết có `clip_selected`
- [ ] Post: node Topaz `skipped` là bình thường nếu IT chưa cấp Topaz key
- [ ] Báo AM khi Gate 4 auto **blocked** + lý do trên Post SC-09

### 3.4. Sprint đầu — Sign-off Motion

- [ ] Hoàn thành ≥1 shot: keyframe → draft take passed → final take → clip_selected
- [ ] Phân biệt được job `cine_motion_draft` vs `cine_motion_final` trên overview
- [ ] Biết đọc `model_key` trên job (Runway vs Kling)
- [ ] Không enqueue final khi chưa có draft passed

**Escalate IT khi:** keyframe/motion kẹt `running` > 30 phút · webhook Leonardo · lỗi `not_ready` lặp · Topaz saga treo.

**Escalate AM khi:** `budget_exceeded` · cần Override gate · thay shotlist sau Gate 1.

---

## 4. IT — IT / Ops / Platform

**Mục tiêu onboarding:** Bật module, cấu hình provider, deploy, smoke, hỗ trợ on-call — **không** cần sản xuất creative.

### 4.1. Quyền & môi trường

- [ ] SSH VPS `deploy@rs.pttads.vn` · root repo `/var/www/rnosai`
- [ ] Truy cập sửa `.env` (API keys — **không** commit git)
- [ ] Cap admin: `crm_vd.admin` hoặc `ai_admin` (xem `/admin/video/providers`)
- [ ] Quyền `sudo systemctl restart ptt-crm-api` và `deploy_ops_web.sh --restart`

### 4.2. Ngày 1 — Bật module (≈ 2 giờ)

**Env bắt buộc — kiểm tra từng dòng**

- [ ] `PTT_CMKT_VIDEO_CINEMATIC=1` (API)
- [ ] `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1` (build ops-web)
- [ ] `DATABASE_URL` trỏ PG có bảng `vd_*`
- [ ] `OPENAI_API_KEY`
- [ ] `PTT_VD_LEONARDO_API_KEY`
- [ ] `PTT_VD_RUNWAY_API_KEY`
- [ ] `PTT_VD_LEONARDO_WEBHOOK_KEY` (production)
- [ ] `PTT_VD_TOPAZ_API_KEY` (tùy chọn — post skip nếu thiếu)
- [ ] `REPLICATE_API_TOKEN` (fallback Flux — staging)

**DDL & deploy**

- [ ] `bash scripts/apply_pg_ddl_vd_sop_s2.sh`
- [ ] `bash scripts/apply_pg_ddl_vd_sop_s11.sh`
- [ ] `APPLY=1 bash scripts/deploy_video_sop_s14_vps.sh`
- [ ] Nếu `WARN ops-web restart skipped` → `sudo /var/www/rnosai/scripts/deploy_ops_web.sh --restart`

**Webhook Leonardo**

- [ ] URL: `POST https://rs.pttads.vn/api/v1/vd/webhooks/leonardo`
- [ ] Header: `authorization: Bearer <PTT_VD_LEONARDO_WEBHOOK_KEY>`

**Smoke (local hoặc VPS)**

- [ ] `curl -sf http://127.0.0.1:3000/health` (hoặc URL public)
- [ ] `bash scripts/smoke_video_sop_s14.sh`
- [ ] `bash scripts/smoke_video_sop_s13.sh`
- [ ] `bash scripts/smoke_video_sop_dual.sh`

**UI xác nhận**

- [ ] `/crm/video` — không hiện *Module tắt*
- [ ] Content Board picker **Video chiến dịch (SOP)** enabled
- [ ] `/admin/video/providers` — 8 `model_key`, cột `verified_at` có giá trị

### 4.3. Tuần 1 — Vận hành & cấp quyền

**Cấp cap cho AM / Motion**

- [ ] AM: mục [§5 AM](#51-am--account-manager)
- [ ] Motion: mục [§5 Motion](#52-motion--motion--video-artist)
- [ ] Xác nhận user test đăng nhập thấy đúng menu

**Monitoring nhẹ**

- [ ] `journalctl -u ptt-crm-api -n 50 | rg -i 'VdPoller|leonardo|runway'`
- [ ] Disk `/var/www/rnosai` — alert nếu >85%
- [ ] Biết runbook: [19-video-sop-runbook.md](./19-video-sop-runbook.md)

**Staging vs production**

- [ ] Staging có thể dùng `PTT_VD_PROVIDER_STUB=1` + `VD_E2E_PROVIDERS=1` cho E2E
- [ ] Production **tắt** stub; keys live

### 4.4. Sprint đầu — Sign-off IT

- [ ] Smoke S14 + dual xanh trên VPS
- [ ] AM + Motion onboarding xong project test
- [ ] Runbook 6 sự cố đã đọc; biết restart API khi poller chết
- [ ] Không lưu API key trong DB / ticket công khai

**Handover on-call:** runbook §1 provider down · §3 poller · §5 storage · link [§11 sự cố](./20-video-sop-huong-dan-day-du.md#11-xử-lý-sự-cố-thường-gặp).

---

## 5. Cap gợi ý theo role (Admin cấp quyền)

Admin cấp trên ops-web (**Quản trị → RBAC**) hoặc theo template role có sẵn.

### 5.1. AM — Account Manager

| Cap | Action | Lý do |
|-----|--------|-------|
| `crm_vd.project` | view, edit, create | Hub, brief, overview, lock studio |
| `crm_vd.budget` | edit | Cost SC-11 |
| `crm_vd.gate1` | approve | Duyệt shotlist |
| `crm_vd.qc` | edit | Gate 4 + portal review link |
| `crm_content` | view, write | Content Board + fallback write |
| `crm_vd.project` | view | Dashboard SC-16 |

*Không bắt buộc:* `crm_vd.motion`, `crm_vd.keyframe` (để Motion owner).

### 5.2. Motion — Motion / Video Artist

| Cap | Action | Lý do |
|-----|--------|-------|
| `crm_vd.project` | view | Overview, theo dõi job |
| `crm_vd.script` | edit *(hoặc view)* | Đọc/chỉnh shotlist |
| `crm_vd.bible` | edit | Bible SC-05 |
| `crm_vd.keyframe` | edit | Keyframes SC-06 |
| `crm_vd.motion` | edit | Render + Takes |
| `crm_vd.gate2` | approve | Duyệt keyframe |
| `crm_vd.gate3` | approve | Duyệt takes |
| `crm_vd.post` | edit | Post SC-09 |
| `crm_content` | view | Xem Content Board |

*Tuỳ tổ chức:* Gate 2/3 có thể gán Creative Lead thay Motion junior.

### 5.3. IT — IT / Ops

| Cap | Action | Lý do |
|-----|--------|-------|
| `crm_vd.admin` | view, create | `/admin/video/providers` |
| `ai_admin` | view | Fallback admin AI |
| `crm_vd.project` | view | UAT smoke trên UI |
| `crm_content` | view | Kiểm tra dual studio picker |

*Không cần* cap creative (`keyframe`, `motion`) trừ khi IT tự UAT full pipeline.

---

## Phụ lục — Checklist nhanh 1 trang (in/PDF)

### AM — 10 mục must-do mỗi project

1. [ ] Lock **Video chiến dịch (SOP)** trên Content Board  
2. [ ] Brief 8 nhóm → **Đánh dấu brief sẵn sàng**  
3. [ ] Set budget **Cost SC-11**  
4. [ ] **Gate 1** Approve shotlist  
5. [ ] Theo dõi Gate 2/3 (Motion)  
6. [ ] Xử lý `budget_exceeded` nếu có  
7. [ ] **Gate 4** Approve  
8. [ ] **Tạo editor package** + portal link  
9. [ ] Dashboard KPI cuối project  
10. [ ] Export xlsx khi archived  

### Motion — 10 mục must-do mỗi project

1. [ ] **Bible** style + characters  
2. [ ] Keyframe mọi shot → **Gate 2**  
3. [ ] **Enqueue draft motion** (Runway)  
4. [ ] **Takes** passed + **clip_selected**  
5. [ ] **Enqueue final motion** (Kling)  
6. [ ] **Gate 3** Approve  
7. [ ] **Post** enqueue compose  
8. [ ] Báo AM nếu Gate 4 auto blocked  
9. [ ] Không vượt 5 fail/shot (BR-08)  
10. [ ] Handoff package metadata cho AM  

### IT — 10 mục must-do mỗi môi trường

1. [ ] Flag cinematic API + UI  
2. [ ] DDL S2 + S11 applied  
3. [ ] API keys đủ (OpenAI, Leonardo, Runway)  
4. [ ] Webhook Leonardo  
5. [ ] Deploy S14 + restart ops-web  
6. [ ] Smoke S14 + dual PASS  
7. [ ] Admin 8 model_key  
8. [ ] Cap AM + Motion  
9. [ ] Runbook bookmark  
10. [ ] Không commit secrets  

---

*Liên kết: [20-video-sop-huong-dan-day-du.md](./20-video-sop-huong-dan-day-du.md) · [19-video-sop-runbook.md](./19-video-sop-runbook.md) · [README huong-dan](./README.md)*
