# Design: Content Video OS — Video marketing chuyên nghiệp đa kênh

**Ngày:** 2026-08-20  
**Document ID:** CMKT-VIDEO-SPEC-20260820  
**Phiên bản:** 1.1  
**Trạng thái:** Spec — plan Social V1: [`../plans/2026-08-20-cmkt-video-social-ffmpeg-v1.md`](../plans/2026-08-20-cmkt-video-social-ffmpeg-v1.md)  
**Kiến trúc 2 studio (2026-08-20):** [`2026-08-20-cmkt-video-dual-studio-design.md`](./2026-08-20-cmkt-video-dual-studio-design.md)  
**Parent:** [`2026-08-09-content-marketing-os-design.md`](./2026-08-09-content-marketing-os-design.md) §24 (CMKT-UC-036)  
**UX parent:** [`2026-08-09-content-marketing-integration-spec.md`](../../specs/2026-08-09-content-marketing-integration-spec.md) SCR-CMKT-008  
**Hướng dẫn UI:** [`docs/huong-dan-su-dung/18-content-marketing-os.md`](../../huong-dan-su-dung/18-content-marketing-os.md) §17  
**App:** `services/ptt-crm-api` (`ContentMarketingModule`) · `services/ops-web` (`ContentOsMediaStudio`)  
**Primary surface:** `/crm/service-delivery/[id]?tab=content-os` → drawer item → tab **Media AI**

---

## 1. Tóm tắt & quyết định đã khóa

### 1.1. Mục tiêu

Nâng **CMKT-UC-036** từ pipeline khung (TTS/stock + URL `.mp4` giả) thành **studio short-form agency-grade**: một script đã duyệt → **file MP4 thật**, caption cháy, brand lock, preview in-board, QA video, xuất **pack đa kênh** (Reels / TikTok / Shorts / Feed / LinkedIn / Ads) — vẫn **human publish** (BR-AI-01, BR-CMKT-02).

**Định vị:** không thay CapCut/InVideo/HeyGen trên sân “editor đẹp”. Thắng trên sân agency: **script CRM + brand KH + dual-gate + lịch retainer + audit pháp lý**.

### 1.2. Quyết định kiến trúc (khóa)

| # | Quyết định | Lý do |
|---|------------|-------|
| D1 | **Hai studio riêng** trên Content OS — không một pipeline lai | User chọn; nâng cấp độc lập — xem Dual Studio spec |
| D1b | **Không tách app / route CRM mới** | Cùng item, calendar, publish, RBAC |
| D2 | **Studio Social = FFmpeg V1** | Stock + TTS + caption; file MP4 thật |
| D3 | **Studio SOP = cinematic G1–G4** | Leonardo + Kling/Runway + 4 cổng QC |
| D4 | **Pack kênh thuộc kernel** | Cả hai studio transcode cùng contract |
| D5 | **Storyboard beat chỉ Studio Social** | Studio SOP dùng shot/take/keyframe |
| D6 | **QA riêng từng studio** | Social: file/LUFS; SOP: 4 gate checklist |
| D7 | **Quota / flag / credit tách** | Ảnh social ≠ render FFmpeg ≠ credit Kling |
| D8 | **Không đổi studio giữa dự án** | Clone item nếu cần engine kia |

### 1.3. Định nghĩa “video hoàn hảo” (agency, không Hollywood)

Một cut **đạt** khi **tất cả** đúng:

1. File MP4 tồn tại trên S3/CDN, `ffprobe` đọc được, không 404.  
2. Tỷ lệ đúng pack kênh; duration 12–60s (default 21–35s).  
3. Voiceover tiếng Việt nghe rõ (LUFS −14 ± 2), nhạc nền ducking.  
4. Caption burn-in + hook text 0–3s + end-card CTA + logo KH.  
5. B-roll khớp ≥ 3 beat (hook / pain / proof / CTA).  
6. `video_qa.score ≥ 70` hoặc Leader override + comment.  
7. `visual_status=approved` trước `published`.  
8. Audit: script version, TTS voice, clip license, prompt_hash, render_id.

**Không đạt** nếu chỉ có poster + URL bịa, hoặc preview bằng `<img>`.

---

## 2. As-is (2026-08-20) — gap bắt buộc phải đóng

| Thành phần | Code hiện tại | Gap |
|------------|---------------|-----|
| Job | `video_short_generate` + progress UI | Progress % giả (poll loop), không theo step thật |
| TTS | OpenAI `tts-1` nếu có key; không thì stub buffer | Không lưu audio thật vào asset; duration ước lượng từ số từ |
| Stock | Pexels nếu có key; không thì URL stub | Keyword = từ dài trong script, không beat |
| Stitch | `stitched_at` trên JSON manifest; URL `.mp4` bịa | **Không FFmpeg, không mux** |
| Brand | `brandContext.resolveForLifecycle` có trên image job | Video **không inject** logo/màu |
| QA | `scoreAssets` (OCR / ΔE ảnh) | Không check duration/caption/audio |
| Preview | `<img src={asset.url}>` + link “Mở video preview” | MP4 không xem trong grid |
| Provider env | Spec hẹn `runway`/`luma`/`pika`/`elevenlabs` | **Chưa có adapter** |
| Quota | `PTT_CMKT_MEDIA_DAILY_CAP_PER_LIFECYCLE=20` chung | Video hết quota vì generate ảnh |

