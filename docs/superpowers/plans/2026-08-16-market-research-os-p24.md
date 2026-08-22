# Market Research OS P24 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal report detail (`/research/[versionId]`) shows the same client stale banner as P19 RAG when a finding/rec’s linked published insight has `valid_to` before today (UTC), closing the last portal stale channel after P18/P19/P22.

**Architecture:** `GET /api/v1/portal/research/reports/:versionId` already returns snapshot `findings` / `recs` with `insight_id`. P24 looks up **live** `valid_to` for those IDs (`published` + JWT `client_id` only) and annotates each row with `valid_to` / `is_stale` via existing `isInsightStale`. portal-web reuses `PortalInsightStaleBanner` + P19 copy under stale rows. Snapshot on disk and PDF export stay unchanged. No new endpoint, no DDL.

**Tech Stack:** NestJS `portal-research`, existing `insight-stale.util.ts`, Next.js portal-web, Jest, Vitest, bash smoke/deploy.

**Hướng đã khóa:** 1 — portal report-detail stale (RES-UC-085). pgvector prod / portal RAG «Chỉ hết hạn» / hide stale from ranking / live Talkwalker / conjoint simulator = out.

## Global Constraints

- **No DDL** · **No** new endpoint · **No** ops-web changes · **No** PDF / snapshot rewrite
- Stale rule (P18/P19/P22): `is_stale = true` when `valid_to` set and `valid_to < today` (UTC); `valid_to === today` → false; null → false
- Lookup corpus = **`published` + JWT `client_id` only** — not `approved_client_facing`, not other tenants
- **Do not** hide stale findings/recs — warn only
- Portal copy: reuse P19 `PORTAL_INSIGHT_STALE_BANNER` (not staff copy)
- Live `valid_to` at GET time (insight may expire after publish)
- Missing / unpublished / cross-tenant `insight_id` → `valid_to: null`, `is_stale: false` (no leak)
- Deploy rebuilds **api + portal-web** (not ops-web)
- Deploy **must not** set `RESEARCH_RAG_ENABLED` / OpenAI embed / pgvector / Talkwalker flags
- Không đụng GTM WIP
- Branch: `feat/market-research-os-p24` from `main` (`e4ee8923`+)
- Commit chỉ khi user yêu cầu

---

## File map

| File | Role |
|------|------|
| `services/ptt-crm-api/src/portal-research/portal-report-stale.util.ts` | Collect insight IDs; annotate finding/rec rows |
| `services/ptt-crm-api/src/portal-research/portal-report-stale.util.spec.ts` | P24 annotate + ID collect |
| `services/ptt-crm-api/src/portal-research/portal-research.repository.ts` | `listPublishedInsightValidTo` |
| `services/ptt-crm-api/src/portal-research/portal-research.repository.spec.ts` | SQL binds client + published + ids |
| `services/ptt-crm-api/src/portal-research/portal-research.service.ts` | `getReport` annotates findings/recs |
| `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts` | P24 stale / today / null / tenancy |
| `services/portal-web/src/lib/insight-stale.util.ts` | `reportRowIsStale` (same as `ragHitIsStale`) |
| `services/portal-web/src/lib/insight-stale.util.spec.ts` | P24 helper |
| `services/portal-web/src/app/research/[versionId]/page.tsx` | Banner under stale finding/rec |
| Catalog / OS / Actions | RES-UC-085; UAT P24; backlog P24+ |
| `scripts/smoke_market_research_p24*.sh` | M1–M5 |
| `scripts/deploy_market_research_p24_vps.sh` | Clone P19 path (api + **portal-web**) + P20–P23 DDL |

**Unchanged:** ops-web, RAG search, Talkwalker, conjoint, PDF export, `content_snapshot` persist, publish-portal.

---

## Shared types

Finding/rec response rows (JSON objects that already have `insight_id`) gain:

```ts
valid_to?: string | null;
is_stale?: boolean;
```

`PortalResearchReportDetail.findings` / `recs` stay `unknown[]` at the type alias if that is current; annotation is additive on object rows only. String-only legacy rows stay as-is (no banner).

```ts
export function collectReportInsightIds(input: {
  findings?: unknown;
  recs?: unknown;
  insight_ids?: unknown;
}): number[]

export function annotatePortalReportRow(
  row: unknown,
  validToById: Map<number, string | null>,
  ref?: Date,
): unknown
```

