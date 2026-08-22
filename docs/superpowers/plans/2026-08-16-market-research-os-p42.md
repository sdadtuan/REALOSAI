# Market Research OS P42 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff thấy **banner stale live** dưới finding/rec trên tab Báo cáo (`/crm/research/[id]`) — parity portal P24 detail, sau P41 list badge (RES-UC-104).

**Architecture:** **Client-side join** `project.insights` (đã load qua `getProject`) + `content_snapshot.findings/recs[].insight_id` → `insightIsStale(valid_to)`. Component `ReportStaleInsightList` reuse `InsightStaleBanner` (P22). **Không** endpoint mới · **không** DDL · deploy **ops-web only**.

**Tech Stack:** ops-web (React + vitest); bash deploy/smoke. Không ptt-crm-api · không portal-web.

**Hướng đề xuất:** **1** — staff report version live stale rows (client-side). API annotate = hướng 2 fallback.

---

## 1. Ba hướng P42

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff report version live stale rows (client-side)** | **RES-UC-104** | **S** | **Đề xuất** — gap sau P33 bake note; reuse insights đã có; ops-web only |
| 2 | Staff report stale via API annotate | RES-UC-104 | S–M | Parity portal `annotatePortalReportRow`; deploy api + ops-web; chọn nếu insights không đủ trên page |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** · **No API change**
- Stale rule giống P18/P22/P24: UTC calendar; `valid_to === today` → không stale
- Lookup = **`project.insights`** map theo `id` (live `valid_to` tại thời điểm load page)
- `insight_id` thiếu / không có trong map → **không** banner (giống portal unpublished)
- **Cấm** dùng `published_valid_to` bake (P32/P33) cho `is_stale`
- **Cấm** ẩn version · **cấm** sửa snapshot · **cấm** đổi PDF/DOCX footer (P29/P31)
- Banner copy reuse P22 `INSIGHT_STALE_BANNER` — **không** copy portal list P41
- Không portal-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p42` from `main` @ P41 (`861924c4`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **ops-web only**

---

## 3. Hành vi — RES-UC-104 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P42 |
|-------|----------|-------------|
| P22 | `InsightStaleBanner`, `insightIsStale` | Banner + rule |
| P24 | Portal detail annotate | Parity hành vi (staff channel) |
| P33 | `ReportPublishedValidToList` | Pattern list dưới version meta |
| P41 | Portal list `has_stale_insights` | Không đổi; staff ≠ list badge |

### 3.2 Staff UI — tab Báo cáo, mỗi version

Vị trí: ngay **dưới** `ReportPublishedValidToList`, **trên** Executive (VI).

| testid | Element |
|--------|---------|
| `staff-report-stale-list` | Wrapper khi ≥1 finding/rec stale |
| `insight-stale-banner` | Reuse P22 — một banner / stale row |
| `staff-report-stale-row-{insightId}` | Optional wrapper từng banner |

**Thuật toán (`ReportStaleInsightList`):**

1. Input: `findings`, `recs`, `insights: ResearchInsight[]`
2. Build `Map<number, ResearchInsight>` từ `insights`
3. Duyệt `findings` rồi `recs` (giữ thứ tự P33)
4. Với mỗi row có `insight_id` > 0:
   - Lookup insight trong map
   - `insightIsStale(insight)` → render `<InsightStaleBanner validTo={insight.valid_to} />`
   - Prefix label gợi ý: `Finding #11` / `Rec #11` (muted, ngắn) — **không** leak full `statement`
5. Không row stale → return `null`

| Snapshot row | Banner |
|--------------|--------|
| Không `insight_id` | Không |
| `insight_id` không trong `project.insights` | Không |
| Insight fresh / `valid_to` null / today | Không |
| Insight stale | Có |

**Optional (cùng PR nếu ≤15 dòng):** suffix `· có insight hết hạn` trên dòng meta `v{N}` khi list không rỗng.

### 3.3 Unchanged

- Portal `/research` list badge P41 · detail P24
- PDF/DOCX export P29/P31
- `publishPortal` / bake P32
- RAG re-embed panel P40

---

## 4. Hành vi sketch — hướng 2 (fallback, không code P42 mặc định)

| | |
|--|--|
| Scope | Staff `GET …/research/projects/:id` hoặc `listReports` — annotate `findings/recs` với `valid_to`, `is_stale` |
| Reuse | `collectReportInsightIds` + batch valid_to query (giống portal P24) |
| Deploy | api + ops-web |
| Khi chọn | Insights không load đủ trên page hoặc PO muốn JSON contract giống portal |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `ops-web/src/lib/report-stale.util.ts` | `insightsById`, `reportSnapshotRowIsStale`, extract `insight_id` |
| `ops-web/src/lib/report-stale.util.spec.ts` | P42 unit: stale/fresh/missing id |
| `ops-web/src/components/research/ReportStaleInsightList.tsx` | List banners dưới version |
| `ops-web/src/app/crm/research/[id]/page.tsx` | Wire list + pass `project.insights` |
| Catalog / OS / Actions | RES-UC-104; UAT P42; P43+ |
| `scripts/deploy_market_research_p42_vps.sh` | ops-web only |
| `scripts/smoke_market_research_p42*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — Util join snapshot ↔ insights (TDD)

**Files:**
- Create: `services/ops-web/src/lib/report-stale.util.ts`
- Create: `services/ops-web/src/lib/report-stale.util.spec.ts`

**Interfaces:**
- Produces: `insightsById(insights)`, `snapshotInsightId(row)`, `reportSnapshotRowIsStale(row, map, ref?)`

- [ ] **Step 1: Write failing spec**

```ts
import { describe, expect, it } from 'vitest';
import {
  insightsById,
  reportSnapshotRowIsStale,
  snapshotInsightId,
} from './report-stale.util';