File neo: `content-media-video.provider.ts`, `content-media-tts.provider.ts`, `content-media-stock.provider.ts`, `content-job-worker.service.ts`, `ContentOsMediaStudio.tsx`.

---

## 3. Personas & journey

| Persona | Việc trên video |
|---------|-----------------|
| **SP Content** | Chốt script → storyboard → render → chọn cut → submit visual |
| **QA / Lead** | Review queue Visual: xem MP4, điểm QA, duyệt / từ chối / escalate |
| **Designer / Video** | Nhận escalate, upload MP4 polish, giữ lineage AI draft |
| **AM** | Gửi KH duyệt (client gate) khi flag bật; không edit render |
| **IT** | Flag, provider key, FFmpeg trên worker, quota, cost |

**Happy path (V1):**

```
Script approved_internal
  → POST jobs/video-short (mode=storyboard)
  → Worker: script_beats → TTS → stock per beat → storyboard draft
  → SP chỉnh clip / text hook trên UI
  → POST jobs/video-render (mode=final)
  → FFmpeg stitch + caption + logo + music + watermark DRAFT
  → Video QA
  → Submit visual review → Duyệt visual → watermark gỡ
  → Transcode channel pack
  → Copy caption + Mark published (human post)
```

---

## 4. Phạm vi kênh — Channel Pack

Master render **luôn 1080×1920 @ 30fps, H.264 + AAC**. Pack là **transcode + crop + end-card variant**, không generate lại TTS.

### 4.1. Ma trận pack

| Pack id | Kênh Content OS | Tỷ lệ | Độ phân giải | Duration mục tiêu | Safe zone | Đặc thù |
|---------|-----------------|-------|--------------|-------------------|-----------|---------|
| `reels` | `short_video` / `facebook` + `video_script` | 9:16 | 1080×1920 | 15–35s | Top 14% + bottom 20% (UI Reels) | Hook lớn; caption giữa-dưới |
| `tiktok` | `short_video` | 9:16 | 1080×1920 | 15–35s | Top 12% + bottom 22% | Cùng master, end-card không có “Subscribe” |
| `shorts` | `youtube` + `video_script` | 9:16 | 1080×1920 | 20–45s | Bottom 18% (title overlay YT) | End-card: subscribe + URL |
| `feed_square` | `facebook` / `linkedin` + `video_script` | 1:1 | 1080×1080 | 15–30s | Center crop từ 9:16 (giữ hook) | Caption lớn hơn vì không full-bleed |
| `linkedin_wide` | `linkedin` | 16:9 | 1920×1080 | 20–45s | Letterbox hoặc crop giữa | Tone corporate; ít text nổ |
| `ads_15` | `meta_ads` / `google_ads` | 9:16 hoặc 1:1 | theo Ads | **15s cứng** | 15% mọi cạnh | Cắt beat CTA sớm; **bắt buộc** qua CreativesModule nếu paid |
| `youtube_long` | `youtube` | 16:9 | 1920×1080 | ≤180s | — | **V3 only** |

**Quy tắc map mặc định khi SP bấm Generate:**

| Item `channel` + `format` | Pack mặc định | Pack phụ (auto sau approve) |
|---------------------------|---------------|-----------------------------|
| `short_video` + `video_script` | `reels` | `tiktok`, `shorts` |
| `youtube` + `video_script` | `shorts` | `reels` |
| `facebook` + `video_script` | `reels` | `feed_square` |
| `linkedin` + `video_script` | `linkedin_wide` | `feed_square` |
| `meta_ads` / `google_ads` + `ad_copy` hoặc `video_script` | `ads_15` | — |
| Blog / email / document | Không video job | — |

**Phạm vi ship theo version:** V1 chỉ transcode `reels`, `shorts`, `feed_square`. V2 thêm `tiktok` (nếu khác end-card), `linkedin_wide`, `ads_15`. V3 thêm `youtube_long`. UI có thể hiện checkbox pack V2 — disable + tooltip “V2” nếu chưa bật.

Item text-only (`social_post` không `needs_visual`) **không** hiện nút Generate video. Muốn video: convert/repurpose sang `video_script` (đã có `content-repurpose.util` profile `video_short`).

### 4.2. Giới hạn duration

