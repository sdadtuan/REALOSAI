# Market Research OS P47 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal `GET /portal/research/reports?stale_only=1` lọc server-side card có `has_stale_insights` — portal-web refetch khi bật filter P46 thay vì chỉ client join (RES-UC-109).

**Architecture:** Mở rộng `listReports` portal — sau batch stale annotate P41, `filter(has_stale_insights)` khi `parseRagStaleOnlyFlag(stale_only)`. portal-web checkbox gọi lại `portalResearchReports` với flag; giữ client filter P46 làm fallback khi API cũ. **Không** DDL · **không** endpoint mới · deploy **api + portal-web**.

**Tech Stack:** NestJS portal-research, Jest; portal-web vitest; bash deploy/smoke.

**Hướng đề xuất:** **1** — portal reports API `stale_only`. Staff reports API filter = hướng 2.

---

## 1. Ba hướng P47

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Portal reports API `stale_only=1` + refetch UI** | **RES-UC-109** | **S–M** | **Đề xuất** — deferred P46 hướng 2; pattern P25 RAG |
| 2 | Staff `GET …/reports?stale_only=1` | RES-UC-109 alt | S–M | Parity portal; api + ops-web |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** — mở rộng query `GET /api/v1/portal/research/reports`
- Reuse **`parseRagStaleOnlyFlag`** (P25) — `stale_only=1` | `true` → filter
- Stale compute **giữ nguyên P41** — filter **sau** annotate, không đổi rule
- **`stale_only` off/absent** → trả full list (backward compatible)
- **`stale_only=1`** → chỉ card `has_stale_insights === true`
- **Cấm** ẩn card khỏi DB/export · filter chỉ response list
- **Cấm** leak thêm PII · **cấm** đổi card shape
- portal-web: refetch on toggle; P46 client util **fallback** khi response không phải stale-only request trên api cũ
- Không ops-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p47` from `main` @ P46 (`7bb959d8`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **api + portal-web**

---

## 3. Hành vi — RES-UC-109 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P47 |
|-------|----------|-------------|
| P41 | `listReports` + `has_stale_insights` | Stale boolean trên card |
| P46 | Checkbox + client filter | UI shell; upgrade refetch |
| P25 | `parseRagStaleOnlyFlag` | Query parser reuse |

### 3.2 API — `GET /portal/research/reports`

Query mới (optional):

```ts
stale_only?: string | boolean; // '1' | 'true' → filter
```

Type mới:

```ts
export type PortalReportsListInput = {
  stale_only?: string | boolean;
};
```

**Controller:**

```ts
@Get('reports')
list(@PortalUser() user: PortalJwtPayload, @Query() query: PortalReportsListInput) {
  return this.research.listReports(user, query);
}
```

**Service (`listReports`):**

```ts
async listReports(user: PortalJwtPayload, input: PortalReportsListInput = {}): Promise<{ items: PortalResearchReportCard[] }> {
  // ... existing P41 batch annotate → items
  const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
  const filtered = staleOnly ? items.filter((item) => item.has_stale_insights) : items;
  return { items: filtered };
}
```

| Query | Response |
|-------|----------|
| (none) | All readable cards + `has_stale_insights` |
| `stale_only=1` | Subset stale only |
| 0 stale match | `{ items: [] }` |

### 3.3 portal-web

**API client** — extend `portalResearchReports`:

```ts
export async function portalResearchReports(
  token: string,
  input?: { stale_only?: boolean },
): Promise<{ items: PortalResearchReportCard[] }> {
  const qs = new URLSearchParams();
  if (input?.stale_only) qs.set('stale_only', '1');
  const url = `${API_BASE}/api/v1/portal/research/reports${qs.size ? `?${qs}` : ''}`;
  // ...
}
```

**Page state** (`research/page.tsx`):

```ts
const [allItems, setAllItems] = useState<PortalResearchReportCard[]>([]);
const [items, setItems] = useState<PortalResearchReportCard[]>([]);
const [staleOnly, setStaleOnly] = useState(false);

async function loadReports(nextStaleOnly: boolean) {
  const [full, filtered] = await Promise.all([
    portalResearchReports(token),
    nextStaleOnly ? portalResearchReports(token, { stale_only: true }) : Promise.resolve(null),
  ]);
  setAllItems(full.items ?? []);
  setItems(nextStaleOnly ? (filtered?.items ?? filterPortalReportCardsByStale(full.items ?? [], true)) : (full.items ?? []));
}