Repo:

```ts
async listPublishedInsightValidTo(
  clientId: string,
  insightIds: number[],
): Promise<Map<number, string | null>>
```

Empty `insightIds` → empty Map, **no** SQL.

---

## Milestone M1 — Util + repo lookup

**Files:**
- Create: `portal-report-stale.util.ts` + spec
- Modify: `portal-research.repository.ts` + spec

**Interfaces:**
- Consumes: `isInsightStale` from `../market-research/insight-stale.util`
- Produces: `collectReportInsightIds`, `annotatePortalReportRow`, `listPublishedInsightValidTo`

- [ ] **Step 1: Write failing util spec**

```ts
import { annotatePortalReportRow, collectReportInsightIds } from './portal-report-stale.util';

const ref = new Date('2026-08-16T12:00:00.000Z');

it('P24 collectReportInsightIds unions findings recs and insight_ids', () => {
  expect(
    collectReportInsightIds({
      findings: [{ insight_id: 1 }, { insight_id: 2 }],
      recs: [{ insight_id: 2 }, { insight_id: 3 }],
      insight_ids: [3, 4, 0],
    }).sort((a, b) => a - b),
  ).toEqual([1, 2, 3, 4]);
});

it('P24 annotate sets is_stale from live valid_to', () => {
  const map = new Map<number, string | null>([
    [11, '2020-01-01'],
    [12, '2026-08-16'],
    [13, null],
  ]);
  expect(annotatePortalReportRow({ insight_id: 11, statement: 'A' }, map, ref)).toMatchObject({
    insight_id: 11,
    is_stale: true,
    valid_to: '2020-01-01',
  });
  expect(annotatePortalReportRow({ insight_id: 12, statement: 'B' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: '2026-08-16',
  });
  expect(annotatePortalReportRow({ insight_id: 13, statement: 'C' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: null,
  });
  expect(annotatePortalReportRow({ insight_id: 99, statement: 'missing' }, map, ref)).toMatchObject({
    is_stale: false,
    valid_to: null,
  });
  expect(annotatePortalReportRow('plain', map, ref)).toBe('plain');
});
```

Run: `cd services/ptt-crm-api && npx jest src/portal-research/portal-report-stale.util.spec.ts --verbose --no-coverage`  
Expected: FAIL

- [ ] **Step 2: Implement util**

```ts
import { isInsightStale } from '../market-research/insight-stale.util';

function asPositiveId(raw: unknown): number | null {
  const n = Number((raw as { insight_id?: unknown })?.insight_id ?? raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function collectReportInsightIds(input: {
  findings?: unknown;
  recs?: unknown;
  insight_ids?: unknown;
}): number[] {
  const out = new Set<number>();
  for (const row of [input.findings, input.recs]) {
    if (!Array.isArray(row)) continue;
    for (const item of row) {
      const id = item && typeof item === 'object' ? asPositiveId(item) : null;
      if (id) out.add(id);
    }
  }
  if (Array.isArray(input.insight_ids)) {
    for (const raw of input.insight_ids) {
      const id = asPositiveId(raw);
      if (id) out.add(id);
    }
  }
  return [...out];
}

export function annotatePortalReportRow(
  row: unknown,
  validToById: Map<number, string | null>,
  ref: Date = new Date(),
): unknown {
  if (!row || typeof row !== 'object') return row;
  const id = asPositiveId(row);
  if (!id) return row;
  const validTo = validToById.has(id) ? validToById.get(id) ?? null : null;
  return {
    ...(row as Record<string, unknown>),
    valid_to: validTo,
    is_stale: isInsightStale(validTo, ref),
  };
}
```

- [ ] **Step 3: Repo spec + SQL**

```ts
it('P24 listPublishedInsightValidTo filters published and client_id', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  await repo.listPublishedInsightValidTo('acme', [11, 12]);
  const sql = String(queryMock.mock.calls[0][0]);
  const binds = queryMock.mock.calls[0][1];
  expect(sql).toMatch(/i\.status = 'published'/);
  expect(sql).toMatch(/p\.client_id = \$1/);
  expect(sql).toMatch(/i\.id = ANY/);
  expect(binds[0]).toBe('acme');
});

it('P24 listPublishedInsightValidTo skips SQL when ids empty', async () => {
  const out = await repo.listPublishedInsightValidTo('acme', []);
  expect(out.size).toBe(0);
  expect(queryMock).not.toHaveBeenCalled();
});
```

