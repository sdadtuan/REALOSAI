# Market Research OS P22 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff RAG search (`InsightsRagSearch`) shows the same stale banner as P18 insight cards when a hit’s `valid_to` is before today (UTC), closing the staff-channel gap left after P19 portal RAG stale.

**Architecture:** P19 already adds `valid_to` / `is_stale` on `RagHit` via `rankRagHits`. P20 `listEmbeddingsByVec` already SELECTs `i.valid_to`. P22 extends staff `listEmbeddings` SQL (JSONB default path) to SELECT + GROUP BY `i.valid_to` and map the row. ops-web reuses `InsightStaleBanner` + `insightIsStale` under each stale hit in `InsightsRagSearch`. No new endpoints, no DDL.

**Tech Stack:** NestJS `market-research`, Next.js ops-web, existing `insight-stale.util.ts`, Jest, Vitest, bash smoke/deploy.

**Hướng đã khóa:** 1 — staff RAG stale banner (RES-UC-083). Talkwalker / pgvector prod / portal report-detail stale / conjoint simulator = out.

## Global Constraints

- **No DDL** · **No** new endpoint · **No** portal-web changes · **No** RAG/pgvector flag changes on prod deploy
- Stale rule (same as P18/P19): `is_stale = true` when `valid_to` set and `valid_to < today` (UTC); `valid_to === today` → false; null → false
- Corpus staff RAG = **`approved_client_facing` + `published`** (unchanged P7)
- **Do not** hide stale hits — warn only (P18/P19 parity)
- Staff copy: reuse P18 `INSIGHT_STALE_BANNER` (not portal client copy)
- Deploy rebuilds **api + ops-web** (not portal-web)
- Deploy **must not** set `RESEARCH_RAG_ENABLED` / OpenAI embed / pgvector flags
- Branch: `feat/market-research-os-p22` from `main` (`9d42fed9`+)
- Commit chỉ khi user yêu cầu

---

## File map

| File | Role |
|------|------|
| `services/ptt-crm-api/src/market-research/market-research.repository.ts` | `listEmbeddings` SELECT `i.valid_to`; map row |
| `services/ptt-crm-api/src/market-research/market-research.repository.spec.ts` | Assert SQL binds `valid_to` on listEmbeddings |
| `services/ptt-crm-api/src/market-research/market-research.service.spec.ts` | P22 staff search returns `is_stale` |
| `services/ops-web/src/lib/market-research-api.ts` | `ResearchRagHit` adds `valid_to?`, `is_stale?` |
| `services/ops-web/src/components/research/insight-stale.util.ts` | Add `ragHitIsStale` (same shape as `insightIsStale`) |
| `services/ops-web/src/components/research/insight-stale.util.spec.ts` | P22 ragHitIsStale prefers API flag |
| `services/ops-web/src/components/research/InsightsRagSearch.tsx` | Banner under stale hits |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | Catalog + RES-UC-083 |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | P22 section |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | UAT P22 |
| `scripts/smoke_market_research_p22*.sh` | M1–M5 |
| `scripts/deploy_market_research_p22_vps.sh` | Clone P21 (api + ops-web); no new DDL |

**Unchanged:** `rankRagHits` score math, portal RAG, insight tab P18, conjoint P21, pgvector P20, DDL scripts, portal-web.

---

