# Market Research OS P41 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách portal thấy **badge cảnh báo** trên danh sách báo cáo `/research` khi report có insight hết hạn (live `valid_to`) — trước khi mở chi tiết P24 (RES-UC-103).

**Architecture:** Mở rộng `GET /api/v1/portal/research/reports` — mỗi card thêm `has_stale_insights: boolean` (reuse `collectReportInsightIds` + `reportSnapshotHasStaleInsights` + `listPublishedInsightValidTo` batch). portal-web list hiện badge vàng; **không** ẩn report; không đổi PDF/detail P24.

**Tech Stack:** NestJS portal-research, Jest; portal-web vitest; bash deploy/smoke. **Không** DDL · **không** ops-web.

**Hướng đề xuất:** **1** — portal report list stale badge. Staff report stale rows = P42+.

---

## 1. Ba hướng P41

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Portal report list stale badge** | **RES-UC-103** | **S–M** | **Đề xuất** — gap sau P24 detail; api + portal-web |
| 2 | Staff report version live stale rows | RES-UC-104 | S–M | Parity portal P24 trên snapshot; ops-web (client-side ưu tiên) |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **không** endpoint mới — mở rộng response `listReports` hiện có
- Stale rule giống P24/P19: UTC calendar; `valid_to === today` → không stale
- Lookup corpus = **`published` + JWT `client_id`** only
- **`has_stale_insights`** = live check tại GET list (insight có thể hết hạn sau publish)
- **Cấm** ẩn report khỏi list · **cấm** leak `title` / `statement`
- Badge copy reuse P19 tone (ngắn); không claim «báo cáo hết hạn» nếu chỉ 1 finding stale
- Không ops-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p41` from `main` @ P40 (`a90e94c8` / `c6c902c0`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **api + portal-web**

---

## 3. Hành vi — RES-UC-103 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P41 |
|-------|----------|-------------|
| P24 | `annotatePortalReportRow`, detail banner | Detail unchanged |
| P29 | `reportSnapshotHasStaleInsights` | Boolean trên snapshot |
| P3 | `listPortalVisibleVersions` | Rows + `content_snapshot` |

### 3.2 API — `GET /portal/research/reports`

Mỗi item trong `{ items[] }` thêm:

```ts
has_stale_insights: boolean;
```

**Thuật toán (service `listReports`):**

1. Filter readable rows (embargo/expired/portal_visible) — giữ nguyên P3
2. Thu thập tất cả `insight_id` từ mọi snapshot visible → `Set<number>`
3. **Một** query `listPublishedInsightValidTo(client_id, ids[])` → `Map`
4. Với mỗi row: `has_stale_insights = reportSnapshotHasStaleInsights(content_snapshot, validToById)`

| Snapshot | `has_stale_insights` |
|----------|----------------------|
| Không insight_id | `false` |
| insight unpublished / khác tenant | `false` (không trong map) |
| ≥1 insight stale | `true` |
| Chỉ fresh / null valid_to | `false` |

**Performance:** batch 1 query cho all IDs (typical N report nhỏ); empty ids → skip SQL.

### 3.3 portal-web — `/research` list

| testid | Element |
|--------|---------|
| `portal-report-stale-badge` | Badge trên row khi `has_stale_insights` |
| `portal-report-list-row-{versionId}` | Row wrapper (optional) |

Copy badge gợi ý: «Có nội dung có thể đã lỗi thời» — **không** trùng verbatim banner finding P19 (list-level).

Type `PortalResearchReportCard` (portal `api.ts`) thêm `has_stale_insights?: boolean`.

### 3.4 Unchanged

- `GET …/reports/:versionId` detail P24
- PDF export footer P29
- Staff ops-web · RAG re-embed P40

---

## 4. Hành vi sketch — hướng 2 (P42+, không code P41)

| | |
|--|--|
| Scope | Staff tab Báo cáo — `InsightStaleBanner` live dưới finding/rec snapshot |
| Cách | Component `ReportStaleFindingList` join `project.insights` + snapshot `insight_id` |
| Deploy | ops-web only nếu client-side đủ |
| Không gộp | portal list badge |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `market-research.types.ts` | `PortalResearchReportCard.has_stale_insights` |
| `portal-research.service.ts` | `listReports` batch stale compute |
| `portal-research.service.spec.ts` | P41 list: stale true/false; tenancy; no title leak |
| `portal-web/src/lib/api.ts` | Type card + optional badge field |
| `portal-web/src/app/research/page.tsx` | Badge UI |
| `portal-web/src/lib/portal-report-list.util.ts` | Label + shouldShowBadge (optional) |
| `portal-web/src/lib/portal-report-list.util.spec.ts` | Copy unit |
| Catalog / OS / Actions | RES-UC-103; UAT P41; P42+ |
| `scripts/deploy_market_research_p41_vps.sh` | api + portal-web |
| `scripts/smoke_market_research_p41*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — API types + service (TDD)

- [ ] Extend `PortalResearchReportCard` với `has_stale_insights: boolean`
- [ ] `listReports`: batch collect IDs → `listPublishedInsightValidTo` → per-row `reportSnapshotHasStaleInsights`
- [ ] Spec: 2 reports — một stale một fresh; cross-tenant map empty → false; JSON không `title`

**Verify:** `npx jest portal-research.service.spec.ts --testNamePattern='P41|listReports'`

### Task 2 — portal-web list badge

- [ ] Update `PortalResearchReportCard` type in `api.ts`
- [ ] List row: badge khi `has_stale_insights === true`
- [ ] Vitest util: badge copy không claim ISO/cert

**Verify:** vitest pass; grep `portal-report-stale-badge`

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-103 catalog + OS §P41
- [ ] Actions §P41 UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | CL | Seed report stale + fresh | 2 version portal-visible |
| 2 | CL | Mở `/research` | Row stale có badge; fresh không |
| 3 | CL | Click stale → detail | Banner P24 vẫn dưới finding |
| 4 | CL | Click fresh → detail | Không banner finding |
| 5 | QA | GET list JSON | `has_stale_insights` đúng; không `title` |
| 6 | QA | Prod deploy P41 | Flags off; badge hiện khi data stale |

- [ ] `deploy_market_research_p41_vps.sh` — api + portal-web
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p41.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p41_vps.sh
```

**Services:** api + portal-web. Không ops-web/worker.

---

## 8. UAT gates (hướng 1)

- [ ] portal-research Jest P41 pass
- [ ] portal-web vitest pass
- [ ] Smoke P41 m1–m5
- [ ] Staging UAT Actions §P41
- [ ] Prod: flags unchanged

---

## 9. Out of scope (P42+)

- Staff report live stale rows (hướng 2)
- Ẩn stale report khỏi list
- Bake `has_stale` vào snapshot at publish
- pgvector/RAG prod enable
- ops-web changes
- MOE / portal what-if

---

## 10. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| N+1 query | Batch một `listPublishedInsightValidTo` |
| User hiểu nhầm badge = report expired | Copy «có nội dung» không «báo cáo hết hạn» |
| List/detail lệch thời điểm | Cùng live rule; UAT #3 |
| GTM WIP lẫn commit | Stage chỉ file P41 |

---

## 11. Self-review

| Requirement | Task |
|-------------|------|
| Đóng gap list vs P24 detail | Task 1–2 |
| No new endpoint | §3.2 extend list |
| portal deploy | Task 3 |
| Prod flags off | Global constraints |

**Next step:** PO khóa **hướng 1** → `code P41 theo hướng 1` → branch `feat/market-research-os-p41`.
