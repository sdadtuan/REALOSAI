# Market Research OS P19 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal RAG search (`/research`) shows a client-facing stale banner on each published hit whose `valid_to` is before today (UTC), mirroring staff P18 (FR-INS-07) for the client channel.

**Architecture:** Reuse API `isInsightStale` from P18. Extend portal embedding SQL + `rankRagHits` to carry `valid_to` / `is_stale` on every `RagHit`. portal-web renders `PortalInsightStaleBanner` under stale hits in `PortalResearchRagSearch`. No new endpoints, no DDL, no ops-web changes.

**Tech Stack:** NestJS `portal-research`, shared `insight-stale.util.ts` + `research-rag.util.ts`, Next.js `portal-web`, Jest, Vitest, bash smoke/deploy.

**Hướng đã khóa:** 1 — portal stale banner (RES-UC-080). Conjoint lite / Talkwalker / pgvector / ISO 20252 = out.

## Global Constraints

- **No DDL** · **No** new endpoint · **No** ops-web changes · **No** RAG flag changes on prod deploy
- Stale rule (same as P18): `is_stale = true` when `valid_to` set and `valid_to < today` (UTC); `valid_to === today` → false; `valid_to` null → false
- Corpus: portal RAG = **`published` only** (unchanged P12)
- Tenancy: JWT `client_id` only — unchanged
- **Do not** hide stale hits from search — warn only (staff P18 parity)
- Portal copy **client-facing** (not staff «Cập nhật hiệu lực…»)
- Deploy rebuilds **api + portal-web** (not ops-web)
- Deploy **must not** set `RESEARCH_RAG_ENABLED` / OpenAI embed flags on prod
- Branch: `feat/market-research-os-p19` from `main`

---

## File map

| File | Role |
|------|------|
| `services/ptt-crm-api/src/market-research/insight-stale.util.ts` | Reuse `isInsightStale` (no change unless test helper needed) |
| `services/ptt-crm-api/src/market-research/market-research.types.ts` | `RagHit` + `RagEmbeddingRow` add `valid_to`, `is_stale` |
| `services/ptt-crm-api/src/market-research/research-rag.util.ts` | `rankRagHits` maps `valid_to` + `is_stale` |
| `services/ptt-crm-api/src/market-research/research-rag.util.spec.ts` | P19 stale hit test |
| `services/ptt-crm-api/src/portal-research/portal-research.repository.ts` | `listPublishedEmbeddings` SELECT `i.valid_to` |
| `services/ptt-crm-api/src/portal-research/portal-research.repository.spec.ts` | Assert SQL binds `valid_to` |
| `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts` | P19 search returns `is_stale` |
| `services/portal-web/src/lib/insight-stale.util.ts` | Client banner copy + `isInsightStale` (mirror ops-web) |
| `services/portal-web/src/components/PortalInsightStaleBanner.tsx` | Amber banner per stale hit |
| `services/portal-web/src/components/PortalResearchRagSearch.tsx` | Render banner under stale `<li>` |
| `services/portal-web/src/lib/api.ts` | `PortalResearchRagHit` adds `valid_to?`, `is_stale?` |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | Catalog + RES-UC-080 |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | P19 section |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | UAT P19 |
| `scripts/smoke_market_research_p19*.sh` | M1–M5 |
| `scripts/deploy_market_research_p19_vps.sh` | Clone P17 (api + portal-web) |

**Unchanged:** ops-web, staff insight list, portal theme analytics, report detail page, `rankRagHits` scoring math, DDL scripts.

---

## Milestone M1 — API: `valid_to` / `is_stale` on portal RAG hits

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.types.ts`
- Modify: `services/ptt-crm-api/src/market-research/research-rag.util.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.repository.ts`
- Test: `services/ptt-crm-api/src/market-research/research-rag.util.spec.ts`
- Test: `services/ptt-crm-api/src/portal-research/portal-research.repository.spec.ts`
- Test: `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts`

**Interfaces:**
- Consumes: `isInsightStale(validTo: string | null | undefined, ref?: Date): boolean`
- Consumes: embedding rows with optional `valid_to: string | null`
- Produces: `RagHit` with `valid_to: string | null` and `is_stale: boolean`

- [ ] **Step 1: Extend types**

In `market-research.types.ts`:

```ts
export type RagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: RagCorpusStatus;
  score: number;
  theme_codes: string[];
  valid_to: string | null;
  is_stale: boolean;
};

