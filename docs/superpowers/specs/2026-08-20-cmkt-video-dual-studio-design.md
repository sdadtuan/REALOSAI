# Design: Hai studio video — Social (FFmpeg V1) và SOP (Cinematic)

**Ngày:** 2026-08-20  
**Document ID:** CMKT-VIDEO-DUAL-20260820  
**Phiên bản:** 1.0  
**Trạng thái:** Khóa kiến trúc  
**Parent Social/FFmpeg:** [`2026-08-20-cmkt-professional-video-os-design.md`](./2026-08-20-cmkt-professional-video-os-design.md)  
**Parent SOP:** `SOP san xuat video chuyen nghiep.docx`  
**Module 7 (BA → RNOSAI):** [`2026-08-20-video-sop-module-7-design.md`](./2026-08-20-video-sop-module-7-design.md)  
**Content OS:** [`2026-08-09-content-marketing-os-design.md`](./2026-08-09-content-marketing-os-design.md)

---

## 1. Quyết định

**Có — tách thành 2 module/studio riêng.** Người dùng **chọn một** khi tạo (hoặc mở lần đầu) item video. Hai pipeline **không trộn job, không trộn provider, không trộn QC**.

Không tách thành 2 app CRM. Vẫn neo `/crm/service-delivery/[id]?tab=content-os`.

```
Content OS (item, review, calendar, publish, caps)
        │
        ├── video-kernel     (storage, ffprobe, pack, job poll, license row)
        ├── video-social     (FFmpeg V1 — retainer / tuần)
        └── video-cinematic  (SOP G1–G4 — chiến dịch / QC)
```

**Lý do tách (lâu dài):**

| Nếu gộp 1 module | Nếu tách 2 studio |
|------------------|-------------------|
| Nút one-shot phá 4 cổng SOP | SOP không bao giờ one-shot |
| Nâng Kling làm hỏng stock render | Đổi Leonardo/Kling không đụng FFmpeg |
| Quota/credit lẫn | Flag + cap + cost riêng |
| QA ảnh/stock lẫn QC giải phẫu | Checklist khác, reviewer khác |
| SOP §9: cấm đổi tool giữa project | `engine` khóa sau lần chọn |

---

## 2. Người dùng chọn thế nào

### 2.1. Điểm chọn (bắt buộc 1 lần)

Khi item `format=video_script` (hoặc `channel=short_video`) **chưa có** `media_json.video_studio`:

```
┌ Chọn studio video ──────────────────────────────────────────┐
│ ○ Video tuần — Social (FFmpeg)                               │
│    15–35s · TTS + B-roll · caption · vài phút · rẻ          │
│    Phù hợp: Reels/TikTok retainer, lịch tuần                 │
│                                                              │
│ ○ Video chiến dịch — SOP Studio                              │
│    15–60s · 4 cổng QC · keyframe → Kling/Runway · 9–18 giờ  │
│    Phù hợp: QC, brand, sản phẩm, ads                         │
│                                                              │
│ [Bắt đầu]   Không đổi studio sau khi đã có job.              │
└──────────────────────────────────────────────────────────────┘
```

Nhãn UI khóa:

- `social` → **Video tuần (FFmpeg)**  
- `cinematic` → **Video chiến dịch (SOP)**

### 2.2. Luật đổi studio

| Tình huống | Hành vi |
|------------|---------|
| Chưa có job video | Cho đổi |
| Đã storyboard / shot / take | **Cấm** đổi — toast: “Tạo item video mới (clone script)” |
| Clone | `POST items/:id/clone-video-studio` — copy script/brief, **không** copy keyframe/takes/mp4 |
| SOP đang chạy | Lock `provider_set` (Leonardo+Kling…) — SOP §9 |

Board card + drawer badge: `FFmpeg` | `SOP` để Lead lọc.

---

## 3. Ranh giới module

### 3.1. `video-kernel` (dùng chung — mỏng)

**Được** dùng chung:

- `ContentMediaStorageService` (S3/CDN, sha256)  
- `ffprobe` helper, LUFS đo sau khi **đã có MP4**  
- Transcode **pack** (reels / shorts / feed_square) từ một master  
- Bảng `cmkt_video_licenses`  
- Poll job + progress DTO  
- Overlay logo/caption **nếu studio gọi** (API kernel, không tự quyết pipeline)  
- Preview `<video>` component  
- Publish gate `visual_status=approved` + BR-CMKT-02  

