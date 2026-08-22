# Video SOP Module 7 — Implementation Plan (S1–S10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship **Video SOP Studio** (`video-cinematic`) trên RNOSAI đúng BA Module 7: Brief → Script → Shotlist → Keyframe → Clip → Master → Delivery, 4 cổng, Leonardo + Kling/Runway + Topaz, Cost Ledger, Client Review, dashboard — không trộn Social FFmpeg.

**Architecture:** Nest `VideoSopModule` sibling `ContentMarketingModule` (ADR-R1). Bảng `vd_*`, API `/api/v1/vd`, hub `/crm/video` (ADR-R2/R3). Provider qua adapter L2 (`ITextGen` / `IImageGen` / `IVideoGen` / `IEnhance` / `IMediaOps`); service L3 không import file `kling.video.ts`. Queue logic `q.text` · `q.image` · `q.video.kling` · `q.video.runway` · `q.enhance` · `q.media` · `q.notify` trên worker `setImmediate` (ADR-R6). FFmpeg trong module này chỉ probe/proxy/loudness/zip (ADR-R4). Secret chỉ env (ADR-R5).

**Tech Stack:** NestJS `ptt-crm-api`, Next.js `ops-web` + `portal-web`, PostgreSQL `vd_*`, Jest, RBAC `crm_vd.*`, ExcelJS (đã có trong API).

**Spec:** [`2026-08-20-video-sop-module-7-design.md`](../specs/2026-08-20-video-sop-module-7-design.md) · Dual-studio [`2026-08-20-cmkt-video-dual-studio-design.md`](../specs/2026-08-20-cmkt-video-dual-studio-design.md)

**S1 TDD từng bước:** [`2026-08-20-video-sop-s1.md`](./2026-08-20-video-sop-s1.md) — chạy hết S1 trước Task 10.

## Global Constraints

- Không import `services/ptt-crm-api/src/content-marketing/video-social/**` từ `src/video-sop/**` (EC-DUAL-06). Được import `social-studio.util` (`lockVideoStudio` / `assertStudioWritable`) — lock helper, không composer/jobs.
- Không tạo `social_*` trong `vd_jobs` (AC-R1). Cinematic không enqueue `social_storyboard` / `social_render`.
- Không one-shot; không Pexels làm shot chính; không animate keyframe chưa `keyframe_approved`; không chữ trong AI frame.
- Ngoài v1.0: NLE trong trình duyệt; auto grade/mix; multi-tenant bán ngoài; TTS VO cinematic (v1.1); auto-post TikTok/Meta.
- Flag: `PTT_CMKT_VIDEO_CINEMATIC=1` + `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1`. Tắt → hub ẩn, picker SOP disabled.
- Quota project: `PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP` default `1` (đếm `vd_projects` tạo trong ngày / lifecycle). Credit Kling/Leonardo = ledger S7.
- API: `/api/v1/vd`. Idempotency: header `Idempotency-Key` = `job_id` khi submit render (S2+).
- Stage: `brief_draft → brief_ready → ideation → scripting → shotlist_ready → [G1] → keyframing → [G2] → animating → [G3] → post_production → [G4] → delivered → archived`. `status`: `active | on_hold | cancelled`. Service chặn (AC-01).
- Shot status: `draft → prompts_ready → keyframe_pending → keyframe_approved → clip_draft → clip_final → clip_selected → posted`; `take_fail_count>=5 → blocked → plan_b → clip_draft`.
- Job status: `created → queued → running → succeeded | failed | cancelled | stale`. Retry ≤3 chỉ `transient` / `rate_limit` (BR-10). HTTP user không await Kling.
- Caps: `crm_vd.project` · `crm_vd.script` · `crm_vd.bible` · `crm_vd.keyframe` · `crm_vd.motion` · `crm_vd.post` · `crm_vd.qc` · `crm_vd.budget` · `crm_vd.gate1` · `crm_vd.gate2` · `crm_vd.gate3` · `crm_vd.admin`. Override: cap cấp trên + `override_reason` ≥ 10 ký tự.
- Cost: `buffer_factor` mặc định **1.5**; PM được set **2.5**. Cảnh báo 70% / 90% / 100%. Đóng project → CSV/Excel, không MISA.
- Portal: magic link TTL ≤14 ngày (BR-14); watermark tên + thời gian; hết hạn → 403 (AC-09).
- Commit chỉ khi user yêu cầu. TDD. Một sprint đỏ thì không mở sprint sau.

### Quyết định khóa (payload không có trong spec)

**Brief 8 nhóm (BR-01)** — `vd_briefs.body_json`:

| Key | Type | Complete khi |
|-----|------|----------------|
| `objective` | string | trim length ≥ 8 |
| `audience` | string | trim length ≥ 8 |
| `offer` | string | trim length ≥ 8 |
| `duration_sec` | number | 15–60 |
| `platform` | `reels` / `shorts` / `feed_square` | một trong 3 |
| `tone` | string | trim length ≥ 4 |
| `constraints` | string | trim length ≥ 8 |
| `insight_ids` | number[] | luôn là mảng; được `[]` |

**Feasibility FR-R01…10** — file `rules/vd-feasibility.rules.ts`, mỗi rule một unit test:

| ID | Fail khi |
|----|----------|
| FR-R01 | `shot.duration_ms > 15000` |
| FR-R02 | `shot.text_in_frame === true` |
| FR-R03 | `shot.contains_human` không phải boolean |
| FR-R04 | `shot.aspect` không thuộc `9:16` hoặc `1:1` |
| FR-R05 | số shot < 3 hoặc > 12 |
| FR-R06 | thiếu `camera` hoặc `action` (string độ dài ≥ 3) |
| FR-R07 | `shot.logo_in_ai_frame === true` |
| FR-R08 | status `keyframe_approved` mà `seed` null |
| FR-R09 | `project.duration_sec` ngoài 15–60 |
| FR-R10 | `platform` không thuộc `reels` / `shorts` / `feed_square` |

