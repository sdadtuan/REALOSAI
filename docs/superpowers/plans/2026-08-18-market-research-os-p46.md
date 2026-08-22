# Market Research OS P46 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal `/research` có checkbox «Chỉ báo cáo hết hạn (N)» — lọc client-side danh sách card có `has_stale_insights`, parity staff P45 (RES-UC-108).

**Architecture:** Pure client-side filter trên `items` đã load từ `portalResearchReports` (P41 API `has_stale_insights`). Util `filterPortalReportCardsByStale` wrap `shouldShowReportListStaleBadge`. Checkbox + empty state trên list báo cáo; **không** endpoint mới · **không** DDL · deploy **portal-web only**.

**Tech Stack:** portal-web vitest; bash deploy/smoke. Không ptt-crm-api · không ops-web.

**Hướng đề xuất:** **1** — portal report list stale filter. API `stale_only` query = hướng 2.

---

## 1. Ba hướng P46

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Portal `/research` list filter «Chỉ báo cáo hết hạn»** | **RES-UC-108** | **S** | **Đề xuất** — deferred P45 hướng 2; portal-web only |
| 2 | Portal reports API query `stale_only=1` | RES-UC-108 alt | S–M | Server-side filter; pattern P25 RAG; deploy api + portal-web |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** · **No API change**
- Stale predicate = **`has_stale_insights === true`** từ card P41 (live tại GET list)
- Stale rule giống P41/P24/P19: UTC calendar; `valid_to === today` → không stale
- **Cấm** ẩn report khỏi API/export · filter chỉ **UI list** `/research`
- **Cấm** claim «báo cáo hết hạn» nếu chỉ subset insight stale — copy list-level giữ tone P41
- Theme analytics · Conjoint · RAG search **không bị filter** — chỉ `<ul>` báo cáo
- P41 badge · P24 detail banner **giữ nguyên** trên card còn hiển thị
- Không ops-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p46` from `main` @ P45 (`d491f592`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **portal-web only**

---

## 3. Hành vi — RES-UC-108 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P46 |
|-------|----------|-------------|
| P41 | Portal list `has_stale_insights` + badge | Predicate + badge parity |
| P24 | Detail stale banner | Unchanged |
| P45 | Staff stale-only filter pattern | UX/copy parity reference |

### 3.2 Portal UI — `/research`, phía trên danh sách báo cáo

**Vị trí:** Ngay trên `<ul className="portal-content-list">` — sau `PortalResearchRagSearch`, trước «Chưa có báo cáo».

| testid | Element |
|--------|---------|
| `portal-report-stale-only-filter` | Checkbox «Chỉ báo cáo hết hạn (N)» |
| `portal-report-stale-only-empty` | Empty state khi filter bật, 0 card stale |

**Hiển thị checkbox:**

- Chỉ render khi `staleCount > 0` **hoặc** `staleOnly === true` (pattern P45 / `PortalResearchRagSearch`)
- Label: `Chỉ báo cáo hết hạn (${staleOnly ? visibleCount : staleCount})`

**State:**

```ts
const [staleOnly, setStaleOnly] = useState(false);
```

**Thuật toán:**

```ts
const staleCount = countPortalReportCardsWithStaleInsights(items);
const visibleItems = filterPortalReportCardsByStale(items, staleOnly);
```

Predicate per card:

```ts
shouldShowReportListStaleBadge(card); // has_stale_insights === true
```

| Filter | Card `has_stale_insights` | Hiển thị |
|--------|---------------------------|----------|
| Off | bất kỳ | Tất cả card |
| On | `true` | Có |
| On | `false` / missing | Ẩn |
| On | 0 stale total | Checkbox ẩn (trừ khi đang bật → empty state) |

**Empty states:**

| Điều kiện | Copy |
|-----------|------|
| `items.length === 0` | «Chưa có báo cáo được công bố.» (giữ nguyên) |
| `staleOnly && visibleItems.length === 0 && items.length > 0` | «Không có báo cáo hết hạn.» |

**Toggle:** Chỉ đổi state local — **không** refetch API.

### 3.3 Unchanged

- Staff P42–P45
- `GET /portal/research/reports` response shape
- Detail `/research/[versionId]` P24
- PDF export P29
- RAG search P25 `stale_only` (server re-search — khác scope)

---

## 4. Hành vi sketch — hướng 2 (P47+, không code P46 mặc định)

| | |
|--|--|
| Scope | `GET /portal/research/reports?stale_only=1` — server filter rows |
| Cách | Reuse `has_stale_insights` compute trong service; portal checkbox gọi lại API |
| Deploy | api + portal-web |
| Khi chọn | List lớn / muốn JSON contract filter |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `portal-web/src/lib/portal-report-list.util.ts` | `countPortalReportCardsWithStaleInsights`, `filterPortalReportCardsByStale`, copy constants |
| `portal-web/src/lib/portal-report-list.util.spec.ts` | P46 filter + count tests |
| `portal-web/src/app/research/page.tsx` | Checkbox + filtered map |
| Catalog / OS / Actions | RES-UC-108; UAT P46; P47+ |
| `scripts/deploy_market_research_p46_vps.sh` | portal-web only |
| `scripts/smoke_market_research_p46*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — Filter util (TDD)

