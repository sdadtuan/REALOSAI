# Video tuần (FFmpeg V1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay pipeline video giả (JSON + URL `.mp4` bịa) bằng **Video tuần / Studio Social**: picker studio → storyboard 4 beat → TTS + stock → **FFmpeg ra MP4 thật** → QA file → pack `reels`/`shorts`/`feed_square` → preview `<video>` — không đụng Module 7 SOP.

**Architecture:** Kernel mỏng (`ffprobe`, pack, license) + `video-social` (beat, composer, QA, jobs `social_*`). Worker Content OS gọi Social khi `video_studio=social`. SOP (`vd_*`, Kling) **cấm** import. Nút `jobs/video-short` cũ = one-shot Social khi `PTT_CMKT_VIDEO_ONE_SHOT=1`.

**Tech Stack:** NestJS `ptt-crm-api`, Next.js `ops-web`, PostgreSQL `cmkt_video_licenses`, FFmpeg 6 + ffprobe trên worker, S3/CDN hiện có (`ContentMediaStorageService`), Jest + vitest, bash smoke.

**Spec:** [`2026-08-20-cmkt-professional-video-os-design.md`](../specs/2026-08-20-cmkt-professional-video-os-design.md) v1.1 · [`2026-08-20-cmkt-video-dual-studio-design.md`](../specs/2026-08-20-cmkt-video-dual-studio-design.md)

## Global Constraints

- **Studio:** chỉ `social`. Không tạo `vd_*`, không gọi Leonardo/Kling/Runway/Topaz.
- **BR-CMKT-01 / 02 / 06 / 08:** copy approved trước media; không auto-post; visual approve trước publish.
- **BR-CMKT-V01:** cấm publish / succeed job nếu URL không `ffprobe` được.
- **BR-CMKT-V03:** nhạc chỉ first-party bed hoặc skip nếu `PTT_CMKT_VIDEO_MUSIC=0`.
- **VO tốc độ:** `words / 2.5` giây (khớp SOP); ước lượng > max pack → `script_too_long` **trước** TTS/stock.
- **Provider staging:** `PTT_CMKT_VIDEO_PROVIDER=ffmpeg`. `stub` chỉ unit test. Thiếu binary → `ffmpeg_missing`, không fallback URL giả.
- **Quota:** `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP` (default 3) đếm job `social_*` / `video_short_generate`. Cap ảnh 20 **không** đếm video.
- **Pack V1:** `reels` (1080×1920), `shorts` (1080×1920), `feed_square` (1080×1080). Không `ads_15` / `linkedin_wide`.
- **API prefix:** `api/crm/service-lifecycle/:lifecycleId/content-marketing` — không đổi.
- **Pilot slug:** `tiep-thi-noi-dung`.
- **Import graph:** `video-social` ↛ `video-sop` / `video-cinematic`.
- **Commit:** chỉ khi user yêu cầu. Mỗi task: test xanh trước khi báo xong.
- **TDD:** viết test fail trước, rồi code tối thiểu.

---

## File map

