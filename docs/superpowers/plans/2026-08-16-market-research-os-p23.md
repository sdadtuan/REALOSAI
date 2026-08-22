# Market Research OS P23 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Analyst can run Talkwalker from Sources as a **flag-off stub** that inserts `crm_research_sources` from a fixture mapper (no vendor HTTP, no prod key), plus a 100-point Talkwalker vs Brandwatch bake-off scorecard so PO can decide later.

**Architecture:** Clone SparkToro P5 stub + Qualtrics disabled path. `POST /api/v1/research/projects/:id/run-talkwalker` with `{ question_id }`. Flag or token off → `200 {ok:true, note:talkwalker_disabled}` and zero persist / zero HTTP. Flag + token on (staging only) → sync persist from `TALKWALKER_STUB_RESULTS` via `mapTalkwalkerResponse` (`publisher=Talkwalker`, tier ≤ medium, BR-RES-04 limitation). Health `talkwalker_enabled` = flag **and** token — never return the token. Live Talkwalker Search API = P24+ after bake-off winner.

**Tech Stack:** NestJS `market-research`, Next.js ops-web, PostgreSQL job_type CHECK, Jest, Vitest, bash smoke/deploy. No npm/pip. No Python worker.

**Hướng đã khóa:** 2 — Talkwalker bake-off stub (RES-UC-084). Portal report-detail stale / pgvector prod / IVFFlat / conjoint simulator / live Talkwalker HTTP / Brandwatch connector = out.

## Global Constraints

- **Cấm** live HTTP tới `api.talkwalker.com` / bất kỳ host Talkwalker
- **Cấm** mua / ghi `TALKWALKER_ACCESS_TOKEN` trên prod deploy
- Flag `RESEARCH_TALKWALKER_ENABLED` default `0`
- Health `talkwalker_enabled` = flag **và** token; JSON **không** chứa token
- Flag/token off → `200 {ok:true, note:talkwalker_disabled}`; không `insertAiRun`; không `createSource`
- **BR-RES-06/08:** chỉ insert `crm_research_sources`. **Cấm** `createInsight` / `createReport` / publish-portal
- **BR-RES-04 / BR-RES-09:** `publisher=Talkwalker` → tier ∈ {`low`,`medium`} + `limitation_note` bắt buộc
- **BR-RES-11:** `piiHint(question_vi)` → 400 trước persist
- `source_type` = `social_public`
- Không portal-web; không RAG / OpenAI embed / pgvector / SparkToro / Qualtrics flag changes
- Không đụng GTM WIP (`services/ptt-crm-api/src/gtm/`, `gtm-cms/`, ops-web `crm/gtm`)
- Deploy rebuilds **api + ops-web**; apply P23 DDL (job_type only)
- Branch: `feat/market-research-os-p23` from `main` (`b610ff38`+)
- Commit chỉ khi user yêu cầu

---

## File map

