# Market Research OS P45 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff tab Báo cáo có checkbox «Chỉ version hết hạn (N)» — lọc client-side danh sách version có insight stale, giúp Lead/Analyst tập trung version cần xử lý (RES-UC-107).

**Architecture:** Pure client-side filter trên `versions` đã load (P44 API `has_stale_insights` + P42 fallback). Util `filterStaffReportVersionsByStale` wrap `staffReportVersionHasStaleInsights`. Checkbox + empty state trong `ReportTab`; **không** endpoint mới · **không** DDL · deploy **ops-web only**.

**Tech Stack:** ops-web vitest; bash deploy/smoke. Không ptt-crm-api · không portal-web.

**Hướng đề xuất:** **1** — staff version stale filter checkbox. Portal list filter = hướng 2.

---

## 1. Ba hướng P45

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff tab Báo cáo filter «Chỉ version hết hạn»** | **RES-UC-107** | **S** | **Đề xuất** — deferred P44 hướng 2; ops-web only |
| 2 | Portal `/research` list filter stale (client-side trên cards) | RES-UC-107 alt | S | Parity staff; portal-web only; không API |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc đnh plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** · **No API change**
- Stale predicate = **`staffReportVersionHasStaleInsights`** (API-first P44, fallback P42)
- Stale rule giống P41–P44: UTC calendar; `valid_to === today` → không stale
- **Cấm** ẩn version khỏi API/export · filter chỉ **UI list** tab Báo cáo
- **Cấm** claim «báo cáo hết hạn» — copy list-level giữ tone P41/P43
- Form tạo version (insight tick + methodology + nút Tạo) **luôn hiện** — filter không áp dụng lên form
- P42 detail banners · P43 meta badge **giữ nguyên** trên version còn hiển thị
- Không portal-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p45` from `main` @ P44 (`52f7e594`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **ops-web only**

---

## 3. Hành vi — RES-UC-107 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P45 |
|-------|----------|-------------|
| P42 | `ReportStaleInsightList` | Detail banners (unchanged) |
| P43 | `StaffReportVersionStaleBadge` | Meta badge (unchanged) |
| P44 | `staffReportVersionHasStaleInsights` + API `has_stale_insights` | Predicate filter chính xác sau refetch |

### 3.2 Staff UI — tab Báo cáo, phía trên danh sách version

**Vị trí:** Ngay trên `<ul>` version list — sau block chọn insight, trước «Chưa có phiên bản».

| testid | Element |
|--------|---------|
| `staff-report-stale-only-filter` | Checkbox «Chỉ version hết hạn (N)» |
| `staff-report-stale-only-empty` | Empty state khi filter bật, 0 version stale |

**Hiển thị checkbox:**

- Chỉ render khi `staleCount > 0` **hoặc** `staleOnly === true` (pattern portal RAG `PortalResearchRagSearch`)
- Label: `Chỉ version hết hạn (${staleOnly ? visibleCount : staleCount})`

**State:**

```ts
const [staleOnly, setStaleOnly] = useState(false);
```

**Thuật toán:**

```ts
const allVersions = reports.flatMap((report) =>
  report.versions.map((version) => ({ report, version })),
);
const insights = project.insights ?? [];
const staleCount = countStaffReportVersionsWithStaleInsights(allVersions, insights);
const visibleVersions = filterStaffReportVersionsByStale(allVersions, insights, staleOnly);
```

Predicate per row:

```ts
staffReportVersionHasStaleInsights(row.version, insights);
```

| Filter | Version snapshot | Hiển thị |
|--------|------------------|----------|
| Off | bất kỳ | Tất cả version |
| On | stale | Có |
| On | fresh only | Ẩn |
| On | 0 stale total | Checkbox ẩn (trừ khi đang bật → empty state) |

**Empty states:**

| Điều kiện | Copy |
|-----------|------|
| `allVersions.length === 0` | «Chưa có phiên bản báo cáo.» (giữ nguyên) |
| `staleOnly && visibleVersions.length === 0 && allVersions.length > 0` | «Không có version hết hạn.» |

**Toggle:** Chỉ đổi state local — **không** refetch API.

### 3.3 Unchanged

- Portal P41/P24
- PDF/DOCX export P29/P31
- `fetchResearchReports` / `listReports` response shape
- P42/P43 trên từng version row còn visible

---

## 4. Hành vi sketch — hướng 2 (P46+, không code P45 mặc định)

| | |
|--|--|
| Scope | Portal `/research` — checkbox «Chỉ báo cáo hết hạn» trên list cards |
| Cách | Client-side filter trên `has_stale_insights` từ API P41 |
| Deploy | portal-web only |
| Không gộp | Staff filter |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `ops-web/src/lib/staff-report-list.util.ts` | `countStaffReportVersionsWithStaleInsights`, `filterStaffReportVersionsByStale`, copy constants |
| `ops-web/src/lib/staff-report-list.util.spec.ts` | P45 filter + count tests |
| `ops-web/src/app/crm/research/[id]/page.tsx` | `ReportTab`: state `staleOnly`, checkbox, filtered map |
| Catalog / OS / Actions | RES-UC-107; UAT P45; P46+ |
| `scripts/deploy_market_research_p45_vps.sh` | ops-web only |
| `scripts/smoke_market_research_p45*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — Filter util (TDD)