Implement:

```ts
async listPublishedInsightValidTo(
  clientId: string,
  insightIds: number[],
): Promise<Map<number, string | null>> {
  const ids = [...new Set(insightIds.filter((n) => Number.isFinite(n) && n > 0))];
  const map = new Map<number, string | null>();
  if (!ids.length) return map;
  const result = await this.db.query(
    `SELECT i.id, i.valid_to::text AS valid_to
     FROM crm_research_insights i
     JOIN crm_research_projects p ON p.id = i.project_id
     WHERE p.client_id = $1
       AND i.status = 'published'
       AND i.id = ANY($2::int[])`,
    [clientId, ids],
  );
  for (const row of result.rows) {
    map.set(Number(row.id), row.valid_to != null ? String(row.valid_to) : null);
  }
  return map;
}
```

Run: `npx jest src/portal-research/portal-report-stale.util.spec.ts src/portal-research/portal-research.repository.spec.ts --testNamePattern='P24' --verbose --no-coverage`  
Expected: PASS

---

## Milestone M2 — `getReport` annotation

**Files:**
- Modify: `portal-research.service.ts` + spec

**Interfaces:**
- Consumes: `listPublishedInsightValidTo`, `collectReportInsightIds`, `annotatePortalReportRow`
- Produces: `getReport` findings/recs with `valid_to` / `is_stale`

- [ ] **Step 1: Failing service specs**

After existing `getReport happy path`, add (use `ref` via mocking `Date` only if needed — prefer injecting by asserting against known past `valid_to` like `2020-01-01`):

```ts
it('P24 getReport annotates stale finding from published valid_to', async () => {
  repo.getPortalReportVersion.mockResolvedValue(
    acmeVersion({
      content_snapshot: {
        exec: { vi: 'Tóm tắt', en: null, en_status: 'approved' },
        findings: [{ insight_id: 11, statement: 'Old claim' }],
        recs: [{ insight_id: 11, recommendation: 'Act' }],
        methodology: { stub: true },
        evidence_index: [],
        insight_ids: [11],
      },
    }),
  );
  repo.listPublishedInsightValidTo.mockResolvedValue(new Map([[11, '2020-01-01']]));
  const body = await makeService().getReport(acmeUser, 42);
  expect(body.findings[0]).toMatchObject({ insight_id: 11, is_stale: true, valid_to: '2020-01-01' });
  expect(body.recs[0]).toMatchObject({ insight_id: 11, is_stale: true });
});

it('P24 getReport valid_to today or null is not stale', async () => {
  const today = new Date().toISOString().slice(0, 10);
  repo.getPortalReportVersion.mockResolvedValue(
    acmeVersion({
      content_snapshot: {
        exec: { vi: 'x', en: null, en_status: 'approved' },
        findings: [
          { insight_id: 1, statement: 'today' },
          { insight_id: 2, statement: 'null' },
        ],
        recs: [],
        methodology: {},
        evidence_index: [],
      },
    }),
  );
  repo.listPublishedInsightValidTo.mockResolvedValue(
    new Map([
      [1, today],
      [2, null],
    ]),
  );
  const body = await makeService().getReport(acmeUser, 42);
  expect(body.findings[0]).toMatchObject({ is_stale: false, valid_to: today });
  expect(body.findings[1]).toMatchObject({ is_stale: false, valid_to: null });
});

it('P24 getReport does not leak other-tenant valid_to', async () => {
  repo.getPortalReportVersion.mockResolvedValue(
    acmeVersion({
      content_snapshot: {
        exec: { vi: 'x', en: null, en_status: 'approved' },
        findings: [{ insight_id: 99, statement: 'foreign' }],
        recs: [],
        methodology: {},
        evidence_index: [],
      },
    }),
  );
  repo.listPublishedInsightValidTo.mockResolvedValue(new Map()); // repo already filtered
  const body = await makeService().getReport(acmeUser, 42);
  expect(body.findings[0]).toMatchObject({ insight_id: 99, is_stale: false, valid_to: null });
  expect(JSON.stringify(body)).not.toMatch(/2020-01-01/);
});
```

