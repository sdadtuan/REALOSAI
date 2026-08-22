# Video SOP L5 Adapters (hướng A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden tầng L5 Module 7 tại chỗ — Capability Registry, contract `IProviderAdapter`, live Leonardo v2 / OpenAI Responses / Runway / Kling-via-Leonardo / Topaz — không viết lại SOP S1–S10.

**Architecture:** Widen `video-sop/adapters/**` và evolve `vd_models.capability_json`. L3 tiếp tục `selectXxx()`. Dispatcher S13+ gọi `submit`/`poll`/`fetchOutputs`. Kling MVP `VIA_LEONARDO` only.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL `vd_*`, Jest, Vitest ops-web (SC-15), `providerFetch` hiện có.

**Spec:** [`2026-08-21-video-sop-l5-adapter-design.md`](../specs/2026-08-21-video-sop-l5-adapter-design.md) · Adapter Spec PTT-SA-M7-ADAPTER v1.0 · cha [`2026-08-20-video-sop-module-7-design.md`](../specs/2026-08-20-video-sop-module-7-design.md)

**S11 TDD từng bước:** [`2026-08-21-video-sop-s11.md`](./2026-08-21-video-sop-s11.md) — chạy hết S11 trước Task 10 (S12).

## Global Constraints

- Không import `services/ptt-crm-api/src/content-marketing/video-social/**` (EC-DUAL-06). `social-studio.util` vẫn được.
- Không tạo `social_*` trong `vd_jobs` (AC-R1).
- Không HTTP `api-singapore.klingai.com` / JWT Kling (ADR-L5-04).
- Secret chỉ env: `PTT_VD_LEONARDO_API_KEY` · `PTT_VD_RUNWAY_API_KEY` · `PTT_VD_TOPAZ_API_KEY` · `OPENAI_API_KEY` · `PTT_VD_KLING_ACCESS_KEY` / `PTT_VD_KLING_SECRET_KEY` (reserved, unused until DIRECT).
- L3 không `import` file `kling.video.ts` / `runway.video.ts` / `leonardo.image.ts` — chỉ `i-*.ts` + `vd-model-router.ts`.
- Tham số canonical không hỗ trợ → `error_class=capability`, không gọi HTTP.
- `E_MODERATION` → `moderation`, không retry, tạo rework Lead nếu shot_id có.
- Leonardo HTTP 200 + `generated_images: []` = `not_ready`, không `succeeded`.
- Runway `DELETE` chỉ khi status `PENDING`/`THROTTLED`/`RUNNING`. SUCCEEDED phải `fetchOutputs` trước.
- Flag cinematic + cap daily project giữ nguyên.
- Test S1–S10 hiện có phải xanh sau mỗi sprint. Widen additive.
- Commit chỉ khi user yêu cầu. TDD. Một sprint đỏ thì không mở sprint sau.

### Quyết định khóa (payload)

**`error_class` CHECK mới:** `auth` · `validation` · `budget` · `rate_limit` · `moderation` · `input_asset` · `capability` · `transient` · `timeout` · `not_ready` · `provider` · `unknown`.

**`status` CHECK mới:** thêm `submitted` · `expired` (giữ `created` `queued` `running` `succeeded` `failed` `cancelled` `stale`).

**`CanonicalRequest`:**

```ts
export type VdCapability =
  | 'TEXT_GEN' | 'IMAGE_GEN' | 'VIDEO_GEN' | 'ENHANCE_IMAGE' | 'ENHANCE_VIDEO';
export type VdIntent = 'DRAFT' | 'FINAL';
export type VdProviderCode = 'openai' | 'leonardo' | 'kling' | 'runway' | 'topaz' | 'flux' | 'ffmpeg';

export type CanonicalRequest = {
  job_id: string;
  project_id: number;
  shot_id: number | null;
  capability: VdCapability;
  provider_code: VdProviderCode;
  model_key: string;
  intent: VdIntent;
  params: Record<string, unknown>;
  inputs: Array<{ role: string; asset_id?: number; url?: string; delivery?: 'URL' | 'UPLOAD' | 'DATA_URI' }>;
  budget?: { max_credits?: number; max_usd?: number };
  callback?: { mode: 'WEBHOOK' | 'POLL'; url?: string };
  meta?: { requested_by?: string; sop_gate?: string; attempt?: number };
};
```