| Pack | Min | Max | Reject render |
|------|-----|-----|---------------|
| `ads_15` | 12s | 15.5s | >16s |
| `reels` / `tiktok` | 12s | 60s | >62s |
| `shorts` | 12s | 60s | >62s |
| `feed_square` / `linkedin_wide` | 12s | 45s | >48s |

Script TTS cắt cứng 4096 ký tự (giữ as-is). Ước lượng trước render: `words / 2.4` ≈ giây. Nếu ước lượng > max pack → **block job** với `error=script_too_long` + gợi ý rút script (không render rồi cắt cụt lời).

---

## 5. Giải phẫu video (template)

### 5.1. Beat model (bắt buộc V1)

Mọi script được parse thành **4 beat** (thiếu thì gộp):

| Beat | Thời lượng gợi ý | Việc hình | Việc chữ |
|------|------------------|-----------|----------|
| `hook` | 0–3s | Clip chuyển động mạnh / face-safe stock | Text hook 3–8 từ, font ≥ 64px |
| `pain` | 3–12s | B-roll problem | Caption câu 1–2 |
| `proof` | 12–24s | Product / team / dashboard stock | Caption bằng chứng |
| `cta` | 3–6s cuối | End-card brand | CTA + logo + URL/handle |

`pipeline_json.beats[]`:

```json
{
  "id": "hook",
  "start_ms": 0,
  "end_ms": 3000,
  "script_excerpt": "Khách không nhớ brand sau 3 giây.",
  "keywords": ["attention", "phone screen"],
  "clip_id": "pexels-229543",
  "on_screen_text": "Khách quên bạn sau 3s",
  "locked": false
}
```

SP **đổi clip / sửa on_screen_text / lock beat** trước `video-render`. Không lock → worker được phép thay clip nếu QA fail (V2). V1: không auto-swap sau storyboard.

### 5.2. Style preset → video look

Reuse 4 preset ảnh, map video:

| Preset | Music bed | Caption style | Cut pace | Grade |
|--------|-----------|---------------|----------|-------|
| `corporate` | piano/ambient −22 dB | Sans, trắng + brand primary | 4–6s/cut | trung tính |
| `bold` | punchy −20 dB | Extra-bold, stroke | 2–3s/cut | contrast cao |
| `minimal` | sparse −24 dB | Ít chữ, nhiều khoảng | 5–7s/cut | desaturate nhẹ |
| `playful` | upbeat −20 dB | Rounded, màu phụ | 2–4s/cut | warm |

File nhạc: bundle nội bộ `assets/cmkt-beds/{preset}.m4a` (license purchased, commit binary nhỏ hoặc S3 `cmkt/beds/`). **Cấm** kéo nhạc YouTube.

### 5.3. Lớp render (z-order)

1. B-roll clip (scale-to-cover, Ken Burns nhẹ 1.05→1.0)  
2. Color grade LUT theo preset  
3. Caption (ASS/SRT burn)  
4. Hook card 0–3s (fade 200ms)  
5. Logo KH góc **không** nằm safe-zone chết (mặc định bottom-left, margin 4%)  
6. End-card 2.5–4s (brand + CTA)  
7. Watermark **DRAFT** chéo 18% opacity nếu `visual_status ≠ approved`  
8. Audio: TTS voice + bed ducking (sidechain −12 dB khi có speech)

---

## 6. Kiến trúc kỹ thuật

### 6.1. Thành phần

```
ops-web ContentOsMediaStudio
        │
        ▼
content-media-generate.service.ts     # gate flag/cap/format/script length
        │
        ▼
cmkt_content_jobs
  storyboard_generate | video_render | video_transcode | video_qa_score
        │
        ▼
content-job-worker.service.ts
        ├─ ContentMediaScriptBeatService     # parse 4 beat + on-screen text
        ├─ ContentMediaTtsProvider           # openai | elevenlabs | azure | stub
        ├─ ContentMediaStockProvider         # pexels | storyblocks | stub
        ├─ ContentMediaVideoComposer         # FFmpeg stitch — THAY thế "manifest URL"
        ├─ ContentMediaVideoTranscoder       # pack kênh
        └─ ContentMediaVideoQaService        # ffprobe + rules
        │
        ▼
ContentMediaStorageService  → S3 + CDN (mp4, srt, poster, wav)
```

**Không** thêm Nest module mới. Composer là service trong `content-marketing/`.

### 6.2. Worker & runtime

| Yêu cầu | Giá trị |
|---------|---------|
| Binary | `ffmpeg` ≥ 6, `ffprobe` trên host worker (VPS `ptt-crm-api` hoặc queue riêng) |
| Job mode | `PTT_CMKT_MEDIA_ASYNC=1` **bắt buộc** cho video (sync timeout API) |
| Timeout render | 180s V1; 300s nếu pack ≥ 3 |
| p95 storyboard | ≤ 40s (TTS + 4 clip fetch) |
| p95 render | ≤ 90s cho 30s master |
| Temp | `/tmp/cmkt-video/{jobId}/` — xóa sau upload, kể cả fail |
| Concurrency | 1 render/process (CPU). Queue FIFO per lifecycle |

