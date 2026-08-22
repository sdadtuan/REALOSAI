# Market Research OS P17 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal theme-quarter analytics shows the same QoQ/YoY percent deltas as staff P16, on published insights only, without a new endpoint or DDL.

**Architecture:** Reuse P16 `enrichThemeQuarterRows`. Portal `getThemeQuarterAnalytics` dual-fetches `year` + `year-1` for JWT `client_id`, then enriches rows. `PortalThemeQuarterTable` renders Δ under each quarter cell (copy staff `QuarterCell`).

**Tech Stack:** NestJS `portal-research`, Next.js `portal-web`, existing `theme-quarter-delta.util.ts`, Jest, bash smoke/deploy.

**Hướng đã khóa:** 1 — portal QoQ/YoY (RES-UC-078). Staff table / ops-web / conjoint / Talkwalker / pgvector / `valid_to` banner = out.

## Global Constraints

- Corpus: **`published` only** — no `approved_client_facing`, no draft
- Tenancy: JWT `client_id` only — same as P15
- **Reuse** `enrichThemeQuarterRows` — do **not** duplicate delta math
- Same Δ rules as P16: QoQ = prior quarter same year (Q1 → `prev_qoq_count`/`delta_qoq_pct` null); YoY = same quarter `year-1`; `delta_*_pct = null` when prior count is 0 or missing
- **No** new endpoint · **No DDL** · **No** ops-web changes · **No** RAG flag changes
- Deploy rebuilds **api + portal-web** (not ops-web)
- Deploy **must not** set `RESEARCH_RAG_ENABLED` / OpenAI embed flags on prod
- Branch: `feat/market-research-os-p17` from `main`

---

## File map

| File | Role |
|------|------|
| `services/ptt-crm-api/src/market-research/market-research.types.ts` | `PortalThemeQuarterAnalyticsPayload.rows` → `ThemeQuarterRow[]` |
| `services/ptt-crm-api/src/portal-research/portal-research.service.ts` | Dual-fetch + `enrichThemeQuarterRows` |
| `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts` | Update P15 mock (year-1) + P17 enrich test |
| `services/portal-web/src/lib/api.ts` | Row type adds four delta fields |
| `services/portal-web/src/components/PortalThemeQuarterTable.tsx` | Pivot + `QuarterCell` Δ QoQ/YoY |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | Catalog + RES-UC-078 |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | P17 section |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | UAT P17 |
| `scripts/smoke_market_research_p17*.sh` | M1–M5 |
| `scripts/deploy_market_research_p17_vps.sh` | Clone P15 (api + portal-web) |

**Unchanged:** portal repository SQL, portal controller, staff analytics, `theme-quarter-delta.util.ts`, ops-web.

---