**Cấm** nằm trong kernel:

- Pexels / TTS / FFmpeg filter_complex storyboard  
- Leonardo / Kling / Runway / Topaz  
- Shotlist SOP, bible, 4 gate checklist  
- Beat model 4 nhịp social  

Kernel **không** import social hay cinematic. Hai studio import kernel.

### 3.2. Studio Social — `video-social` (FFmpeg V1)

**Trách nhiệm:** beat hook/pain/proof/CTA → TTS → stock → FFmpeg stitch → video QA file → pack.

**Cấm:** gọi Kling/Runway/Leonardo; không có Gate 2/3 giải phẫu; không overshoot 2,5×.

**Flag:** `PTT_CMKT_VIDEO_SOCIAL=1` (alias đọc `PTT_CMKT_VIDEO_GEN` đến khi GA).  
**Quota:** `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP=3`.  
**Jobs:** `social_storyboard`, `social_render`, `social_transcode`, `social_qa`.  
**UC:** 036 (umbrella social), 039–044 trong spec Video OS.  
**UI:** `ContentOsSocialVideoStudio.tsx` (thay khối video trong Media AI khi `video_studio=social`).

Nâng cấp độc lập: ElevenLabs, music ducking, stock search — **không** đụng SOP.

### 3.3. Studio SOP — `video-cinematic` (G1–G4)

**Trách nhiệm:** Brief 9 mục → director (3 idea) → shotlist + bible → Gate 1–4 → Leonardo KFA/KFB → Kling/Runway takes → concat selects + đồ họa G4 → escalate 4K.

**Cấm:** one-shot; Pexels làm shot chính; animate keyframe chưa `approved`; chữ trong AI frame.

**Flag:** `PTT_CMKT_VIDEO_CINEMATIC=1`.  
**Quota:** `PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP=1` (campaign) + **credit ledger** (không dùng cap social).  
**Jobs:** `cine_script_director`, `cine_keyframe`, `cine_motion_draft`, `cine_motion_final`, `cine_compose`, `cine_transcode`.  
**UC:** 047+ (xem §6) — không tái sử dụng 039–044.  
**UI:** Hub `/crm/video` + 16 màn SC-01…16 — spec Module 7. Không nhét SOP vào form beat Media AI.

Nâng cấp độc lập: đổi Kling 3.0 → 3.1, thêm Runway dual, Topaz — **không** đụng FFmpeg social.

---

## 4. Cấu trúc code (để nâng cấp)

```
services/ptt-crm-api/src/content-marketing/
  video-kernel/
    video-storage.facade.ts
    video-pack.transcoder.ts
    video-ffprobe.util.ts
    video-license.repository.ts
    video-job-progress.util.ts
  video-social/
    social-video.module.ts          # Nest submodule
    social-video.controller.ts      # /video/social/*
    social-beat.service.ts
    social-ffmpeg.composer.ts
    social-video-qa.service.ts
  video-cinematic/
    cinematic-video.module.ts
    cinematic-video.controller.ts   # /video/cinematic/*
    cine-script.service.ts          # G1
    cine-keyframe.service.ts        # G2 Leonardo adapter
    cine-motion.service.ts          # G3 Kling/Runway
    cine-gate.service.ts            # Gate 1–4
    cine-compose.service.ts         # G4 in-app (1080 social deliverable)

services/ops-web/src/components/content-os/
  ContentOsVideoStudioPicker.tsx
  social/ContentOsSocialVideoStudio.tsx
  cinematic/ContentOsCinematicVideoStudio.tsx
```

API prefix tách:

```
.../content-marketing/video/social/...
.../content-marketing/video/cinematic/...
```

Job type **namespace** (`social_*` / `cine_*`) — worker `switch` hai file, không một hàm 800 dòng.

FE: Media AI tab chỉ mount **một** studio theo `video_studio`. Picker là màn hình riêng, không tab lẫn control.

---

## 5. Data

```ts
media_json.video_studio: 'social' | 'cinematic'   // immutable sau job đầu
media_json.studio_locked_at: string
media_json.provider_set?: { image?: string; motion?: string; tts?: string }
```

| Studio | Khối JSON riêng |
|--------|-----------------|
| social | `storyboard`, `video_short`, `video_qa` (spec Video OS) |
| cinematic | `bible`, `shots[]`, `takes[]`, `pipeline_gate`, `credit_estimate` |