**`error_class`:** `transient` · `rate_limit` · `auth` · `validation` · `provider` · `budget` · `conflict` · `not_found`.

**Env secret (cấm cột trên `vd_providers`):** `PTT_VD_LEONARDO_API_KEY` · `PTT_VD_KLING_ACCESS_KEY` · `PTT_VD_KLING_SECRET_KEY` · `PTT_VD_RUNWAY_API_KEY` · `PTT_VD_TOPAZ_API_KEY` · `REPLICATE_API_TOKEN`.

**S2 image:** Leonardo nếu có `PTT_VD_LEONARDO_API_KEY`; không thì Flux/Replicate; thiếu cả hai → job `failed` `error_class=auth`, không URL ảnh giả.

---

## File map

```
docs/specs/postgresql-ddl-vd-sop-s1.sql … s10.sql
scripts/apply_pg_ddl_vd_sop_s{1..10}.sh
scripts/smoke_video_sop_s1.sh … s10.sh

services/ptt-crm-api/src/video-sop/
  video-sop.module.ts
  video-sop.types.ts
  video-sop-flags.ts
  project/  script/  shot/  bible/  prompt/
  asset/    render/  post/  gate/   cost/
  review/   report/  admin/ audit/
  adapters/   i-text-gen.ts i-image-gen.ts i-video-gen.ts i-enhance.ts i-media-ops.ts
              openai.text.ts leonardo.image.ts flux-replicate.image.ts
              kling.video.ts runway.video.ts topaz.enhance.ts ffmpeg.media-ops.ts
  orchestration/  vd-dispatcher.service.ts vd-poller.service.ts vd-dag.ts vd-model-router.ts
  rules/          vd-stage.guard.ts vd-feasibility.rules.ts vd-qc-auto.ts

services/ops-web/src/app/crm/video/**          SC-01…13, SC-16
services/ops-web/src/lib/video-sop-api.ts
services/ops-web/src/app/admin/video/providers  SC-15
services/portal-web/src/app/video-review/[token] SC-14
docs/huong-dan-su-dung/19-video-sop.md
```

Cấm tạo `content-marketing/video-cinematic/**` — Module 7 sống ở `src/video-sop`.

---

## Sprint S1 — Schema + hub (Tasks 1–9)

Thực thi nguyên văn [`2026-08-20-video-sop-s1.md`](./2026-08-20-video-sop-s1.md).

| Task | Deliverable |
|------|-------------|
| 1 Flags + cap | `PTT_CMKT_VIDEO_CINEMATIC`, daily cap |
| 2 DDL | `vd_projects` `vd_briefs` `vd_scripts` `vd_audit_logs` |
| 3 Stage guard | S1: mọi `from !== to` → `stage_guard` |
| 4 Create project | `createFromContentItem`, idempotent `cmkt_item_id` |
| 5 HTTP `/api/v1/vd/projects` | lock `cinematic` + `vd_project_id` |
| 6 Caps | `crm_vd.project` view/edit/create |
| 7 SC-01 / SC-02 | `/crm/video`, `/crm/video/[id]` |
| 8 Picker + nav | AC-R4 |
| 9 Smoke S1 | block `social_*` trên item cinematic |

**Exit S1:** `bash scripts/smoke_video_sop_s1.sh` exit 0. Grep `src/video-sop` không import `social-ffmpeg` / `social-video.service`.

---

## Sprint S2 — Job engine + IImageGen (Tasks 10–14)

### Task 10: DDL jobs / providers / models / assets

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s2.sql`
- Create: `scripts/apply_pg_ddl_vd_sop_s2.sh`

**Interfaces:**
- `vd_jobs`: `id`, `project_id`, `shot_id` nullable, `queue` CHECK (`q.text`,`q.image`,`q.video.kling`,`q.video.runway`,`q.enhance`,`q.media`,`q.notify`), `job_type`, `status` (7 giá trị §6.3), `error_class` nullable, `attempt` default 0, `idempotency_key` unique, `input_json`, `output_json`, timestamps
- `vd_providers`: `code` unique (`leonardo`,`flux`,`kling`,`runway`,`topaz`,`openai`,`ffmpeg`) — **không** cột secret
- `vd_models`: `provider_id`, `code`, `capability_json` (`{"kind":"image"|"video"|"text"|"enhance"|"media"}`)
- `vd_assets`: `kind` (`keyframe`,`take`,`master`,`proxy`,`package`), `storage_key`, `url`, `sha256`, `width`, `height`, `duration_ms`
- `vd_asset_lineage`: `parent_asset_id`, `child_asset_id`, `edge` (`prompt`,`img2vid`,`upscale`,`concat`)
- `vd_llm_runs`: `project_id`, `template_code`, `input_json`, `output_json`

- [ ] **Step 1:** Viết SQL đúng CHECK ở trên.

- [ ] **Step 2:** `bash scripts/apply_pg_ddl_vd_sop_s2.sh` — Expected: exit 0; `\d vd_jobs` có `idempotency_key`.

- [ ] **Step 3:** Seed `vd_providers.code=ffmpeg` + model `capability_json={"kind":"media"}`.

- [ ] **Step 4:** `SELECT code FROM vd_providers` trả `ffmpeg`.

- [ ] **Step 5:** Commit khi user yêu cầu — `feat(vd): S2 DDL jobs providers assets`

### Task 11: Dispatcher + poller

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/orchestration/vd-dispatcher.service.ts`
- Create: `services/ptt-crm-api/src/video-sop/orchestration/vd-poller.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/orchestration/vd-dispatcher.service.spec.ts`

