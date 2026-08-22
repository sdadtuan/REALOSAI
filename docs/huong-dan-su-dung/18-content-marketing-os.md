# Hướng dẫn — Content Marketing OS (đầy đủ)

> **Module:** MOD-CMKT · **Phiên bản:** P0–P2 + M7–M16  
> **Đối tượng:** SP Content, Lead SP, QA, AM, Designer, Khách hàng (portal)  
> **URL chính:** `/crm/service-delivery/[id]?tab=content-os`  
> **Use case:** [`docs/use-cases/11-CONTENT-MARKETING.md`](../use-cases/11-CONTENT-MARKETING.md)

Tài liệu này mô tả **toàn bộ phân hệ tạo content** — mọi kênh, AI draft, tạo hình ảnh/carousel, tạo video ngắn, repurpose, bridge SEO/Email — với **hướng dẫn từng bước trên UI**.

*(Bản tóm tắt nhanh: [`10-content-marketing.md`](./10-content-marketing.md))*

---

## 1. Giới thiệu

**Content Marketing OS** nằm trong **lifecycle triển khai dịch vụ** (`service-delivery`), quản lý luồng:

```
AI Planner (TMMT) → Idea bank → Content item → AI draft → Review → Calendar → Publish
                                                      ↓
                                              Media AI (ảnh / carousel / video)
                                                      ↓
                                              Repurpose đa kênh · Bridge SEO · Bridge Email
```

**Nguyên tắc vận hành:**

| Quy tắc | Mô tả |
|---------|-------|
| **BR-AI-01** | AI chỉ sinh draft — **human publish** (không auto-post FB/Zalo/OA) |
| **BR-CMKT-01** | Không `published` khi chưa `approved_internal` |
| **BR-CMKT-03** | Từ chối bắt buộc comment ≥ 10 ký tự |
| **BR-CMKT-06** | Media AI chạy sau khi copy `approved_internal` (carousel draft có watermark ngoại lệ) |
| **BR-CMKT-08** | Item cần visual → `visual_status=approved` trước publish |

**Pilot mặc định:** slug dịch vụ `tiep-thi-noi-dung` trong allowlist.

---

## 2. Thiết lập môi trường (IT / DevOps)

### 2.1. Feature flags

| Biến | Giá trị khuyến nghị | Mô tả |
|------|---------------------|-------|
| `PTT_CONTENT_MARKETING_ENABLED` | `1` | Bật module backend |
| `PTT_CONTENT_MARKETING_FE` | `1` | Gate BE cho ops-web |
| `NEXT_PUBLIC_CONTENT_MARKETING` | `1` | Hiện tab **Content Board** trên ops-web |
| `PTT_CONTENT_MARKETING_SLUGS` | `tiep-thi-noi-dung` | Slug dịch vụ pilot (phân cách dấu phẩy nếu nhiều) |
| `PTT_CONTENT_MARKETING_AI_ENABLED` | `1` | AI draft, variants, repurpose, bulk ideas |
| `PTT_CONTENT_MARKETING_APPROVAL_REQUIRED` | `1` | Bắt buộc workflow duyệt |
| `PTT_CONTENT_MARKETING_MEDIA_ENABLED` | `1` | Tab Media AI |
| `PTT_CMKT_IMAGE_GEN` | `1` | Generate image / carousel |
| `PTT_CMKT_VIDEO_GEN` | `1` | Generate short video |
| `PTT_CMKT_VIDEO_PROVIDER` | `ffmpeg` | Provider stitch MP4 (staging/prod); `stub` chỉ unit test |
| `PTT_CMKT_VIDEO_SOCIAL` | `1` | Bật studio **Video tuần (FFmpeg)** |
| `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP` | `3` | Cap job social/video_short/ngày/lifecycle |
| `PTT_CMKT_VIDEO_ONE_SHOT` | `1` | UAT: nút **Tạo nhanh** one-shot; GA lật `0` |
| `PTT_CONTENT_MARKETING_CLIENT_GATE` | `1` | Cột Chờ KH / KH OK trên board |
| `PTT_CMKT_PORTAL_SUMMARY` | `1` | API tóm tắt cho portal |
| `NEXT_PUBLIC_CMKT_PORTAL_SUMMARY` | `1` | Card Content trên portal dashboard |
| `PTT_CMKT_BRIEF_GATE` | `1` | Bắt audience/goal trước AI generate |
| `PTT_CMKT_WEEKLY_MEMO` | `1` | Weekly memo (Intelligence) |
| `PTT_CMKT_EXTERNAL_METRICS` | `1` | Metrics ngoài trong Intelligence |