Nếu `ffmpeg` thiếu: job `failed` + `error=ffmpeg_missing` — **không** fallback URL giả.

### 6.3. Pipeline chi tiết

```
storyboard_generate
  1. Load approved markdown + brand context + channel pack
  2. Beat parse (LLM structured JSON, fallback rule-split đoạn)
  3. TTS full script → audio.wav + duration_sec THẬT (ffprobe)
  4. If duration > pack max → fail script_too_long (trước stock $)
  5. Per beat: stock.search(keywords, orientation)
  6. Persist media_json.storyboard + tts asset (storage_key)
  7. visual_status=ai_pending → ai_ready (storyboard, chưa có mp4)

video_render
  1. Require storyboard + selected clips
  2. Download clips + tts + bed + logo
  3. Build filter_complex (trim, scale, overlay, subtitles, amix)
  4. ffmpeg → master.mp4 + poster.webp (@ t=1.2s) + captions.srt
  5. Upload; video_short.url = CDN thật
  6. video_qa_score
  7. visual_status=ai_ready

video_transcode  (sau visual approve hoặc song song draft watermark)
  For each pack in requested_packs:
    crop/scale + optional end-card swap → pack.mp4
```

### 6.4. FFmpeg contract (V1 tối thiểu)

Input: `voice.wav`, `clip{n}.mp4`, `bed.m4a`, `logo.png`, `captions.ass`, `hook.png` (generated SVG→PNG).

Output:

- `master.mp4` — yuv420p, +faststart, aac 192k, 30fps  
- `poster.webp` — 1080×1920  
- `captions.srt` — lưu kèm (KH muốn file cứng + file mềm)

Watermark DRAFT: `drawtext` hoặc overlay PNG. Khi `visual/approve` → `ContentMediaCleanService` re-render **không** DRAFT (hoặc dùng bản `clean_storage_key` render song song nếu disk cho phép). **Cấm** “gỡ watermark bằng CSS”.

### 6.5. Provider adapter

| Env | V1 bắt buộc | V2 | V3 |
|-----|-------------|----|----|
| `PTT_CMKT_TTS_PROVIDER` | `openai` (vi-capable) hoặc `azure` | `elevenlabs` | — |
| `PTT_CMKT_STOCK_PROVIDER` | `pexels` | `storyblocks` | — |
| `PTT_CMKT_VIDEO_PROVIDER` | **`ffmpeg`** (composer nội bộ) | `ffmpeg` | `runway` / `kling` chỉ cho **1 beat** thiếu stock |
| `PTT_CMKT_VIDEO_GEN` | `1` | `1` | `1` |

`PTT_CMKT_VIDEO_PROVIDER=stub` **chỉ** test unit. Staging/UAT/prod **cấm** stub nếu flag video=1 — health check fail khi ffmpeg missing.

Giá trị `runway`/`luma`/`pika` trong spec 2026-08-09 **bị thay**: V1 không implement. Ghi chú deprecation trong changelog module.

---

## 7. Data model

Không bảng mới bắt buộc. Mở rộng JSON đã có + 1 bảng license (V1 nên có).

### 7.1. `cmkt_content_items.media_json` (bổ sung)

```ts
type CmktVideoStoryboard = {
  version: 1;
  pack_default: string;           // reels | shorts | ...
  requested_packs: string[];
  style_preset: 'corporate' | 'bold' | 'minimal' | 'playful';
  voice: { provider: string; voice_id: string; lang: 'vi' | 'en' };
  beats: CmktVideoBeat[];
  tts: { storage_key: string; duration_sec: number; url: string };
};

type CmktVideoBeat = {
  id: 'hook' | 'pain' | 'proof' | 'cta';
  start_ms: number;
  end_ms: number;
  script_excerpt: string;
  keywords: string[];
  clip_id: string | null;
  clip_url?: string;
  license?: 'pexels' | 'storyblocks' | 'upload' | 'generated';
  on_screen_text: string;
  locked: boolean;
};

type CmktMediaJson = {
  // ... existing
  storyboard?: CmktVideoStoryboard;
  video_short?: CmktMediaAsset | null;
  video_packs?: Record<string, CmktMediaAsset>;  // reels, tiktok, ...
  video_generation?: CmktVideoGenerationProgress;
  video_qa?: CmktVideoQaResult;
};
```

`CmktVideoGenerationProgress.steps` **cố định**:

`script` → `beats` → `tts` → `clips` → `storyboard` → `compose` → `qa` → `packs`