| File | Role |
|------|------|
| `services/ptt-crm-api/src/market-research/talkwalker-mapper.util.ts` | Normalize `{results}` → source candidates |
| `services/ptt-crm-api/src/market-research/talkwalker-mapper.util.spec.ts` | Mapper + PII drop + limitation |
| `services/ptt-crm-api/src/market-research/talkwalker-stub.util.ts` | `TALKWALKER_STUB_RESULTS` (no HTTP) |
| `services/ptt-crm-api/src/market-research/competitor-snapshot.util.ts` | Regex `talkwalker` in `assertPaidEstimateTier` |
| `services/ptt-crm-api/src/market-research/competitor-snapshot.util.spec.ts` | P23 talkwalker + tier high → `reliability_capped` |
| `services/ptt-crm-api/src/market-research/market-research.types.ts` | Types + `TALKWALKER_LIMITATION_NOTE` |
| `services/ptt-crm-api/src/config/app-config.service.ts` | `researchTalkwalkerEnabled` + `talkwalkerAccessToken` |
| `services/ptt-crm-api/src/market-research/guards/market-research-enabled.guard.spec.ts` | Default off; parse flag+token |
| `services/ptt-crm-api/src/market-research/market-research.service.ts` | `health.talkwalker_enabled` + `runTalkwalker` |
| `services/ptt-crm-api/src/market-research/market-research.service.spec.ts` | Disabled / stub persist / PII / no insight |
| `services/ptt-crm-api/src/market-research/market-research.controller.ts` | `POST …/run-talkwalker` |
| `docs/specs/2026-08-16-postgresql-ddl-market-research-p23.sql` | `job_type` + `talkwalker` |
| `scripts/apply_pg_ddl_market_research_p23.sh` | Apply P23 DDL |
| `scripts/fixtures/talkwalker-mentions.sample.json` | Same shape as stub results |
| `services/ops-web/src/lib/market-research-api.ts` | Health + `runResearchTalkwalker` + copy |
| `services/ops-web/src/components/research/sources-talkwalker.util.ts` | Button gate + banner |
| `services/ops-web/src/components/research/sources-talkwalker.util.spec.ts` | Hide when health off |
| `services/ops-web/src/app/crm/research/[id]/page.tsx` | **Chạy Talkwalker** next to SparkToro |
| `docs/specs/2026-08-16-talkwalker-brandwatch-bakeoff-scorecard.md` | Scorecard 100đ (trống điểm) |
| Catalog / OS / Actions | RES-UC-084; UAT P23; backlog P23+ |
| `scripts/smoke_market_research_p23*.sh` | M1–M5 |
| `scripts/deploy_market_research_p23_vps.sh` | Clone P22 + P23 DDL; **không** bật flag/token |

**Unchanged:** SparkToro/Qualtrics live clients, portal-web, RAG, conjoint, pgvector, Python workers.

---

## Shared types

```ts
export const TALKWALKER_LIMITATION_NOTE =
  'Talkwalker mentions — hội thoại công khai, không phải census. Cấm suy “người Việt nghĩ rằng…”. Không suy mentions = population.';

export type TalkwalkerSourceCandidate = {
  url: string;
  title: string;
  publisher: 'Talkwalker';
  reliability_tier: 'low' | 'medium';
  limitation_note: string;
  snippet: string; // ≤ 500, không PII
};

export type TalkwalkerNormalized = {
  results: Array<{
    url: string;
    title: string;
    snippet: string;
    published_at?: string;
    source_name?: string;
  }>;
};

export type RunTalkwalkerInput = {
  question_id: number;
};

export type RunTalkwalkerResult =
  | { ok: true; note: 'talkwalker_disabled' }
  | { ok: true; run_id: number; status: 'succeeded'; source_ids: number[]; note: 'talkwalker_stub' };
```

Env:

| Key | Default | Prod deploy |
|-----|---------|-------------|
| `RESEARCH_TALKWALKER_ENABLED` | `0` | **không** set `1` |
| `TALKWALKER_ACCESS_TOKEN` | empty | **không** ghi |
| `TALKWALKER_PROJECT_ID` | empty | reserved P24+; **không** dùng P23 |

P24+ live (out of P23): `GET https://api.talkwalker.com/api/v1/search/p/{project_id}/results?access_token=` → normalize `url/title/content` → same `TalkwalkerNormalized`. P23 mapper **không** gọi URL này.

---

## Milestone M1 — Mapper + paid-estimate + fixture

**Files:**
- Create: `talkwalker-mapper.util.ts` + spec + `talkwalker-stub.util.ts`
- Create: `scripts/fixtures/talkwalker-mentions.sample.json`
- Modify: `competitor-snapshot.util.ts` + spec
- Modify: `market-research.types.ts`

**Interfaces:**
- Consumes: `piiHint`, `assertPaidEstimateTier`
- Produces: `mapTalkwalkerResponse`, `TALKWALKER_STUB_RESULTS`, `TALKWALKER_LIMITATION_NOTE`

- [ ] **Step 1: Write failing mapper spec**