### 2.2. Provider media (ảnh / video)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `PTT_CMKT_IMAGE_PROVIDER` | `stub` | `replicate` / `flux` trên prod |
| `PTT_CMKT_IMAGE_MODEL` | `black-forest-labs/flux-schnell` | Model image |
| `PTT_CMKT_VIDEO_PROVIDER` | `ffmpeg` | Pipeline video ngắn — FFmpeg stitch MP4 thật |
| `PTT_CMKT_TTS_PROVIDER` | `stub` | Text-to-speech cho video |
| `PTT_CMKT_TTS_VOICE` | `alloy` | Giọng đọc |
| `PTT_CMKT_STOCK_PROVIDER` | `stub` | Stock footage |
| `PTT_CMKT_CDN_BASE` | `https://cdn.pttads.vn/cmkt` | CDN asset |
| `PTT_CMKT_S3_BUCKET` | *(empty)* | Bucket lưu asset |
| `REPLICATE_API_TOKEN` | — | Token Replicate (prod) |
| `PTT_CMKT_MEDIA_DAILY_CAP_PER_LIFECYCLE` | `20` | Cap job media/ngày/lifecycle |

### 2.3. Apply DDL & deploy

```bash
# Apply schema Content Marketing
bash scripts/apply_pg_ddl_content_marketing.sh
# hoặc: psql "$DATABASE_URL" -f docs/specs/2026-08-09-postgresql-ddl-content-marketing.sql

# Deploy staging/UAT (bật flags + build API + ops-web)
APPLY=1 bash scripts/deploy_content_marketing_staging.sh
```

**Smoke test theo phase:**

```bash
bash scripts/smoke_content_marketing_m0.sh    # context + flags
bash scripts/smoke_content_marketing_p0.sh    # P0 core workflow
bash scripts/smoke_content_marketing_p1.sh    # repurpose + bridges
bash scripts/smoke_content_marketing_p2_media.sh  # Media AI
bash scripts/smoke_content_marketing_video_social_v1.sh  # Social video FFmpeg V1
SMOKE_SKIP_FFMPEG=1 bash scripts/smoke_content_marketing_video_social_v1.sh  # CI không có ffmpeg
bash scripts/run_content_marketing_uat.sh     # UAT runner
```

### 2.4. Phân quyền RBAC (caps)

| Cap | Vai trò | Chức năng UI |
|-----|---------|--------------|
| `crm_content.view` | SP, QA, AM | Xem tab Content Board |
| `crm_content.write` | SP Content | Tạo/sửa idea, item, comment, brief |
| `crm_content.generate` | SP Content | AI draft, media jobs, repurpose |
| `crm_content.approve_internal` hoặc `crm_content.qa` | QA, Lead | Duyệt/từ chối copy + visual |
| `crm_content.publish` | SP, Lead | Mark published, copy caption |
| `crm_content.production` | Lead, Designer | Production phase, export, escalate |
| `crm_content.assign` | Lead | Phân công SP/QA |

**Thêm:** hầu hết thao tác write/generate cần `crm_board.edit` trên lifecycle.

---

## 3. Truy cập & điều hướng

### 3.1. Mở Content Board

1. Đăng nhập https://rs.pttads.vn
2. Sidebar → **Triển khai DV** (hoặc tìm lifecycle khách)
3. Mở `/crm/service-delivery/[lifecycle_id]`
4. Bấm tab **Content Board** (`?tab=content-os`)

**Tab ẩn khi:** flag tắt, slug không trong allowlist, hoặc thiếu `crm_content.view`.

### 3.2. Sub-navigation (thanh view)

Sau khi vào Content Board, dùng các nút:

| Nút | URL param | Mô tả |
|-----|-----------|-------|
| **Tổng quan** | `view=overview` | KPI + quick actions |
| **Ideas** | `view=ideas` | Idea bank |
| **Pillars** | `view=pillars` | Content pillars |
| **Board** | `view=board` | Kanban workflow |
| **Review** | `view=review` | Hàng đợi duyệt copy + visual |
| **Calendar** | `view=calendar` | Lịch publish tuần |
| **Repurpose** | `view=repurpose` | Wizard tái sử dụng blog |
| **Audit** | `view=audit` | Nhật ký AI + chỉnh sửa |
| **Intelligence** | `view=intelligence` | Metrics, memo, gợi ý topic |

**Deep link item:** `?tab=content-os&view=board&id=123` — mở drawer item #123.

### 3.3. Banner Planner (luôn hiển thị trên cùng)

**⚡ Kế hoạch Planner** — trạng thái:

- `Chưa import Planner`
- `draft · TMMT #N` — đã import, chưa seal
- `sealed · TMMT #N` — đã khóa snapshot

Cảnh báo **⚠ Planner đã đổi** khi TMMT trên AI Planner khác snapshot đã import.

---

## 4. Ma trận kênh & format

Mọi content item gắn **1 channel + 1 format** (cặp hợp lệ):

| Kênh | Format | Nhãn UI |
|------|--------|---------|
| Website | Blog | Website — Blog |
| Facebook | Bài viết | Facebook — Bài viết |
| Facebook | Carousel | Facebook — Carousel |
| LinkedIn | Bài viết | LinkedIn — Bài viết |
| LinkedIn | Carousel | LinkedIn — Carousel |
| Short video | Script | Short video — Script |
| YouTube | Script | YouTube — Script |
| Newsletter | Email | Newsletter — Email |
| Drip | Email | Drip — Email |
| Zalo OA | Bài viết | Zalo OA — Bài viết |
| Meta Ads | Ad copy | Meta Ads — Ad copy |
| Google Ads | Ad copy | Google Ads — Ad copy |
| Document | Blog | Document — Blog |

**Cần visual approval:** format `carousel`, `video_script`, hoặc brief `needs_visual=true`.

**Convert nhanh từ Ideas (P0):** Website/Blog, Facebook bài + carousel, LinkedIn bài + carousel.

---

## 5. Nguồn dữ liệu content

| Nguồn | Cách vào hệ thống | UI |
|-------|-------------------|-----|
| **AI Planner (TMMT)** | Apply TMMT → Import snapshot | Banner Planner, tab Ideas |
| **Idea thủ công** | Nhập tiêu đề → Thêm idea | Tab Ideas |
| **AI bulk ideas** | Job 30 ideas/tháng | Tab Ideas — **AI 30 ideas tháng** |
| **Convert idea** | Idea → item theo channel | Tab Ideas — **Convert → item** |
| **Tạo item trực tiếp** | Channel picker modal | Tổng quan — **+ Item** |
| **AI draft** | Generate trên item | Drawer → Body → AI Generate |
| **Repurpose** | Blog approved → derived | Tab Repurpose |
| **Market Research** | Insert insight vào brief | Drawer (panel research) |
| **Bridge SEO** | Blog → pipeline SEO | Drawer → Production |
| **Bridge Email** | Newsletter/Drip → campaign | Drawer → Production |
| **Media AI** | Image/carousel/video jobs | Drawer → Media AI |

---

## 6. Import từ AI Planner

**Điều kiện:** Tab **AI Planner** trên cùng lifecycle đã **Apply TMMT**.

### 6.1. Thủ công trên Content Board

1. Mở Content Board — đọc banner **⚡ Kế hoạch Planner**
2. Nếu hiện *«Chưa có TMMT — Apply AI Planner trước khi import»* → quay lại tab **AI Planner** → Apply
3. Chọn chế độ import:
   - **Merge** — gộp ideas/pillars mới
   - **Replace** — thay thế (archive ideas cũ)
4. Bấm **Import từ Planner**
5. Toast: `Import OK — N ideas, M pillars`
6. Chuyển sang tab **Ideas** để review

### 6.2. Auto-import từ Planner

Sau Apply TMMT, bước cuối AI Planner link tới:

`/crm/service-delivery/[id]?tab=content-os&view=ideas&import=planner`

Hệ thống tự chạy import (nếu có quyền write).

### 6.3. Seal snapshot & drift