## Milestone M1 — API: `valid_to` on staff `listEmbeddings`

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.spec.ts`

**Interfaces:**
- Consumes: existing `rankRagHits` + `isInsightStale` (P19 — no util change)
- Produces: staff `GET /api/v1/research/insights/search` hits with populated `valid_to` / `is_stale` on the **JSONB** path (`listEmbeddings`)

- [ ] **Step 1: Write failing repository spec**

In `market-research.repository.spec.ts`, after the existing `listEmbeddings filters theme_code` test:

```ts
it('P22 listEmbeddings selects valid_to', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  const repo = repoWithMock();
  await repo.listEmbeddings({ client_id: 'acme' });
  const sql = String(queryMock.mock.calls[0][0]);
  expect(sql).toMatch(/i\.valid_to/);
  expect(sql).toMatch(/GROUP BY.*i\.valid_to/s);
});
```

Run: `cd services/ptt-crm-api && npx jest src/market-research/market-research.repository.spec.ts --testNamePattern='P22 listEmbeddings' -v`  
Expected: FAIL

- [ ] **Step 2: Extend `listEmbeddings` SQL**

In SELECT add `i.valid_to::text AS valid_to` next to `i.observation`.  
In GROUP BY add `i.valid_to`.  
In the row mapper add:

```ts
valid_to: row.valid_to != null ? String(row.valid_to) : null,
```

Mirror `listEmbeddingsByVec` (already has this from P20). Do **not** change `listEmbeddingsByVec`.

- [ ] **Step 3: Service spec — search returns `is_stale`**

In `market-research.service.spec.ts`, after the existing search tests (flag off stays `listEmbeddings`):

```ts
it('P22 searchInsights returns is_stale from listEmbeddings valid_to', async () => {
  config.researchRagEnabled = true;
  const statement = 'Giá sữa học đường tăng tại Hà Nội';
  const vec = embedInsightText(statement);
  repo.listEmbeddings.mockResolvedValue([
    {
      insight_id: 20,
      project_id: 9,
      status: 'published',
      statement,
      observation: null,
      embedding: vec,
      theme_codes: [],
      client_id: 'acme',
      valid_to: '2020-01-01',
    },
  ]);
  const out = await service.searchInsights(
    { restricted: false, allowedClientIds: [] },
    { q: statement },
  );
  expect(repo.listEmbeddings).toHaveBeenCalled();
  expect(out.hits[0]).toMatchObject({
    insight_id: 20,
    valid_to: '2020-01-01',
    is_stale: true,
  });
});
```

`rankRagHits` already sets `is_stale` when `valid_to` is present — no service change if mapper is correct.

Run: `npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P22 searchInsights' -v`  
Expected: PASS after Step 2.

---

## Milestone M2 — ops-web: banner on staff RAG hits

**Files:**
- Modify: `services/ops-web/src/lib/market-research-api.ts`
- Modify: `services/ops-web/src/components/research/insight-stale.util.ts`
- Modify: `services/ops-web/src/components/research/insight-stale.util.spec.ts`
- Modify: `services/ops-web/src/components/research/InsightsRagSearch.tsx`

**Interfaces:**
- Consumes: `InsightStaleBanner`, `insightIsStale` / `INSIGHT_STALE_BANNER`
- Produces: stale hits render the P18 amber banner

- [ ] **Step 1: Extend `ResearchRagHit`**

```ts
export type ResearchRagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: 'approved_client_facing' | 'published';
  score: number;
  theme_codes: string[];
  valid_to?: string | null;
  is_stale?: boolean;
};
```

- [ ] **Step 2: `ragHitIsStale`**

In `insight-stale.util.ts` add (alias — same rule as `insightIsStale`):

```ts
export function ragHitIsStale(
  hit: { is_stale?: boolean; valid_to?: string | null },
  ref: Date = new Date(),
): boolean {
  return insightIsStale(hit, ref);
}
```

In `insight-stale.util.spec.ts`:

```ts
it('P22 ragHitIsStale prefers API is_stale flag', () => {
  const ref = new Date('2026-08-15T00:00:00.000Z');
  expect(ragHitIsStale({ is_stale: true, valid_to: '2099-01-01' }, ref)).toBe(true);
  expect(ragHitIsStale({ is_stale: false, valid_to: '2020-01-01' }, ref)).toBe(false);
  expect(ragHitIsStale({ valid_to: '2020-01-01' }, ref)).toBe(true);
  expect(ragHitIsStale({ valid_to: null }, ref)).toBe(false);
});
```

Run: `cd services/ops-web && npm run test:unit -- src/components/research/insight-stale.util.spec.ts`  
Expected: PASS after adding the import + function.

- [ ] **Step 3: Render banner in `InsightsRagSearch`**

Import `InsightStaleBanner` and `ragHitIsStale`. Under each `<li>`:

```tsx
{ragHitIsStale(hit) ? <InsightStaleBanner validTo={hit.valid_to} /> : null}
```

Do **not** filter stale hits out of the list.

---

## Milestone M3 — Docs + smoke + deploy

**Files:**
- Modify: catalog / OS / Actions
- Create: smoke + deploy scripts

- [ ] **Step 1: Catalog + RES-UC-083**

| RES-UC-083 | Staff insight stale banner (RAG) | P22 | P22 | Spec ready | FR-INS-07 · UC-079 |

### RES-UC-083 — Staff insight stale banner (RAG search)