**Interfaces:**
- `enqueue(input: { projectId: number; queue: VdQueue; jobType: string; payload: Record<string, unknown>; idempotencyKey: string }): Promise<VdJobRow>`
- Trùng `idempotency_key` → trả job cũ
- Retry nếu `error_class` là `transient` hoặc `rate_limit` và `attempt < 3`
- HTTP chỉ `201 { id, status: 'queued' }`

- [ ] **Step 1: Test**

```ts
it('returns existing row when idempotency_key repeats', async () => {
  const a = await dispatcher.enqueue({
    projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-aaa',
  });
  const b = await dispatcher.enqueue({
    projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-aaa',
  });
  expect(b.id).toBe(a.id);
});

it('retries transient up to 3 then failed', async () => {
  handler.mockRejectedValue(Object.assign(new Error('up'), { error_class: 'transient' }));
  const job = await dispatcher.enqueue({
    projectId: 1, queue: 'q.image', jobType: 'cine_keyframe', payload: {}, idempotencyKey: 'job-bbb',
  });
  await dispatcher.drainForTest(job.id);
  expect(jobRepo.last.status).toBe('failed');
  expect(jobRepo.last.attempt).toBe(3);
});
```

- [ ] **Step 2:** `cd services/ptt-crm-api && ./node_modules/.bin/jest src/video-sop/orchestration/vd-dispatcher.service.spec.ts --no-coverage` — Expected: FAIL module not found

- [ ] **Step 3:** In-memory repo + `setImmediate`. S2 chỉ đăng ký handler `cine_keyframe`.

- [ ] **Step 4:** Jest PASS

- [ ] **Step 5:** `feat(vd): job dispatcher idempotency and retry`

### Task 12: IImageGen Leonardo / Flux

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/adapters/i-image-gen.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/leonardo.image.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/flux-replicate.image.ts`
- Create: `services/ptt-crm-api/src/video-sop/orchestration/vd-model-router.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/i-image-gen.spec.ts`

**Interfaces:**

```ts
export type VdImageGenInput = {
  prompt: string; width: number; height: number; seed?: number; negativePrompt?: string;
};
export type VdImageGenResult = {
  buffer: Buffer; provider: 'leonardo' | 'flux'; providerId: string; seed: number;
};
export interface IImageGen {
  readonly providerName: 'leonardo' | 'flux';
  generate(input: VdImageGenInput): Promise<VdImageGenResult>;
}
export function selectImageGen(env: {
  PTT_VD_LEONARDO_API_KEY: string;
  REPLICATE_API_TOKEN: string;
}): IImageGen;
```

Cấm import `content-media-image.provider` / `content-media-replicate.provider`. Flux tự `fetch` Replicate. Thiếu key → throw `auth`.

- [ ] **Step 1: Test**

```ts
it('selects flux when leonardo key missing and replicate token set', () => {
  expect(selectImageGen({ PTT_VD_LEONARDO_API_KEY: '', REPLICATE_API_TOKEN: 'r' }).providerName).toBe('flux');
});
it('throws auth when both keys missing', () => {
  expect(() => selectImageGen({ PTT_VD_LEONARDO_API_KEY: '', REPLICATE_API_TOKEN: '' })).toThrow(/auth/);
});
```

- [ ] **Step 2:** Jest FAIL

- [ ] **Step 3:** Router + 2 adapter. Handler `cine_keyframe` ghi `vd_assets.kind='keyframe'`, không bịa URL.

- [ ] **Step 4:** Jest PASS

- [ ] **Step 5:** `feat(vd): IImageGen leonardo or flux`

### Task 13: Admin SC-15 — providers không secret

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/admin/vd-admin.controller.ts`
- Create: `services/ops-web/src/app/admin/video/providers/page.tsx`
- Test: `services/ptt-crm-api/src/video-sop/admin/vd-admin.controller.spec.ts`

**Interfaces:**
- `GET/POST /api/v1/vd/admin/providers` · `GET/POST /api/v1/vd/admin/models`
- Reject body có `api_key` hoặc `secret` → 400 `secret_not_allowed`
- Guard: `crm_vd.admin`

- [ ] **Step 1: Test** `POST { code: 'kling', api_key: 'x' }` → 400 `secret_not_allowed`

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Controller + trang list `code` + `capability_json` (không input secret)

- [ ] **Step 4:** Jest PASS

- [ ] **Step 5:** `feat(vd): admin providers without secrets`

### Task 14: Smoke S2

**Files:**
- Create: `scripts/smoke_video_sop_s2.sh`

- [ ] **Step 1:** Tạo project S1 → `POST /api/v1/vd/projects/:id/jobs` header `Idempotency-Key: smoke-s2-1` **hai lần** → cùng `id`. GET job status ∈ queued|running|succeeded|failed (HTTP không treo > 2s). Không key ảnh: `failed` + `error_class=auth` vẫn **OK**.

- [ ] **Step 2:** `bash scripts/smoke_video_sop_s2.sh` — Expected: `OK Video SOP S2`

- [ ] **Step 3:** Không thêm production code

- [ ] **Step 4:** exit 0

- [ ] **Step 5:** `test(vd): S2 smoke idempotent image job`

---

## Sprint S3 — Brief + Script + feasibility (Tasks 15–19)

### Task 15: DDL ideas / shots / prompts

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s3.sql`
- Create: `scripts/apply_pg_ddl_vd_sop_s3.sh`

**Interfaces:**
- `vd_ideas`: `project_id`, `ordinal` 1–3, `summary`, `selected` bool
- `vd_shots`: `script_id`, `ordinal`, `status` default `draft`, `duration_ms`, `camera`, `action`, `aspect`, `contains_human` bool, `text_in_frame` bool default false, `logo_in_ai_frame` bool default false, `seed` nullable, `take_fail_count` int default 0
- `vd_prompts`: `shot_id`, `body`, `bible_snapshot_json`, `region_locked` bool
- `vd_prompt_templates`: `code` unique, `kind` (`brief`,`director`,`shot`,`keyframe`,`motion`)

- [ ] **Step 1:** Viết SQL.

- [ ] **Step 2:** `bash scripts/apply_pg_ddl_vd_sop_s3.sh` — exit 0

- [ ] **Step 3:** `\dt vd_ideas vd_shots vd_prompts`

- [ ] **Step 4:** 3 bảng tồn tại

- [ ] **Step 5:** `feat(vd): S3 DDL ideas shots prompts`

### Task 16: BR-01 brief + SC-03

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/project/vd-brief.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/project/vd-brief.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/brief/page.tsx`
- Modify: `services/ptt-crm-api/src/video-sop/rules/vd-stage.guard.ts`