1. Sau import ổn định → **Seal snapshot** (khóa baseline)
2. Nếu Planner đổi sau seal → banner **⚠ Planner đã đổi**
3. Bấm **Xem diff** — modal so sánh drift
4. Import lại (Merge/Replace) nếu cần đồng bộ

---

## 7. Tab Ideas — Idea bank

**Route:** `?tab=content-os&view=ideas`

### 7.1. Thêm idea thủ công

1. Nhập **Tiêu đề idea mới**
2. Bấm **Thêm idea**
3. Idea xuất hiện trong danh sách

### 7.2. AI 30 ideas tháng

**Cap:** `crm_content.generate` + flag AI bật

1. Bấm **AI 30 ideas tháng**
2. Job chạy async — đợi toast hoàn tất
3. Refresh danh sách ideas

### 7.3. Convert idea → content item

1. Chọn idea trong list
2. Dropdown channel/format (VD: `Facebook — Bài viết`)
3. Bấm **Convert → item**
4. Drawer item mở — status **Draft**

---

## 8. Tab Pillars — Trụ cột nội dung

**Route:** `?tab=content-os&view=pillars`

1. Xem pillars import từ Planner hoặc tạo mới
2. Thêm/sửa tên pillar, mô tả, thứ tự
3. Ideas có thể gắn pillar (filter trên Ideas)

---

## 9. Tạo content item trực tiếp

**Route:** Tổng quan → **+ Item** (hoặc modal channel picker)

1. Bấm **+ Item** / **Tạo content item**
2. Modal **Tạo content item** — chọn **Kênh** và **Format**
3. Cặp không hợp lệ bị disable
4. Nhập tiêu đề (tuỳ chọn)
5. **Tạo** → item mở trong drawer, status **Draft**

---

## 10. Drawer item — tổng quan tab

Mở item từ Board, Ideas, Calendar, Review, hoặc deep link `&id=`.

| Tab drawer | Nhãn | Nội dung chính |
|------------|------|----------------|
| `body` | **Body** | AI Generate, editor markdown, workflow |
| `variants` | **Variants** | Chọn hook variant |
| `versions` | **Versions** | Lịch sử phiên bản + diff |
| `comments` | **Comments** | QA thread |
| `production` | **Production** | SEO/Email bridge, export, phase |
| `media` | **Media AI** | Image, carousel, video, visual QA |

**Header drawer:** channel/format, status, chip **Text ✓/○** và **Visual ✓/○** (item cần visual).

---

## 11. AI Generate — soạn nội dung text (mọi kênh)

**Vị trí:** Drawer → tab **Body** → panel **AI Generate**

**Cap:** `crm_content.generate` + `PTT_CONTENT_MARKETING_AI_ENABLED=1`

### 11.1. Cấu hình generate

| Field | Tùy chọn |
|-------|----------|
| **Tone** | Professional friendly, Bold, Casual, Formal |
| **Length** | Short, Medium, Long |
| **Goal** | Engagement, Lead, Awareness, Conversion |
| **Variants** | 3 / 4 / 5 (khi generate variants) |

### 11.2. Generate draft

1. Chọn Tone, Length, Goal
2. Bấm **Generate draft**
3. Job polling — khi xong, markdown điền vào editor
4. Sửa tay nếu cần → **Lưu nội dung**

**Gate brief:** Nếu thiếu audience/goal → modal **Bổ sung brief**:

- **Audience / đối tượng**
- **Funnel goal:** Engagement, Lead, Awareness, Conversion
- **Lưu & generate lại**

### 11.3. Generate variants (hook)

1. Bấm **Generate variants**
2. Chuyển tab **Variants** — chọn hook ưa thích
3. **Apply** variant vào body

### 11.4. Regenerate / viết lại

1. Chọn lý do: **Sai tone**, **Quá dài**, **Thiếu CTA**, **Chưa đúng factual**
2. Mode: **Rewrite** / **Refresh**
3. Bấm **Yêu cầu viết lại**
4. Job fail → **Thử lại**

### 11.5. Insert Market Research

Trên drawer (item chưa published): panel **Insert insight** — chọn insight từ Market Research OS → chèn vào brief/body.

---

## 12. Workflow duyệt copy

**Vị trí:** Drawer tab **Body** (nút workflow phía dưới)

### 12.1. SP submit