```
docs/specs/postgresql-ddl-cmkt-video-social-v1.sql          # licenses
scripts/apply_pg_ddl_cmkt_video_social_v1.sh
scripts/smoke_content_marketing_video_social_v1.sh

services/ptt-crm-api/src/content-marketing/
  video-kernel/
    video-ffprobe.util.ts
    video-ffprobe.util.spec.ts
    video-pack.util.ts
    video-pack.util.spec.ts
    video-license.repository.ts
    video-progress.util.ts
  video-social/
    social-studio.util.ts                 # lock studio, one-shot, duration
    social-studio.util.spec.ts
    social-beat.service.ts
    social-beat.service.spec.ts
    social-ffmpeg.composer.ts
    social-ffmpeg.composer.spec.ts
    social-video-qa.service.ts
    social-video-qa.service.spec.ts
    social-video.service.ts               # storyboard + render + transcode
    social-video.service.spec.ts

Modify:
  content-marketing.types.ts              # storyboard, video_studio, video_qa
  content-marketing.module.ts             # register providers
  app-config.service.ts                   # flags
  content-media-generate.service.ts       # quota + delegate social
  content-job-worker.service.ts           # replace fake stitch
  content-media-video.provider.ts         # deprecate: gọi composer hoặc xóa path giả
  content-media-tts.provider.ts           # duration từ buffer length fallback
  content-marketing.controller.ts         # new routes
  content-marketing.controller.spec.ts

services/ops-web/src/
  components/content-os/ContentOsVideoStudioPicker.tsx
  components/content-os/social/ContentOsSocialVideoStudio.tsx
  components/content-os/ContentOsMediaStudio.tsx   # mount picker / social / hide cine
  lib/content-os-api.ts                   # lock studio, storyboard, render
  lib/content-os-api.spec.ts              # vitest nếu đã có pattern
```

**Ngoài plan:** `/crm/video`, `vd_*`, SC-01…16, Gate SOP.

---

### Task 1: Types, flags, khóa studio

**Files:**
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` (cạnh `contentMarketingVideoGenEnabled`)
- Modify: `services/ptt-crm-api/src/content-marketing/content-marketing.types.ts`
- Create: `services/ptt-crm-api/src/content-marketing/video-social/social-studio.util.ts`
- Test: `services/ptt-crm-api/src/content-marketing/video-social/social-studio.util.spec.ts`

**Interfaces:**
- Consumes: `CmktMediaJson` hiện tại
- Produces:
  - `lockVideoStudio(media, studio)` → `{ video_studio, studio_locked_at }`
  - `assertStudioWritable(media, next)` ném `studio_locked` nếu đã lock và `next !== media.video_studio`
  - `estimateVoDurationSec(text)` = `round(words/2.5)` clamp 8–60
  - `assertScriptFitsPack(text, packId)` ném `script_too_long` nếu estimate > max (reels/shorts 60, feed_square 45)

- [ ] **Step 1: Test fail**

```ts
import {
  assertScriptFitsPack,
  assertStudioWritable,
  estimateVoDurationSec,
  lockVideoStudio,
} from './social-studio.util';

describe('social-studio.util', () => {
  it('estimates VO at 2.5 words/sec', () => {
    expect(estimateVoDurationSec('một hai ba bốn năm')).toBe(2);
  });

  it('blocks script longer than reels max', () => {
    const long = Array.from({ length: 200 }, () => 'từ').join(' ');
    expect(() => assertScriptFitsPack(long, 'reels')).toThrow(/script_too_long/);
  });

  it('locks studio and rejects switch', () => {
    const locked = lockVideoStudio({}, 'social');
    expect(locked.video_studio).toBe('social');
    expect(() => assertStudioWritable(locked, 'cinematic')).toThrow(/studio_locked/);
  });
});
```

- [ ] **Step 2:** `npx jest src/content-marketing/video-social/social-studio.util.spec.ts --no-coverage`  
  Expected: FAIL module not found

- [ ] **Step 3: Implement** `lockVideoStudio`, `assertStudioWritable`, `estimateVoDurationSec`, `assertScriptFitsPack`. Thêm vào `CmktMediaJson`:

```ts
video_studio?: 'social' | 'cinematic';
studio_locked_at?: string;
storyboard?: CmktVideoStoryboard;
video_packs?: Record<string, CmktMediaAsset>;
video_qa?: CmktVideoQaResult;
```

(`CmktVideoStoryboard` / `CmktVideoBeat` / `CmktVideoQaResult` đúng spec §7.1.)

Config mới (default):

| Env | Default |
|-----|---------|
| `PTT_CMKT_VIDEO_SOCIAL` | cùng `PTT_CMKT_VIDEO_GEN` nếu unset |
| `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP` | `3` |
| `PTT_CMKT_VIDEO_ONE_SHOT` | `1` |
| `PTT_CMKT_VIDEO_MUSIC` | `1` |
| `PTT_CMKT_FFMPEG_BIN` | `ffmpeg` |
| `PTT_CMKT_VIDEO_PROVIDER` | đổi default **`ffmpeg`** (không `stub`) |

- [ ] **Step 4:** Jest PASS

- [ ] **Step 5:** Commit chỉ khi user yêu cầu — `feat(cmkt): social studio lock + VO 2.5 wps`

---

### Task 2: Kernel ffprobe + pack specs

**Files:**
- Create: `video-kernel/video-ffprobe.util.ts`
- Create: `video-kernel/video-ffprobe.util.spec.ts`
- Create: `video-kernel/video-pack.util.ts`
- Create: `video-kernel/video-pack.util.spec.ts`

**Interfaces:**
- Produces:
  - `assertFfmpegAvailable(bin: string): void` — spawnSync `${bin} -version`; ném `{ error: 'ffmpeg_missing' }`
  - `probeVideoBuffer` **không** bắt buộc V1 — `probeFile(path): { hasVideo, hasAudio, width, height, durationSec, fps }`
  - `SOCIAL_PACKS`: `{ reels: { w:1080,h:1920,min:12,max:60 }, shorts: same, feed_square: { w:1080,h:1080,min:12,max:45 } }`
  - `packSpec(id)` ném nếu không thuộc V1

- [ ] **Step 1: Test**

```ts
it('throws ffmpeg_missing when binary absent', () => {
  expect(() => assertFfmpegAvailable('/bin/no-such-ffmpeg-rnosai')).toThrow(/ffmpeg_missing/);
});