Worker **ghi step thật** vào job + `media_json.video_generation` mỗi lần chuyển bước (SSE không bắt buộc V1; poll 1.5s giữ như hiện tại nhưng % = step/8).

### 7.2. `cmkt_video_licenses` (V1)

```sql
CREATE TABLE IF NOT EXISTS cmkt_video_licenses (
  id              bigserial PRIMARY KEY,
  lifecycle_id    bigint NOT NULL,
  item_id         bigint NOT NULL,
  asset_kind      text NOT NULL CHECK (asset_kind IN ('stock_clip', 'music_bed', 'tts', 'logo', 'upload')),
  provider        text NOT NULL,
  provider_id     text,
  license_name    text NOT NULL,          -- pexels_license | storyblocks_seat | first_party
  source_url      text,
  local_storage_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cmkt_video_licenses_item_idx ON cmkt_video_licenses (item_id);
```

Mọi clip trong MP4 publish **phải** có row. Thiếu → `video_qa.checks.license_ok=false` + block approve (không override trừ Lead + comment ≥ 20 ký tự).

### 7.3. Asset fields bổ sung

`CmktMediaAsset` thêm:

| Field | Ý nghĩa |
|-------|---------|
| `width` / `height` / `fps` | ffprobe |
| `sha256` | toàn vẹn file |
| `render_job_id` | job compose |
| `pack_id` | null = master |
| `has_burned_captions` | boolean |
| `lufs` | đo loudness |

---

## 8. API

Base giữ: `/api/crm/service-lifecycle/:lifecycleId/content-marketing`

| Method | Path | Cap | UC |
|--------|------|-----|-----|
| POST | `/items/:id/jobs/video-short` | generate | 036, 039 — **alias** `storyboard_generate` (tương thích FE cũ) |
| POST | `/items/:id/jobs/video-storyboard` | generate | 039 |
| PATCH | `/items/:id/video/storyboard` | write | 040 — sửa beat/clip/text |
| POST | `/items/:id/jobs/video-render` | generate | 041 |
| POST | `/items/:id/jobs/video-transcode` | generate | 042 |
| POST | `/items/:id/jobs/video-qa` | generate | 043 |
| GET | `/items/:id/video/preview` | view | 041 — 302 CDN, chỉ khi có mp4 thật |
| POST | `/items/:id/video/upload-broll` | write | 040 — clip KH (consent) |
| POST | `/items/:id/visual/approve` | approve | 037 — không đổi path |

### 8.1. POST `jobs/video-storyboard`

```json
{
  "aspect_ratio": "9:16",
  "style_preset": "corporate",
  "pack_default": "reels",
  "requested_packs": ["reels", "tiktok", "shorts"],
  "voice_id": "alloy",
  "allow_draft_watermark": false
}
```

Gate: `itemEligibleForVideoShort` + `assertMediaJobEligible` + `assertScriptDuration(pack)` + daily **video** cap.

### 8.2. PATCH `video/storyboard`

```json
{
  "beats": [
    { "id": "hook", "clip_id": "pexels-1", "on_screen_text": "3 giây quyết định", "locked": true }
  ]
}
```

Validate beat id ∈ 4 beat; clip_id thuộc stock cache hoặc upload.

### 8.3. POST `jobs/video-render`

```json
{ "mode": "final", "requested_packs": ["reels"] }
```

`mode=preview` (V2): render 8s hook+cta. V1 chỉ `final`.

### 8.4. Lỗi chuẩn

| `error` | HTTP | Khi |
|---------|------|-----|
| `cmkt_video_disabled` | 400 | Flag off |
| `video_format_required` | 400 | Sai channel/format |
| `media_copy_not_approved` | 400 | Script chưa duyệt |
| `script_too_long` | 400 | Ước lượng > max pack |
| `ffmpeg_missing` | 500 | Worker thiếu binary |
| `storyboard_incomplete` | 400 | Render khi chưa đủ 4 clip |
| `video_daily_cap` | 400 | Hết 3 render/ngày |
| `license_missing` | 400 | Approve khi thiếu license row |

Tương thích: FE hiện gọi `jobs/video-short` → V1 map thành **storyboard + auto-render** nếu `PTT_CMKT_VIDEO_ONE_SHOT=1` (default `1` để không gãy UAT cũ). Default `0` trên GA: hai bước rõ (storyboard rồi render).

---

## 9. UI — Media AI Studio (video)

Màn **SCR-CMKT-008b** (mở rộng 008). Chỉ hiện khối video khi `itemEligibleForVideoShort`.

### 9.1. Wireframe