```ts
import { TALKWALKER_LIMITATION_NOTE, mapTalkwalkerResponse } from './talkwalker-mapper.util';
import { TALKWALKER_STUB_RESULTS } from './talkwalker-stub.util';

it('P23 maps stub results to Talkwalker sources with limitation', () => {
  const out = mapTalkwalkerResponse(TALKWALKER_STUB_RESULTS);
  expect(out.length).toBeGreaterThanOrEqual(1);
  expect(out[0]).toMatchObject({
    publisher: 'Talkwalker',
    reliability_tier: 'medium',
    limitation_note: TALKWALKER_LIMITATION_NOTE,
  });
  expect(out[0].url).toMatch(/^https?:\/\//);
  expect(out[0].snippet.length).toBeLessThanOrEqual(500);
});

it('P23 drops rows with PII snippet', () => {
  const out = mapTalkwalkerResponse({
    results: [
      { url: 'https://news.example/a', title: 'A', snippet: 'Liên hệ 0901234567' },
      { url: 'https://news.example/b', title: 'B', snippet: 'Công khai không PII' },
    ],
  });
  expect(out.map((r) => r.title)).toEqual(['B']);
});

it('P23 skips rows missing url or title', () => {
  expect(mapTalkwalkerResponse({ results: [{ url: '', title: 'X', snippet: 'y' }] })).toEqual([]);
});
```

Run: `cd services/ptt-crm-api && npx jest src/market-research/talkwalker-mapper.util.spec.ts --verbose --no-coverage`  
Expected: FAIL (module missing)

- [ ] **Step 2: Implement mapper + stub**

`talkwalker-mapper.util.ts` — clone `mapSparkToroResponse`:

```ts
import { piiHint } from './evidence-immutable.util';
import { assertPaidEstimateTier } from './competitor-snapshot.util';
import type { TalkwalkerSourceCandidate } from './market-research.types';

export const TALKWALKER_LIMITATION_NOTE =
  'Talkwalker mentions — hội thoại công khai, không phải census. Cấm suy “người Việt nghĩ rằng…”. Không suy mentions = population.';

const MAX_SNIPPET = 500;

export function mapTalkwalkerResponse(raw: unknown): TalkwalkerSourceCandidate[] {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.results) ? obj.results : [];
  const out: TalkwalkerSourceCandidate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const url = String(item.url ?? '').trim();
    const title = String(item.title ?? '').trim();
    const snippet = String(item.snippet ?? '').trim().slice(0, MAX_SNIPPET);
    if (!url || !title) continue;
    if (snippet && piiHint(snippet)) continue;
    const candidate: TalkwalkerSourceCandidate = {
      url,
      title: title.slice(0, 500),
      publisher: 'Talkwalker',
      reliability_tier: 'medium',
      limitation_note: TALKWALKER_LIMITATION_NOTE,
      snippet,
    };
    assertPaidEstimateTier(candidate);
    out.push(candidate);
  }
  return out;
}
```

`talkwalker-stub.util.ts` — **không** `fetch`:

```ts
import type { TalkwalkerNormalized } from './market-research.types';

export const TALKWALKER_STUB_RESULTS: TalkwalkerNormalized = {
  results: [
    {
      url: 'https://news.example/sua-uong-q3',
      title: 'Hội thoại công khai sữa uống Q3',
      snippet: 'Người dùng bàn về giá premium trên diễn đàn công khai.',
      source_name: 'example-news',
    },
    {
      url: 'https://news.example/mt-hcm',
      title: 'MT HCM và SKU mới',
      snippet: 'Mention công khai về kênh hiện đại HCM.',
      source_name: 'example-news',
    },
  ],
};
```

Add types to `market-research.types.ts` (block in Shared types). Re-export `TALKWALKER_LIMITATION_NOTE` from mapper **or** types — **one** canonical string in `talkwalker-mapper.util.ts`; types file may import/re-export it. Do not duplicate two different strings.

Fixture `scripts/fixtures/talkwalker-mentions.sample.json` = same JSON as `TALKWALKER_STUB_RESULTS`.

- [ ] **Step 3: Extend `assertPaidEstimateTier`**

Change regex to `/similarweb|semrush|sparktoro|talkwalker/`.

Add spec next to SparkToro case:

```ts
it('P23 url/publisher talkwalker + tier high is reliability_capped', () => {
  expect(() =>
    assertPaidEstimateTier({
      publisher: 'Talkwalker',
      url: 'https://news.example/a',
      reliability_tier: 'high',
      limitation_note: 'x',
    }),
  ).toThrow('reliability_capped');
});
```

Run: `npx jest src/market-research/talkwalker-mapper.util.spec.ts src/market-research/competitor-snapshot.util.spec.ts --testNamePattern='P23' --verbose --no-coverage`  
Expected: PASS

---

## Milestone M2 — Flag, health, `runTalkwalker`, DDL

**Files:**
- Modify: `app-config.service.ts`, guard spec, service, service spec, controller
- Create: P23 DDL + apply script

**Interfaces:**
- Consumes: `mapTalkwalkerResponse`, `TALKWALKER_STUB_RESULTS`, `loadScopedProject`, `getQuestion`, `piiHint`, `createSource`, `insertAiRun`
- Produces: `POST /api/v1/research/projects/:id/run-talkwalker`, `health.talkwalker_enabled`

- [ ] **Step 1: Config + guard spec**

`AppConfigService` fields (next to Qualtrics):

```ts
readonly researchTalkwalkerEnabled: boolean;
readonly talkwalkerAccessToken: string;
```

Parse (same truthy list as SparkToro):

```ts
this.researchTalkwalkerEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.RESEARCH_TALKWALKER_ENABLED ?? '0').trim().toLowerCase(),
);
this.talkwalkerAccessToken = (process.env.TALKWALKER_ACCESS_TOKEN ?? '').trim();
```

Guard spec: add `RESEARCH_TALKWALKER_ENABLED` + `TALKWALKER_ACCESS_TOKEN` to saved keys. Default expect `researchTalkwalkerEnabled === false` and token `''`. New test: flag `1` + token `tw-secret` → enabled true; health-shaped assertions must **not** stringify the token in `service.health()` (M2 step 3).

- [ ] **Step 2: Failing service specs**

Add to service constructor config mock: `researchTalkwalkerEnabled: false`, `talkwalkerAccessToken: ''`. Reset in `beforeEach`.

```ts
it('P23 flag or token off returns talkwalker_disabled without enqueue or insight', async () => {
  const out = await service.runTalkwalker(1, scope, { question_id: 9 }, 'an@ptt');
  expect(out).toEqual({ ok: true, note: 'talkwalker_disabled' });
  expect(repo.insertAiRun).not.toHaveBeenCalled();
  expect(repo.createSource).not.toHaveBeenCalled();
  expect(repo.createInsight).not.toHaveBeenCalled();
});

it('P23 health talkwalker_enabled is true only when flag and token are both present', () => {
  config.researchTalkwalkerEnabled = true;
  config.talkwalkerAccessToken = 'tw-secret-never-leak';
  const payload = service.health();
  expect(payload.talkwalker_enabled).toBe(true);
  expect(JSON.stringify(payload)).not.toMatch(/tw-secret|TALKWALKER_ACCESS_TOKEN/);
});

it('P23 stub persist creates Talkwalker sources and no insight', async () => {
  config.researchTalkwalkerEnabled = true;
  config.talkwalkerAccessToken = 'tw-secret';
  repo.getQuestion.mockResolvedValue({ id: 9, project_id: 1, question_vi: 'Quy mô sữa uống?' });
  repo.insertAiRun.mockResolvedValue({ id: 77 });
  repo.createSource.mockResolvedValueOnce({ id: 501 }).mockResolvedValueOnce({ id: 502 });
  const out = await service.runTalkwalker(1, scope, { question_id: 9 }, 'an@ptt');
  expect(out).toEqual({
    ok: true,
    run_id: 77,
    status: 'succeeded',
    source_ids: [501, 502],
    note: 'talkwalker_stub',
  });
  expect(repo.insertAiRun).toHaveBeenCalledWith(
    expect.objectContaining({ jobType: 'talkwalker', provider: 'talkwalker' }),
  );
  expect(repo.createSource).toHaveBeenCalledWith(
    1,
    expect.objectContaining({
      publisher: 'Talkwalker',
      source_type: 'social_public',
      ai_generated: true,
      keep: true,
    }),
  );
  expect(repo.createInsight).not.toHaveBeenCalled();
  const output = repo.succeedAiRun.mock.calls[0][1];
  expect(output.outputJson.stub).toBe(true);
});

it('P23 PII question_vi is 400 before persist', async () => {
  config.researchTalkwalkerEnabled = true;
  config.talkwalkerAccessToken = 'tw-secret';
  repo.getQuestion.mockResolvedValue({
    id: 9,
    project_id: 1,
    question_vi: 'Gọi 0901234567 hỏi panel',
  });
  await expect(service.runTalkwalker(1, scope, { question_id: 9 }, 'an@ptt')).rejects.toMatchObject({
    status: 400,
  });
  expect(repo.insertAiRun).not.toHaveBeenCalled();
});
```