**Interfaces:**

```ts
export const BRIEF_KEYS = [
  'objective', 'audience', 'offer', 'duration_sec', 'platform', 'tone', 'constraints', 'insight_ids',
] as const;
export function assertBriefComplete(body: Record<string, unknown>): void;
```

- `PUT /api/v1/vd/projects/:id/brief` — cap `crm_vd.project` edit
- `POST /api/v1/vd/projects/:id/brief/ready` — `assertBriefComplete` rồi `stage=brief_ready`
- Insight: GET insights approved của Market Research (cùng lifecycle); được để `[]`

- [ ] **Step 1: Test**

```ts
it('fails when objective short', () => {
  expect(() => assertBriefComplete({
    objective: 'hi', audience: 'khách hàng phổ thông A', offer: 'gói retainer content',
    duration_sec: 30, platform: 'reels', tone: 'rõ ràng', constraints: 'không mặt người',
    insight_ids: [],
  })).toThrow(/brief_incomplete/);
});
it('passes with eight groups', () => {
  expect(() => assertBriefComplete({
    objective: 'tăng nhận biết', audience: 'khách hàng phổ thông A', offer: 'gói retainer content',
    duration_sec: 30, platform: 'reels', tone: 'rõ ràng', constraints: 'không mặt người',
    insight_ids: [],
  })).not.toThrow();
});
```

- [ ] **Step 2:** Jest FAIL

- [ ] **Step 3:** Implement + form SC-03 8 field

- [ ] **Step 4:** Jest PASS

- [ ] **Step 5:** `feat(vd): BR-01 brief eight groups and SC-03`

### Task 17: ITextGen director + SC-04

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/adapters/i-text-gen.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/openai.text.ts`
- Create: `services/ptt-crm-api/src/video-sop/script/vd-script.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/script/vd-script.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/script/page.tsx`

**Interfaces:**
- `ITextGen.complete(input: { system: string; user: string }): Promise<unknown>`
- `POST /api/v1/vd/projects/:id/ideas/generate` → job `q.text` `cine_director` → 3 `vd_ideas`
- `POST /api/v1/vd/projects/:id/ideas/:ideaId/select`
- `POST /api/v1/vd/projects/:id/scripts` `{ markdown }`
- `POST /api/v1/vd/scripts/:id/shots` — cap `crm_vd.script` edit
- SC-04: 3 cột template | JSON | shotlist
- Thiếu `OPENAI_API_KEY`: stub trả 3 idea cố định, không tạo ảnh

- [ ] **Step 1: Test** mock `ITextGen` → 3 rows `ordinal` 1..3

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Implement

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): director ideas and SC-04 script studio`

### Task 18: Feasibility FR-R01…10

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/rules/vd-feasibility.rules.ts`
- Test: `services/ptt-crm-api/src/video-sop/rules/vd-feasibility.rules.spec.ts`

**Interfaces:**
- `evaluateFeasibility(project: { duration_sec: number; platform: string }, shots: VdShotDraft[]): { id: string; ok: boolean }[]`
- `assertFeasibilityPass(...): void` ném `feasibility_blocked` nếu có `ok===false`

- [ ] **Step 1:** Mười `it('FR-R0x ...')` — mỗi rule một case fail đúng bảng khóa

```ts
it('FR-R01 fails when duration_ms is 16000', () => {
  const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
    duration_ms: 16000, text_in_frame: false, contains_human: false, aspect: '9:16',
    camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
  }]);
  expect(rows.find((r) => r.id === 'FR-R01')?.ok).toBe(false);
});
```

Viết đủ FR-R02…FR-R10 trong cùng file (không ghi “tương tự”).

- [ ] **Step 2:** `./node_modules/.bin/jest src/video-sop/rules/vd-feasibility.rules.spec.ts --no-coverage` — FAIL

- [ ] **Step 3:** Mười hàm thuần trong `vd-feasibility.rules.ts`

- [ ] **Step 4:** 10 test PASS

- [ ] **Step 5:** `feat(vd): feasibility FR-R01 to FR-R10`

### Task 19: Smoke S3 + guide

**Files:**
- Create: `scripts/smoke_video_sop_s3.sh`
- Create: `docs/huong-dan-su-dung/19-video-sop.md`

- [ ] **Step 1:** Smoke: brief thiếu → 400 `brief_incomplete`; brief đủ → `brief_ready`; shot `duration_ms=20000` → `feasibility_blocked`; shot hợp lệ → `draft`. Guide: tạo project, 8 nhóm, script.

- [ ] **Step 2:** `bash scripts/smoke_video_sop_s3.sh` — `OK Video SOP S3`

- [ ] **Step 3:** Không thêm API ngoài brief/script/shots

- [ ] **Step 4:** exit 0

- [ ] **Step 5:** `test(vd): S3 smoke brief and feasibility`

---

## Sprint S4 — Bible + keyframe (Tasks 20–22)

### Task 20: Bible + SC-05 + BR-03

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s4.sql`
- Create: `services/ptt-crm-api/src/video-sop/bible/vd-bible.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/bible/vd-bible.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/bible/page.tsx`