```
┌ Media AI Studio — Video ─────────────────────────────────────┐
│ Copy: approved_internal ✓   Pack: [Reels 9:16 ▼]            │
│ Preset: [corporate ▼]  Voice: [VI · Alloy ▼]                 │
│ Packs: ☑ Reels  ☑ TikTok  ☑ Shorts  ☐ Feed 1:1  ☐ Ads 15s    │
│ [Tạo storyboard]                                              │
├ Beats ───────────────────────────────────────────────────────┤
│ HOOK 0–3s   [clip thumb ▼ đổi]  Text: [............]  🔒     │
│ PAIN        [clip thumb ▼]      Text: [............]         │
│ PROOF       [clip thumb ▼]      Text: [............]         │
│ CTA         [end-card preview]  Text: [Liên hệ AM]           │
│ [Render video]   Generating: Beats ✓ TTS ✓ Clips ✓ Compose ⟳ │
├ Preview ─────────────────────────────────────────────────────┤
│ <video controls poster=...>  00:00 / 00:28                   │
│ Pack files: reels.mp4 · tiktok.mp4                           │
│ Video QA: 82/100  duration ✓  caption ✓  lufs ✓  license ✓   │
│ [Submit visual review]  [Duyệt visual]  [Escalate Video]     │
└──────────────────────────────────────────────────────────────┘
```

### 9.2. Luật UI

- Asset `type=video` → **`<video controls playsInline>`**, không `<img src=mp4>`.  
- Progress copy đúng step worker, không “Clips ⟳” giả khi compose đang chạy.  
- Nút **Generate short video** cũ = one-shot nếu flag `ONE_SHOT=1`; tooltip: “Tạo storyboard + render”.  
- Empty stock: nút **Tải B-roll** (mp4 ≤ 40MB, 9:16 ưu tiên).  
- LinkedIn pack: cảnh báo “Crop từ 9:16 — kiểm tra mặt/logo trước duyệt”.

### 9.3. Review queue

Cột Visual: thumbnail **poster** + duration. Click **Mở Media AI** seek preview. Filter `visual_status=ai_ready` giữ nguyên.

---

## 10. Video QA (CMKT-UC-043)

Tách `ContentMediaVideoQaService` — **không** gọi `scoreAssets` ảnh cho master MP4.

| Check | Rule | Fail |
|-------|------|------|
| `file_ok` | ffprobe video+audio stream | Block |
| `duration_ok` | Trong min/max pack | Block |
| `aspect_ok` | Khớp pack (±2px) | Block |
| `fps_ok` | 24–30 | Warn |
| `caption_ok` | Có burned captions **hoặc** srt đính kèm | Block V1 |
| `hook_text_ok` | Có overlay trong 0–3000ms (manifest hook layer) | Warn |
| `logo_ok` | Logo layer present **hoặc** KH không có logo (ghi `logo_skipped`) | Warn |
| `lufs_ok` | Integrated LUFS −16…−12 | Warn < −20 hoặc > −10 Block |
| `silence_ok` | Không im > 1.5s đầu | Warn |
| `license_ok` | Mọi clip + bed + tts có row | Block |
| `nsfw_ok` | Reuse policy image trên poster frame t=1.2s | Block |
| `safe_zone_ok` | Hook/CTA bbox không đè vùng chết pack | Warn |
| `watermark_ok` | DRAFT có trước approve; không có sau approve | Block |

Score: 100 − 15×block − 5×warn. `blocked=true` nếu bất kỳ check Block. Leader override: comment ≥ 10 ký tự (BR-CMKT-03) + `override=true` (giữ như visual ảnh).

---

## 11. Flags, quota, cost, RBAC

### 11.1. Flags mới / sửa

| Env | Default | Ý nghĩa |
|-----|---------|---------|
| `PTT_CMKT_VIDEO_GEN` | 0 | Master switch (giữ) |
| `PTT_CMKT_VIDEO_PROVIDER` | `ffmpeg` | V1 composer; `stub` chỉ test |
| `PTT_CMKT_VIDEO_ONE_SHOT` | 1 | Tương thích nút cũ |
| `PTT_CMKT_VIDEO_DAILY_CAP` | 3 | Render jobs / lifecycle / ngày |
| `PTT_CMKT_TTS_PROVIDER` | `openai` | |
| `PTT_CMKT_STOCK_PROVIDER` | `pexels` | |
| `PTT_CMKT_VIDEO_MUSIC` | 1 | Bật bed |
| `PTT_CMKT_FFMPEG_BIN` | `ffmpeg` | Path |
| `PTT_CMKT_ADS_CREATIVE_GATE` | 1 | Pack `ads_15` bắt `creative_id` trước publish |

Cap ảnh `PTT_CMKT_MEDIA_DAILY_CAP_PER_LIFECYCLE` **không** đếm `video_*` jobs.

### 11.2. Cost (Leader dashboard — V2 UI, V1 log)

Ghi `ai_agent_runs` + `cmkt_content_jobs.output_json.cost_usd_estimate`:

- TTS: $/1k ký tự provider  
- Stock: 0 nếu Pexels license  
- Compute: flat $0.02/30s render (nội bộ)

### 11.3. Caps