1. Item status **Draft** hoặc **changes_requested**
2. Bấm **Submit review**
3. Status → **Đang duyệt** (`in_review`)

### 12.2. QA / Lead duyệt

**Cách 1 — Review tab:**

1. `?view=review` → sub-tab **Copy review**
2. Filter **Chỉ SLA breach** (tuỳ chọn)
3. Mỗi dòng: **Mở** / **Duyệt** / **Từ chối**

**Cách 2 — Drawer:**

1. Mở item `in_review`
2. Bấm **Duyệt** → `approved_internal`

### 12.3. Từ chối

1. Bấm **Từ chối**
2. Nhập **Comment tối thiểu 10 ký tự…**
3. **Xác nhận từ chối** → status `changes_requested`

### 12.4. Client gate (nếu bật flag)

Sau `approved_internal`:

1. Bấm **Gửi KH duyệt** → cột board **Chờ KH**
2. Khách duyệt trên portal **Content Marketing** → **Duyệt**
3. Hoặc staff test: **Simulate KH duyệt** → **KH OK**

---

## 13. Tab Board — Kanban

**Route:** `?view=board`

**Cột mặc định:** Draft · Đang duyệt · Đã duyệt · Đã lên lịch · Published  
**Có client gate thêm:** Chờ KH · KH OK

1. Kéo/thả card giữa cột (nếu quyền cho phép) hoặc dùng workflow drawer
2. Checkbox **Chỉ của tôi (assignee SP)** — lọc item được gán
3. Card hiển thị channel/format + chip **Text ✓/○**, **Visual ✓/○**
4. Bấm card → mở drawer

**Phân công:** Drawer/header — **Phân công** SP/QA (cap `crm_content.assign`).

---

## 14. Tab Review — hàng đợi QA

**Route:** `?view=review`

### 14.1. Copy review

- Tile SLA tổng hợp
- Danh sách item `in_review`
- **Mở** · **Duyệt** · **Từ chối** (comment ≥ 10 ký tự)

### 14.2. Visual review

- Sub-tab **Visual (N)**
- Lọc item `visual_status=ai_ready`
- **Mở Media AI** · **Duyệt visual** · **Từ chối**

---

## 15. Tab Calendar — lên lịch publish

**Route:** `?view=calendar`

### 15.1. Lưới tuần

1. **← Tuần trước** / **Tuần sau →**
2. Kéo item **Đã duyệt** vào ô ngày → status **Đã lên lịch** (`scheduled`, giờ mặc định 12:00 local)

### 15.2. Form lên lịch

1. Section **Lên lịch (item đã duyệt)**
2. Chọn item + datetime
3. **Lên lịch**

### 15.3. Publish thực tế (human)

AI **không** auto-post. SP thực hiện:

| Kênh | Thao tác ngoài hệ thống |
|------|-------------------------|
| Facebook / LinkedIn | **Copy caption** → đăng thủ công |
| Zalo OA | Copy → đăng OA |
| Blog / Website | Publish CMS hoặc **→ SEO pipeline** |
| Email | **→ Email campaign** |
| Ads | Copy ad copy → Ads Manager |

Quay lại drawer:

1. Nhập **Published URL (optional)**
2. Bấm **Mark published** → cột **Published**

**Gate:** Chưa `approved_internal` hoặc visual chưa duyệt → lỗi publish.

---

## 16. Media AI — tạo hình ảnh & carousel

**Vị trí:** Drawer → tab **Media AI** → **Media AI Studio**

**Flags:** `PTT_CONTENT_MARKETING_MEDIA_ENABLED=1` + `PTT_CMKT_IMAGE_GEN=1`  
**Cap:** `crm_content.generate`

**Áp dụng cho:** Facebook/LinkedIn **Carousel**, social post có `needs_visual`, và các format cần visual.

### 16.1. Điều kiện trước khi generate

- Copy status **approved_internal** (hoặc draft carousel với watermark — ngoại lệ)
- Badge hiển thị: **Copy: approved_internal ✓**, **Visual: …**, **QA: N/100**

### 16.2. Cấu hình media

| Control | Tùy chọn |
|---------|----------|
| **Preset** | corporate, bold, minimal, playful |
| **Size** | 1:1, 4:5, 9:16, 16:9 |
| **Variants** | 2, 3, 4 |