describe('report-stale.util', () => {
  const ref = new Date('2026-08-17T12:00:00Z');
  const map = insightsById([
    { id: 11, valid_to: '2020-01-01' } as never,
    { id: 12, valid_to: '2026-08-17' } as never,
  ]);

  it('P42 snapshotInsightId reads positive insight_id', () => {
    expect(snapshotInsightId({ insight_id: 11 })).toBe(11);
    expect(snapshotInsightId({ insight_id: 0 })).toBe(null);
  });

  it('P42 reportSnapshotRowIsStale uses live valid_to', () => {
    expect(reportSnapshotRowIsStale({ insight_id: 11 }, map, ref)).toBe(true);
    expect(reportSnapshotRowIsStale({ insight_id: 12 }, map, ref)).toBe(false);
    expect(reportSnapshotRowIsStale({ insight_id: 99 }, map, ref)).toBe(false);
  });

  it('P42 ignores published_valid_to on snapshot row', () => {
    expect(
      reportSnapshotRowIsStale({ insight_id: 12, published_valid_to: '2099-01-01' }, map, ref),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ops-web && npx vitest@2 run src/lib/report-stale.util.spec.ts`

- [ ] **Step 3: Implement util** (delegate stale to `insightIsStale` from `insight-stale.util.ts`)

- [ ] **Step 4: Run test — expect PASS**

**Verify:** vitest green

---

### Task 2 — ReportStaleInsightList component

**Files:**
- Create: `services/ops-web/src/components/research/ReportStaleInsightList.tsx`
- Modify: `services/ops-web/src/app/crm/research/[id]/page.tsx` — mount under `ReportPublishedValidToList`

**Interfaces:**
- Consumes: `report-stale.util` + `InsightStaleBanner`

- [ ] Render wrapper `data-testid="staff-report-stale-list"` only when ≥1 stale row
- [ ] Each stale row: optional `staff-report-stale-row-{id}` + `InsightStaleBanner`
- [ ] Pass `insights={project.insights ?? []}` from `ReportsTab`

**Verify:** grep `staff-report-stale-list` · `ReportStaleInsightList`

---

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-104 catalog + OS §P42
- [ ] Actions §P42 UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed report version có finding stale | Snapshot trỏ insight `valid_to` quá khứ |
| 2 | Lead | Mở tab Báo cáo | Banner stale dưới version; fresh version không |
| 3 | AN | Đổi insight `valid_to` → tương lai + F5 | Banner biến mất (live) |
| 4 | Lead | Cùng version | `published_valid_to` note P33 vẫn hiện nếu có bake |
| 5 | CL | Portal detail cùng report | Banner P24 không regress |
| 6 | QA | Prod deploy P42 | Flags off; ops-web only |

- [ ] `deploy_market_research_p42_vps.sh` — ops-web (clone P40 pattern)
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p42.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p42_vps.sh
```

**Services:** ops-web only. Không api / portal-web / worker.

Script gợi ý: P0–P38 DDL (warn) → **không** rebuild api → `deploy_ops_web.sh` → restart `ptt-ops-web`.

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | vitest `report-stale.util.spec.ts` |
| m2 | grep `ReportStaleInsightList` + `staff-report-stale-list` |
| m3 | grep `RES-UC-104` docs + deploy script exists |
| m4 | ops-web build / tsc (hoặc `next build` dry nếu CI nặng) |
| m5 | full smoke aggregator |

---

## 9. UAT gates (hướng 1)

- [ ] ops-web vitest P42 pass
- [ ] Smoke P42 m1–m5
- [ ] Staging UAT Actions §P42
- [ ] Prod: flags unchanged
- [ ] Portal P41/P24 không regress

---

## 10. Out of scope (P43+)

- API annotate staff report (hướng 2) — trừ khi PO chọn
- Staff report **list-level** badge (portal P41 đã cover khách)
- Bake `is_stale` vào snapshot
- Ẩn version stale khỏi staff list
- pgvector/RAG prod enable (hướng 3)
- portal-web changes
- MOE / conjoint persist mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Stale lệch nếu tab mở lâu không F5 | Giống portal pre-P41 detail; document UAT #3 F5 |
| Insight không trong `getProject` payload | Hiện tại full list; hướng 2 nếu pagination sau này |
| Trùng banner finding + rec cùng `insight_id` | Hiện 2 banner (finding + rec) — parity portal P24 |
| GTM WIP lẫn commit | Stage chỉ file P42 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Parity portal P24 trên staff channel | Task 1–2 |
| No new endpoint | §2 Global constraints |
| ops-web-only deploy | Task 3 |
| Prod flags off | §2 |
| Không dùng bake cho stale | Task 1 spec |

**Next step:** PO khóa **hướng 1** → `code P42 theo hướng 1` → branch `feat/market-research-os-p42`.