- [ ] Extend `staff-report-list.util.ts`:

```ts
import type { ResearchInsight, ResearchReport, ResearchReportVersion } from '@/lib/market-research-api';
import { staffReportVersionHasStaleInsights } from '@/lib/staff-report-stale.util';

export const STAFF_REPORT_STALE_ONLY_LABEL = 'Chỉ version hết hạn';
export const STAFF_REPORT_STALE_ONLY_EMPTY = 'Không có version hết hạn.';

export type StaffReportVersionRow = {
  report: ResearchReport;
  version: ResearchReportVersion;
};

export function countStaffReportVersionsWithStaleInsights(
  rows: StaffReportVersionRow[],
  insights: ResearchInsight[],
  ref: Date = new Date(),
): number {
  return rows.filter((row) =>
    staffReportVersionHasStaleInsights(row.version, insights, ref),
  ).length;
}

export function filterStaffReportVersionsByStale(
  rows: StaffReportVersionRow[],
  insights: ResearchInsight[],
  staleOnly: boolean,
  ref: Date = new Date(),
): StaffReportVersionRow[] {
  if (!staleOnly) return rows;
  return rows.filter((row) =>
    staffReportVersionHasStaleInsights(row.version, insights, ref),
  );
}
```

- [ ] Spec `staff-report-list.util.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  STAFF_REPORT_STALE_ONLY_EMPTY,
  STAFF_REPORT_STALE_ONLY_LABEL,
  countStaffReportVersionsWithStaleInsights,
  filterStaffReportVersionsByStale,
  type StaffReportVersionRow,
} from './staff-report-list.util';

const ref = new Date('2026-08-01T12:00:00Z');
const insights = [{ id: 1, valid_to: '2026-07-01' } as const];
const staleRow = {
  report: { id: 10 } as StaffReportVersionRow['report'],
  version: {
    id: 100,
    has_stale_insights: true,
    content_snapshot: { findings: [{ insight_id: 1 }], recs: [] },
  } as StaffReportVersionRow['version'],
};
const freshRow = {
  report: { id: 11 } as StaffReportVersionRow['report'],
  version: {
    id: 101,
    has_stale_insights: false,
    content_snapshot: { findings: [], recs: [] },
  } as StaffReportVersionRow['version'],
};

describe('staff-report-list.util P45', () => {
  it('count stale versions', () => {
    expect(countStaffReportVersionsWithStaleInsights([staleRow, freshRow], insights as never, ref)).toBe(1);
  });

  it('filter staleOnly keeps only stale rows', () => {
    expect(filterStaffReportVersionsByStale([staleRow, freshRow], insights as never, true, ref)).toEqual([
      staleRow,
    ]);
  });

  it('filter off returns all rows', () => {
    expect(filterStaffReportVersionsByStale([staleRow, freshRow], insights as never, false, ref)).toHaveLength(2);
  });

  it('copy does not claim report expired', () => {
    expect(STAFF_REPORT_STALE_ONLY_LABEL).toMatch(/version hết hạn/i);
    expect(STAFF_REPORT_STALE_ONLY_EMPTY).not.toMatch(/báo cáo hết hạn/i);
  });
});
```

**Verify:** `cd services/ops-web && npx vitest run src/lib/staff-report-list.util.spec.ts`

### Task 2 — ReportTab checkbox + filtered list

- [ ] Import helpers + add state in `ReportTab`:

```ts
import {
  STAFF_REPORT_STALE_ONLY_EMPTY,
  STAFF_REPORT_STALE_ONLY_LABEL,
  countStaffReportVersionsWithStaleInsights,
  filterStaffReportVersionsByStale,
} from '@/lib/staff-report-list.util';

// inside ReportTab:
const [staleOnly, setStaleOnly] = useState(false);
const insights = project.insights ?? [];
const allVersions = reports.flatMap((report) =>
  report.versions.map((version) => ({ report, version })),
);
const staleCount = countStaffReportVersionsWithStaleInsights(allVersions, insights);
const visibleVersions = filterStaffReportVersionsByStale(allVersions, insights, staleOnly);
```