### 16.3. Tạo hình ảnh (single post / thumbnail)

1. Chọn Preset, Size, số Variants
2. Bấm **Generate image variants**
3. Đợi job (nút **Đang chạy…**)
4. Lưới thumbnail — **bấm chọn asset** ưa thích
5. Bấm **Run visual QA** — xem điểm QA /100
6. **Submit visual review**

### 16.4. Tạo carousel (nhiều slide)

**Chỉ khi format = carousel**

1. Cấu hình Preset + Size
2. Bấm **Generate carousel slides**
3. Chọn slide từng slide trong lưới
4. **Run visual QA** → **Submit visual review**

**Watermark:** Asset draft có watermark **DRAFT** — gỡ sau khi **Duyệt visual**.

### 16.5. Duyệt / từ chối visual

**QA trên Media AI tab hoặc Review → Visual:**

1. **Duyệt visual** — nhập comment (tuỳ chọn) → asset clean
2. **Từ chối visual** — comment bắt buộc
3. **Escalate to Design** — chuyển designer (cap production)

---

## 17. Media AI — tạo video ngắn (Social FFmpeg V1)

> **Hai studio (picker trên UI):** [Dual Studio](../superpowers/specs/2026-08-20-cmkt-video-dual-studio-design.md) — **Video tuần (FFmpeg)** vs **Video chiến dịch (SOP)**.  
> **Spec Social/FFmpeg:** [`2026-08-20-cmkt-professional-video-os-design.md`](../superpowers/specs/2026-08-20-cmkt-professional-video-os-design.md)  
> **V1 (2026-08):** Social FFmpeg stitch **MP4 thật** lên CDN; card **Video chiến dịch (SOP)** disabled (Module 7 chưa ship).

**Vị trí:** Tab **Media AI** — item **Short video — Script** hoặc **YouTube — Script**

**Flags bắt buộc:**

| Biến | Giá trị V1 |
|------|------------|
| `PTT_CMKT_VIDEO_GEN` | `1` |
| `PTT_CMKT_VIDEO_PROVIDER` | `ffmpeg` |
| `PTT_CMKT_VIDEO_SOCIAL` | `1` |
| `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP` | `3` (quota job social/ngày/lifecycle) |
| `PTT_CMKT_VIDEO_ONE_SHOT` | `1` (UAT — nút **Tạo nhanh**; GA lật `0`) |

(+ `PTT_CONTENT_MARKETING_MEDIA_ENABLED=1`)

### 17.1. Chọn studio & chuẩn bị script

1. Tab **Body** — AI generate script (Length **Long**, format video)
2. Duyệt copy → **approved_internal**
3. Tab **Media AI** — picker hiện hai lựa chọn:
   - **Video tuần (FFmpeg)** — chọn để lock studio social
   - **Video chiến dịch (SOP)** — disabled (Module 7 chưa ship)

### 17.2. Storyboard → render → preview

1. Chọn **Pack:** Reels / Shorts / Feed 1:1
2. Cấu hình **Preset** + **Voice**
3. Bấm **Tạo storyboard** — worker sinh **4 beat** (hook · problem · solution · CTA) + TTS + clip id
4. Xem 4 beat read-only trên UI
5. Bấm **Render video** — FFmpeg stitch master `.mp4` lên CDN
6. Progress 8 bước (`script` … `packs`) từ `video_generation.steps`
7. Preview: thẻ `<video controls playsInline poster src>` trong Media AI — **không** dùng `<img src={mp4}>`

**Watermark:** Bản draft có watermark **DRAFT** trên preview. **Duyệt visual** → worker promote bản clean (gỡ DRAFT).

**Quota:** Tối đa **3** job social (`social_*` / `video_short_generate`) / ngày / lifecycle — cap ảnh 20 **không** đếm video.

### 17.3. QA & publish video

1. **Run visual QA** — xem điểm Video QA /100 + checks
2. **Submit visual review** → QA **Duyệt visual** (asset clean, không DRAFT)
3. Tab **Production** — phase **awaiting_video** → **done**
4. Export script nếu cần: **Export script** (Production tab)
5. Upload/publish lên TikTok/Reels/YouTube Shorts thủ công
6. **Mark published** + URL