Update existing `health() toEqual` snapshot: add `talkwalker_enabled: false`.

Run: `npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P23' --verbose --no-coverage`  
Expected: FAIL

- [ ] **Step 3: Implement `health` + `runTalkwalker`**

`health()` add:

```ts
const talkwalkerToken = String(this.config.talkwalkerAccessToken ?? '').trim();
// ...
talkwalker_enabled: Boolean(this.config.researchTalkwalkerEnabled && talkwalkerToken),
```

`runTalkwalker` — clone `runSparktoro` **without** enqueue / `collectSparkToro`:

```ts
async runTalkwalker(projectId, scope, input: RunTalkwalkerInput, actor): Promise<RunTalkwalkerResult> {
  const project = await this.loadScopedProject(projectId, scope);
  const questionId = Number(input.question_id);
  if (!Number.isFinite(questionId) || questionId <= 0) {
    throw new BadRequestException({ error: 'validation_error', messages: ['question_id is required'] });
  }
  const question = await this.repo.getQuestion(questionId);
  if (!question || question.project_id !== projectId) {
    throw new NotFoundException({ error: 'not_found' });
  }
  if (piiHint(question.question_vi)) {
    throw new BadRequestException({ error: 'validation_error', messages: ['question_vi contains pii'] });
  }
  const token = String(this.config.talkwalkerAccessToken ?? '').trim();
  if (!this.config.researchTalkwalkerEnabled || !token) {
    return { ok: true, note: 'talkwalker_disabled' };
  }
  const run = await this.repo.insertAiRun({
    projectId,
    questionId,
    jobType: 'talkwalker',
    provider: 'talkwalker',
    actor,
  });
  const candidates = mapTalkwalkerResponse(TALKWALKER_STUB_RESULTS);
  const source_ids: number[] = [];
  for (const row of candidates) {
    const created = await this.repo.createSource(projectId, {
      title: row.title,
      url: row.url,
      publisher: row.publisher,
      reliability_tier: row.reliability_tier,
      limitation_note: row.limitation_note,
      question_id: questionId,
      source_type: 'social_public',
      ai_generated: true,
      keep: true,
    });
    source_ids.push(created.id);
  }
  await this.repo.succeedAiRun(run.id, {
    creditsUsed: 0,
    outputJson: { source_ids, stub: true, note: 'talkwalker_stub' },
  });
  return { ok: true, run_id: run.id, status: 'succeeded', source_ids, note: 'talkwalker_stub' };
}
```

Do **not** call `jobQueue.enqueue*`. Do **not** import `fetch`. `project` is loaded for tenancy only.

Controller — clone SparkToro block:

```ts
@Post('projects/:id/run-talkwalker')
@UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
async runTalkwalker(...) {
  const out = await this.research.runTalkwalker(...);
  res.status(out.note === 'talkwalker_disabled' ? HttpStatus.OK : HttpStatus.ACCEPTED);
  return out;
}
```

- [ ] **Step 4: DDL job_type**

`docs/specs/2026-08-16-postgresql-ddl-market-research-p23.sql`:

```sql
-- Market Research OS P23 — 2026-08-16 (talkwalker job_type)

ALTER TABLE crm_research_ai_runs DROP CONSTRAINT IF EXISTS crm_research_ai_runs_type_chk;
ALTER TABLE crm_research_ai_runs ADD CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
  'desk_tavily','deep_research','insight_draft','report_draft','pii_scan',
  'research_triangulate','research_pulse','whisper_ingest','sparktoro','qualtrics','rag_reembed','talkwalker'));

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-16-market-research-p23',
        'P23 M2: crm_research_ai_runs job_type talkwalker'
    )
ON CONFLICT (version) DO NOTHING;
```

`scripts/apply_pg_ddl_market_research_p23.sh` — clone P13 apply; point at this SQL.

`chmod +x` the apply script.

Run: `npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P23|health exposes' --verbose --no-coverage`  
Expected: PASS

---

## Milestone M3 — ops-web Sources CTA

**Files:**
- Create: `sources-talkwalker.util.ts` + spec
- Modify: `market-research-api.ts`, `page.tsx` Sources toolbar

**Interfaces:**
- Consumes: `health.talkwalker_enabled`, `POST …/run-talkwalker`
- Produces: button **Chạy Talkwalker** only when health on + `canRun`

- [ ] **Step 1: Failing FE spec**

```ts
import { shouldShowTalkwalkerButton, TALKWALKER_SOURCES_BANNER } from './sources-talkwalker.util';

it('P23 hides Chạy Talkwalker when health.talkwalker_enabled is false', () => {
  expect(shouldShowTalkwalkerButton(false, true)).toBe(false);
  expect(shouldShowTalkwalkerButton(false, false)).toBe(false);
});

it('P23 shows Chạy Talkwalker only when talkwalker is enabled and actor can run', () => {
  expect(shouldShowTalkwalkerButton(true, true)).toBe(true);
  expect(shouldShowTalkwalkerButton(true, false)).toBe(false);
});

it('P23 banner forbids auto insight', () => {
  expect(TALKWALKER_SOURCES_BANNER).toMatch(/Không tự tạo insight/);
});
```

Run: `cd services/ops-web && npm run test:unit -- src/components/research/sources-talkwalker.util.spec.ts`  
Expected: FAIL

- [ ] **Step 2: Util + API client**

```ts
export const TALKWALKER_SOURCES_BANNER =
  'Nguồn social công khai (stub bake-off) — ghi limitation. Không tự tạo insight.';

export const TALKWALKER_DISABLED_TITLE = 'Cần quyền chạy job và Talkwalker đã cấu hình';

export function shouldShowTalkwalkerButton(talkwalkerEnabled: boolean, canRun: boolean): boolean {
  return talkwalkerEnabled === true && canRun === true;
}
```

`TRANSITION_REASON_VI` / copy map in `market-research-api.ts`:

```ts
talkwalker_disabled: 'Talkwalker đang tắt — không tạo insight.',
```

`fetchResearchHealth` type add `talkwalker_enabled: boolean`.