**8 `model_key` seed (code = model_key):**
`text.openai.script` · `image.leonardo.lucid_origin` · `enhance.leonardo.upscale_precise` · `video.kling.v3.pro` · `video.runway.gen45` · `video.runway.gen4_turbo_draft` · `enhance.topaz.image_gigapixel` · `enhance.topaz.video_starlight_quality`

---

## File map

```
docs/specs/postgresql-ddl-vd-sop-s11.sql … s14.sql
scripts/apply_pg_ddl_vd_sop_s{11..14}.sh
scripts/smoke_video_sop_s11.sh … s14.sh
scripts/deploy_video_sop_s11_vps.sh … (khi user yêu cầu deploy)

services/ptt-crm-api/src/video-sop/
  adapters/
    i-provider.ts              # IProviderAdapter + types
    i-provider.spec.ts
    provider-error.ts          # map HTTP → error_class
    provider-error.spec.ts
    capability-registry.ts     # đọc vd_models
    capability-registry.spec.ts
    preflight.ts               # AP-06
    preflight.spec.ts
    asset-delivery.ts
    asset-delivery.spec.ts
    i-text-gen.ts / openai.text.ts          # S12 widen
    i-image-gen.ts / leonardo.image.ts      # S12 v2
    i-video-gen.ts / kling.video.ts / runway.video.ts  # S13
    i-enhance.ts / topaz.enhance.ts         # S14
    leonardo.video.ts                       # S13 VIA_LEONARDO
  jobs/vd-job.types.ts                      # status + error_class
  jobs/vd-job.repository.ts
  admin/vd-admin.service.ts                 # list registry fields
  orchestration/vd-dispatcher.service.ts
  orchestration/vd-poller.service.ts        # S13 poll cadence
  orchestration/vd-webhook.controller.ts    # S12+
  orchestration/vd-model-router.ts          # intent → model_key
  cost/vd-cost.service.ts                   # estimate() from adapter
```

**Ngoài L5:** không đụng brief/gate/portal/dashboard trừ SC-15 hiện `verified_at`.

---

## Sprint S11 — Contract + registry + AssetDelivery

Chi tiết TDD: [`2026-08-21-video-sop-s11.md`](./2026-08-21-video-sop-s11.md)

| Task | Deliverable |
|------|-------------|
| 1 | DDL s11 + seed 8 model_key |
| 2 | `provider-error.ts` + map 12 class |
| 3 | `IProviderAdapter` + `capabilities()` từ DB (CT-01) |
| 4 | `preflight.ts` — CT-02/CT-03 không HTTP |
| 5 | `vd_job_provider_ref` + submit idempotent (CT-04) |
| 6 | `vd_webhook_events` + parseWebhook dedupe (CT-05/06) |
| 7 | `AssetDeliveryService` — Content-Type + 5 strategy stub |
| 8 | Dispatcher: `submitted`, `not_ready` không FAILED, moderation no-retry |
| 9 | Smoke S11 + SC-15 hiện model_key / verified_at |

---

## Sprint S12 — Leonardo v2 + OpenAI Responses

### Task 10: OpenAI Responses + schema `video_script`

**Files:**
- Modify: `services/ptt-crm-api/src/video-sop/adapters/openai.text.ts`
- Modify: `services/ptt-crm-api/src/video-sop/adapters/i-text-gen.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/openai.text.spec.ts`
- Modify: `services/ptt-crm-api/src/video-sop/script/vd-script.service.ts` (parse shots từ schema)

**Interfaces:**
- `OpenAITextGen` implement `IProviderAdapter` + giữ `complete()` facade.
- `submit` → `POST https://api.openai.com/v1/responses` với `background: true`, `store: true`, `text.format: { type: "json_schema", strict: true, name: "video_script", schema }`.
- `model` đọc `provider_model_id` từ registry (`gpt-5.6` seed; thiếu key → stub như cũ).
- Schema bắt buộc: `title`, `total_duration_sec`, `hook_line`, `cta_line`, `shots[]` với `shot_no`, `duration_sec`, `scene_desc`, `camera`, `shot_size`, `image_prompt`, `motion_prompt`, `negative_prompt`, `vo_script`, `onscreen_text`, `risk_flags`.
- `parseWebhook`: verify header `webhook-id` + `webhook-signature` nếu `OPENAI_WEBHOOK_SECRET` set; thiếu secret ở staging → chỉ chấp nhận `x-ptt-internal-key`.
- Map 401→`auth`, 429+Retry-After→`rate_limit`, 429 `insufficient_quota`→`budget`, 500/503→`transient`.