it('returns reels 1080x1920 max 60', () => {
  expect(packSpec('reels')).toEqual(expect.objectContaining({ width: 1080, height: 1920, maxSec: 60 }));
});

it('rejects ads_15 in V1', () => {
  expect(() => packSpec('ads_15')).toThrow(/pack_not_in_v1/);
});
```

- [ ] **Step 2:** Jest FAIL  
- [ ] **Step 3:** Implement spawnSync + pack map. Không gọi network.  
- [ ] **Step 4:** PASS  
- [ ] **Step 5:** `feat(cmkt): video kernel ffprobe + V1 packs`

---

### Task 3: DDL licenses + apply script

**Files:**
- Create: `docs/specs/postgresql-ddl-cmkt-video-social-v1.sql` — đúng SQL spec §7.2
- Create: `scripts/apply_pg_ddl_cmkt_video_social_v1.sh` (copy pattern `apply_pg_ddl_content_marketing.sh`)
- Create: `video-kernel/video-license.repository.ts` — `insertLicense(row)`, `listByItem(itemId)`

**Interfaces:**
- Produces: `VideoLicenseRepository.insertLicense({ lifecycleId, itemId, assetKind, provider, providerId, licenseName, sourceUrl, localStorageKey })`

- [ ] **Step 1:** Test repo với mock `pool.query` — assert INSERT cột `asset_kind IN (...)`.  
- [ ] **Step 2:** FAIL  
- [ ] **Step 3:** SQL + repo. Không FK cứng `cmkt_content_items` nếu bảng không cùng schema constraint sẵn — chỉ index `item_id`.  
- [ ] **Step 4:** `bash scripts/apply_pg_ddl_cmkt_video_social_v1.sh` trên DB local → `OK`  
- [ ] **Step 5:** `feat(cmkt): cmkt_video_licenses + apply script`

---

### Task 4: Beat parser (4 beat)

**Files:**
- Create: `video-social/social-beat.service.ts`
- Test: `video-social/social-beat.service.spec.ts`

**Interfaces:**
- Consumes: markdown script + `packId` + `estimateVoDurationSec`
- Produces: `parseBeats(script: string, durationSec: number): CmktVideoBeat[]` — luôn đúng 4 id `hook|pain|proof|cta`

Quy tắc V1 (không LLM):
1. Tách đoạn theo `\n\n` hoặc câu (`. `).
2. Gán lần lượt vào 4 beat; thiếu đoạn → gộp / lặp excerpt cuối.
3. `start_ms`/`end_ms` chia theo tỷ lệ SOP: hook 3s, cta 4s, còn lại chia đều `pain`/`proof` (không âm).
4. `keywords` = `extractClipKeywords(excerpt)` từ `content-media-stock.provider.ts` (export function đã có).
5. `on_screen_text` = 8 từ đầu excerpt.
6. `clip_id` = null, `locked` = false.

- [ ] **Step 1:**

```ts
it('always returns 4 beats hook-pain-proof-cta', () => {
  const beats = parseBeats('Hook ngắn.\n\nPain đây.\n\nProof số.\n\nCTA liên hệ.', 28);
  expect(beats.map((b) => b.id)).toEqual(['hook', 'pain', 'proof', 'cta']);
  expect(beats[0].end_ms).toBe(3000);
});