```ts
export async function runResearchTalkwalker(
  token: string,
  projectId: number,
  questionId: number,
) {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-talkwalker`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}
```

- [ ] **Step 3: Wire Sources pane**

Clone SparkToro state: `talkwalkerEnabled` from `health.talkwalker_enabled`, `talkwalkerRunId`, `talkwalkerBanner`, `onRunTalkwalker`.

Button next to **Chạy SparkToro**:

```tsx
{showTalkwalker ? (
  <button
    type="button"
    className="btn btn-sm"
    disabled={saving || !questionId || talkwalkerInFlight}
    title={TALKWALKER_DISABLED_TITLE}
    onClick={onRunTalkwalker}
  >
    Chạy Talkwalker
  </button>
) : null}
```

`onRunTalkwalker`: if `out.note === 'talkwalker_disabled'` set banner from `TRANSITION_REASON_VI.talkwalker_disabled`. Prod health is false → button hidden; banner path is for staging misconfig.

Show `TALKWALKER_SOURCES_BANNER` near the button when `showTalkwalker`.

Do **not** change portal-web.

Run: `cd services/ops-web && npm run test:unit -- src/components/research/sources-talkwalker.util.spec.ts`  
Expected: PASS

---

## Milestone M4 — Scorecard + docs + smoke + deploy

**Files:**
- Create: bake-off scorecard
- Modify: catalog / OS / Actions
- Create: smoke + deploy

- [ ] **Step 1: Scorecard 100đ**

Create `docs/specs/2026-08-16-talkwalker-brandwatch-bakeoff-scorecard.md`.

10 tiêu chí × 10 điểm. **Để trống điểm** — PO chấm sau trial. Không bịa số.

| # | Tiêu chí | Talkwalker (/10) | Brandwatch (/10) | Ghi chú |
|---|---------|------------------|------------------|---------|
| 1 | Phủ tiếng Việt / slang / dialect | | | |
| 2 | Kênh công khai FB / TikTok / news (**không** login scrape) | | | Design §20 |
| 3 | Sentiment / topic trên VI | | | |
| 4 | API: search → url + title + snippet | | | P23 contract |
| 5 | Giá / credit theo usage PTT | | | |
| 6 | DPA / no-training / residency | | | |
| 7 | Latency + rate limit | | | |
| 8 | Export vào Evidence OS + limitation | | | BR-RES-09 |
| 9 | Minh bạch mentions ≠ population | | | BR-RES-04 |
| 10 | Lock-in / chi phí đổi vendor | | | |

**Quyết định P24+:** chỉ live HTTP vendor **thắng** (≥70 **và** hơn đối thủ ở #2+#9). Hòa / thua → giữ stub, không mua key.

- [ ] **Step 2: Catalog + RES-UC-084**

Matrix row:

| RES-UC-084 | Talkwalker source candidates (stub) | P23 | P23 | Spec ready | FR-SRC · BR-RES-04/06/08/09/11 |

### RES-UC-084 — Talkwalker source candidates (stub bake-off)

- **Actor chính:** Analyst (`crm_research.run`)
- **API:** `POST /api/v1/research/projects/:id/run-talkwalker` body `{ question_id }`
- **Flag:** `RESEARCH_TALKWALKER_ENABLED` default 0; health `talkwalker_enabled` = flag **và** `TALKWALKER_ACCESS_TOKEN`
- Flag/token off → `200 {ok:true, note:talkwalker_disabled}`; 0 source; 0 HTTP
- Flag+token on → persist fixture sources `publisher=Talkwalker`, `source_type=social_public`, `note=talkwalker_stub`; **cấm** `createInsight`
- PII `question_vi` → 400
- **Màn hình:** Sources — **Chạy Talkwalker** ẩn khi health off
- Banner: `Nguồn social công khai (stub bake-off) — ghi limitation. Không tự tạo insight.`
- Scorecard: `docs/specs/2026-08-16-talkwalker-brandwatch-bakeoff-scorecard.md`
- **Cấm** live Talkwalker HTTP; **cấm** bật flag/token trên prod deploy; không portal; không Brandwatch connector

SCR-RES-003b Sources: add UC 084.

- [ ] **Step 3: OS doc P23**

After P22 section in `12-MARKET-RESEARCH-OS.md`:

```markdown
## P23 — RES-UC-084

| UC | Tóm tắt |
|----|---------|
| 084 | Stub Talkwalker → source candidates + scorecard bake-off; không HTTP vendor. |

**API:** `POST /api/v1/research/projects/:id/run-talkwalker`  
**Gates:** api + ops-web + job_type DDL; không portal; không bật flag/token prod.
```

Guards table add:

| `RESEARCH_TALKWALKER_ENABLED` | default `0` — stub; không bật deploy |
| `TALKWALKER_ACCESS_TOKEN` | không log / không trả health / không ghi deploy |

- [ ] **Step 4: UAT P23**

Replace `## P22+ (backlog — Talkwalker / pgvector prod)` with P23 UAT + `## P23+ (backlog — pgvector prod / portal report-detail stale)`.

**Walkthrough UAT P23 — Talkwalker stub (≈8 phút)**

**Mục tiêu:** *«Analyst bấm Chạy Talkwalker khi flag off → không source mới; staging flag+token → source Talkwalker + limitation, không insight.»*