// initial + year effect: loadReports(staleOnly)
// checkbox onChange: setStaleOnly + loadReports(next)
```

**Label count:**

```ts
const staleCount = countPortalReportCardsWithStaleInsights(allItems);
const visibleItems = items; // already filtered when staleOnly
```

Fallback: nếu `stale_only` fetch fail → `filterPortalReportCardsByStale(allItems, true)` (P46 util).

| testid | Giữ từ P46 |
|--------|------------|
| `portal-report-stale-only-filter` | Checkbox |
| `portal-report-stale-only-empty` | Empty state |

### 3.4 Unchanged

- Staff P42–P46
- Detail `/research/[versionId]` P24
- RAG search P25 `stale_only` (insights, không reports)
- PDF export P29

---

## 4. Hành vi sketch — hướng 2 (P48+, không code P47 mặc định)

| | |
|--|--|
| Scope | Staff `GET /research/projects/:id/reports?stale_only=1` |
| Cách | Filter sau P44 `has_stale_insights` annotate |
| Deploy | api + ops-web |
| Khi chọn | Staff list dài / muốn parity portal |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `market-research.types.ts` | `PortalReportsListInput` |
| `portal-research.controller.ts` | Pass query to `listReports` |
| `portal-research.service.ts` | `listReports(user, input)` + stale filter |
| `portal-research.service.spec.ts` | P47: stale_only true/false; 0 match; no leak |
| `portal-web/src/lib/api.ts` | `portalResearchReports` + `stale_only` qs |
| `portal-web/src/app/research/page.tsx` | Refetch on toggle; `allItems` cache |
| Catalog / OS / Actions | RES-UC-109; UAT P47; P48+ |
| `scripts/deploy_market_research_p47_vps.sh` | api + portal-web |
| `scripts/smoke_market_research_p47*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — API types + service (TDD)

- [ ] Add `PortalReportsListInput` to `market-research.types.ts`
- [ ] `listReports(user, input?)`: parse flag → filter items
- [ ] Spec P47:

```ts
it('P47 listReports stale_only returns only stale cards', async () => {
  // mock 2 versions stale + fresh (reuse P41 fixture)
  const { items } = await makeService().listReports(acmeUser, { stale_only: '1' });
  expect(items).toHaveLength(1);
  expect(items[0].has_stale_insights).toBe(true);
});

it('P47 listReports without stale_only returns all cards', async () => {
  const { items } = await makeService().listReports(acmeUser, {});
  expect(items).toHaveLength(2);
});

it('P47 listReports stale_only empty when none stale', async () => {
  const { items } = await makeService().listReports(acmeUser, { stale_only: '1' });
  expect(items).toEqual([]);
});
```

- [ ] Controller wire `@Query() query: PortalReportsListInput`

**Verify:** `npx jest portal-research.service.spec.ts --testNamePattern='P47|listReports'`

### Task 2 — portal-web refetch + fallback

- [ ] Extend `portalResearchReports(token, { stale_only? })`
- [ ] `ResearchListContent`: `allItems` + `loadReports(staleOnly)` refetch pattern
- [ ] Checkbox `onChange` → `loadReports(checked)`; loading state disable checkbox
- [ ] Keep P46 empty state + label; staleCount from `allItems`

**Verify:** grep `stale_only` in api.ts + page.tsx

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-109 catalog + OS §P47 + Actions UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 report portal — 1 stale, 1 fresh | `/research` |
| 2 | CL | Bật filter P46 | Chỉ card stale |
| 3 | QA | GET reports `stale_only=1` | JSON 1 item, `has_stale_insights: true` |
| 4 | CL | Tắt filter | 2 card; refetch full list |
| 5 | CL | Detail stale | P24 banner OK |
| 6 | QA | Prod deploy P47 | api + portal-web; flags off |

- [ ] `deploy_market_research_p47_vps.sh` — api test gate + portal-web (clone P41 deploy steps 2/3 only, no DDL)
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p47.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p47_vps.sh
```

**Services:** api + portal-web. Không ops-web · không worker · **không DDL**.

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | Jest P47 listReports stale_only |
| m2 | grep `stale_only` portal api + page refetch |
| m3 | grep RES-UC-109 + deploy script |
| m4 | api + portal-web build/test gate |
| m5 | aggregator |

---

## 9. UAT gates (hướng 1)

- [ ] portal-research Jest P47 pass
- [ ] portal-web vitest P46 util still pass (fallback)
- [ ] Smoke P47 m1–m5
- [ ] Staging UAT Actions §P47
- [ ] Prod: flags unchanged
- [ ] P41/P46 UI không regress
- [ ] RAG P25 không regress

---

## 10. Out of scope (P48+)

- Staff reports API `stale_only` (hướng 2)
- Bake `has_stale` vào snapshot at publish
- Ẩn stale card khỏi export/detail
- Default hide stale from list (no opt-in)
- pgvector/RAG prod enable (hướng 3)
- MOE / conjoint mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| API filter lệch P41 boolean | Cùng pipeline annotate → filter; UAT #3 |
| Double fetch latency | Parallel full+filtered on toggle; list N nhỏ |
| Staging api cũ chưa deploy | portal-web P46 client fallback |
| GTM WIP lẫn commit | Stage chỉ file P47 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Đóng gap server contract cho portal filter | Task 1 |
| Refetch thay pure client khi API sẵn | Task 2 |
| api + portal-web deploy | Task 3 |
| Prod flags off | §2 |
| Backward compat api cũ | §3.3 fallback |

**Next step:** PO khóa **hướng 1** → `code P47 theo hướng 1` → branch `feat/market-research-os-p47`.