it('works with a single paragraph', () => {
  expect(parseBeats('Chỉ một đoạn dài về dịch vụ PTT ads.', 20)).toHaveLength(4);
});
```

- [ ] **Step 2–4:** TDD  
- [ ] **Step 5:** `feat(cmkt): social 4-beat parser`

---

### Task 5: FFmpeg composer (MP4 thật — cốt lõi)

**Files:**
- Create: `video-social/social-ffmpeg.composer.ts`
- Test: `video-social/social-ffmpeg.composer.spec.ts`

**Interfaces:**
- Consumes: `assertFfmpegAvailable`, local paths (voice.wav, clip0..n.mp4, optional bed.m4a, optional logo.png)
- Produces:

```ts
composeSocialMaster(input: {
  workDir: string;
  ffmpegBin: string;
  beats: CmktVideoBeat[];
  voicePath: string;
  clipPaths: string[];
  bedPath?: string;
  logoPath?: string;
  captionsAssPath: string;
  draftWatermark: boolean;
  width: number;
  height: number;
}): Promise<{ masterPath: string; posterPath: string }>;
```

Composer **cấm**:
- upload JSON rồi `replace('.json', '.mp4')`
- succeed khi `masterPath` không tồn tại hoặc `probeFile` thiếu video+audio

V1 filter tối thiểu:
1. `color=c=black:s={w}x{h}:d={duration}` nền
2. Mỗi clip: `scale=w:h:force_original_aspect_ratio=increase,crop=w:h,trim,setpts`
3. `concat` video; `amix` voice + bed (bed volume 0.15 nếu music on)
4. `subtitles=` captions.ass
5. `drawtext` hook 0–3s (text từ beat hook)
6. DRAFT: `drawtext` chéo `DRAFT` nếu flag
7. `-movflags +faststart` yuv420p aac 30fps

Captions: generate `captions.ass` từ beat `on_screen_text` + timing (function `buildAss(beats)` trong cùng file hoặc `social-captions.util.ts`).

- [ ] **Step 1: Test** — nếu CI không có ffmpeg, skip compose integration; **bắt buộc** test:

```ts
it('refuses to return a fabricated mp4 url', async () => {
  const composer = new SocialFfmpegComposer();
  await expect(
    composer.composeSocialMaster({
      workDir: '/tmp/nope',
      ffmpegBin: '/bin/no-such-ffmpeg-rnosai',
      beats: [],
      voicePath: '/tmp/x.wav',
      clipPaths: [],
      captionsAssPath: '/tmp/x.ass',
      draftWatermark: true,
      width: 1080,
      height: 1920,
    }),
  ).rejects.toThrow(/ffmpeg_missing/);
});
```

Nếu `which ffmpeg` OK trên máy dev:

```ts
it('writes probeable mp4 from generated color+sine fixtures', async () => {
  // spawn ffmpeg to create 2s color + 2s sine, then compose
  const out = await composer.composeSocialMaster(/* fixtures */);
  const probe = probeFile(out.masterPath);
  expect(probe.hasVideo && probe.hasAudio).toBe(true);
});
```

- [ ] **Step 2–4:** Implement spawn `ffmpeg` với `stdio: pipe`, timeout 180s, xóa workDir caller chịu.  
- [ ] **Step 5:** `feat(cmkt): social ffmpeg composer rejects missing binary`

Xóa / ngừng dùng path giả trong `content-media-video.provider.ts`: `generateShortVideo` **gọi composer** hoặc worker không còn gọi provider cũ khi `provider===ffmpeg`.

---

### Task 6: Video QA (không dùng OCR ảnh)

**Files:**
- Create: `video-social/social-video-qa.service.ts`
- Test: `video-social/social-video-qa.service.spec.ts`

**Interfaces:**
- Consumes: `probeFile` + `listByItem` licenses + pack spec
- Produces: `scoreMaster({ probe, packId, hasCaptions, hasHookLayer, hasLogoOrSkipped, draftWatermark, visualApproved, licenseCount }): CmktVideoQaResult`

Checks spec §10: `file_ok`, `duration_ok`, `aspect_ok`, `caption_ok`, `license_ok`, `watermark_ok`. Score `100 - 15*block - 5*warn`. `blocked` nếu bất kỳ block.

- [ ] **Step 1:**

```ts
it('blocks when no video stream', () => {
  const qa = scoreMaster({
    probe: { hasVideo: false, hasAudio: true, width: 1080, height: 1920, durationSec: 20, fps: 30 },
    packId: 'reels',
    hasCaptions: true,
    hasHookLayer: true,
    hasLogoOrSkipped: true,
    draftWatermark: true,
    visualApproved: false,
    licenseCount: 2,
  });
  expect(qa.blocked).toBe(true);
  expect(qa.checks.file_ok).toBe(false);
});