**Tiền đề:** Prod flags Talkwalker off. Staging UAT bước 4–6 cần flag+token **staging only**.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Sources, prod/default health | Không thấy **Chạy Talkwalker** |
| 2 | QA | `POST …/run-talkwalker` flag off | `200 {note:talkwalker_disabled}`; 0 source |
| 3 | QA | Health JSON | `talkwalker_enabled=false`; không token |
| 4 | AN | Staging flag+token, chọn RQ, **Chạy Talkwalker** | Source `publisher=Talkwalker` + limitation |
| 5 | QA | Activity / ai_run | `job_type=talkwalker`; `output_json.stub=true`; 0 insight |
| 6 | QA | Prod sau deploy P23 | Button ẩn; Talkwalker/RAG/pgvector flags không đổi |

- [ ] **Step 5: Smoke scripts**

`scripts/smoke_market_research_p23.sh` loops m1–m5.

| Script | Gate |
|--------|------|
| `p23_m1.sh` | `npx jest …talkwalker-mapper.util.spec.ts --testNamePattern='P23'` + competitor P23 |
| `p23_m2.sh` | `npx jest …market-research.service.spec.ts --testNamePattern='P23'` |
| `p23_m3.sh` | grep `talkwalker_disabled` in service; grep `run-talkwalker` in controller; grep `shouldShowTalkwalkerButton` in page; grep `TALKWALKER_STUB_RESULTS`; **forbid** `api.talkwalker.com` in `services/ptt-crm-api/src/market-research/**` |
| `p23_m4.sh` | grep `RES-UC-084`, `P23`, `Walkthrough UAT P23`; `test -f` scorecard + deploy + DDL |
| `p23_m5.sh` | `npm test -- --testPathPattern='market-research\|portal-research' --passWithNoTests --no-coverage` + ops-web `sources-talkwalker.util.spec.ts` |

- [ ] **Step 6: Deploy script**

Clone `scripts/deploy_market_research_p22_vps.sh` → `deploy_market_research_p23_vps.sh`:

- Header: P23 — P0–P22 stack + Talkwalker stub
- Path: 1/3 DDL (P0–P7 + P10 + P11 + P13 + P20 fail-soft + P21 + **P23**) → 2/3 api → 3/3 **ops-web**
- Do **not** rebuild portal-web
- Do **not** set `RESEARCH_TALKWALKER_ENABLED` / `TALKWALKER_ACCESS_TOKEN`
- Do **not** set RAG / OpenAI embed / pgvector / SparkToro / Qualtrics flags
- Echo `UAT: bash scripts/smoke_market_research_p23.sh`
- Echo flags untouched: Talkwalker + RAG + pgvector stay off

`chmod +x` all new scripts.

---

## Milestone M5 — Verification

- [ ] `bash scripts/smoke_market_research_p23.sh` — m1–m5 pass
- [ ] Confirm no `fetch(` / `api.talkwalker.com` under `market-research/`
- [ ] Confirm no portal-web diff
- [ ] Confirm no GTM files in the P23 change set
- [ ] Confirm SparkToro / Qualtrics / conjoint / RAG files unchanged except health snapshot `talkwalker_enabled: false`

---

## Out of scope (P24+)

Live Talkwalker Search API, `TALKWALKER_PROJECT_ID` required path, Python worker, Brandwatch connector, buying a key, pgvector prod enable / IVFFlat / install pgvector on VPS, portal report-detail stale, filter «Chỉ hết hạn» portal RAG, hide stale from ranking, conjoint simulator / MOE.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| Stub + flag off (clone SparkToro/Qualtrics) | M2 disabled path |
| No vendor HTTP / no prod key | M1 stub util + M4 smoke forbid host + deploy |
| Sources only, no insight | M2 persist + spec |
| BR-RES-04/09 limitation + tier cap | M1 mapper + paid-estimate |
| BR-RES-11 PII | M2 400 before persist |
| FE hidden when health off | M3 |
| Bake-off scorecard 100đ | M4 scorecard |
| job_type CHECK | M2 DDL |
| Deploy api + ops-web | M4 deploy |

No placeholders. Names: `runTalkwalker`, `talkwalker_disabled`, `talkwalker_stub`, `TALKWALKER_STUB_RESULTS`, `mapTalkwalkerResponse`, `RES-UC-084`.
