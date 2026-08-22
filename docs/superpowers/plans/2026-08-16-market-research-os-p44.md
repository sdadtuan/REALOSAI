# Market Research OS P44 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff `GET …/reports` trả `has_stale_insights` live trên mỗi version — JSON contract parity portal P41, giảm lệch khi tab mở lâu / refetch reports (RES-UC-106).

**Architecture:** Mở rộng `listReports` (staff) — batch `collectReportInsightIds` + `listInsightValidToForProject` + `reportSnapshotHasStaleInsights` per version. ops-web P43 badge ưu tiên field API; client join P42 util làm fallback khi thiếu field. **Không** DDL · **không** endpoint mới.

**Tech Stack:** NestJS market-research, Jest; ops-web vitest; bash deploy/smoke. Deploy **api + ops-web**.

**Hướng đề xuất:** **1** — staff reports API stale flag. Version filter checkbox = hướng 2.

---

## 1. Ba hướng P44

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff reports API `has_stale_insights`** | **RES-UC-106** | **S–M** | **Đề xuất** — deferred P42/P43 hướng 2; api + ops-web |
| 2 | Staff tab Báo cáo filter «Chỉ version hết hạn» | RES-UC-107 | S | Client-side; ops-web only; không API |
| 3 | pgvector / RAG prod enable | — | L | Blocked PO/sudo; không code slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **No DDL** · **No new endpoints** — mở rộng response `GET /api/v1/research/projects/:id/reports`
- Stale rule giống P29/P42/P43: UTC calendar; scope = insight thuộc **project** (`listInsightValidToForProject`)
- **`has_stale_insights`** = live tại GET (không bake snapshot)
- Insight id không trong map → `false` (giống export PDF staff)
- **Cấm** ẩn version · **cấm** leak thêm PII · **cấm** đổi `content_snapshot` shape
- P42 detail banners · P43 meta badge **giữ** — ops-web đọc API field trước
- Không portal-web · flags prod không đổi
- Branch: `feat/market-research-os-p44` from `main` @ P43 (`d3dd3d27`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **api + ops-web**

---

## 3. Hành vi — RES-UC-106 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P44 |
|-------|----------|-------------|
| P29 | `reportSnapshotHasStaleInsights`, `listInsightValidToForProject` | Export PDF đã dùng |
| P41 | Portal list `has_stale_insights` | Pattern parity |
| P42–P43 | Staff UI badges (client join) | Refactor đọc API |

### 3.2 API — `GET /research/projects/:id/reports`

Mỗi object trong `reports[].versions[]` thêm:

```ts
has_stale_insights: boolean;
```

**Thuật toán (`listReports` service):**

1. Load rows từ repo (giữ nguyên)
2. Thu thập tất cả `insight_id` từ mọi version snapshot → `Set<number>`
3. **Một** query `listInsightValidToForProject(projectId, ids[])` → `Map`
4. Với mỗi version: `has_stale_insights = reportSnapshotHasStaleInsights(content_snapshot, validToById, now)`

| Snapshot | `has_stale_insights` |
|----------|----------------------|
| Không insight_id | `false` |
| id không trong map | `false` |
| ≥1 insight stale | `true` |
| Chỉ fresh / null valid_to | `false` |

**Performance:** batch 1 query; empty ids → skip SQL (repo đã có).

### 3.3 ops-web

Helper `staffReportVersionHasStaleInsights(version, insights)`:

```ts
return version.has_stale_insights ?? reportVersionHasStaleInsights(...); // P42 fallback
```

P43 `StaffReportVersionStaleBadge` + P42 list dùng helper — backward compat staging cũ.

Type `ResearchReportVersion` (`market-research-api.ts`) thêm `has_stale_insights?: boolean`.

### 3.4 Unchanged

- Portal P41/P24
- PDF/DOCX export paths (đã có stale gate riêng)
- `publishPortal` / bake P32
- RAG re-embed P40

---

## 4. Hành vi sketch — hướng 2 (P45+, không code P44 mặc định)

| | |
|--|--|
| Scope | Tab Báo cáo — checkbox «Chỉ version có nội dung hết hạn (N)» |
| Cách | Filter client-side trên `reportVersionHasStaleInsights` |
| Deploy | ops-web only |
| Không gộp | API field |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `market-research.types.ts` | `ResearchReportVersionRow.has_stale_insights` |
| `market-research.service.ts` | `listReports` batch stale compute |
| `market-research.service.spec.ts` | P44: stale true/false; empty ids; no snapshot leak |
| `ops-web/.../market-research-api.ts` | Type version + optional field |
| `ops-web/.../staff-report-stale.util.ts` | API-first helper (create) |
| `ops-web/.../staff-report-stale.util.spec.ts` | Prefer API vs fallback |
| `ops-web/.../page.tsx` | Wire helper thay direct client-only |
| Catalog / OS / Actions | RES-UC-106; UAT P44; P45+ |
| `scripts/deploy_market_research_p44_vps.sh` | api + ops-web |
| `scripts/smoke_market_research_p44*.sh` | m1–m5 |

---

## 6. Tasks (hướng 1)

### Task 1 — API types + service (TDD)

- [ ] Extend `ResearchReportVersionRow` với `has_stale_insights: boolean`
- [ ] `listReports`: batch collect IDs → `listInsightValidToForProject` → per-version boolean
- [ ] Spec: 2 versions stale/fresh; missing id → false; không thêm field lạ vào snapshot

**Verify:** `npx jest market-research.service.spec.ts --testNamePattern='P44|listReports'`

### Task 2 — ops-web API-first helper

- [ ] `staffReportVersionHasStaleInsights(version, findings, recs, insights)`
- [ ] P43 badge + P42 list dùng helper
- [ ] Vitest: API true wins; missing field → client fallback

**Verify:** vitest pass; grep `has_stale_insights`

### Task 3 — Docs + deploy + smoke

- [ ] RES-UC-106 catalog + OS §P44
- [ ] Actions §P44 UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Seed version stale + fresh | 2 version |
| 2 | Lead | Tab Báo cáo | Badge P43 đúng |
| 3 | AN | PATCH insight valid_to quá khứ | Refetch reports → API `has_stale_insights` true |
| 4 | Lead | F5 tab Báo cáo | Badge + P42 banners khớp API |
| 5 | CL | Portal P41 | Không regress |
| 6 | QA | Prod deploy P44 | Flags off |

- [ ] `deploy_market_research_p44_vps.sh` — api + ops-web (clone P41 pattern)
- [ ] Smoke m1–m5

**Verify:** `bash scripts/smoke_market_research_p44.sh` exit 0

---

## 7. Deploy

```bash
APPLY=1 ./scripts/deploy_market_research_p44_vps.sh
```

**Services:** api + ops-web. Không portal-web/worker.

---

## 8. Smoke sketch (hướng 1)

| Script | Verify |
|--------|--------|
| m1 | Jest P44 listReports |
| m2 | vitest staff-report-stale helper |
| m3 | grep RES-UC-106 + deploy script |
| m4 | api + ops-web test/build gate |
| m5 | aggregator |

---

## 9. UAT gates (hướng 1)

- [ ] market-research Jest P44 pass
- [ ] ops-web vitest pass
- [ ] Smoke P44 m1–m5
- [ ] Staging UAT Actions §P44
- [ ] Prod: flags unchanged
- [ ] P42/P43 UI không regress

---

## 10. Out of scope (P45+)

- Staff version filter checkbox (hướng 2)
- Bake `has_stale` vào snapshot at publish
- Ẩn stale version khỏi list
- pgvector/RAG prod enable (hướng 3)
- portal-web changes
- MOE / conjoint mở rộng

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| API vs client join lệch | Cùng `reportSnapshotHasStaleInsights`; UAT #3–4 |
| Response lớn (snapshot + flag) | Chỉ thêm 1 boolean/version |
| Staging api cũ chưa deploy | ops-web fallback P42 util |
| GTM WIP lẫn commit | Stage chỉ file P44 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Đóng gap live refetch vs client join | Task 1–2 |
| Parity portal P41 API pattern | §3.2 |
| api + ops-web deploy | Task 3 |
| Prod flags off | §2 |

**Next step:** PO khóa **hướng 1** → `code P44 theo hướng 1` → branch `feat/market-research-os-p44`.