export type RagEmbeddingRow = RagEmbedInput & {
  project_id: number;
  embedding: number[];
  theme_codes: string[];
  theme_synonyms?: string[];
  client_id?: string;
  valid_to?: string | null;
};
```

- [ ] **Step 2: Write failing `rankRagHits` stale test**

In `research-rag.util.spec.ts`:

```ts
it('P19 rankRagHits sets is_stale from valid_to', () => {
  const statement = 'Giá tăng';
  const vec = embedInsightText(statement);
  const hits = rankRagHits(statement, [
    {
      insight_id: 1,
      project_id: 9,
      status: 'published',
      statement,
      observation: null,
      embedding: vec,
      theme_codes: [],
      valid_to: '2020-01-01',
    },
    {
      insight_id: 2,
      project_id: 9,
      status: 'published',
      statement: 'Ổn định',
      observation: null,
      embedding: vec,
      theme_codes: [],
      valid_to: null,
    },
  ]);
  expect(hits.find((h) => h.insight_id === 1)).toMatchObject({
    valid_to: '2020-01-01',
    is_stale: true,
  });
  expect(hits.find((h) => h.insight_id === 2)).toMatchObject({
    valid_to: null,
    is_stale: false,
  });
});
```

Run: `cd services/ptt-crm-api && npx jest src/market-research/research-rag.util.spec.ts --testNamePattern='P19 rankRagHits' -v`  
Expected: FAIL (missing fields)

- [ ] **Step 3: Implement `rankRagHits` mapping**

In `research-rag.util.ts`:

```ts
import { isInsightStale } from './insight-stale.util';

// extend row type in rankRagHits signature:
// valid_to?: string | null

hits.push({
  insight_id: row.insight_id,
  project_id: row.project_id,
  statement: row.statement,
  status: row.status,
  score,
  theme_codes: row.theme_codes,
  valid_to: row.valid_to ?? null,
  is_stale: isInsightStale(row.valid_to ?? null),
});
```

Update existing `research-rag.util.spec.ts` row helpers to include `valid_to: null` where needed so older tests still compile.

- [ ] **Step 4: Portal repo SELECT `valid_to`**

In `portal-research.repository.ts` `listPublishedEmbeddings`:

```sql
i.valid_to,
```

Add to `GROUP BY`:

```sql
GROUP BY e.insight_id, e.project_id, e.embedding, i.status, i.statement, i.observation, p.client_id, i.valid_to
```

Map in `mapEmbeddingRow` (or inline): `valid_to: row.valid_to != null ? String(row.valid_to) : null`.

- [ ] **Step 5: Repository spec**

In `portal-research.repository.spec.ts`, assert query text contains `i.valid_to`.

- [ ] **Step 6: Portal service spec P19**

In `portal-research.service.spec.ts` inside `describe('P12 portal RAG search')`:

```ts
it('P19 searchInsights returns is_stale on hits', async () => {
  config.researchRagEnabled = true;
  const statement = 'Giá sữa học đường tăng tại Hà Nội';
  const vec = embedInsightText(statement);
  repo.listPublishedEmbeddings.mockResolvedValue([
    {
      insight_id: 20,
      project_id: 9,
      status: 'published',
      statement,
      observation: null,
      embedding: vec,
      theme_codes: [],
      client_id: ACME,
      valid_to: '2020-06-01',
    },
  ]);
  const service = makeService();
  const out = await service.searchInsights(acmeUser, { q: statement });
  expect(out.hits[0]).toMatchObject({
    insight_id: 20,
    valid_to: '2020-06-01',
    is_stale: true,
  });
});
```

Run: `npm test -- --testPathPattern='research-rag.util|portal-research' --testNamePattern='P19|rankRagHits' --no-coverage`  
Expected: PASS

---

## Milestone M2 — portal-web stale banner on RAG hits

**Files:**
- Create: `services/portal-web/src/lib/insight-stale.util.ts`
- Create: `services/portal-web/src/components/PortalInsightStaleBanner.tsx`
- Modify: `services/portal-web/src/lib/api.ts`
- Modify: `services/portal-web/src/components/PortalResearchRagSearch.tsx`
- Test: `services/portal-web/src/lib/insight-stale.util.test.ts` (optional Vitest, mirror ops-web)

**Copy (client-facing):**

```ts
export const PORTAL_INSIGHT_STALE_BANNER =
  'Insight này có thể đã lỗi thời (hết hiệu lực). Liên hệ account manager để được cập nhật.';