- [ ] **Step 1: Failing test — background luôn kèm store**

```ts
it('sets store true when background true', () => {
  const body = buildOpenAiResponseBody({ prompt: 'x', schema: VIDEO_SCRIPT_SCHEMA });
  expect(body.background).toBe(true);
  expect(body.store).toBe(true);
});
```

- [ ] **Step 2: Failing test — schema thiếu additionalProperties:false bị preflight `capability`**

- [ ] **Step 3: Implement `buildOpenAiResponseBody` + map errors; `complete()` gọi Responses rồi parse JSON (giữ 3 ideas path nếu `params.mode==='ideas'`)**

- [ ] **Step 4:** `npx jest src/video-sop/adapters/openai.text.spec.ts --no-coverage` — PASS

- [ ] **Step 5:** Commit khi user yêu cầu: `feat(vd): S12 OpenAI Responses structured video_script`

### Task 11: Leonardo v2 generations + guidances

**Files:**
- Modify: `services/ptt-crm-api/src/video-sop/adapters/leonardo.image.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/leonardo.image.spec.ts`
- Modify: `adapters/i-image-gen.ts` — thêm `guidances?` vào `VdImageGenInput`

**Interfaces:**
- Default route `DIRECT` v2: `POST https://cloud.leonardo.ai/api/rest/v2/generations` body `{ model, parameters }`.
- `image.leonardo.lucid_origin` → `model: "lucid-origin"`.
- Character strength ULTRA/MAX → HIGH + warning trong `request_snapshot.warnings` (không im lặng).
- Poll `GET /v1/generations/{id}`: `status==COMPLETE` **và** `generated_images.length>0` mới SUCCEEDED; `[]` → throw `{ error_class: 'not_ready' }`.
- Upload: `AssetDeliveryService.deliver({ provider_code: 'leonardo' })` = init-image 2 bước, **không** gửi Authorization lên presigned URL.
- Giữ v1 path khi `capability_json.route==='VIA_V1_CONTROLNETS'` (chưa dùng S12).

- [ ] **Step 1: Test 200 + empty images → not_ready**

```ts
it('maps complete empty images to not_ready', () => {
  expect(mapLeonardoPoll({ generations_by_pk: { status: 'COMPLETE', generated_images: [] } })).toEqual({
    status: 'running',
    error_class: 'not_ready',
  });
});
```

- [ ] **Step 2: Test character ULTRA maps to HIGH + warning**

- [ ] **Step 3: Implement v2 payload builder + poll mapper; `generate()` facade vẫn trả Buffer**

- [ ] **Step 4:** Jest PASS `leonardo.image.spec.ts` + `i-image-gen.spec.ts`

- [ ] **Step 5:** Commit: `feat(vd): S12 Leonardo v2 guidances and empty-array guard`