Wire `listPublishedInsightValidTo: jest.fn().mockResolvedValue(new Map())` on the repo mock in `beforeEach` so existing getReport tests still pass.

Run: `npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P24' --verbose --no-coverage`  
Expected: FAIL

- [ ] **Step 2: Annotate in `getReport` only** (not `listReports`, not `exportReportPdf`)

```ts
const snapshot = row.content_snapshot;
const ids = collectReportInsightIds(snapshot);
const validToById = await this.repo.listPublishedInsightValidTo(user.client_id, ids);
const findings = (Array.isArray(snapshot.findings) ? snapshot.findings : []).map((item) =>
  annotatePortalReportRow(item, validToById),
);
const recs = (Array.isArray(snapshot.recs) ? snapshot.recs : []).map((item) =>
  annotatePortalReportRow(item, validToById),
);
return {
  ...toCard(row, watermarkFor(user, now)),
  exec: portalExec(snapshot),
  findings,
  recs,
  methodology: snapshot.methodology ?? null,
  evidence_index: Array.isArray(snapshot.evidence_index) ? snapshot.evidence_index : [],
};
```

Do **not** write back to `content_snapshot`. Do **not** change PDF.

Run: `npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P24|getReport happy' --verbose --no-coverage`  
Expected: PASS

---

## Milestone M3 — portal-web report detail banner

**Files:**
- Modify: `services/portal-web/src/lib/insight-stale.util.ts` + spec (create spec if missing)
- Modify: `services/portal-web/src/app/research/[versionId]/page.tsx`

**Interfaces:**
- Consumes: `PortalInsightStaleBanner`, `PORTAL_INSIGHT_STALE_BANNER`
- Produces: banner under stale finding/rec `<li>`

- [ ] **Step 1: Helper + spec**

```ts
export function reportRowIsStale(row: {
  is_stale?: boolean;
  valid_to?: string | null;
}): boolean {
  if (typeof row.is_stale === 'boolean') return row.is_stale;
  return isInsightStale(row.valid_to);
}
```

Spec: API `is_stale: true` wins; `valid_to` past without flag → true; today/null → false.

Run: `cd services/portal-web && npm run test:unit -- src/lib/insight-stale.util.spec.ts`  
Expected: FAIL then PASS after implement.

- [ ] **Step 2: Render banners**

In `[versionId]/page.tsx`, import `PortalInsightStaleBanner` and `reportRowIsStale`.

Replace finding/rec `<li>` so object rows can show a banner. Keep `asText(row)` for the line:

```tsx
{findings.map((row, i) => (
  <li key={i}>
    {asText(row) || '—'}
    {row && typeof row === 'object' && reportRowIsStale(row as { is_stale?: boolean; valid_to?: string | null }) ? (
      <PortalInsightStaleBanner
        validTo={(row as { valid_to?: string | null }).valid_to}
      />
    ) : null}
  </li>
))}
```

Same for `recs`. Do **not** filter rows out. Do **not** change PDF download. Do **not** change ops-web.

---

## Milestone M4 — Docs + smoke + deploy

**Files:** catalog / OS / Actions + smoke + deploy

- [ ] **Step 1: Catalog + RES-UC-085**

Matrix after 084:

| RES-UC-085 | Portal report-detail stale banner | P24 | P24 | Spec ready | FR-INS-07 · UC-080 |

### RES-UC-085 — Portal report-detail stale banner

- **Actor chính:** Client portal (JWT `client_id`)
- **API:** `GET /api/v1/portal/research/reports/:versionId` — mỗi finding/rec object thêm `valid_to`, `is_stale` từ insight **published** cùng khách (live, không đóng băng snapshot)
- **Rule:** giống RES-UC-079 (UTC calendar)
- **Màn hình:** `/research/[versionId]` — banner dưới finding/rec stale
- Banner: reuse P19 `PORTAL_INSIGHT_STALE_BANNER`
- Insight thiếu / unpublished / khác tenant → `is_stale: false`
- **Cấm** endpoint mới; không DDL; không ops-web; không ẩn dòng; không đổi PDF / `content_snapshot`

- [ ] **Step 2: OS doc P24**

After P23 section:

```markdown
## P24 — RES-UC-085

| UC | Tóm tắt |
|----|---------|
| 085 | Báo cáo portal: finding/rec gắn insight hết hạn hiện banner P19. |

**API:** cùng GET portal report detail — findings/recs `valid_to`/`is_stale`  
**Gates:** api + portal-web; không DDL; không ops-web; không RAG/Talkwalker flags.
```

- [ ] **Step 3: UAT P24**

Replace `## P23+ (backlog — pgvector prod / portal report-detail stale)` with P24 UAT + `## P24+ (backlog — pgvector prod / portal RAG «Chỉ hết hạn»)`.

**Walkthrough UAT P24 — Portal report-detail stale (≈8 phút)**

**Mục tiêu:** *«Khách mở báo cáo portal → finding gắn insight hết hạn có banner vàng; finding còn hiệu lực không banner.»*

**Tiền đề:** ≥1 report portal-visible; ≥1 finding `insight_id` published stale + ≥1 còn hiệu lực / null

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở `/research/{versionId}` | Finding stale có banner P19 |
| 2 | CL | Finding valid_to = hôm nay | Không banner |
| 3 | CL | Finding valid_to null | Không banner |
| 4 | CL | Finding còn hiệu lực | Không banner |
| 5 | QA | GET report JSON | `is_stale` đúng trên finding/rec |
| 6 | QA | Prod sau deploy P24 | Banner portal; RAG/Talkwalker flags không đổi |

- [ ] **Step 4: Smoke**

`scripts/smoke_market_research_p24.sh` loops m1–m5.

| Script | Gate |
|--------|------|
| `p24_m1.sh` | jest `portal-report-stale.util.spec.ts` + repo `--testNamePattern='P24'` |
| `p24_m2.sh` | jest `portal-research.service.spec.ts --testNamePattern='P24'` |
| `p24_m3.sh` | grep `listPublishedInsightValidTo` in repo; grep `annotatePortalReportRow` in service; grep `PortalInsightStaleBanner` in `[versionId]/page.tsx` (quote the path); grep `exportReportPdf` **does not** call annotate (or grep annotate only in `getReport`) |
| `p24_m4.sh` | grep `RES-UC-085`, `P24`, `Walkthrough UAT P24`; `test -f` deploy |
| `p24_m5.sh` | api `npm test -- --testPathPattern='portal-research' --passWithNoTests --no-coverage` + portal-web `insight-stale.util.spec.ts` |

Quote `[versionId]` in bash.

- [ ] **Step 5: Deploy**

Clone `scripts/deploy_market_research_p19_vps.sh` → `deploy_market_research_p24_vps.sh`, but DDL path like P23 (P0–P7 + P10 + P11 + P13 + P20 fail-soft + P21 + P23). **No P24 DDL.**

- 1/3 DDL → 2/3 api → 3/3 **portal-web** (`wave_p1_rebuild_portal_web.sh`)
- Do **not** rebuild ops-web
- Do **not** set RAG / OpenAI embed / pgvector / Talkwalker flags
- Echo `UAT: bash scripts/smoke_market_research_p24.sh`

`chmod +x` all new scripts.

---

## Milestone M5 — Verification

- [ ] `bash scripts/smoke_market_research_p24.sh` — m1–m5 pass
- [ ] Confirm no ops-web P24 diffs (except none)
- [ ] Confirm `exportReportPdf` unchanged
- [ ] Confirm no GTM files in the P24 change set
- [ ] Confirm Talkwalker / conjoint / RAG search files unchanged

---

## Out of scope (P25+)

pgvector prod enable / IVFFlat / install pgvector on VPS, portal RAG filter «Chỉ hết hạn», hide stale from ranking, PDF stale footer, snapshot bake `valid_to` at publish, live Talkwalker HTTP, Brandwatch, conjoint simulator / MOE.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| FR-INS-07 portal report channel | M2 + M3 |
| Live valid_to, not snapshot freeze | M2 listPublishedInsightValidTo |
| published + JWT client only | M1 SQL |
| No hide rows | M3 |
| P19 banner copy | M3 PortalInsightStaleBanner |
| No PDF / no DDL / no new endpoint | M2 + M4 deploy |
| Deploy api + portal-web | M4 |

No placeholders. Names: `listPublishedInsightValidTo`, `annotatePortalReportRow`, `reportRowIsStale`, `RES-UC-085`.
