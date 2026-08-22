# Market Research OS P48 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff `GET /research/projects/:id/reports?stale_only=1` lọc server-side version có `has_stale_insights` — ops-web refetch khi bật filter P45 thay vì chỉ client join (RES-UC-110).

**Architecture:** Mở rộng staff `listReports` — sau batch annotate P44, lọc `versions[]` theo `has_stale_insights`; bỏ report rỗng. ops-web parent refetch `fetchResearchReports` với flag; P45 client util **fallback**. Pattern parity P47 portal. **Không** DDL · **không** endpoint mới · deploy **api + ops-web**.

**Tech Stack:** NestJS market-research, Jest; ops-web vitest; bash deploy/smoke.

**Hướng đề xuất:** **1** — staff reports API `stale_only`. Bake snapshot stale = hướng 2.

---

## 1. Ba hướng P48

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff reports API `stale_only=1` + refetch UI** | **RES-UC-110** | **S–M** | **Đề xuất** — deferred P47 hướng 2; parity portal P47 |
| 2 | Bake `has_stale_insights` vào snapshot at publish | RES-UC-110 alt | M | Immutable audit trail; không live refetch |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** — mở rộng query `GET /api/v1/research/projects/:id/reports`
- Reuse **`parseRagStaleOnlyFlag`** (P25/P47)
- Stale compute **giữ nguyên P44** — filter **sau** annotate
- **`stale_only` off/absent** → full nested `reports[]` (backward compatible)
- **`stale_only=1`** → mỗi report chỉ còn version `has_stale_insights === true`; report không còn version → **omit** khỏi response
- **Cấm** ẩn version khỏi DB/export · filter chỉ list response
- Form tạo version (P45) **luôn hiện** — filter không áp dụng form
- portal P46/P47 **không đổi**
- Branch: `feat/market-research-os-p48` from `main` @ P47 (`b171c512`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **api + ops-web**

---

## 3. Hành vi — RES-UC-110 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P48 |
|-------|----------|-------------|
| P44 | Staff `listReports` + `has_stale_insights` | Stale boolean per version |
| P45 | Checkbox + client filter | UI shell; upgrade refetch |
| P47 | Portal `stale_only` pattern | Parity reference |

### 3.2 API — `GET /research/projects/:id/reports`

Query mới (optional):

```ts
stale_only?: string | boolean;
```

Type:

```ts
export type StaffReportsListInput = {
  stale_only?: string | boolean;
};
```

**Controller:**

```ts
@Get('projects/:id/reports')
async listReports(
  @Req() req: StaffReq,
  @Param('id', ParseIntPipe) id: number,
  @Query() query: StaffReportsListInput,
) {
  const scope = await resolveStaffClientScope(req, this.clientScope);
  return this.research.listReports(id, scope, query);
}
```

**Service (`listReports`):**

```ts
async listReports(
  projectId: number,
  scope: ClientScopeContext,
  input: StaffReportsListInput = {},
): Promise<{ reports: ResearchReportRow[] }> {
  // ... existing P44 batch annotate → annotatedReports
  const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
  if (!staleOnly) return { reports: annotatedReports };
  return {
    reports: annotatedReports
      .map((report) => ({
        ...report,
        versions: report.versions.filter((v) => v.has_stale_insights),
      }))
      .filter((report) => report.versions.length > 0),
  };
}
```

| Query | Response |
|-------|----------|
| (none) | Full reports + versions + flags |
| `stale_only=1` | Chỉ stale versions; reports rỗng omitted |
| 0 stale match | `{ reports: [] }` |

### 3.3 ops-web

**API client:**

```ts
export async function fetchResearchReports(
  token: string,
  projectId: number,
  input?: { stale_only?: boolean },
): Promise<{ reports: ResearchReport[] }> {
  const qs = input?.stale_only ? '?stale_only=1' : '';
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports${qs}`);
}
```

**Parent page** (`crm/research/[id]/page.tsx`):

```ts
const [allReports, setAllReports] = useState<ResearchReport[]>([]);
const [reports, setReports] = useState<ResearchReport[]>([]);
const [reportsStaleOnly, setReportsStaleOnly] = useState(false);