## Milestone M1 — Portal payload type + dual-year enrich

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.types.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.ts`
- Test: `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts`

**Interfaces:**
- Consumes: `enrichThemeQuarterRows(currentRows: ThemeQuarterCountRow[], priorYearRows: ThemeQuarterCountRow[]): ThemeQuarterRow[]`
- Consumes: `repo.getThemeQuarterAnalytics(clientId: string, year: number): Promise<ThemeQuarterCountRow[]>`
- Produces: `PortalThemeQuarterAnalyticsPayload.rows: ThemeQuarterRow[]`

- [ ] **Step 1: Change portal payload row type**

In `market-research.types.ts`, change only the `rows` field:

```ts
export type PortalThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string;
  corpus_statuses: readonly ['published'];
  rows: ThemeQuarterRow[];
};
```

- [ ] **Step 2: Write the failing P17 service test (and fix P15 mock)**

P15 currently mocks one repo call. After dual-fetch, a second `year-1` call runs. Update the existing P15 test so year-1 returns `[]` (deltas null) and still asserts corpus/`published`/no `title`.

Add a new test in the same `describe('P15 portal theme quarter analytics')` block (or a sibling `describe('P17 portal theme quarter deltas')`):

```ts
it('P17 getThemeQuarterAnalytics enriches QoQ and YoY deltas', async () => {
  repo.getThemeQuarterAnalytics
    .mockResolvedValueOnce([
      { quarter: 1, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
      { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 4 },
    ])
    .mockResolvedValueOnce([
      { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
    ]);
  const service = makeService();
  const out = await service.getThemeQuarterAnalytics(acmeUser, 2026);
  expect(out.corpus_statuses).toEqual(['published']);
  expect(out.rows[1]).toMatchObject({
    quarter: 2,
    insight_count: 4,
    prev_qoq_count: 2,
    delta_qoq_pct: 100,
    prev_yoy_count: 2,
    delta_yoy_pct: 100,
  });
  expect(out.rows[0]).toMatchObject({
    quarter: 1,
    prev_qoq_count: null,
    delta_qoq_pct: null,
  });
  expect(JSON.stringify(out)).not.toContain('title');
  expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith(ACME, 2026);
  expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith(ACME, 2025);
});
```

Update P15 test repo mock to two calls:

```ts
repo.getThemeQuarterAnalytics
  .mockResolvedValueOnce([
    { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
  ])
  .mockResolvedValueOnce([]);
```

Keep `expect(out.rows[0])` matching count fields; after enrich it will also have `prev_qoq_count: null`, `prev_yoy_count: null`, `delta_qoq_pct: null`, `delta_yoy_pct: null`. Do **not** keep a strict `toEqual` on count-only objects.

- [ ] **Step 3: Run P17 test — expect FAIL**

```bash
cd services/ptt-crm-api
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P17 getThemeQuarterAnalytics' --verbose --no-coverage
```

Expected: FAIL — second repo call not made / rows lack delta fields.

- [ ] **Step 4: Implement dual-fetch + enrich**

In `portal-research.service.ts`:

```ts
import { enrichThemeQuarterRows } from '../market-research/theme-quarter-delta.util';
```

Replace the body of `getThemeQuarterAnalytics` after year validation:

```ts
const currentRows = await this.repo.getThemeQuarterAnalytics(user.client_id, year);
const priorYearRows =
  year > 2000
    ? await this.repo.getThemeQuarterAnalytics(user.client_id, year - 1)
    : [];
const rows = enrichThemeQuarterRows(currentRows, priorYearRows);
return {
  ok: true,
  year,
  client_id: user.client_id,
  corpus_statuses: PORTAL_RAG_CORPUS_STATUSES,
  rows,
};
```

Do **not** change the controller or repository.

- [ ] **Step 5: Run P15 + P17 service specs — expect PASS**

```bash
cd services/ptt-crm-api
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P15 portal theme quarter|P17 getThemeQuarterAnalytics' --verbose --no-coverage
```

Expected: PASS.

---

## Milestone M2 — portal-web Δ under Q1–Q4

**Files:**
- Modify: `services/portal-web/src/lib/api.ts` (`PortalThemeQuarterAnalyticsPayload.rows`)
- Modify: `services/portal-web/src/components/PortalThemeQuarterTable.tsx`

**Interfaces:**
- Consumes: each row may include `delta_qoq_pct` / `delta_yoy_pct` (`number | null`)
- Produces: table cells show count + optional `+N% QoQ` / `+N% YoY` muted subtext

- [ ] **Step 1: Extend portal API row type**

In `services/portal-web/src/lib/api.ts`:

```ts
export type PortalThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string;
  corpus_statuses: readonly string[];
  rows: Array<{
    quarter: number;
    theme_code: string;
    label_vi: string;
    insight_count: number;
    prev_qoq_count?: number | null;
    prev_yoy_count?: number | null;
    delta_qoq_pct?: number | null;
    delta_yoy_pct?: number | null;
  }>;
};
```

- [ ] **Step 2: Mirror staff QuarterCell + pivot deltas**

In `PortalThemeQuarterTable.tsx`:

1. Add optional delta fields to `PortalThemeQuarterRow`.
2. Add `deltaQoq` / `deltaYoy` tuples to `PortalThemeQuarterPivotRow` (same shape as staff).
3. In `pivotPortalThemeQuarterRows`, when `quarter` is 1–4, set `deltaQoq[idx] = row.delta_qoq_pct ?? null` and `deltaYoy[idx] = row.delta_yoy_pct ?? null`.
4. Copy staff `formatDeltaPct` + `QuarterCell` (count 0 → `—`; hide a Δ line when that pct is `null`).
5. Replace `<td key={idx}>{count || '—'}</td>` with `<QuarterCell count={count} deltaQoq={row.deltaQoq[idx]} deltaYoy={row.deltaYoy[idx]} />`.

Do **not** change `/research` page layout, RAG prefill, or banner copy except a one-line note if needed: table still visible when `rag_enabled=false`.

- [ ] **Step 3: Grep gate (smoke M3)**

```bash
grep -q 'delta_qoq_pct' services/portal-web/src/lib/api.ts
grep -q 'deltaQoq' services/portal-web/src/components/PortalThemeQuarterTable.tsx
grep -q 'enrichThemeQuarterRows' services/ptt-crm-api/src/portal-research/portal-research.service.ts
```

Expected: all three match.

---

## Milestone M3 — Docs + smoke + deploy

**Files:**
- Modify: `docs/specs/modules/RNOSAI-BA-RES-UseCases.md`
- Modify: `docs/use-cases/12-MARKET-RESEARCH-OS.md`
- Modify: `docs/use-cases/actions/12-RES-ACTIONS.md`
- Create: `scripts/smoke_market_research_p17.sh` and `p17_m1`–`p17_m5`
- Create: `scripts/deploy_market_research_p17_vps.sh`

- [ ] **Step 1: Catalog row + RES-UC-078**

Add after RES-UC-077 in the catalog table:

```
| RES-UC-078 | Theme QoQ / YoY delta (portal analytics) | P17 | P17 | Spec ready | FR-INT-04 · BR-RES-06 · UC-076 |
```

Add section after RES-UC-077 (same bullet style):

```
### RES-UC-078 — Theme QoQ / YoY delta (portal analytics)

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/analytics/themes?year=` — payload rows thêm `prev_qoq_count`, `prev_yoy_count`, `delta_qoq_pct`, `delta_yoy_pct`
- **Corpus:** chỉ `published` cùng `client_id` JWT
- **QoQ:** quý trước trong cùng năm (Q1 → null)
- **YoY:** cùng quý năm `year-1`
- **Δ:** `null` khi prior count = 0 hoặc không có dữ liệu
- **Màn hình:** `/research` (portal-web) — subtext Δ dưới mỗi ô quý
- **Cấm** endpoint mới; không ops-web; không Talkwalker / conjoint / pgvector
```

- [ ] **Step 2: OS + UAT docs**

Append to `12-MARKET-RESEARCH-OS.md`:

```
## P17 — RES-UC-078

| UC | Tóm tắt |
|----|---------|
| 078 | Portal theme analytics thêm Δ QoQ (trong năm) và YoY (cùng quý năm trước). |

**API:** cùng `GET /api/v1/portal/research/analytics/themes` — rows enriched  
**Gates:** api + portal-web; không DDL; không ops-web; không RAG flags.
```

In `12-RES-ACTIONS.md`, after UAT P16, add `## P17+ (backlog — conjoint / Talkwalker)` and:

```
## Walkthrough UAT P17 — Portal theme QoQ/YoY delta (≈8 phút)

**Mục tiêu:** *«Khách portal mở /research → bảng theme có Δ QoQ/YoY dưới mỗi quý.»*

**Tiền đề:** insight `published` gắn theme ít nhất 2 quý liên tiếp hoặc cùng quý năm trước

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research` | Ô quý hiện count + Δ QoQ/YoY (nếu có) |
| 2 | CL | Q2 count=4, Q1 count=2 | Δ QoQ +100% |
| 3 | CL | Q2 năm trước count=2 | Δ YoY +100% |
| 4 | CL | Q1 bất kỳ | Không Δ QoQ |
| 5 | CL | Prior count=0 | Δ = null (không hiện %) |
| 6 | QA | Prod sau deploy P17 | Bảng + Δ; RAG ẩn khi flag off |

- [ ] Bước 1–6 pass staging
```

- [ ] **Step 3: Smoke scripts**

`scripts/smoke_market_research_p17.sh` — loop m1–m5 (clone P16 wrapper).

| Script | Command / gate |
|--------|----------------|
| `p17_m1.sh` | `npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P17 getThemeQuarterAnalytics'` |
| `p17_m2.sh` | `npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P15 portal theme quarter\|P17 getThemeQuarterAnalytics'` |
| `p17_m3.sh` | grep `delta_qoq_pct` in portal-web `api.ts`; grep `deltaQoq` in `PortalThemeQuarterTable.tsx`; grep `enrichThemeQuarterRows` in portal service |
| `p17_m4.sh` | grep `RES-UC-078`, `P17` in OS doc, `Walkthrough UAT P17`; `test -f scripts/deploy_market_research_p17_vps.sh` |
| `p17_m5.sh` | `npm test -- --testPathPattern='market-research\|portal-research' --passWithNoTests --no-coverage` |

`chmod +x` all new scripts.

- [ ] **Step 4: Deploy script**

Clone `scripts/deploy_market_research_p15_vps.sh` → `deploy_market_research_p17_vps.sh`:

- Header: P17 — P0–P16 stack + portal theme QoQ/YoY
- Path: 1/3 DDL (P0–P7 + P10 + P11 + P13) → 2/3 api → 3/3 **portal-web**
- Do **not** rebuild ops-web
- Do **not** set `RESEARCH_RAG_ENABLED` / embed flags unless `--enable-flags`
- Echo `UAT: bash scripts/smoke_market_research_p17.sh`

---

## Milestone M4 — Verification

- [ ] `bash scripts/smoke_market_research_p17.sh` — all m1–m5 pass
- [ ] Confirm no ops-web diff, no DDL file, no new portal route

---

## Out of scope (P18+)

Conjoint lite, Talkwalker bake-off, pgvector, ISO 20252, stale `valid_to` banner, staff analytics changes.