it('blocks approve-ready file without licenses', () => {
  const qa = scoreMaster({
    probe: { hasVideo: true, hasAudio: true, width: 1080, height: 1920, durationSec: 20, fps: 30 },
    packId: 'reels',
    hasCaptions: true,
    hasHookLayer: true,
    hasLogoOrSkipped: true,
    draftWatermark: true,
    visualApproved: false,
    licenseCount: 0,
  });
  expect(qa.checks.license_ok).toBe(false);
  expect(qa.blocked).toBe(true);
});
```

- [ ] **Step 2–4:** TDD — **không** gọi `ContentVisualQaService.scoreAssets`.  
- [ ] **Step 5:** `feat(cmkt): social video QA separate from image OCR`

---

### Task 7: Social jobs — storyboard + render + quota

**Files:**
- Create: `video-social/social-video.service.ts`
- Test: `video-social/social-video.service.spec.ts`
- Modify: `content-media-generate.service.ts`
- Modify: `content-marketing.controller.ts` + `.spec.ts`
- Modify: `content-job-worker.service.ts`

**Interfaces:**
- Produces:
  - `startStoryboard(lifecycleId, itemId, body, email)` → job `social_storyboard`
  - `patchStoryboard(lifecycleId, itemId, beatsPatch)`
  - `startRender(lifecycleId, itemId, body, email)` → job `social_render`
  - `startTranscode(lifecycleId, itemId, packs, email)` → job `social_transcode`
  - `startVideoQa(lifecycleId, itemId, email)` → job `social_qa`
- `startVideoShortJob` hiện tại: nếu `ONE_SHOT=1` và studio social/empty → enqueue storyboard rồi render (cùng request nếu sync, hoặc 2 job). Nếu `video_studio=cinematic` → `400 studio_mismatch`.

Quota: `countSocialJobsToday(lifecycleId)` chỉ `job_type LIKE 'social_%' OR job_type='video_short_generate'`. So với `contentMarketingVideoSocialDailyCap`. Ảnh không đếm.

Worker `social_storyboard`:
1. `lockVideoStudio(media, 'social')`
2. `assertScriptFitsPack`
3. TTS → upload `audio/mpeg` → license `tts`
4. `parseBeats` + stock per beat (max 4 clips) → license `stock_clip`
5. Persist `storyboard` + step progress thật
6. `visual_status=ai_ready` (storyboard, chưa bắt buộc mp4)

Worker `social_render`:
1. `assertFfmpegAvailable`
2. Download clips+tts vào `/tmp/cmkt-video/{jobId}/`
3. `composeSocialMaster`
4. Upload master.mp4 + poster.webp + srt
5. `probeFile` — fail job nếu không đạt V01
6. `scoreMaster` → `media.video_qa`
7. `video_short.url` = CDN **file đã upload**
8. Cleanup tmp

Worker `social_transcode`: scale/crop master → `video_packs.reels|shorts|feed_square`.

- [ ] **Step 1: Tests**

```ts
it('rejects cinematic item for social render', async () => {
  repo.getItemById.mockResolvedValue({
    format: 'video_script',
    channel: 'short_video',
    status: 'approved_internal',
    media_json: { video_studio: 'cinematic' },
  });
  await expect(svc.startRender(1, 2, {}, 'a@b.c')).rejects.toThrow(/studio_mismatch/);
});