**CI / máy thiếu ffmpeg:** Job `failed` + `error=ffmpeg_missing` — không fallback URL giả. Smoke: `SMOKE_SKIP_FFMPEG=1 bash scripts/smoke_content_marketing_video_social_v1.sh`.

---

## 18. Tab Repurpose — tái sử dụng đa kênh

**Route:** `?view=repurpose`

**Mục tiêu:** 1 blog master → nhiều item derived (FB, LinkedIn, Email…)

1. Bấm **Tải blog master**
2. Dropdown **Blog master (approved)** — chọn blog `approved_internal`
3. Toggle **Targets:**
   - **Facebook — Bài viết ×2**
   - **LinkedIn — Bài viết ×1**
   - **Newsletter — Email ×1**
4. **Chạy repurpose**
5. Danh sách derived: `#id channel — title` — bấm mở từng item
6. Mỗi derived item có workflow riêng (draft → review → …)

---

## 19. Tab Production & bridges (drawer)

**Vị trí:** Drawer → tab **Production** — **Production & bridges**

### 19.1. Bridge SEO (Website — Blog)

**Điều kiện:** Item `approved_internal`, channel website, format blog

1. Badge **SEO: not linked**
2. Bấm **→ SEO pipeline** — tạo bridge
3. Badge **SEO: linked** + link **mở** → `/seo/content/{id}`
4. Sau publish SEO → **Sync SEO published URL**

### 19.2. Bridge Email (Newsletter / Drip)

**Điều kiện:** Lifecycle đã liên kết agency email client

1. Badge **Email: not linked** (hoặc cảnh báo HĐ chưa link client)
2. Bấm **→ Email campaign** — mở campaign draft Email Marketing
3. Badge **Email: linked** + **mở**

### 19.3. Production phase & export

| Phase | Ý nghĩa |
|-------|---------|
| none | Chưa vào production |
| awaiting_design | Chờ design |
| awaiting_video | Chờ video |
| in_progress | Đang sản xuất |
| done | Hoàn tất — cho phép publish (visual items) |

**Export:**

- **Export design brief** (Markdown)
- **Export design brief PDF**
- **Export script** (video)

**Gán designer/video staff ID** — field production JSON.

---

## 20. Tab Intelligence & Audit

### 20.1. Intelligence

**Route:** `?view=intelligence`

- Metrics content (manual + external nếu bật `PTT_CMKT_EXTERNAL_METRICS`)
- **Weekly memo** — tóm tắt tuần (cron `PTT_CMKT_WEEKLY_MEMO_CRON`)
- Gợi ý topic / drift alerts

### 20.2. Audit

**Route:** `?view=audit`

- Log mọi job AI (`ai_agent_runs`)
- Lịch sử chỉnh sửa human trên body/versions
- Dùng compliance & debug khi generate fail

---

## 21. Portal — khách hàng duyệt content

**URL:** https://portal.pttads.vn/dashboard

**Flag:** `NEXT_PUBLIC_CMKT_PORTAL_SUMMARY=1`

1. Card **Content Marketing**
2. Số **Published MTD**, pending approval
3. Item **Chờ KH** → nút **Duyệt**
4. Read-only — chi tiết chỉnh trên ops-web

---

## 22. Quy trình theo vai trò

### 22.1. Lead SP — khởi tạo tháng

1. Tab **AI Planner** → chốt TMMT → Apply
2. Content Board → **Import từ Planner** (Merge)
3. **Seal snapshot**
4. Tab **Pillars** / **Ideas** — review & phân công
5. Tab **Calendar** — phác lịch tuần

### 22.2. SP Content — sản xuất

1. Convert ideas hoặc **+ Item**
2. AI Generate draft + variants
3. **Submit review**
4. Item carousel/video → tab **Media AI** sau khi copy duyệt
5. **Copy caption** + **Mark published** sau khi đăng thực tế

### 22.3. QA — duyệt

1. Tab **Review** — Copy + Visual
2. SLA tile — ưu tiên breach
3. Từ chối với comment rõ ràng (≥ 10 ký tự)

### 22.4. Designer / Video

1. Drawer → **Production** — phase, asset URL
2. Hoặc **Escalate to Design** từ Media AI
3. Export brief PDF → làm tay nếu AI chưa đạt