### Task 12: Webhook Leonardo + smoke S12

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/orchestration/vd-webhook.controller.ts`
- Create: `scripts/smoke_video_sop_s12.sh`
- Create: `docs/specs/postgresql-ddl-vd-sop-s12.sql` (no-op comment + index nếu thiếu)
- Modify: `video-sop.module.ts`

**Interfaces:**
- `POST /api/v1/vd/webhooks/leonardo` — header `authorization: Bearer <PTT_VD_LEONARDO_WEBHOOK_KEY>`.
- Sai/thiếu key → 401, không đổi job (CT-06).
- Trùng `data.object.id` + event type → 200 no-op (CT-05).
- Smoke: registry có `image.leonardo.lucid_origin`; `POST /api/v1/vd/jobs` keyframe vẫn 201; webhook bad sig 401.

- [ ] Implement controller + tests + smoke. Commit: `feat(vd): S12 Leonardo webhook and smoke`

---

## Sprint S13 — Runway live + Kling VIA_LEONARDO

### Task 13: Runway image_to_video

**Files:**
- Modify: `services/ptt-crm-api/src/video-sop/adapters/runway.video.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/runway.video.spec.ts` (tạo mới)
- Modify: `adapters/i-video-gen.ts` — `model_key` + `intent` trên input
- Modify: `orchestration/vd-model-router.ts` — `intent==='DRAFT'` → `video.runway.gen4_turbo_draft`

**Interfaces:**
- `POST https://api.dev.runwayml.com/v1/image_to_video`
- Headers: `Authorization: Bearer $PTT_VD_RUNWAY_API_KEY`, `X-Runway-Version` từ `capability_json.async.api_version` default `2024-11-06`.
- `gen4.5`: `promptText`, `promptImage` (URL từ AssetDelivery), `ratio` từ `resolution_tier`+`aspect_ratio`, `duration` 2–10.
- `gen4_turbo`: draft; `promptText` optional.
- Preflight: duration không nằm enum model → `capability` (veo3.1 chỉ 4/6/8 — chưa seed S13).
- `estimate`: `max(rate * duration_sec, min_charge ?? 0)`; gen4.5 rate 12, turbo 5, usd_per_credit 0.01.
- Poll `GET /v1/tasks/{id}` ≥5s + jitter (poller, không trong adapter sleep cứng 1.5s).
- `SAFETY.INPUT.*` → `moderation`.
- `fetchOutputs`: tải URL, ghi `vd_assets`; URL chết → job `expired`.
- `cancel`: GET status trước; chỉ DELETE khi PENDING/THROTTLED/RUNNING.
- Thiếu key: giữ hành vi S6 — enqueue ném `auth` (không Buffer giả khi key rỗng). **Bỏ stub Buffer khi key có.**

- [ ] **Step 1: Test estimate sàn**

```ts
it('uses min_charge when higher than rate*duration', () => {
  expect(estimateRunwayCredits({ rate: 28, duration_sec: 1, min_charge: 56 })).toBe(56);
});
```

- [ ] **Step 2: Test DELETE blocked after SUCCEEDED without fetch**

- [ ] **Step 3: Implement live submit/poll/fetch/cancel; stub chỉ khi `PTT_VD_PROVIDER_STUB=1`**

- [ ] **Step 4:** Jest PASS. Commit: `feat(vd): S13 Runway image_to_video live adapter`

### Task 14: Kling VIA_LEONARDO

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/adapters/leonardo.video.ts`
- Modify: `adapters/kling.video.ts` — delegate to LeonardoVideoGen khi `route==='VIA_LEONARDO'`
- Test: `adapters/leonardo.video.spec.ts`

**Interfaces:**
- `KlingVideoGen.providerName` vẫn `'kling'` (queue `q.video.kling` không đổi).
- `submit` → Leonardo `POST /v2/generations` `model: "kling-3.0"` (từ `provider_model_id`).
- Constraints: duration 3–15, prompt ≤1500, `guidances.start_frame` / `end_frame`; end_frame yêu cầu start_frame; không kèm `image_reference` khi có end_frame.
- `enable_audio` / `motion_has_audio` từ `params.audio_enabled`.
- Không import PiAPI/fal trong S13.

- [ ] Test end_frame without start_frame → `capability` trước HTTP.
- [ ] Implement. Commit: `feat(vd): S13 Kling via Leonardo IVideoGen`

### Task 15: Poller cadence + smoke S13

**Files:**
- Modify: `orchestration/vd-poller.service.ts`
- Create: `scripts/smoke_video_sop_s13.sh`
- Create: `docs/specs/postgresql-ddl-vd-sop-s13.sql` (comment only nếu không ALTER)

**Interfaces:**
- `pollSecFor(model_key)` đọc `capability_json.async.poll_sec` (OpenAI 2, Runway 5, Leonardo/Kling 10).
- Jitter `delay = poll_sec * (1 + random()*0.5)` khi retry transient.
- Smoke: `intent=DRAFT` chọn `video.runway.gen4_turbo_draft`; storyboard social trên item cinematic vẫn 400 (giữ dual).
- `VD_E2E_PROVIDERS=1` mới gọi API thật; mặc định stub flag hoặc skip live.

- [ ] Implement + smoke. Commit: `feat(vd): S13 poller cadence and smoke`

---

## Sprint S14 — Topaz + đối soát cost

### Task 16: Topaz image async

**Files:**
- Modify: `adapters/topaz.enhance.ts`
- Test: `adapters/topaz.enhance.spec.ts` (tạo)
- Modify: `i-enhance.ts` — `enhance(req: CanonicalRequest)` + facade `enhance(inputPath)`

**Interfaces:**
- `POST https://api.topazlabs.com/image/v1/enhance/async` header `X-API-Key`.
- Poll `GET /image/v1/status/{process_id}` mỗi 2s.
- Download: đọc `download_url` rồi fallback `url`; log warning nếu fallback.
- 409/425 → `not_ready`. 402 → `budget`.
- `fetchOutputs` ngay (TTL 1 giờ).