it('counts only social jobs toward social cap', async () => {
  repo.countSocialJobsToday.mockResolvedValue(3);
  config.contentMarketingVideoSocialDailyCap = 3;
  await expect(svc.startStoryboard(1, 2, { pack_default: 'reels' }, 'a@b.c')).rejects.toThrow(/video_daily_cap/);
});
```

Worker unit: mock composer trả path; assert `patchItem` **không** chứa `.replace('-manifest.json', '.mp4')`.

- [ ] **Step 2–4:** Routes:

```
POST items/:id/jobs/video-storyboard
PATCH items/:id/video/storyboard
POST items/:id/jobs/video-render
POST items/:id/jobs/video-transcode
POST items/:id/jobs/video-qa
POST items/:id/video/lock-studio   { "studio": "social" }
```

Giữ `POST jobs/video-short` (one-shot).

- [ ] **Step 5:** `feat(cmkt): social storyboard/render jobs + quota`

---

### Task 8: Clean DRAFT on visual approve + pack default

**Files:**
- Modify: `content-media-clean.service.ts` — nếu `video_short` social: re-render không watermark **hoặc** upload bản `clean_storage_key` đã compose song song (V1: compose lại `draftWatermark=false` nếu có storyboard).
- Modify: visual approve path đã gọi clean — giữ.
- Transcode mặc định sau render: `requested_packs` default `['reels']`; nếu item `channel=youtube` → `shorts`; facebook feed không đổi master.

- [ ] **Step 1:** Test clean sets `draft_watermark=false` trên asset video sau approve mock.  
- [ ] **Step 2–4:** Implement  
- [ ] **Step 5:** `feat(cmkt): social clean master after visual approve`

---

### Task 9: FE picker + Social studio + `<video>`

**Files:**
- Create: `services/ops-web/src/components/content-os/ContentOsVideoStudioPicker.tsx`
- Create: `services/ops-web/src/components/content-os/social/ContentOsSocialVideoStudio.tsx`
- Modify: `ContentOsMediaStudio.tsx` — nếu item video:
  - chưa `video_studio` → Picker (2 card: FFmpeg / SOP)
  - `social` → `ContentOsSocialVideoStudio`
  - `cinematic` → text: “Mở Video SOP `/crm/video` (Module 7 — chưa ship thì disabled + link spec)” — **không** form beat
- Modify: `content-os-api.ts` — `lockVideoStudio`, `postSocialStoryboard`, `patchSocialStoryboard`, `postSocialRender`

**UI Social (đúng spec Dual + Video OS §9):**
- Pack select: Reels / Shorts / Feed 1:1
- Preset + Voice
- Nút **Tạo storyboard** / **Render video**
- 4 beat: text + clip id (read-only V1 nếu chưa search UI)
- Progress: 8 step (`script`…`packs`) từ `video_generation.steps`
- Preview: **`<video controls playsInline poster={poster_url} src={url} />`** — cấm `<img src={mp4}>`
- QA score + checks
- Submit visual / Duyệt visual (giữ API cũ)

Picker SOP card: `disabled` nếu `NEXT_PUBLIC` không có cinematic flag (default off). Click Social → `lock-studio` + storyboard.

- [ ] **Step 1:** Vitest hoặc RTL: picker hiện 2 nhãn **Video tuần (FFmpeg)** và **Video chiến dịch (SOP)**.  
- [ ] **Step 2–4:** Implement  
- [ ] **Step 5:** `feat(ops-web): social video studio picker + video element`

---

### Task 10: Smoke + docs + health

**Files:**
- Create: `scripts/smoke_content_marketing_video_social_v1.sh`
- Modify: `docs/huong-dan-su-dung/18-content-marketing-os.md` §17 — bước UI V1 (picker → storyboard → render → preview)
- Modify: deploy staging env list: `PTT_CMKT_VIDEO_PROVIDER=ffmpeg`, `PTT_CMKT_VIDEO_SOCIAL=1`, cap 3
- Optional: `/health` hoặc smoke bước 0: `ffmpeg -version`

Smoke (cần staff token + `LIFECYCLE_ID` + item `video_script` approved — hoặc tạo item trong script):

1. `POST lock-studio` social  
2. `POST video-storyboard`  
3. Poll job ≠ failed với `ffmpeg_missing` trên CI không có ffmpeg — **skip render** nếu `SMOKE_SKIP_FFMPEG=1`  
4. Trên VPS có ffmpeg: render → `GET item` → `video_short.url` kết thúc `.mp4`  
5. `ffprobe` URL hoặc download head — fail nếu body JSON  

- [ ] **Step 1–4:** Script + docs  
- [ ] **Step 5:** `docs(cmkt): social ffmpeg V1 smoke + UI guide`

---

## Thứ tự & phụ thuộc

```
T1 types/flags/lock
  → T2 ffprobe/packs
  → T3 licenses
  → T4 beats
  → T5 composer
  → T6 QA
  → T7 jobs/worker
  → T8 clean
  → T9 FE
  → T10 smoke/docs