Không thêm cap mới. `crm_content.generate` = storyboard/render; `approve` = visual; `production` = escalate + upload polish MP4.

---

## 12. Pháp lý & brand

Giữ BR-CMKT-04, 06, 07, 08. Bổ sung:

| Mã | Rule |
|----|------|
| **BR-CMKT-V01** | Cấm publish khi `file_ok` false hoặc URL không ffprobe được. |
| **BR-CMKT-V02** | Cấm face/deepfake KH hoặc nhân viên nếu `lifecycle.video_likeness_consent ≠ true`. Upload B-roll mặt người = bắt consent checkbox. |
| **BR-CMKT-V03** | Nhạc chỉ first-party bed hoặc stock licensed — cấm URL YouTube. |
| **BR-CMKT-V04** | Paid ads pack `ads_15` không `published` trực tiếp — bắt `production.creative_id` (CreativesModule) khi `PTT_CMKT_ADS_CREATIVE_GATE=1`. |
| **BR-CMKT-V05** | Mọi pack publish inherit `visual_status` của master; không duyệt từng pack. |
| **BR-CMKT-V06** | Logo KH = overlay, không train model; thiếu logo → end-card text brand_name. |

---

## 13. Use case mới (mở rộng 036)

| ID | Tên | Phase | Actor |
|----|-----|-------|-------|
| **CMKT-UC-039** | Generate storyboard (beats + TTS + clip gợi ý) | V1 | SP |
| **CMKT-UC-040** | Sửa storyboard / upload B-roll | V1 | SP |
| **CMKT-UC-041** | Render master MP4 (FFmpeg) | V1 | SP |
| **CMKT-UC-042** | Transcode channel pack | V1 | SP / system |
| **CMKT-UC-043** | Video QA score | V1 | system / QA |
| **CMKT-UC-044** | Clean render (gỡ DRAFT) khi visual approve | V1 | system |
| **CMKT-UC-045** | Beat-matched restock + music ducking tinh chỉnh | V2 | SP |
| **CMKT-UC-046** | Generative B-roll 1 beat / avatar / long-form | V3 | SP + Lead |

CMKT-UC-036 trở thành **umbrella**: “Tạo short video đa kênh” = 039→044.

### 13.1. CMKT-UC-041 — Render master (chi tiết)

- **Pre:** storyboard đủ 4 beat + clip; script approved; ffmpeg có.  
- **Main:** compose → upload → qa → `video_short.url` CDN.  
- **Post:** `visual_status=ai_ready`, poster, srt.  
- **E1** ffmpeg fail → job failed, giữ storyboard, nút Thử lại.  
- **E2** clip 404 Pexels → fail beat đó, SP đổi clip.  
- **E3** duration lệch TTS vs clip timeline → trim/loop clip, không cắt voice.

---

## 14. Lộ trình triển khai

### V1 — File thật, xem được, duyệt được (ship trước)

1. FFmpeg composer + storage MP4/SRT/poster  
2. Progress step thật  
3. `<video>` preview  
4. Caption burn + hook + logo + DRAFT  
5. Storyboard 4 beat (rule-split + LLM JSON nếu AI flag)  
6. TTS duration thật; Pexels theo beat keyword  
7. Video QA + license table  
8. Pack: `reels` + `shorts` + `feed_square` (3 pack)  
9. Quota video riêng; cấm stub trên staging  
10. One-shot tương thích nút cũ  
11. Smoke `smoke_content_marketing_video_v1.sh`  
12. Cập nhật `18-content-marketing-os.md` §17

**Exit V1:** UAT 3 video tiếng Việt trên lifecycle `tiep-thi-noi-dung` — QA xem hết 28s, duyệt, tải mp4 máy local play được.

### V2 — Thắng template (InVideo/CapCut)

- ElevenLabs / Azure neural VI  
- Music ducking + 4 bed  
- Đổi clip theo thumb + search stock in-drawer  
- `linkedin_wide` + `ads_15`  
- Preview 8s  
- Cost tile trên Intelligence  
- Safe-zone overlay trên preview

### V3 — Đấu điểm đối thủ chuyên biệt (optional)

- 1 beat generative (Runway/Kling) khi stock miss  
- Avatar consent-gated  
- Opus-style cut từ video dài upload  
- YouTube ≤3 phút human-edit bắt buộc  
- A/B 2 hook → metrics Intelligence

---

## 15. Non-functional

| Hạng | Target |
|------|--------|
| Availability render | Best-effort; fail đóng job, không treo API |
| Idempotency | Cùng `prompt_hash` + storyboard sha trong 10 phút → trả job cũ (không double bill) |
| PII | TTS không đọc SĐT/CCCD (sanitize script như prompt text) |
| Retention | MP4 draft 90 ngày; published giữ theo lifecycle |
| Observability | Log job_id, step, ffmpeg stderr tail 2KB, duration_ms |
| Security | Presigned GET; không public bucket list |