**Interfaces:**
- Style JSON: `{ palette: string[]; lens: string; lighting: string; refs: string[] }`
- Character JSON: `{ name: string; lock_regions: string[]; notes: string }`
- `PUT /api/v1/vd/projects/:id/bibles/style` · `PUT /api/v1/vd/projects/:id/bibles/characters` — cap `crm_vd.bible` edit
- `composePrompt(shotAction: string, bible: { lock_regions: string[] }): string` — giữ nguyên token `{{lock:face}}` nếu `face` ∈ `lock_regions`

- [ ] **Step 1: Test**

```ts
it('keeps locked region tokens', () => {
  const out = composePrompt('walk {{lock:face}}', { lock_regions: ['face'] });
  expect(out).toContain('{{lock:face}}');
});
```

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** DDL + service + SC-05

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): style and character bible SC-05`

### Task 21: Keyframe workbench SC-06

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/prompt/vd-prompt.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/prompt/vd-prompt.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/keyframes/page.tsx`

**Interfaces:**
- `POST /api/v1/vd/shots/:id/jobs` `{ job_type: 'cine_keyframe' }` + `Idempotency-Key` → `q.image`
- Shot: `draft → prompts_ready → keyframe_pending` khi enqueue
- Cấm set `keyframe_approved` ở task này (Gate 2 = Task 24)
- Cấm `assertStageTransition(..., 'animating')` từ handler keyframe
- SC-06: trái shots · giữa tối đa 4 keyframe + CSS `transform: scale(2)` + hiện `seed` · phải chữ `Gate 2 — S5`
- Lineage edge `prompt` khi có asset

- [ ] **Step 1: Test** enqueue không đổi project `stage` thành `animating`

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Implement

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): keyframe workbench SC-06`

### Task 22: Smoke S4

**Files:**
- Create: `scripts/smoke_video_sop_s4.sh`

- [ ] **Step 1:** Bible + 1 shot + job keyframe. Job succeeded → `vd_asset_lineage` ≥ 1. Job `auth` → shot không `keyframe_approved`. Expected: `OK Video SOP S4`

- [ ] **Step 2–5:** `test(vd): S4 smoke bible and keyframe job`

---

## Sprint S5 — Gate 1–2 (Tasks 23–25)

### Task 23: DDL gates + StageGuard đầy đủ

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s5.sql`
- Modify: `services/ptt-crm-api/src/video-sop/rules/vd-stage.guard.ts`
- Test: `services/ptt-crm-api/src/video-sop/rules/vd-stage.guard.spec.ts`

**Interfaces:**

```ts
export type GateStatus = 'pending' | 'approved' | 'rejected';
export function assertStageTransition(
  from: VdProjectStage,
  to: VdProjectStage,
  ctx: { gate1?: GateStatus; gate2?: GateStatus; gate3?: GateStatus; gate4?: GateStatus },
): void;
```

- `shotlist_ready → keyframing` cần `gate1 === 'approved'`
- `keyframing → animating` cần `gate2 === 'approved'` (AC-R3)
- `animating → post_production` cần `gate3 === 'approved'`
- `post_production → delivered` cần `gate4 === 'approved'`

- [ ] **Step 1: Test AC-R3**

```ts
it('blocks animating when gate2 is not approved', () => {
  expect(() => assertStageTransition('keyframing', 'animating', { gate2: 'pending' })).toThrow(/stage_guard/);
});
```

- [ ] **Step 2:** FAIL (S1 guard cấm mọi chuyển)

- [ ] **Step 3:** Implement chuỗi + bảng `vd_gates` `vd_approvals` `vd_rework_items` `vd_checklist_*`

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): stage guard requires gates`

### Task 24: Gate API + SC-10

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/gate/vd-gate.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/gate/vd-gate.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/gates/[n]/page.tsx`

**Interfaces:**
- `POST /api/v1/vd/projects/:id/gates/:n/approve` `{ override?: boolean; override_reason?: string }`
- `POST /api/v1/vd/projects/:id/gates/:n/reject` `{ reason: string }`
- Gate 1: `assertBriefComplete` + `assertFeasibilityPass`; sau approve `PATCH /shots` → 400 `shotlist_immutable` (BR-04)
- Gate 2: mọi shot `keyframe_approved` + bible tồn tại
- Override: `override_reason.trim().length >= 10` + cap `crm_vd.gate1`/`crm_vd.gate2` hoặc `crm_vd.project` edit
- Reject → insert `vd_rework_items`, không tiến stage
- SC-10: hiện checklist auto (S8 điền QC); nút Approve / Reject / Override

- [ ] **Step 1: Test** reason `'ngắn'` → `override_reason`; sau G1 patch shot → `shotlist_immutable`

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Implement + seed cap `crm_vd.gate1` `crm_vd.gate2` trong `rbac-admin-catalog.json`

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): gate 1-2 approve reject override SC-10`

### Task 25: Smoke S5

**Files:**
- Create: `scripts/smoke_video_sop_s5.sh`

- [ ] **Step 1:** `POST` chuyển `animating` khi gate2 pending → 400 `stage_guard`. Approve G1+G2 → `keyframing` rồi `animating`. Expected: `OK Video SOP S5`

- [ ] **Step 2–5:** `test(vd): S5 smoke AC-R3 stage guard`

---

## Sprint S6 — Kling / Runway + takes (Tasks 26–29)

### Task 26: IVideoGen

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/adapters/i-video-gen.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/kling.video.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/runway.video.ts`
- Modify: `services/ptt-crm-api/src/video-sop/orchestration/vd-model-router.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/i-video-gen.spec.ts`

**Interfaces:**

```ts
export type VdVideoGenInput = {
  imageUrl: string; prompt: string; durationSec: number; providerHint?: 'kling' | 'runway';
};
export type VdVideoGenResult = { buffer: Buffer; provider: 'kling' | 'runway'; providerId: string };
export interface IVideoGen {
  enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<'running' | VdVideoGenResult>;
}
```