async function loadReports(access: string, staleOnly: boolean) {
  const full = await fetchResearchReports(access, id);
  setAllReports(full.reports);
  if (!staleOnly) {
    setReports(full.reports);
    return;
  }
  try {
    const filtered = await fetchResearchReports(access, id, { stale_only: true });
    setReports(filtered.reports);
  } catch {
    setReports(filterStaffReportsByStale(full.reports, project?.insights ?? [], true));
  }
}
```

**ReportTab props** — thêm:

```ts
allReports: ResearchReport[];
reportsStaleOnly: boolean;
onReportsStaleOnlyChange: (checked: boolean) => void;
reportsLoading?: boolean;
```

**ReportTab** — bỏ local `staleOnly` state; dùng props; `staleCount` từ `allReports` flatMap; `visibleVersions` từ `reports` flatMap (đã filtered).

**Util fallback** (`staff-report-list.util.ts`):

```ts
export function filterStaffReportsByStale(
  reports: ResearchReport[],
  insights: ResearchInsight[],
  staleOnly: boolean,
  ref?: Date,
): ResearchReport[] {
  if (!staleOnly) return reports;
  return reports
    .map((report) => ({
      ...report,
      versions: report.versions.filter((v) =>
        staffReportVersionHasStaleInsights(v, insights, ref),
      ),
    }))
    .filter((report) => report.versions.length > 0);
}
```

| testid | Giữ từ P45 |
|--------|------------|
| `staff-report-stale-only-filter` | Checkbox |
| `staff-report-stale-only-empty` | Empty state |

### 3.4 Unchanged

- Portal P41/P46/P47
- PDF/DOCX export P29/P31
- RAG search P25/P30
- Detail banners P42 · meta badge P43

---

## 4. Hành vi sketch — hướng 2 (P49+, không code P48 mặc định)

| | |
|--|--|
| Scope | Bake `has_stale_insights` vào `content_snapshot` at `publishPortal` |
| Cách | Immutable audit; list/detail đọc baked field |
| Deploy | api + ops-web + portal-web |
| Khi chọn | PO muốn snapshot không đổi sau publish |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `market-research.types.ts` | `StaffReportsListInput` |
| `market-research.controller.ts` | Pass query to `listReports` |
| `market-research.service.ts` | `listReports(id, scope, input)` + version filter |
| `market-research.service.spec.ts` | P48 stale_only tests |
| `ops-web/.../market-research-api.ts` | `fetchResearchReports` + qs |
| `ops-web/.../staff-report-list.util.ts` | `filterStaffReportsByStale` fallback |
| `ops-web/.../page.tsx` | Parent refetch + ReportTab props |
| Catalog / OS / Actions | RES-UC-110; UAT P48; P49+ |
| `scripts/deploy_market_research_p48_vps.sh` | api + ops-web |
| `scripts/smoke_market_research_p48*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — API types + service (TDD)

- [ ] Add `StaffReportsListInput` to `market-research.types.ts`
- [ ] `listReports(projectId, scope, input?)`: filter versions + omit empty reports
- [ ] Controller `@Query() query: StaffReportsListInput`
- [ ] Spec P48 (reuse P44 fixture):

```ts
it('P48 listReports stale_only returns only stale versions', async () => {
  // 2 versions: one stale one fresh (same or different reports)
  const { reports } = await service.listReports(9, scope, { stale_only: '1' });
  const versions = reports.flatMap((r) => r.versions);
  expect(versions.every((v) => v.has_stale_insights)).toBe(true);
  expect(versions).toHaveLength(1);
});

it('P48 listReports without stale_only returns all versions', async () => {
  const { reports } = await service.listReports(9, scope, {});
  expect(reports.flatMap((r) => r.versions)).toHaveLength(2);
});

it('P48 listReports stale_only empty when none stale', async () => {
  const { reports } = await service.listReports(9, scope, { stale_only: '1' });
  expect(reports).toEqual([]);
});
```

**Verify:** `npx jest market-research.service.spec.ts --testNamePattern='P48|listReports stale_only'`

### Task 2 — ops-web refetch + ReportTab props

- [ ] Extend `fetchResearchReports(token, projectId, { stale_only? })`
- [ ] Add `filterStaffReportsByStale` + spec
- [ ] Parent: `allReports`, `loadReports(access, staleOnly)`, wire checkbox via ReportTab props
- [ ] ReportTab: remove local `staleOnly`; use `allReports` for count, `reports` for list

**Verify:** grep `stale_only` in market-research-api.ts + `loadReports` in page.tsx

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-110 catalog + OS §P48 + Actions UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 version — 1 stale, 1 fresh | Tab Báo cáo |
| 2 | Lead | Bật filter P45 | Chỉ version stale |
| 3 | QA | GET staff reports `stale_only=1` | JSON 1 version stale |
| 4 | Lead | Tắt filter | Cả 2 version; form tạo version OK |
| 5 | CL | Portal P47 | Không regress |
| 6 | QA | Prod deploy P48 | api + ops-web; flags off |

- [ ] `deploy_market_research_p48_vps.sh` — clone P44 (api + ops-web)
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p48.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p48_vps.sh
```

**Services:** api + ops-web. Không portal-web · không worker · **không DDL**.

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | Jest P48 staff listReports stale_only |
| m2 | grep `stale_only` ops-web api + page refetch |
| m3 | grep RES-UC-110 + deploy script |
| m4 | api + ops-web build/test gate |
| m5 | vitest staff-report-list fallback util |

---

## 9. UAT gates (hướng 1)

- [ ] market-research Jest P48 pass
- [ ] ops-web vitest P45/P48 util pass
- [ ] Smoke P48 m1–m5
- [ ] Staging UAT Actions §P48
- [ ] Prod: flags unchanged
- [ ] P42–P45 UI không regress
- [ ] Portal P47 không regress

---

## 10. Out of scope (P49+)

- Bake stale flag at publish (hướng 2)
- Default hide stale without opt-in
- Portal API changes
- pgvector/RAG prod enable (hướng 3)
- MOE / conjoint mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Nested filter lệch P44 boolean | Cùng `has_stale_insights`; UAT #3 |
| Report rỗng sau filter gây confuse | Omit report khỏi JSON |
| Staging api cũ | ops-web P45 client fallback |
| Lift state parent ↔ ReportTab | Props rõ; vitest util |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Parity portal P47 staff side | Task 1–2 |
| P44 annotate unchanged | §3.2 |
| api + ops-web deploy | Task 3 |
| Form tạo version unaffected | §2 · §3.3 |

**Next step:** PO khóa **hướng 1** → `code P48 theo hướng 1` → branch `feat/market-research-os-p48`.