- [ ] Extend `portal-report-list.util.ts`:

```ts
import type { PortalResearchReportCard } from '@/lib/api';

export const PORTAL_REPORT_STALE_ONLY_LABEL = 'Chỉ báo cáo hết hạn';

export const PORTAL_REPORT_STALE_ONLY_EMPTY = 'Không có báo cáo hết hạn.';

export function countPortalReportCardsWithStaleInsights(
  cards: PortalResearchReportCard[],
): number {
  return cards.filter((card) => shouldShowReportListStaleBadge(card)).length;
}

export function filterPortalReportCardsByStale(
  cards: PortalResearchReportCard[],
  staleOnly: boolean,
): PortalResearchReportCard[] {
  if (!staleOnly) return cards;
  return cards.filter((card) => shouldShowReportListStaleBadge(card));
}
```

- [ ] Spec `portal-report-list.util.spec.ts`:

```ts
import type { PortalResearchReportCard } from '@/lib/api';
import {
  PORTAL_REPORT_STALE_ONLY_EMPTY,
  PORTAL_REPORT_STALE_ONLY_LABEL,
  countPortalReportCardsWithStaleInsights,
  filterPortalReportCardsByStale,
} from './portal-report-list.util';

const staleCard = { version_id: 1, version: 1, has_stale_insights: true } as PortalResearchReportCard;
const freshCard = { version_id: 2, version: 2, has_stale_insights: false } as PortalResearchReportCard;

describe('portal-report-list.util P46', () => {
  it('count stale cards', () => {
    expect(countPortalReportCardsWithStaleInsights([staleCard, freshCard])).toBe(1);
  });

  it('filter staleOnly keeps only stale cards', () => {
    expect(filterPortalReportCardsByStale([staleCard, freshCard], true)).toEqual([staleCard]);
  });

  it('filter off returns all cards', () => {
    expect(filterPortalReportCardsByStale([staleCard, freshCard], false)).toHaveLength(2);
  });

  it('copy does not claim report expired', () => {
    expect(PORTAL_REPORT_STALE_ONLY_LABEL).toMatch(/báo cáo hết hạn/i);
    expect(PORTAL_REPORT_STALE_ONLY_EMPTY).not.toMatch(/ISO|cert/i);
  });
});
```

**Verify:** `cd services/portal-web && npx vitest run src/lib/portal-report-list.util.spec.ts`

### Task 2 — Research list checkbox + filtered cards

- [ ] Import helpers + add state in `ResearchListContent`:

```ts
import {
  PORTAL_REPORT_STALE_ONLY_EMPTY,
  PORTAL_REPORT_STALE_ONLY_LABEL,
  countPortalReportCardsWithStaleInsights,
  filterPortalReportCardsByStale,
} from '@/lib/portal-report-list.util';

const [staleOnly, setStaleOnly] = useState(false);
const staleCount = countPortalReportCardsWithStaleInsights(items);
const visibleItems = filterPortalReportCardsByStale(items, staleOnly);
```

- [ ] Replace `items.map` → `visibleItems.map` trong report list block
- [ ] Insert checkbox trước `<ul>`:

```tsx
{(staleCount > 0 || staleOnly) && items.length > 0 ? (
  <label
    data-testid="portal-report-stale-only-filter"
    style={{
      display: 'inline-flex',
      gap: 6,
      alignItems: 'center',
      marginBottom: '0.65rem',
      fontSize: '0.85rem',
    }}
  >
    <input
      type="checkbox"
      checked={staleOnly}
      disabled={loading}
      onChange={(e) => setStaleOnly(e.target.checked)}
    />
    {PORTAL_REPORT_STALE_ONLY_LABEL} ({staleOnly ? visibleItems.length : staleCount})
  </label>
) : null}
{staleOnly && visibleItems.length === 0 && items.length > 0 ? (
  <p className="muted" data-testid="portal-report-stale-only-empty">
    {PORTAL_REPORT_STALE_ONLY_EMPTY}
  </p>
) : null}
{visibleItems.length > 0 ? (
  <ul className="portal-content-list">
    {visibleItems.map((item) => (
      // existing row JSX unchanged
    ))}
  </ul>
) : null}
```

**Verify:** grep `portal-report-stale-only-filter` · `filterPortalReportCardsByStale`

### Task 3 — Docs + deploy + smoke

- [ ] Catalog `RNOSAI-BA-RES-UseCases.md` — row + §RES-UC-108:

| RES-UC-108 | Portal report list stale filter | P46 | P46 | Spec ready | RES-UC-103 · RES-UC-107 |

§ detail:

- **Actor:** Client portal user trên `/research`
- **UI:** checkbox client-side; predicate `has_stale_insights` từ P41
- **Cấm** API/DDL; không ops-web

- [ ] OS `12-MARKET-RESEARCH-OS.md` — §P46
- [ ] Actions `12-RES-ACTIONS.md` — Walkthrough UAT P46 (~6 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 report portal-visible — 1 stale, 1 fresh | Portal `/research` |
| 2 | CL | Quan sát checkbox | «Chỉ báo cáo hết hạn (1)» |
| 3 | CL | Bật filter | Chỉ card stale; badge P41 vẫn đúng |
| 4 | CL | Mở detail stale card | Banner P24 OK |
| 5 | CL | Tắt filter | Cả 2 card hiện lại |
| 6 | QA | Prod deploy P46 | portal-web only; flags off |

- [ ] `scripts/deploy_market_research_p46_vps.sh` — portal-web only (clone P45 pattern, `wave_p1_rebuild_portal_web.sh`)
- [ ] Smoke m1–m5:

| Script | Verify |
|--------|--------|
| m1 | vitest `portal-report-list.util.spec.ts` P46 |
| m2 | grep `portal-report-stale-only-filter` in page |
| m3 | grep RES-UC-108 + deploy script |
| m4 | portal-web build |
| m5 | vitest portal stale list helpers aggregate |

**Verify:** `bash scripts/smoke_market_research_p46.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p46_vps.sh
```

**Services:** portal-web only. Không api · không ops-web · không worker.

Deploy script skeleton:

```bash
export_public_flag_from_runtime
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
bash "$ROOT/scripts/wave_p1_rebuild_portal_web.sh"
sudo -n /usr/bin/systemctl restart ptt-portal-web
```

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | vitest P46 filter util |
| m2 | grep checkbox wired in research/page.tsx |
| m3 | grep RES-UC-108 + deploy script exists |
| m4 | portal-web build gate |
| m5 | aggregator m1–m4 |

---

## 9. UAT gates (hướng 1)

- [ ] portal-web vitest P46 pass
- [ ] Smoke P46 m1–m5
- [ ] Staging UAT Actions §P46
- [ ] Prod: flags unchanged
- [ ] P41 badge · P24 detail không regress
- [ ] Theme analytics · RAG search không regress

---

## 10. Out of scope (P47+)

- Portal reports API `stale_only` query (hướng 2)
- Staff filter changes (P45 done)
- Bake `has_stale` vào snapshot at publish
- Ẩn stale card khỏi API/export
- pgvector/RAG prod enable (hướng 3)
- MOE / conjoint mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Filter lệch badge P41 | Cùng `shouldShowReportListStaleBadge`; UAT #3–4 |
| User tưởng báo cáo bị gỡ khỏi portal | Empty state copy rõ; API vẫn trả full list |
| Checkbox hiện khi 0 stale | Chỉ render khi `staleCount > 0 \|\| staleOnly` |
| Staging api cũ thiếu `has_stale_insights` | Cards không có flag → count 0 → checkbox ẩn |
| GTM WIP lẫn commit | Stage chỉ file P46 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Đóng gap portal parity staff P45 | Task 1–2 |
| Reuse P41 API field | §3.2 |
| portal-web only deploy | Task 3 |
| Prod flags off | §2 |
| Không ẩn card khỏi backend | §2 · §10 |

**Next step:** PO khóa **hướng 1** → `code P46 theo hướng 1` → branch `feat/market-research-os-p46`.