`vd-motion.service.ts` chỉ inject `IVideoGen`. Grep file đó không được có chuỗi `kling` / `runway` (trừ type union ở router).

- [ ] **Step 1: Test** router chọn `q.video.kling` vs `q.video.runway` theo `providerHint`; motion service mock không import adapter

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Adapter + poller. HTTP `POST /shots/:id/jobs` `{ job_type: 'cine_motion_draft' }` → 201 trong ≤ 2s

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): IVideoGen kling and runway adapters`

### Task 27: BR-07 / BR-08 + SC-07 / SC-08

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s6.sql`
- Create: `services/ptt-crm-api/src/video-sop/render/vd-motion.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/render/vd-motion.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/render/page.tsx`
- Create: `services/ops-web/src/app/crm/video/[id]/takes/page.tsx`

**Interfaces:**
- `vd_take_scores`: `asset_id`, `shot_id`, `verdict` (`passed`/`failed`), `artifact_json`
- `cine_motion_final` chỉ khi tồn tại take draft `verdict=passed` (BR-07) — else 400 `take_draft_required`
- `take_fail_count >= 5` → shot `blocked` + audit `lead_task` (BR-08)
- SC-07: hiện `credit_estimate` (số) trước submit; nếu `credit_estimate > budget.alert_threshold` (default 100) hiện confirm
- SC-08: 2–4 thẻ `<video>` + `playbackRate=0.25` + form `artifact_json`

- [ ] **Step 1: Test**

```ts
it('blocks cine_motion_final without passed draft', async () => {
  await expect(motion.enqueueFinal(shotId)).rejects.toThrow(/take_draft_required/);
});
it('blocks shot after 5 failed takes', async () => {
  const shot = await motion.recordTakeFail(shotId, 5);
  expect(shot.status).toBe('blocked');
});
```

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Implement + cap `crm_vd.motion`

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): motion takes BR-07 BR-08 SC-07 SC-08`

### Task 28: Gate 3 stub trong cùng gate service

**Files:**
- Modify: `vd-gate.service.ts` — `n=3` require ≥1 shot `clip_selected` hoặc override
- Test: thêm case gate3

- [ ] **Step 1: Test** gate3 approve khi chưa `clip_selected` → `gate3_incomplete`

- [ ] **Step 2–5:** `feat(vd): gate 3 requires selected take`

### Task 29: Smoke S6

**Files:**
- Create: `scripts/smoke_video_sop_s6.sh`

- [ ] **Step 1:** Enqueue `cine_motion_final` không take passed → 400. Ghi 5 fail → shot `blocked`. Motion job HTTP 201. Expected: `OK Video SOP S6`

- [ ] **Step 2–5:** `test(vd): S6 smoke takes and BR-08`

---

## Sprint S7 — Cost ledger (Tasks 30–32)

### Task 30: DDL + VdCostService

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s7.sql`
- Create: `services/ptt-crm-api/src/video-sop/cost/vd-cost.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/cost/vd-cost.service.spec.ts`

**Interfaces:**
- `vd_budgets`: `project_id` unique, `currency` default `USD`, `limit_amount` numeric, `buffer_factor` numeric default 1.5, `overshoot_factor` numeric default 2.5
- `vd_cost_ledger`: `project_id`, `job_id` nullable, `kind` (`estimated`/`actual`), `amount`, `vendor`, `created_at`
- `reserve(projectId, estimated): void` (BR-06) — nếu `sum(estimated)+sum(actual) + estimated > limit*buffer_factor` → `budget_exceeded`
- Cảnh báo flags: `warn70` / `warn90` / `warn100` khi `actual/limit` vượt mốc
- Dispatcher gọi `reserve` trước enqueue `q.image` / `q.video.*` / `q.enhance`

- [ ] **Step 1: Test**

```ts
it('rejects reserve over buffer', async () => {
  await budget.set({ limit_amount: 10, buffer_factor: 1.5 });
  await expect(cost.reserve(1, 20)).rejects.toThrow(/budget_exceeded/);
});
```

- [ ] **Step 2:** FAIL

- [ ] **Step 3:** Implement

- [ ] **Step 4:** PASS

- [ ] **Step 5:** `feat(vd): cost reserve BR-06`

### Task 31: SC-11 + export đóng project

**Files:**
- Create: `services/ops-web/src/app/crm/video/[id]/cost/page.tsx`
- Create: `services/ptt-crm-api/src/video-sop/cost/vd-cost.controller.ts`

**Interfaces:**
- `GET /api/v1/vd/projects/:id/budget` · `PUT` `{ limit_amount, buffer_factor, overshoot_factor }` — cap `crm_vd.budget` edit
- `GET /api/v1/vd/projects/:id/costs`
- `GET /api/v1/vd/projects/:id/costs/export.xlsx` — ExcelJS, cột `kind,vendor,amount,created_at`
- Đóng project (`status=cancelled` hoặc `stage=archived`) mới cho export “kế toán” (query `?close=1`)

- [ ] **Step 1: Test** export khi `status=active` → 400 `project_not_closed`; `archived` → buffer xlsx magic `PK`

- [ ] **Step 2–5:** `feat(vd): SC-11 cost and xlsx export`

### Task 32: Smoke S7

**Files:**
- Create: `scripts/smoke_video_sop_s7.sh`

- [ ] **Step 1:** Budget 10, reserve 20 → 400 `budget_exceeded`. Reserve 5 → ledger `estimated`. Expected: `OK Video SOP S7`

- [ ] **Step 2–5:** `test(vd): S7 smoke budget reserve`

---

## Sprint S8 — DAG post + FFmpeg ops + Topaz (Tasks 33–35)

