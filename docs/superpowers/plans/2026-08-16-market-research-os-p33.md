# Market Research OS P33 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal report-detail và staff report version hiện `published_valid_to` («Hiệu lực lúc gửi») — audit P32 mà **không** đổi `is_stale` / PDF / DOCX footer (RES-UC-094).

**Architecture:** Util `formatPublishedValidTo` chuẩn hóa ISO → `YYYY-MM-DD` hoặc `null`. Component `PublishedValidToNote` chỉ render khi có ngày. Portal gắn note trên mỗi finding/rec (cạnh banner stale live). Staff đọc `content_snapshot` đã bake — list note dưới mỗi version. API P32 passthrough **không** đổi.

**Tech Stack:** portal-web + ops-web (vitest), bash deploy/smoke. Không DDL, không endpoint mới.

**Hướng đã khóa:** **1** — UI `published_valid_to`. IVFFlat / live Talkwalker = P34+.

---

## 1. Ba hướng P33

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Portal + staff hiện `published_valid_to`** | **RES-UC-094** | **S–M** | **Đã khóa** — field P32 sẵn, chưa UI |
| 2 | IVFFlat trên `embedding_vec` | — | L | VPS chưa pgvector; mix 64/256-d |
| 3 | Live Talkwalker HTTP | — | L | Scorecard P23 chưa chấm |

---

## 2. Global constraints