**Không** field `beats` trên item cinematic. **Không** `shots` trên item social.

DDL: `cmkt_video_takes` + `cmkt_video_credits` **chỉ** cinematic. Social không tạo take.

---

## 6. Use case tách số

Giữ 036 = “có video trên item”.  
039–044 = **chỉ Social**.  
Mới:

| ID | Studio | Tên |
|----|--------|-----|
| CMKT-UC-047 | — | Chọn studio (picker) |
| CMKT-UC-048 | — | Clone item sang studio kia |
| CMKT-UC-049 | cinematic | G1 director + Gate 1 |
| CMKT-UC-050 | cinematic | G2 keyframe + Gate 2 |
| CMKT-UC-051 | cinematic | G3 motion takes + Gate 3 |
| CMKT-UC-052 | cinematic | G4 compose social deliverable + Gate 4 |
| CMKT-UC-053 | cinematic | Escalate master 4K / Editor |

---

## 7. Flags & caps

| Env | Studio |
|-----|--------|
| `PTT_CMKT_VIDEO_SOCIAL` | Social |
| `PTT_CMKT_VIDEO_CINEMATIC` | SOP |
| `PTT_CMKT_VIDEO_SOCIAL_DAILY_CAP` | default 3 |
| `PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP` | default 1 |
| `PTT_CMKT_LEONARDO_*` / `PTT_CMKT_KLING_*` / `PTT_CMKT_RUNWAY_*` | chỉ cinematic |
| `PTT_CMKT_TTS_*` / `PTT_CMKT_STOCK_*` / `PTT_CMKT_FFMPEG_BIN` | Social; cinematic **được** dùng TTS ở G4 overlay |

Cap RBAC (V1 chung `crm_content.generate`; V2 tách nếu cần):

- `crm_content.video_social`  
- `crm_content.video_cinematic`  

Picker ẩn studio nếu flag off hoặc thiếu cap.

---

## 8. Review queue

Hai hàng (hoặc filter chip):

- **Video tuần** — visual QA file (UC-043)  
- **Video SOP** — Gate 1/2/3/4  

Không trộn “Duyệt visual” một nút cho cả keyframe và MP4 stock.

---

## 9. Lộ trình ship độc lập

```
Kernel (storage + <video> preview + pack)
    │
    ├─ Social V1     ← ship trước (retainer chạy ngay)
    │     Social V2  ElevenLabs, music, stock search
    │
    └─ Cinematic A   G1 + picker + lock engine
          Cinematic B   G2 Leonardo
          Cinematic C   G3 Kling/Runway
          Cinematic D   G4 + escalate
```

Hai team/sprint **không chặn nhau** sau kernel. Social V1 không chờ Leonardo key.

---

## 10. Anti-pattern (cấm khi implement)

1. `if (studio==='cinematic')` nhét vào `social-ffmpeg.composer.ts`.  
2. Nút “Generate short video” trên item SOP.  
3. Dùng Pexels thay shot fail rồi vẫn gắn badge SOP. Fallback Ken Burns = **hành động G3 trong cinematic**, file `cine-compose`, không gọi `social-render`.  
4. Một `video_short_generate` phục vụ cả hai.  
5. Shared “Media AI Studio” form (preset/size/variants) cho SOP G2. SOP có form shot/seed/bible riêng.

---

## 11. Acceptance tách module

| ID | Tiêu chí |
|----|----------|
| EC-DUAL-01 | Picker hiện khi chưa chọn studio; 2 card đúng nhãn |
| EC-DUAL-02 | Social job không gọi URL Leonardo/Kling/Runway |
| EC-DUAL-03 | Cinematic không tạo `social_*` job |
| EC-DUAL-04 | Đổi studio sau job đầu → 400 `studio_locked` |
| EC-DUAL-05 | Flag cinematic=0 → chỉ còn Social (và ngược lại) |
| EC-DUAL-06 | Import graph: social ↛ cinematic, cinematic ↛ social |
| EC-DUAL-07 | Clone tạo item mới, `video_studio` khác, script copy, media trống |

---

## 12. Changelog

| Ver | Ngày | Nội dung |
|-----|------|----------|
| 1.0 | 2026-08-20 | Khóa 2 studio + kernel; user picker; UC-047…053 |