### Task 33: DAG cố định BR-09

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/orchestration/vd-dag.ts`
- Test: `services/ptt-crm-api/src/video-sop/orchestration/vd-dag.spec.ts`

**Interfaces:**

```ts
export const POST_DAG_NODES = [
  'select_takes',
  'concat',
  'loudness',
  'proxy',
  'optional_topaz',
  'package_zip',
] as const;
export function nextPostNode(done: string[]): string | 'complete';
```

- `nextPostNode([])` → `select_takes`
- Bỏ node không có trong list → throw `dag_invalid`
- Job types: `cine_compose` (`q.media`), `cine_enhance` (`q.enhance`)

- [ ] **Step 1: Test** thứ tự 6 node; `nextPostNode(['concat'])` không được là `package_zip`

- [ ] **Step 2–5:** `feat(vd): fixed post DAG BR-09`

### Task 34: IMediaOps + IEnhance + QC auto + SC-09

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/adapters/i-media-ops.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/ffmpeg.media-ops.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/i-enhance.ts`
- Create: `services/ptt-crm-api/src/video-sop/adapters/topaz.enhance.ts`
- Create: `services/ptt-crm-api/src/video-sop/rules/vd-qc-auto.ts`
- Test: `services/ptt-crm-api/src/video-sop/adapters/ffmpeg.media-ops.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/post/page.tsx`

**Interfaces:**

```ts
export interface IMediaOps {
  probe(path: string): { hasVideo: boolean; hasAudio: boolean; durationSec: number; lufs: number | null };
  proxy(input: string, output: string): Promise<void>;
  zipEditorPackage(paths: string[], destZip: string): Promise<void>;
}
```

- `ffmpeg.media-ops.ts` dùng `video-kernel/video-ffprobe.util` (`probeFile`) — được, kernel mỏng
- Cấm gọi `SocialFfmpegComposer` / filter_complex B-roll
- Topaz: nếu thiếu `PTT_VD_TOPAZ_API_KEY` node `optional_topaz` skip (status `succeeded` output `{ skipped: true }`)
- `evaluateGate4Auto(probe)` (BR-12): fail nếu `!hasVideo || !hasAudio || durationSec < 12`; `blocked=true` khi fail
- SC-09: list 6 node + status job

- [ ] **Step 1: Test** `evaluateGate4Auto({ hasVideo: true, hasAudio: false, durationSec: 20, lufs: -14 })` → `blocked=true`; composer import path không tồn tại trong `video-sop/**`

- [ ] **Step 2–5:** `feat(vd): media ops QC auto SC-09`

### Task 35: Smoke S8

**Files:**
- Create: `scripts/smoke_video_sop_s8.sh`

- [ ] **Step 1:** Enqueue `cine_compose` → 201. GET DAG không chứa node ngoài `POST_DAG_NODES`. Expected: `OK Video SOP S8`

- [ ] **Step 2–5:** `test(vd): S8 smoke post DAG`

---

## Sprint S9 — Editor package + portal (Tasks 36–38)

### Task 36: Delivery package + SC-13

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s9.sql`
- Create: `services/ptt-crm-api/src/video-sop/post/vd-delivery.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/post/vd-delivery.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/[id]/delivery/page.tsx`

**Interfaces:**
- `vd_delivery_packages`: `project_id`, `zip_storage_key`, `file_names_json` (tên file SOP chỉ lúc này)
- `POST /api/v1/vd/projects/:id/delivery` — Gate 4 approved (Task 37) hoặc S9 cho phép tạo zip khi QC auto pass
- Zip qua `IMediaOps.zipEditorPackage`
- Cap `crm_vd.post` edit

- [ ] **Step 1: Test** chưa Gate 4 → 400 `gate4_required` (sau Task 37 cùng sprint)

- [ ] **Step 2–5:** `feat(vd): editor package SC-13`

### Task 37: Gate 4 + review links

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/review/vd-review.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/review/vd-review.service.spec.ts`
- Modify: `vd-gate.service.ts` — `n=4` gọi `evaluateGate4Auto`; blocking fail + không override → 400 `gate4_blocked` (BR-12)

**Interfaces:**
- `vd_review_links`: `token` unique, `project_id`, `gate_no` 1 hoặc 4, `asset_ids` int[], `expires_at` ≤ now+14d, `watermark_label`
- `vd_review_comments`: `link_id`, `body`, `timecode_ms` nullable, `pin_x` `pin_y` nullable
- `POST /api/v1/vd/review-links` `{ project_id, gate_no, asset_ids, ttl_days }` — `ttl_days > 14` → 400 `ttl_exceeded`
- Public: `GET /api/v1/public/vd/review/:token` — hết hạn 403 `review_expired` (AC-09)
- Comment + `approve` / `request_changes` → rework hoặc gate

- [ ] **Step 1: Test** `ttl_days=15` → `ttl_exceeded`; token expired → 403 `review_expired`

- [ ] **Step 2–5:** `feat(vd): gate 4 and review links BR-14`

### Task 38: Portal SC-14 + smoke S9

**Files:**
- Create: `services/portal-web/src/app/video-review/[token]/page.tsx`
- Create: `scripts/smoke_video_sop_s9.sh`

**Interfaces:**
- Trang public: `<video>` + watermark text `{name} {iso-time}` overlay CSS; không login CRM
- `BR-15`: package metadata bắt buộc `contains_human` + `ai_disclosure` boolean trên `vd_delivery_packages.meta_json`

- [ ] **Step 1:** Smoke tạo link `ttl_days=14` → 201; giả `expires_at` quá khứ → 403. Expected: `OK Video SOP S9`

- [ ] **Step 2–5:** `feat(vd): portal video-review SC-14`

---

## Sprint S10 — Dashboard + E2E (Tasks 39–41)

### Task 39: Benchmarks + SC-16

**Files:**
- Create: `docs/specs/postgresql-ddl-vd-sop-s10.sql`
- Create: `services/ptt-crm-api/src/video-sop/report/vd-report.service.ts`
- Test: `services/ptt-crm-api/src/video-sop/report/vd-report.service.spec.ts`
- Create: `services/ops-web/src/app/crm/video/dashboard/page.tsx`