- [ ] Test download field order. Implement. Commit: `feat(vd): S14 Topaz image async adapter`

### Task 17: Topaz video saga 5 bước + resume

**Files:**
- Create: `adapters/topaz.video.ts`
- Test: `adapters/topaz.video.spec.ts`
- Modify: `jobs/vd-job.repository.ts` — `output_json.saga` persist

**Interfaces:**
- Bước: `POST /video/` (estimate, miễn phí) → `PATCH /accept` → PUT parts → `PATCH /complete-upload/` `{ uploadResults:[{partNum,eTag}] }` → poll `GET /video/{id}/status`.
- `output_json.saga = { step, request_id, parts:[{partNum,eTag}] }`.
- Worker chết: resume từ `step`, không upload lại part đã có eTag (CT-17).
- `ffprobe` qua `IMediaOps` trước bước 1 (duration, frameCount, frameRate, resolution).
- `destination.external` trỏ bucket PTT nếu `PTT_VD_TOPAZ_S3_DEST=1`.
- `cancel()` đọc progress, trả `creditsKept = 1.1 * progress` (0→100% refund; 50%→ giữ 55%).

- [ ] Test resume from step 3. Implement. Commit: `feat(vd): S14 Topaz video five-step saga`

### Task 18: Cost actual từ provider + smoke S14

**Files:**
- Modify: `cost/vd-cost.service.ts` — `actualFromJobState(state)`
- Create: `scripts/smoke_video_sop_s14.sh`
- Create: `docs/specs/postgresql-ddl-vd-sop-s14.sql`
- Optional cron method: `VdCostService.reconcileProviderUsage()` — S14 chỉ fixture, không bắt buộc gọi Runway `/v1/organization/usage` trên VPS.

**Interfaces:**
- Leonardo: `apiCreditCost` → actual.
- Runway: `cost.credits` khi SUCCEEDED; `estimatedCost.credits` lúc submit.
- Topaz: `credits` trên status; video dùng midpoint `estimates.cost` khi chưa xong.
- AC-04 / CT-12: fixture `estimated` vs `actual` lệch ≤2%.
- CT-13: `estimateRunwayCredits` đã có từ Task 13.
- Smoke: 7 metric S10 vẫn 200; enhance job queued; registry `verified_at` hiện SC-15.

- [ ] Implement + smoke. Commit: `feat(vd): S14 cost actuals and smoke`

---

## Thứ tự ship / verify

```
S11 (Tasks 1–9)  →  S12 (10–12)  →  S13 (13–15)  →  S14 (16–18)
```

Mỗi sprint: Jest `src/video-sop` xanh → (khi user yêu cầu) commit → merge main → deploy VPS script `deploy_video_sop_sN_vps.sh` theo pattern S10.

**Không** `git stash -u` trên VPS.

---

## Self-review

| Spec § | Task |
|--------|------|
| AP-01…12 | S11 T3–T8 + S13 poller |
| Envelope + 4 interface | S11 T3, facade S12–S14 |
| Registry seed 8 | S11 T1 |
| OpenAI III | S12 T10 |
| Leonardo IV | S12 T11–T12, S13 T14 |
| Kling V VIA_LEONARDO | S13 T14; DIRECT excluded |
| Runway VI | S13 T13 |
| Topaz VII | S14 T16–T17 |
| CT-01…08 | S11 |
| CT-09…18 | S12–S14 (moderation, retry, estimate, fetch, expired, cancel, saga, secrets) |
| RA-01 Kling guess | ADR-L5-04 — no task DIRECT |