```

T4 song song T2/T3. T5 cần T2. T7 cần T3–T6.

## Definition of done (V1)

- [ ] EC-VIDEO-01…12 (trừ pack LinkedIn/Ads)  
- [ ] EC-DUAL-01 (picker), 02 (không gọi Kling), 04 (`studio_locked`), 06 (import)  
- [ ] Một video tiếng Việt 15–35s play được trong drawer  
- [ ] `grep -n "replace('-manifest.json'" services/ptt-crm-api/src/content-marketing` → không còn trên path social  
- [ ] Module 7 / `/crm/video` **không** xuất hiện trong diff

## Rủi ro

| Rủi ro | Xử lý trong plan |
|--------|------------------|
| CI không có ffmpeg | Unit `ffmpeg_missing`; smoke skip; VPS cài `ffmpeg` trong deploy note |
| Pexels lệch | Upload B-roll = V2; V1 chấp nhận stub clip **chỉ** khi stock stub **và** composer dùng generated color nếu clip 404 — **không** bịa URL master |
| One-shot che storyboard | Flag `ONE_SHOT=1` cho UAT cũ; docs nói GA lật `0` |

---

## Việc không làm trong plan này

- Module 7 SOP (S1–S10)  
- ElevenLabs, storyboard clip search UI, music 4 bed file (V2)  
- `ads_15`, `linkedin_wide`  
- Avatar / Runway