**Interfaces:**
- `vd_benchmarks`: `project_id`, `metric`, `value` — metric khóa: `kf_pass_rate` · `clip_pass_rate` · `takes_per_shot` · `credit_ratio` · `client_rounds` · `lead_days` · `override_rate`
- `GET /api/v1/vd/reports/production?lifecycle_id=` trả đúng 7 metric
- KPI mục tiêu (BA §10.3) hiện trên UI, không fail API nếu lệch (fail = Task 40 UAT)

- [ ] **Step 1: Test** service tính `takes_per_shot = takes / shots` với fixture 6 takes / 2 shots → `3`

- [ ] **Step 2–5:** `feat(vd): production dashboard SC-16`

### Task 40: E2E 30s / 7 shot (AC-11)

**Files:**
- Create: `scripts/smoke_video_sop_s10.sh`
- Create: `services/ptt-crm-api/src/video-sop/e2e/vd-e2e-fixture.ts`

**Interfaces:**
- Fixture: 1 project, brief đủ, 7 shot `duration_ms=4000` (28s + hook), platform `reels`
- Chạy **cờ** `VD_E2E_PROVIDERS=1` mới gọi Leonardo/Kling thật; mặc định: stub adapters ghi file màu + sine (IMediaOps) để AC-11 đường đi API, không tốn credit
- Assert: `stage` đi hết tới `delivered` trên stub; Gate 1–4 approve; `GET /reports/production` 200
- AC-11 thật (7 shot / 30s provider) = runbook staging, không chặn merge stub

- [ ] **Step 1:** Script mặc định stub → `OK Video SOP S10 stub`. Khi `VD_E2E_PROVIDERS=1` và đủ key → `OK Video SOP S10 live`

- [ ] **Step 2–5:** `test(vd): S10 e2e stub pipeline`

### Task 41: Runbook 6 sự cố + dual-studio regression

**Files:**
- Create: `docs/huong-dan-su-dung/19-video-sop-runbook.md`
- Create: `scripts/smoke_video_sop_dual.sh`

**Interfaces:**
- Runbook mục: provider down · hết credit · webhook chết · DAG treo · storage đầy · model deprecated — mỗi mục: triệu chứng, lệnh kiểm, hành động (restart poller / pause enqueue / đổi `vd_models`)
- Dual smoke: item social vẫn `social_storyboard` 200; item cinematic `social_storyboard` 400 `studio_mismatch`; `SELECT job_type FROM vd_jobs` không chứa `social_`

- [ ] **Step 1:** Viết 6 mục + script dual

- [ ] **Step 2:** `bash scripts/smoke_video_sop_dual.sh` — `OK dual studio`

- [ ] **Step 3:** Không đổi Social composer

- [ ] **Step 4:** exit 0

- [ ] **Step 5:** `docs(vd): runbook and dual-studio smoke`

---

## Caps seed (gộp catalog)

Thêm vào `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` (S1 chỉ `crm_vd.project`; các sprint sau thêm đúng cap khi cần UI):

```
crm_vd.project     view edit create
crm_vd.script      view edit
crm_vd.bible       view edit
crm_vd.keyframe    view edit
crm_vd.motion      view edit
crm_vd.post        view edit
crm_vd.qc          view edit
crm_vd.budget      view edit
crm_vd.gate1       view approve
crm_vd.gate2       view approve
crm_vd.gate3       view approve
crm_vd.admin       view configure
```

Gate 4 approve dùng `crm_vd.qc` approve hoặc `crm_vd.project` edit (PM).

---

## Spec coverage

| Spec | Task |
|------|------|
| ADR-R1…R6 | S1 module, S2 queue, S8 ffmpeg ops, S2/S13 secret |
| VD-UC-01 / UC-047 / AC-R4 | S1 T4–T8 |
| BR-01, FR-7.1, SC-03 | T16 |
| FR-7.2, SC-04, ITextGen | T17 |
| FR-R01…10, BR-02 | T18 |
| FR-7.3, SC-05, BR-03 | T20 |
| FR-7.4, SC-06, lineage | T21 |
| FR-7.7 G1–G2, BR-04, SC-10 | T23–T24 |
| AC-R3 | T23, T25 |
| FR-7.5, SC-07/08, BR-07/08, IVideoGen | T26–T28 |
| FR-7.8, SC-11, BR-06/13 | T30–T31 |
| BR-09, ADR-R4, SC-09, Topaz, BR-12 | T33–T34 |
| FR-7.10, SC-13/14, BR-14/15, AC-09 | T36–T38 |
| FR-7.11 SC-15 | T13 |
| FR-7.12 SC-16, AC-11 | T39–T40 |
| AC-R1, EC-DUAL-06 | T9, T41 |
| AC-R2 sidebar | S1 T8 |
| RK runbook | T41 |
| NLE / auto-post / TTS cinematic | ngoài v1.0 — không có task |
| Social FFmpeg hotfix | ngoài plan này |

## Placeholder scan

Không TBD. FR-R01…10, 8 nhóm brief, env key, DAG 6 node đã khóa ở Global Constraints.

## Type consistency

- Stage / shot / job / error_class / queue names dùng một bộ xuyên S1–S10
- Job types: `cine_director` · `cine_keyframe` · `cine_motion_draft` · `cine_motion_final` · `cine_compose` · `cine_enhance`
- Errors: `cmkt_cinematic_disabled` · `video_cinematic_daily_cap` · `stage_guard` · `brief_incomplete` · `feasibility_blocked` · `shotlist_immutable` · `take_draft_required` · `budget_exceeded` · `secret_not_allowed` · `ttl_exceeded` · `review_expired` · `gate4_blocked` · `gate4_required` · `studio_mismatch` / `studio_locked`
- Media item: `video_studio: 'cinematic'`, `vd_project_id: number`