- **No new DDL** · **No new endpoints** · **No API bake/stale logic change**
- **Cấm** dùng `published_valid_to` cho `is_stale` / PDF / DOCX footer
- Thiếu / `null` / không phải ngày → **không** render note (báo cáo pre-P32 im lặng)
- Copy tách bạch banner stale: `Hiệu lực lúc gửi: YYYY-MM-DD`
- Deploy: flags RAG / OpenAI embed / pgvector / Talkwalker **không** đổi
- Branch: `feat/market-research-os-p33` from `main` (`d6a62f93`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: DDL + api (heap 2048) + ops-web + portal-web

---

## 3. Hành vi (RES-UC-094)

### 3.1 Util (portal + ops, cùng contract)

```ts
export const PUBLISHED_VALID_TO_LABEL = 'Hiệu lực lúc gửi';

export function formatPublishedValidTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function publishedValidToFromRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return null;
  return (row as { published_valid_to?: unknown }).published_valid_to;
}
```

### 3.2 Note UI

`data-testid="published-valid-to"`. Neutral muted (không amber stale). Return `null` khi util trả `null`.

### 3.3 Portal

`services/portal-web/src/app/research/[versionId]/page.tsx` — mỗi finding/rec: stale banner **live** (P24) + note bake **nếu có**.

### 3.4 Staff

`ReportPublishedValidToList` dưới meta version (trước Executive VI). Duyệt `findings` rồi `recs`; mỗi row có ngày → một note. Không có ngày nào → không render.

---

## 4. File map

| File | Role |
|------|------|
| `services/portal-web/src/lib/published-valid-to.util.ts` | **Create** — format + label |
| `services/portal-web/src/lib/published-valid-to.util.spec.ts` | **Create** — P33 unit |
| `services/portal-web/src/components/PublishedValidToNote.tsx` | **Create** — portal note |
| `services/portal-web/src/app/research/[versionId]/page.tsx` | **Modify** — wire findings/recs |
| `services/ops-web/src/lib/published-valid-to.util.ts` | **Create** — cùng contract |
| `services/ops-web/src/lib/published-valid-to.util.spec.ts` | **Create** — P33 unit |
| `services/ops-web/src/components/research/PublishedValidToNote.tsx` | **Create** — staff note |
| `services/ops-web/src/components/research/ReportPublishedValidToList.tsx` | **Create** — list từ snapshot |
| `services/ops-web/src/app/crm/research/[id]/page.tsx` | **Modify** — mount list |
| Catalog / OS / Actions | RES-UC-094; UAT P33; backlog P34+ |
| `scripts/deploy_market_research_p33_vps.sh` | **Create** — api + ops-web + portal-web |
| `scripts/smoke_market_research_p33*.sh` | **Create** — m1–m5 |

**Unchanged:** `bakePublishedValidTo`, `annotatePortalReportRow`, PDF/DOCX, `rankRagHits`, RAG flags.

---

## 5. Tasks

### Task 1: formatPublishedValidTo (TDD)

**Files:**
- Create: `services/portal-web/src/lib/published-valid-to.util.ts`
- Create: `services/portal-web/src/lib/published-valid-to.util.spec.ts`
- Create: `services/ops-web/src/lib/published-valid-to.util.ts`
- Create: `services/ops-web/src/lib/published-valid-to.util.spec.ts`

**Interfaces:**
- Produces: `PUBLISHED_VALID_TO_LABEL`, `formatPublishedValidTo`, `publishedValidToFromRow`

- [ ] **Step 1: Write failing portal spec**

```ts
import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_VALID_TO_LABEL,
  formatPublishedValidTo,
  publishedValidToFromRow,
} from './published-valid-to.util';

describe('formatPublishedValidTo', () => {
  it('P33 keeps YYYY-MM-DD and trims ISO datetime', () => {
    expect(formatPublishedValidTo('2026-12-31')).toBe('2026-12-31');
    expect(formatPublishedValidTo(' 2026-12-31T15:00:00Z ')).toBe('2026-12-31');
  });

  it('P33 returns null for missing or invalid values', () => {
    expect(formatPublishedValidTo(null)).toBe(null);
    expect(formatPublishedValidTo('')).toBe(null);
    expect(formatPublishedValidTo('soon')).toBe(null);
    expect(formatPublishedValidTo(20261231)).toBe(null);
  });

  it('P33 reads published_valid_to from a report row', () => {
    expect(publishedValidToFromRow({ published_valid_to: '2026-12-31' })).toBe('2026-12-31');
    expect(publishedValidToFromRow({ valid_to: '2020-01-01' })).toBeUndefined();
    expect(publishedValidToFromRow('x')).toBe(null);
  });

  it('P33 label is audit copy not stale banner', () => {
    expect(PUBLISHED_VALID_TO_LABEL).toBe('Hiệu lực lúc gửi');
    expect(PUBLISHED_VALID_TO_LABEL).not.toMatch(/lỗi thời|hết hạn/i);
  });
});
```

- [ ] **Step 2: Run portal spec — expect FAIL (module missing)**

```bash
cd services/portal-web && npx --yes vitest@2 run src/lib/published-valid-to.util.spec.ts
```

- [ ] **Step 3: Implement portal util (minimal)**
- [ ] **Step 4: Re-run portal spec — PASS**
- [ ] **Step 5: Copy same spec + util to ops-web; run**

```bash
cd services/ops-web && npm run test:unit -- src/lib/published-valid-to.util.spec.ts
```

Expected: PASS

### Task 2: Wire portal + staff UI

**Files:**
- Create: `services/portal-web/src/components/PublishedValidToNote.tsx`
- Modify: `services/portal-web/src/app/research/[versionId]/page.tsx`
- Create: `services/ops-web/src/components/research/PublishedValidToNote.tsx`
- Create: `services/ops-web/src/components/research/ReportPublishedValidToList.tsx`
- Modify: `services/ops-web/src/app/crm/research/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 1 util
- Produces: `PublishedValidToNote`, `ReportPublishedValidToList`

- [ ] **Step 1: Portal note**

```tsx
'use client';

import { PUBLISHED_VALID_TO_LABEL, formatPublishedValidTo } from '@/lib/published-valid-to.util';

export function PublishedValidToNote({ publishedValidTo }: { publishedValidTo?: unknown }) {
  const day = formatPublishedValidTo(publishedValidTo);
  if (!day) return null;
  return (
    <p
      className="muted"
      data-testid="published-valid-to"
      style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}
    >
      {PUBLISHED_VALID_TO_LABEL}: {day}
    </p>
  );
}
```

- [ ] **Step 2: Portal page** — after stale banner (or instead of nothing), render:

```tsx
<PublishedValidToNote publishedValidTo={publishedValidToFromRow(row)} />
```

Do **not** pass `published_valid_to` into `reportRowIsStale` / `PortalInsightStaleBanner`.

- [ ] **Step 3: Staff list**

```tsx
export function ReportPublishedValidToList({
  findings,
  recs,
}: {
  findings?: unknown;
  recs?: unknown;
}) {
  const rows = [...(Array.isArray(findings) ? findings : []), ...(Array.isArray(recs) ? recs : [])];
  const notes = rows
    .map((row, i) => ({ key: i, value: publishedValidToFromRow(row) }))
    .filter((row) => formatPublishedValidTo(row.value));
  if (notes.length === 0) return null;
  return (
    <div data-testid="staff-published-valid-to-list">
      {notes.map((row) => (
        <PublishedValidToNote key={row.key} publishedValidTo={row.value} />
      ))}
    </div>
  );
}
```

Mount in version `<li>` after the meta `<span>` block, before Executive (VI).

- [ ] **Step 4: Smoke grep locally**

```bash
grep -q 'published-valid-to' services/portal-web/src/app/research/\[versionId\]/page.tsx
grep -q 'ReportPublishedValidToList' services/ops-web/src/app/crm/research/\[id\]/page.tsx
```

### Task 3: Docs + deploy + smoke

**Files:**
- Modify: catalog RES-UC-094; OS §P33; Actions UAT P33; backlog P34+
- Create: `scripts/deploy_market_research_p33_vps.sh` (1/4 DDL → 2/4 api heap 2048 → 3/4 ops-web → 4/4 portal-web)
- Create: smoke m1–m5

| Smoke | Check |
|-------|--------|
| m1 | portal vitest `published-valid-to.util.spec.ts` |
| m2 | ops-web vitest same |
| m3 | grep `published-valid-to` portal page + `ReportPublishedValidToList` staff |
| m4 | docs RES-UC-094 + deploy script |
| m5 | api `market-research\|portal-research` + both FE utils |

UAT P33:

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Mở report đã publish P32+ | Finding có `Hiệu lực lúc gửi: YYYY-MM-DD` |
| 2 | AN | Đổi `valid_to` quá khứ | Banner stale **live**; note bake **cũ** |
| 3 | Lead | Staff report version | List note cùng ngày bake |
| 4 | AN | Export PDF/DOCX | Footer live; không in bake |
| 5 | CL | Report publish trước P32 (không field) | Không note |
| 6 | QA | Prod deploy P33 | RAG/pgvector/Talkwalker flags không đổi |

---

## 6. Out of scope (P34+)

- IVFFlat/HNSW
- Drop JSONB `embedding`
- Prod enable RAG / pgvector / OpenAI
- Live Talkwalker, conjoint simulator
- Dùng bake cho `is_stale` / footer

---

## 7. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| FE nhầm bake = stale | Copy «Hiệu lực lúc gửi»; testid riêng; stale vẫn P24 |
| Pre-P32 snapshot không field | Util → null → không render |
| GTM WIP lẫn commit | Stage chỉ file P33 |