- [ ] Replace `versions.map` → `visibleVersions.map`
- [ ] Insert checkbox block trước version list:

```tsx
{(staleCount > 0 || staleOnly) && allVersions.length > 0 ? (
  <label
    data-testid="staff-report-stale-only-filter"
    style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: '0.65rem', fontSize: '0.85rem' }}
  >
    <input
      type="checkbox"
      checked={staleOnly}
      onChange={(e) => setStaleOnly(e.target.checked)}
    />
    {STAFF_REPORT_STALE_ONLY_LABEL} ({staleOnly ? visibleVersions.length : staleCount})
  </label>
) : null}
{staleOnly && visibleVersions.length === 0 && allVersions.length > 0 ? (
  <p className="muted" data-testid="staff-report-stale-only-empty">
    {STAFF_REPORT_STALE_ONLY_EMPTY}
  </p>
) : null}
```

**Verify:** grep `staff-report-stale-only-filter` · `filterStaffReportVersionsByStale`

### Task 3 — Docs + deploy + smoke

- [ ] Catalog `RNOSAI-BA-RES-UseCases.md` — row + §RES-UC-107:

| RES-UC-107 | Staff report version stale filter | P45 | P45 | Spec ready | RES-UC-105 · RES-UC-106 |

§ detail:

- **Actor:** Lead / Analyst tab Báo cáo
- **UI:** checkbox client-side; predicate `staffReportVersionHasStaleInsights`
- **Cấm** API/DDL; không portal-web

- [ ] OS `12-MARKET-RESEARCH-OS.md` — §P45
- [ ] Actions `12-RES-ACTIONS.md` — Walkthrough UAT P45 (~6 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 version — 1 stale, 1 fresh | Tab Báo cáo |
| 2 | Lead | Quan sát checkbox | «Chỉ version hết hạn (1)» |
| 3 | Lead | Bật filter | Chỉ version stale; badge P43 + banners P42 vẫn đúng |
| 4 | Lead | Tắt filter | Cả 2 version hiện lại |
| 5 | AN | Sửa insight → fresh + refetch | Checkbox ẩn hoặc count 0 |
| 6 | QA | Prod deploy P45 | ops-web only; flags off |

- [ ] `scripts/deploy_market_research_p45_vps.sh` — clone P43 (ops-web only)
- [ ] Smoke m1–m5:

| Script | Verify |
|--------|--------|
| m1 | vitest `staff-report-list.util.spec.ts` P45 |
| m2 | grep `staff-report-stale-only-filter` + `filterStaffReportVersionsByStale` in page |
| m3 | grep RES-UC-107 + deploy script |
| m4 | ops-web build |
| m5 | vitest stale list helpers aggregate |

**Verify:** `bash scripts/smoke_market_research_p45.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p45_vps.sh
```

**Services:** ops-web only. Không api · không portal-web · không worker.

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | vitest P45 filter util |
| m2 | grep checkbox wired in ReportTab |
| m3 | grep RES-UC-107 + deploy script exists |
| m4 | ops-web build gate |
| m5 | aggregator m1–m4 |

---

## 9. UAT gates (hướng 1)

- [ ] ops-web vitest P45 pass
- [ ] Smoke P45 m1–m5
- [ ] Staging UAT Actions §P45
- [ ] Prod: flags unchanged
- [ ] P42/P43/P44 không regress
- [ ] Form tạo version vẫn usable khi filter bật

---

## 10. Out of scope (P46+)

- Portal report list stale filter (hướng 2)
- Bake `has_stale` vào snapshot at publish
- Ẩn stale version khỏi API/export
- Server-side filter query param on `listReports`
- pgvector/RAG prod enable (hướng 3)
- MOE / conjoint mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Filter lệch badge P43 | Cùng `staffReportVersionHasStaleInsights`; UAT #3 |
| User tưởng version bị xóa | Empty state copy rõ; form tạo version luôn hiện |
| Checkbox hiện khi 0 stale | Chỉ render khi `staleCount > 0 \|\| staleOnly` |
| GTM WIP lẫn commit | Stage chỉ file P45 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Đóng gap tìm nhanh version stale trong list dài | Task 1–2 |
| Reuse P44 API-first predicate | §3.2 |
| ops-web only deploy | Task 3 |
| Prod flags off | §2 |
| Không ẩn version khỏi backend | §2 · §10 |

**Next step:** PO khóa **hướng 1** → `code P45 theo hướng 1` → branch `feat/market-research-os-p45`.