- **Actor chính:** AM, Analyst, Lead (`crm_research.view`)
- **API:** `GET /api/v1/research/insights/search` — mỗi hit thêm `valid_to`, `is_stale` (populated when staff `listEmbeddings` returns `valid_to`)
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/crm/research/analytics` + project analytics RAG — banner dưới hit stale
- Banner: reuse P18 staff copy (`INSIGHT_STALE_BANNER`)
- **Cấm** endpoint mới; không DDL; không portal; không ẩn hit stale

- [ ] **Step 2: OS doc P22**

After P21 section in `12-MARKET-RESEARCH-OS.md`:

```markdown
## P22 — RES-UC-083

| UC | Tóm tắt |
|----|---------|
| 083 | Staff RAG hit hiện banner khi insight `valid_to` < hôm nay. |

**API:** cùng staff insights/search — hits `valid_to`/`is_stale` populated  
**Gates:** api + ops-web; không DDL; không portal; không RAG flags.
```

- [ ] **Step 3: UAT P22**

Replace `## P21+ (backlog — Talkwalker / staff RAG stale / pgvector prod)` with P22 UAT + `## P22+ (backlog — Talkwalker / pgvector prod)`.

**Walkthrough UAT P22 — Staff RAG stale banner (≈8 phút)**

**Mục tiêu:** *«Analyst tìm insight RAG → hit hết hạn có banner vàng; hit còn hiệu lực không banner.»*

**Tiền đề:** RAG flag on staging; ≥1 insight ACF/published stale + ≥1 còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Mở analytics RAG, search keyword | Hit stale có banner |
| 2 | AN | Hit valid_to = hôm nay | Không banner |
| 3 | AN | Hit valid_to null | Không banner |
| 4 | AN | Hit còn hiệu lực | Không banner |
| 5 | QA | API search JSON | `is_stale` đúng |
| 6 | QA | Prod sau deploy P22 | Banner ops-web; RAG flags không đổi |

- [ ] **Step 4: Smoke scripts**

`scripts/smoke_market_research_p22.sh` loops m1–m5.

| Script | Gate |
|--------|------|
| `p22_m1.sh` | `npx jest ...market-research.repository.spec.ts --testNamePattern='P22 listEmbeddings'` |
| `p22_m2.sh` | `npx jest ...market-research.service.spec.ts --testNamePattern='P22 searchInsights'` |
| `p22_m3.sh` | grep `valid_to` in `listEmbeddings` repo; grep `InsightStaleBanner` in `InsightsRagSearch.tsx`; grep `is_stale` in ops `ResearchRagHit` |
| `p22_m4.sh` | grep `RES-UC-083`, `P22`, `Walkthrough UAT P22`; `test -f scripts/deploy_market_research_p22_vps.sh` |
| `p22_m5.sh` | `npm test -- --testPathPattern='market-research\|portal-research' --passWithNoTests --no-coverage` + `cd services/ops-web && npm run test:unit -- src/components/research/insight-stale.util.spec.ts` |

- [ ] **Step 5: Deploy script**

Clone `scripts/deploy_market_research_p21_vps.sh` → `deploy_market_research_p22_vps.sh`:

- Header: P22 — P0–P21 stack + staff RAG stale banner
- Path: 1/3 DDL (P0–P7 + P10 + P11 + P13 + **P20 fail-soft** + **P21**) → 2/3 api → 3/3 **ops-web**
- Do **not** add a P22 DDL apply (no new schema)
- Do **not** rebuild portal-web
- Echo `UAT: bash scripts/smoke_market_research_p22.sh`
- Echo flags untouched: RAG + OpenAI embed + pgvector stay off

`chmod +x` all new scripts.

---

## Milestone M4 — Verification

- [ ] `bash scripts/smoke_market_research_p22.sh` — m1–m5 pass
- [ ] Confirm no portal-web diff, no new DDL file
- [ ] Confirm `rankRagHits` score lines unchanged
- [ ] Confirm conjoint P21 files unchanged

---

## Out of scope (P23+)

Talkwalker bake-off, portal report-detail stale, filter «Chỉ hết hạn» on portal RAG, hiding stale hits from ranking, pgvector prod enable / IVFFlat / install pgvector on VPS, conjoint simulator / MOE.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| FR-INS-07 staff RAG mirror | M1 + M2 |
| JSONB path (prod default) | M1 `listEmbeddings` only |
| No new endpoint | listEmbeddings only |
| Staff banner copy P18 | M2 InsightStaleBanner |
| Deploy api + ops-web | M3 deploy |
| No RAG prod flags | deploy constraints |

No placeholders. Names: `valid_to`, `is_stale`, `ResearchRagHit`, `ragHitIsStale`, `RES-UC-083`.
