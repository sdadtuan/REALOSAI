# Market Research OS P43 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff thấy **badge cảnh báo cấp version** trên dòng meta `v{N}` tab Báo cáo khi snapshot có insight stale — trước khi scroll tới banner chi tiết P42 (RES-UC-105).

**Architecture:** **Client-side** reuse P42 `collectReportSnapshotStaleRows` / `project.insights` — boolean `has_stale_insights` per version trên UI; badge vàng trên dòng `v{N} · …`. **Không** endpoint mới · **không** DDL · deploy **ops-web only** (giống P42).

**Tech Stack:** ops-web vitest; bash deploy/smoke. Không ptt-crm-api · không portal-web.

**Hướng đề xuất:** **1** — staff version list stale badge. API annotate staff reports = hướng 2.

---

## 1. Ba hướng P43

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff report version list stale badge** | **RES-UC-105** | **S** | **Đề xuất** — parity P41 portal list; reuse P42 util; ops-web only |
| 2 | Staff report stale via API (`listReports` annotate) | RES-UC-105 alt | S–M | Batch `listInsightValidToForProject`; deploy api + ops-web |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** · **No API change**
- Stale rule giống P42/P41/P24: UTC calendar; `valid_to === today` → không stale
- Lookup = **`project.insights`** map (live tại load page)
- **Cấm** ẩn version · **cấm** sửa snapshot · **cấm** đổi PDF/DOCX
- Copy list-level reuse P41 tone: «Có nội dung có thể đã lỗi thời» — **không** claim «báo cáo hết hạn»
- P42 `ReportStaleInsightList` **giữ nguyên** (detail banners)
- Không portal-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p43` from `main` @ P42 (`8ea7db19`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **ops-web only**

---

## 3. Hành vi — RES-UC-105 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P43 |
|-------|----------|-------------|
| P41 | Portal list badge + copy | Parity staff list-level |
| P42 | `report-stale.util`, `ReportStaleInsightList` | Boolean + detail banners |
| P33 | `ReportPublishedValidToList` | Unchanged |

### 3.2 Staff UI — tab Báo cáo, dòng meta version

Vị trí: trên cùng mỗi `<li>` version — cạnh `v{N} · date · user` (trước nút Xuất DOCX/PDF).

| testid | Element |
|--------|---------|
| `staff-report-version-stale-badge` | Badge khi version có ≥1 stale finding/rec |
| `staff-report-version-row-{versionId}` | Optional wrapper dòng meta |

**Thuật toán:**

```ts
hasStale =
  collectReportSnapshotStaleRows(
    version.content_snapshot?.findings,
    version.content_snapshot?.recs,
    project.insights ?? [],
  ).length > 0;
```

Hoặc helper mỏng `reportVersionHasStaleInsights(...)` wrap trên.

| Version snapshot | Badge |
|------------------|-------|
| Không insight_id stale | Không |
| ≥1 finding/rec stale | Có |
| Chỉ fresh / null valid_to | Không |

### 3.3 Unchanged

- P42 detail banners (`staff-report-stale-list`)
- Portal P41/P24
- PDF/DOCX export P29/P31
- `fetchResearchReports` response shape

---

## 4. Hành vi sketch — hướng 2 (fallback)

| | |
|--|--|
| Scope | `GET …/research/projects/:id/reports` — mỗi version thêm `has_stale_insights: boolean` |
| Reuse | `collectReportInsightIds` + `listInsightValidToForProject` + `reportSnapshotHasStaleInsights` (đã dùng export PDF) |
| Deploy | api + ops-web |
| Khi chọn | PO muốn JSON contract / tab mở lâu không F5 |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `ops-web/src/lib/report-stale.util.ts` | `reportVersionHasStaleInsights` (optional thin wrapper) |
| `ops-web/src/lib/report-stale.util.spec.ts` | P43 boolean tests |
| `ops-web/src/lib/staff-report-list.util.ts` | Label + `shouldShowStaffVersionStaleBadge` (optional, mirror portal P41) |
| `ops-web/src/lib/staff-report-list.util.spec.ts` | Copy unit |
| `ops-web/src/components/research/StaffReportVersionStaleBadge.tsx` | Badge UI (optional component) |
| `ops-web/src/app/crm/research/[id]/page.tsx` | Badge trên dòng meta `v{N}` |
| Catalog / OS / Actions | RES-UC-105; UAT P43; P44+ |
| `scripts/deploy_market_research_p43_vps.sh` | ops-web only |
| `scripts/smoke_market_research_p43*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — Util boolean (TDD)

- [ ] Add `reportVersionHasStaleInsights(findings, recs, insights, ref?)` → boolean
- [ ] Spec: stale true/false; empty insights → false

**Verify:** `npx vitest@2 run src/lib/report-stale.util.spec.ts`

### Task 2 — Version meta badge

- [ ] Badge trên dòng `v{N}` khi `reportVersionHasStaleInsights === true`
- [ ] `data-testid="staff-report-version-stale-badge"`
- [ ] Copy list-level (không trùng verbatim `INSIGHT_STALE_BANNER` P22)

**Verify:** grep `staff-report-version-stale-badge`

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-105 catalog + OS §P43
- [ ] Actions §P43 UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed 2 version — stale + fresh | Snapshot insight stale |
| 2 | Lead | Tab Báo cáo | Dòng `v` stale có badge; fresh không |
| 3 | Lead | Scroll version stale | P42 `staff-report-stale-list` vẫn hiện |
| 4 | AN | Đổi valid_to + F5 | Badge meta + detail banners mất |
| 5 | CL | Portal list P41 | Không regress |
| 6 | QA | Prod deploy P43 | ops-web only; flags off |

- [ ] `deploy_market_research_p43_vps.sh` — clone P42
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p43.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p43_vps.sh
```

**Services:** ops-web only.

---

## 8. UAT gates (hướng 1)

- [ ] ops-web vitest P43 pass
- [ ] Smoke P43 m1–m5
- [ ] Staging UAT Actions §P43
- [ ] Prod: flags unchanged
- [ ] P42 detail banners không regress

---

## 9. Out of scope (P44+)

- API annotate staff reports (hướng 2)
- Bake `has_stale` vào snapshot
- Ẩn stale version khỏi list
- pgvector/RAG prod enable (hướng 3)
- portal-web changes
- MOE / conjoint mở rộng

---

## 10. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Badge + P42 banners trùng ý | Meta = scan nhanh; detail = finding-level; UAT #3 |
| Tab mở lâu stale mới | Giống P42; UAT #4 F5; hướng 2 nếu PO cần live API |
| GTM WIP lẫn commit | Stage chỉ file P43 |

---

## 11. Self-review

| Requirement | Task |
|-------------|------|
| Parity P41 list trên staff channel | Task 1–2 |
| Reuse P42 stale logic | Task 1 |
| ops-web-only deploy | Task 3 |
| Prod flags off | §2 |

**Next step:** PO khóa **hướng 1** → `code P43 theo hướng 1` → branch `feat/market-research-os-p43`.