---

## 23. Walkthrough UAT 60 phút

| # | Việc | View / nút |
|---|------|------------|
| 1 | Import Planner | Banner → Import từ Planner |
| 2 | Convert 1 FB + 1 blog | Ideas → Convert |
| 3 | AI draft + variants | Drawer Body → Generate |
| 4 | Submit + QA approve | Review → Duyệt |
| 5 | Generate carousel slides | Media AI → Generate carousel |
| 6 | Duyệt visual | Review Visual → Duyệt visual |
| 7 | Calendar schedule 2 items | Calendar → kéo thả |
| 8 | Repurpose blog | Repurpose → Chạy repurpose |
| 9 | Bridge SEO | Production → → SEO pipeline |
| 10 | Mark published | Body → Mark published |

Chi tiết từng click: [`docs/use-cases/actions/11-CMKT-ACTIONS.md`](../use-cases/actions/11-CMKT-ACTIONS.md)

---

## 24. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| Tab Content Board ẩn | Flag tắt / slug sai / thiếu cap | Bật flags + kiểm tra `PTT_CONTENT_MARKETING_SLUGS` |
| AI Generate disabled | `PTT_CONTENT_MARKETING_AI_ENABLED=0` | Bật flag + OPENAI key |
| Modal Bổ sung brief | Thiếu audience/goal | Điền brief → Lưu & generate lại |
| Generate fail | LLM timeout / quota | Audit tab → **Thử lại**; kiểm tra `ai_agent_runs` |
| Media AI tắt | Media/image flag = 0 | Bật `PTT_CONTENT_MARKETING_MEDIA_ENABLED` + `PTT_CMKT_IMAGE_GEN` |
| Generate short video disabled | `PTT_CMKT_VIDEO_GEN=0` | Bật flag video |
| Publish blocked | Chưa approved / visual pending | Duyệt copy + visual trước |
| Reject 400 | Comment < 10 ký tự | Nhập lý do đủ dài |
| → Email campaign lỗi | Lifecycle chưa link email client | Liên kết agency client trên HĐ |
| Carousel watermark | Draft chưa duyệt visual | Duyệt visual → asset clean |
| Cap media hết | Vượt daily cap 20/lifecycle | Chờ ngày mới hoặc tăng cap |

---

## 25. Checklist triển khai

- [ ] DDL applied (`apply_pg_ddl_content_marketing.sh`)
- [ ] Flags BE + FE bật (staging script hoặc `deploy/runtime.env`)
- [ ] Slug pilot trong allowlist
- [ ] Caps `crm_content.*` gán cho SP/QA/Lead
- [ ] OPENAI + (prod) REPLICATE configured
- [ ] Smoke P0 + P1 + P2 media pass
- [ ] Tab Content Board hiện trên lifecycle pilot
- [ ] E2E: idea → draft → approve → calendar → publish
- [ ] E2E media: carousel slides + visual approve
- [ ] (Tuỳ chọn) Video stub/generate + portal summary

---

## 26. Tài liệu tham chiếu

| Loại | Đường dẫn |
|------|-----------|
| Bản tóm tắt | [`10-content-marketing.md`](./10-content-marketing.md) |
| Use case catalog | [`docs/use-cases/11-CONTENT-MARKETING.md`](../use-cases/11-CONTENT-MARKETING.md) |
| Actions walkthrough | [`docs/use-cases/actions/11-CMKT-ACTIONS.md`](../use-cases/actions/11-CMKT-ACTIONS.md) |
| UX integration spec | [`docs/specs/2026-08-09-content-marketing-integration-spec.md`](../specs/2026-08-09-content-marketing-integration-spec.md) |
| Design spec | [`docs/superpowers/specs/2026-08-09-content-marketing-os-design.md`](../superpowers/specs/2026-08-09-content-marketing-os-design.md) |
| Implementation status | [`docs/superpowers/specs/2026-08-09-content-marketing-implementation-status.md`](../superpowers/specs/2026-08-09-content-marketing-implementation-status.md) |
| UAT runbook | [`docs/runbooks/content-marketing-uat-p0.md`](../runbooks/content-marketing-uat-p0.md) |
| Marketing AI Planner | [`11-marketing-ai-planner.md`](./11-marketing-ai-planner.md) |