---

## 16. Acceptance criteria

| ID | Tiêu chí |
|----|----------|
| EC-VIDEO-01 | Job render xong → `ffprobe` URL master có video+audio |
| EC-VIDEO-02 | `video_short.url` không còn pattern “replace manifest.json → mp4” |
| EC-VIDEO-03 | Preview in-board play được (video element) |
| EC-VIDEO-04 | DRAFT nhìn thấy trên frame; sau approve bản clean không DRAFT |
| EC-VIDEO-05 | 4 beat persisted; đổi clip → render lại phản ánh clip mới |
| EC-VIDEO-06 | Pack `reels` 9:16 và `feed_square` 1:1 cùng một master |
| EC-VIDEO-07 | Script ước lượng 70s + pack reels → 400 `script_too_long` |
| EC-VIDEO-08 | Thiếu ffmpeg → `ffmpeg_missing`, không stub URL |
| EC-VIDEO-09 | Video QA block khi không có file / license |
| EC-VIDEO-10 | Daily video cap 3 không bị ảnh hưởng bởi 20 image job |
| EC-VIDEO-11 | Publish vẫn chặn nếu `visual_status≠approved` (BR-CMKT-08) |
| EC-VIDEO-12 | Smoke V1 pass trên staging `tiep-thi-noi-dung` |

---

## 17. So với đối thủ (sau V1+V2)

| Đối thủ | Họ mạnh | RNOSAI thắng | RNOSAI cố ý thua |
|---------|---------|--------------|------------------|
| CapCut | Editor tay cực mạnh | Governance + CRM + brand KH + duyệt | Timeline frame-level |
| InVideo | Template đẹp | Script đã duyệt + QA + pack kênh + license audit | Kho template giải trí |
| HeyGen / Synthesia | Avatar | Consent + retainer context | Avatar V3 |
| Opus Clip | Cắt video dài | Nằm trên lifecycle + pillar | Cắt dài = V3 |
| Jasper | Copy | Copy **và** MP4 cùng item | — |
| Getfly / HubSpot | CRM | Video in-board + dual gate | Catalog template |

---

## 18. Ngoài phạm vi (mọi version)

- Auto-post TikTok / Reels / Shorts / Ads  
- Phim dài, motion graphics After Effects, VFX  
- Voice clone nhân sự / KH  
- Nhạc có lời copyright  
- Livestream, editor frame-by-frame  
- Thay MISA / kê khai  
- Hub video đa-lifecycle (luôn neo service-delivery)

---

## 19. Rủi ro

| Rủi ro | Mức | Xử lý |
|--------|-----|-------|
| VPS CPU render chậm | C | Async + 1 concurrency; escalate human nếu >180s |
| Pexels lệch ngành VN | C | Upload B-roll; V2 search UI; V3 1 beat gen |
| TTS Việt kém | C | Azure/ElevenLabs V2; SP re-record upload (V2) |
| License stock khi KH paid ads | H | `ads_15` + Creatives gate; ghi license row |
| FFmpeg filter phức tạp khó bảo trì | M | Composer tách file; golden fixture 15s script |
| One-shot che storyboard | M | Flag; docs UI 2 bước trên GA |

---

## 20. Traceability

| Deliverable | UC | EC |
|-------------|----|----|
| Storyboard | 039, 040 | 05, 07 |
| MP4 master | 036, 041 | 01, 02, 03, 08 |
| Pack đa kênh | 042 | 06 |
| QA + approve | 043, 037, 044 | 04, 09, 11 |
| Quota / smoke | — | 10, 12 |
| V2/V3 | 045, 046 | — |

**Files chạm (khi plan):**

- `content-media-video.provider.ts` → thay bằng composer hoặc gọi composer  
- `content-media-video-composer.service.ts` **(mới)**  
- `content-media-video-qa.service.ts` **(mới)**  
- `content-media-script-beat.service.ts` **(mới)**  
- `content-job-worker.service.ts`  
- `content-media-generate.service.ts`  
- `content-marketing.types.ts`  
- `docs/specs/postgresql-ddl-hr` analog → `postgresql-ddl-cmkt-video-v1.sql`  
- `ContentOsMediaStudio.tsx`  
- `scripts/smoke_content_marketing_video_v1.sh` **(mới)**  
- `docs/huong-dan-su-dung/18-content-marketing-os.md` §17  

---

## 21. Changelog spec

| Ver | Ngày | Nội dung |
|-----|------|----------|
| 1.0 | 2026-08-20 | Spec đầy đủ V1–V3; khóa FFmpeg; deprecation runway-as-V1; pack đa kênh |
| 1.1 | 2026-08-20 | Tách 2 studio (Social / SOP); D1–D8 cập nhật; dual-studio spec |