```

- [ ] **Step 1: portal-web util**

Create `insight-stale.util.ts` with `PORTAL_INSIGHT_STALE_BANNER`, `utcDateKey`, `isInsightStale`, `ragHitIsStale(hit)` preferring `hit.is_stale` when boolean.

Vitest:

```ts
it('ragHitIsStale prefers API is_stale', () => {
  expect(ragHitIsStale({ is_stale: true, valid_to: null })).toBe(true);
});
```

- [ ] **Step 2: Extend `PortalResearchRagHit`**

In `api.ts`:

```ts
export type PortalResearchRagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: 'published';
  score: number;
  theme_codes: string[];
  valid_to?: string | null;
  is_stale?: boolean;
};
```

- [ ] **Step 3: `PortalInsightStaleBanner`**

Clone styling from ops-web `InsightStaleBanner.tsx`; use `PORTAL_INSIGHT_STALE_BANNER`; `data-testid="portal-insight-stale-banner"`.

- [ ] **Step 4: Wire `PortalResearchRagSearch`**

After each hit statement, when `ragHitIsStale(hit)`:

```tsx
{ragHitIsStale(hit) ? <PortalInsightStaleBanner validTo={hit.valid_to} /> : null}
```

- [ ] **Step 5: Run portal-web tests**

Run: `cd services/portal-web && npm test -- --run insight-stale`  
Expected: PASS

---

## Milestone M3 — RES-UC-080 docs + smoke + deploy

**Files:**
- Modify: `docs/specs/modules/RNOSAI-BA-RES-UseCases.md`
- Modify: `docs/use-cases/12-MARKET-RESEARCH-OS.md`
- Modify: `docs/use-cases/actions/12-RES-ACTIONS.md`
- Create: `scripts/smoke_market_research_p19.sh` + `p19_m1.sh` … `p19_m5.sh`
- Create: `scripts/deploy_market_research_p19_vps.sh`

- [ ] **Step 1: Catalog row + RES-UC-080**

Catalog table:

| RES-UC-080 | Portal insight stale banner (RAG) | P19 | P19 | Spec ready | FR-INS-07 · UC-079 |

Detail block:

### RES-UC-080 — Portal insight stale banner (RAG search)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/insights/search` — mỗi hit thêm `valid_to`, `is_stale`
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/research` — banner dưới hit RAG stale
- Banner: `Insight này có thể đã lỗi thời (hết hiệu lực). Liên hệ account manager để được cập nhật.`
- **Cấm** endpoint mới; không DDL; không ops-web; không ẩn hit stale

- [ ] **Step 2: OS doc P19 section**

```markdown
## P19 — RES-UC-080

| UC | Tóm tắt |
|----|---------|
| 080 | Portal RAG hit hiện banner khi insight `valid_to` < hôm nay. |

**API:** cùng portal insights/search — hits thêm `valid_to`, `is_stale`  
**Gates:** api + portal-web; không DDL; không ops-web; không RAG flags.
```

- [ ] **Step 3: UAT P19 in `12-RES-ACTIONS.md`**

Replace `## P18+ (backlog — conjoint / Talkwalker)` with P19 UAT + new `## P19+ (backlog — conjoint / Talkwalker)`.

**Walkthrough UAT P19 — Portal insight stale banner (≈8 phút)**

**Mục tiêu:** *«Khách portal tìm insight RAG → hit hết hạn có banner vàng; hit còn hiệu lực không banner.»*

**Tiền đề:** RAG flag on staging; ≥1 insight `published` stale + ≥1 còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research`, search keyword | Hit stale có banner |
| 2 | CL | Hit valid_to = hôm nay | Không banner |
| 3 | CL | Hit valid_to null | Không banner |
| 4 | CL | Hit còn hiệu lực | Không banner |
| 5 | QA | API search JSON | `is_stale` đúng |
| 6 | QA | Prod sau deploy P19 | Banner portal; RAG flags không đổi |

- [ ] **Step 4: Smoke scripts**

`scripts/smoke_market_research_p19.sh` — loop m1–m5.

| Script | Command / gate |
|--------|----------------|
| `p19_m1.sh` | `npx jest src/market-research/research-rag.util.spec.ts --testNamePattern='P19 rankRagHits'` |
| `p19_m2.sh` | `npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P19 searchInsights'` |
| `p19_m3.sh` | grep `is_stale` in portal `api.ts`; grep `PortalInsightStaleBanner` in `PortalResearchRagSearch.tsx`; grep `valid_to` in portal repository |
| `p19_m4.sh` | grep `RES-UC-080`, `P19` in OS doc, `Walkthrough UAT P19`; `test -f scripts/deploy_market_research_p19_vps.sh` |
| `p19_m5.sh` | `npm test -- --testPathPattern='market-research\|portal-research' --passWithNoTests --no-coverage` |

`chmod +x` all new scripts.

- [ ] **Step 5: Deploy script**

Clone `scripts/deploy_market_research_p17_vps.sh` → `deploy_market_research_p19_vps.sh`:

- Header: P19 — P0–P18 stack + portal RAG stale banner
- Path: 1/3 DDL → 2/3 api → 3/3 **portal-web**
- Do **not** rebuild ops-web
- Echo `UAT: bash scripts/smoke_market_research_p19.sh`

---

## Milestone M4 — Verification

- [ ] `bash scripts/smoke_market_research_p19.sh` — all m1–m5 pass
- [ ] Confirm no ops-web diff, no DDL file, no new route
- [ ] Staff RAG / insight list unchanged in UI (extra JSON fields OK)

---

## Out of scope (P20+)

Conjoint lite (PRICE_OFFER), Talkwalker bake-off, pgvector / OpenAI re-embed prod, ISO 20252, portal report-detail stale scan, filter «Chỉ hết hạn» on portal, hiding stale hits from RAG ranking.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| FR-INS-07 portal mirror | M1 + M2 |
| published corpus only | unchanged P12 SQL |
| no new endpoint | extend existing search payload |
| client copy | M2 banner |
| deploy api + portal-web | M3 deploy script |
| no RAG prod flags | deploy constraints |

No placeholders. Type names consistent: `valid_to`, `is_stale`, `RagHit`, `PortalResearchRagHit`.
