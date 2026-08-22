# Market Research OS P29 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF export (staff + portal) in thêm footer cảnh báo trên **mọi trang** khi báo cáo tham chiếu ≥1 insight stale theo `valid_to` live — đóng kênh compliance offline sau P18–P27 (RES-UC-089).

**Architecture:** Tái dùng P24 `collectReportInsightIds` + P18 `isInsightStale`. Staff export tra `valid_to` theo `project_id`; portal PDF dùng cùng lookup `listPublishedInsightValidTo` như `getReport`. `buildResearchReportPdf` nhận thêm `footerLine?` — render cố định đáy trang, **không** mutate `content_snapshot`. DOCX export không đổi.

**Tech Stack:** `market-research-pdf.util.ts`, `portal-report-stale.util.ts`, staff/portal export services, Jest, bash deploy/smoke, api-only deploy.

**Hướng đề xuất:** **1** — PDF stale footer. IVFFlat / bake snapshot = P30+.

---

## 1. Ba hướng P29

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **PDF stale footer** | **RES-UC-089** | **M (~2 ngày)** | **Đề xuất** — compliance offline; không ảnh hưởng RAG/search |
| 2 | IVFFlat/HNSW index trên `embedding_vec` | — | L | Cần pgvector cài + corpus backfill (P26/P28 staging); tuning riêng |
| 3 | Bake `valid_to` vào `content_snapshot` lúc publish | — | M | Snapshot đóng băng; footer runtime vẫn cần cho export cũ |

**Khuyến nghị PO:** chọn **hướng 1** — đã defer từ P27/P28, stack stale đã đủ (P18/P19/P22/P24/P25/P27).

---

## 2. Global constraints

- **No new DDL** · **No new endpoints**
- **No** ops-web / portal-web UI (footer chỉ trong file PDF)
- **No** mutate `content_snapshot` · **No** đổi DOCX export
- **No** ẩn finding/rec stale trong PDF body — chỉ footer cảnh báo
- Stale rule: FR-INS-07 — `valid_to` set và **strictly before** today UTC (`insight-stale.util.ts`)
- Portal: insight thiếu / unpublished / khác tenant → **không** coi stale (giống P24)
- Staff: lookup theo `project_id` đã scope — mọi insight trong project có trong snapshot
- Branch: `feat/market-research-os-p29` from `main` (`7b5ef026`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy mặc định: flags RAG/pgvector **không** đổi

---

## 3. Hành vi chi tiết (RES-UC-089)

### 3.1 Khi nào có footer?

```ts
reportSnapshotHasStaleInsights(snapshot, validToById, ref?) → boolean
```

| Điều kiện | Footer |
|-----------|--------|
| 0 insight_id trong findings/recs/insight_ids | Không |
| Mọi id: không có trong map hoặc `valid_to` null/today+ | Không |
| ≥1 id: `isInsightStale(valid_to) === true` | **Có** — mọi trang PDF |

**Call sites (chỉ `format=pdf` / portal PDF):**

| Export | Service method | Lookup |
|--------|----------------|--------|
| Staff | `MarketResearchService.exportReportVersion(..., 'pdf')` | `repo.listInsightValidToForProject(project.id, ids)` |
| Portal | `PortalResearchService.exportReportPdf` | `repo.listPublishedInsightValidTo(client_id, ids)` (P24) |

### 3.2 Copy footer (rút gọn, ≤90 ký tự/dòng wrap)

```ts
// services/ptt-crm-api/src/market-research/report-pdf-stale.util.ts
export const REPORT_PDF_STALE_FOOTER_STAFF =
  'Cảnh báo: báo cáo có insight hết hạn (valid_to). Xem lại trước khi gửi khách.';

export const REPORT_PDF_STALE_FOOTER_PORTAL =
  'Một số nội dung có thể đã lỗi thời. Liên hệ account manager để được cập nhật.';
```

*(Cùng ý với `INSIGHT_STALE_BANNER` / `PORTAL_INSIGHT_STALE_BANNER` — không import từ ops-web/portal-web.)*

### 3.3 PDF renderer

```ts
export function buildResearchReportPdf(
  sections: ResearchDocxSection[],
  watermark?: string,
  footerLine?: string,  // P29 — mọi trang khi set
): Buffer
```

- Footer: font 9pt, `y=24`, full width wrap ≤90 chars (reuse `wrapLine`)
- Watermark vẫn ở đầu trang (P portal) — footer độc lập ở đáy
- Không footer → hành vi P0 giữ nguyên (regression tests)

### 3.4 Staff repo (mới)

```ts
// market-research.repository.ts
async listInsightValidToForProject(
  projectId: number,
  insightIds: number[],
): Promise<Map<number, string | null>>
```

SQL:

```sql
SELECT i.id, i.valid_to::text AS valid_to
FROM crm_research_insights i
WHERE i.project_id = $1 AND i.id = ANY($2::int[])
```

Empty ids → empty Map (no SQL).

---

## 4. File map

| File | Role |
|------|------|
| `report-pdf-stale.util.ts` | **Create** — constants, `reportSnapshotHasStaleInsights` |
| `report-pdf-stale.util.spec.ts` | **Create** — P29 stale detection unit tests |
| `market-research-pdf.util.ts` | **Modify** — `footerLine?`, render bottom every page |
| `market-research-pdf.util.spec.ts` | **Modify** — P29 footer embedded / absent |
| `market-research.repository.ts` | **Modify** — `listInsightValidToForProject` |
| `market-research.repository.spec.ts` | **Modify** — SQL shape test |
| `market-research.service.ts` | **Modify** — staff PDF path stale gate + footer |
| `market-research.service.spec.ts` | **Modify** — P29 staff PDF with/without stale |
| `portal-research.service.ts` | **Modify** — portal PDF stale gate + footer |
| `portal-research.service.spec.ts` | **Modify** — P29 portal PDF footer when stale finding |
| `scripts/deploy_market_research_p29_vps.sh` | **Create** — P0–P23 DDL + api (clone P28 minus pgvector staging) |
| `scripts/smoke_market_research_p29*.sh` | **Create** — m1–m5 |
| Catalog / OS / Actions | RES-UC-089; UAT P29; backlog P30+ |

**Unchanged:** RAG ranking (P27), pgvector gate (P28), DOCX export, portal JSON `getReport`, ops-web, portal-web.

---

## 5. Tasks (subagent-ready)

### Task 1 — Stale detection util (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/report-pdf-stale.util.ts`
- Create: `services/ptt-crm-api/src/market-research/report-pdf-stale.util.spec.ts`

**Interfaces:**
- Consumes: `collectReportInsightIds` from `portal-report-stale.util.ts`, `isInsightStale` from `insight-stale.util.ts`
- Produces: `reportSnapshotHasStaleInsights(...)`, `REPORT_PDF_STALE_FOOTER_STAFF`, `REPORT_PDF_STALE_FOOTER_PORTAL`

- [ ] **Step 1: Write failing tests**

```ts
import { reportSnapshotHasStaleInsights } from './report-pdf-stale.util';

it('P29 false when no insight ids', () => {
  expect(reportSnapshotHasStaleInsights({ findings: [], recs: [] }, new Map())).toBe(false);
});

it('P29 true when any linked insight is stale', () => {
  const map = new Map([[11, '2020-01-01']]);
  expect(
    reportSnapshotHasStaleInsights(
      { findings: [{ insight_id: 11, text: 'x' }], recs: [] },
      map,
      new Date('2026-08-16T12:00:00Z'),
    ),
  ).toBe(true);
});

it('P29 false when id missing from map (portal unpublished rule)', () => {
  expect(
    reportSnapshotHasStaleInsights(
      { findings: [{ insight_id: 99, text: 'x' }], recs: [] },
      new Map(),
    ),
  ).toBe(false);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/market-research/report-pdf-stale.util.spec.ts -v`

- [ ] **Step 3: Implement util + constants**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** `feat(research): P29 report PDF stale detection util`

---

### Task 2 — PDF footer renderer (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research-pdf.util.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research-pdf.util.spec.ts`

**Interfaces:**
- Produces: `buildResearchReportPdf(sections, watermark?, footerLine?)`

- [ ] **Step 1: Red — footer on every page**

```ts
it('P29 embeds footerLine on each page when set', () => {
  const footer = 'Cảnh báo: báo cáo có insight hết hạn (valid_to).';
  const sections = [
    { title: 'A', lines: Array.from({ length: 50 }, (_, i) => `line ${i}`) },
    { title: 'B', lines: ['tail'] },
  ];
  const buffer = buildResearchReportPdf(sections, undefined, footer);
  const decoded = decodePdfUtf16Be(buffer);
  const count = decoded.split(footer).length - 1;
  expect(count).toBeGreaterThanOrEqual(2); // multi-page
});

it('P29 no footer when footerLine omitted', () => {
  const buffer = buildResearchReportPdf([{ title: 'Cover', lines: ['x'] }]);
  expect(decodePdfUtf16Be(buffer)).not.toContain('Cảnh báo:');
});
```

- [ ] **Step 2: Green — extend `buildPageStream` with optional footer at y=24**

- [ ] **Step 3: Run** `npx jest src/market-research/market-research-pdf.util.spec.ts -v`

- [ ] **Step 4: Commit** `feat(research): P29 PDF per-page stale footer line`

---

### Task 3 — Staff export + repository

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.ts` (~L2937)
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.spec.ts`

**Interfaces:**
- Consumes: Task 1–2 outputs
- Produces: staff PDF calls `buildResearchReportPdf(sections, undefined, footer?)`

- [ ] **Step 1: Repository test** — `listInsightValidToForProject` filters `project_id`

- [ ] **Step 2: Service test P29**

```ts
it('P29 exportReportVersion pdf adds stale footer when finding insight expired', async () => {
  // snapshot findings [{ insight_id: 11 }]
  // repo.listInsightValidToForProject → Map([[11, '2020-01-01']])
  // spy buildResearchReportPdf — expect 3rd arg REPORT_PDF_STALE_FOOTER_STAFF
});

it('P29 exportReportVersion pdf no footer when all insights fresh', async () => {
  // valid_to null or future — footerLine undefined
});
```

- [ ] **Step 3: Wire export path** (chỉ `format === 'pdf'`)

```ts
if (format === 'pdf') {
  const ids = collectReportInsightIds(snapshot);
  const validToById = await this.repo.listInsightValidToForProject(project.id, ids);
  const footer = reportSnapshotHasStaleInsights(snapshot, validToById)
    ? REPORT_PDF_STALE_FOOTER_STAFF
    : undefined;
  const buffer = buildResearchReportPdf(sections, undefined, footer);
  // ...
}
```

- [ ] **Step 4: Run** `npx jest ... --testNamePattern='P29|exportReportVersion.*pdf' -v`

- [ ] **Step 5: Commit** `feat(research): P29 staff PDF stale footer on export`

---

### Task 4 — Portal PDF export

**Files:**
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.ts` (~L222)
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts`

- [ ] **Step 1: Red — portal PDF with stale published insight**

```ts
it('P29 exportReportPdf embeds portal stale footer when finding stale', async () => {
  repo.listPublishedInsightValidTo.mockResolvedValue(new Map([[11, '2020-01-01']]));
  // acmeVersion snapshot with findings insight_id 11
  const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
  await service.exportReportPdf(acmeUser, 42);
  expect(spy).toHaveBeenCalledWith(
    expect.anything(),
    expect.stringContaining('CONFIDENTIAL'),
    REPORT_PDF_STALE_FOOTER_PORTAL,
  );
});
```

- [ ] **Step 2: Green — mirror getReport lookup before buildResearchReportPdf**

- [ ] **Step 3: Regression** — M2-1a watermark still present; no footer when fresh

- [ ] **Step 4: Commit** `feat(research): P29 portal PDF stale footer on export`

---

### Task 5 — Deploy + smoke + docs

**Files:**
- Create: `scripts/deploy_market_research_p29_vps.sh`
- Create: `scripts/smoke_market_research_p29.sh`, `smoke_market_research_p29_m1.sh` … `m5.sh`
- Modify: `docs/specs/modules/RNOSAI-BA-RES-UseCases.md`
- Modify: `docs/use-cases/12-MARKET-RESEARCH-OS.md`
- Modify: `docs/use-cases/actions/12-RES-ACTIONS.md` — replace `P29+` backlog section

**Smoke outline:**

| Script | Checks |
|--------|--------|
| m1 | `report-pdf-stale.util.spec.ts` P29 |
| m2 | `market-research-pdf.util.spec.ts` P29 footer |
| m3 | service specs P29 staff + portal |
| m4 | docs RES-UC-089 + deploy script exists |
| m5 | full `market-research\|portal-research` jest |

**Deploy:** clone P28 — api-only, flags untouched, no P29 DDL.

```bash
APPLY=1 ./scripts/deploy_market_research_p29_vps.sh
bash scripts/smoke_market_research_p29.sh
```

- [ ] **Commit** `docs(research): P29 RES-UC-089 catalog + deploy smoke`

---

## 6. Walkthrough UAT P29 (≈8 phút)

**Tiền đề:** staging có report version với finding `insight_id` trỏ insight `valid_to` quá khứ; 1 report chỉ insight còn hiệu lực.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff export PDF report có insight stale | Mọi trang có footer staff; `%PDF-` OK |
| 2 | AN | Staff export PDF report không stale | Không footer; body giống trước P29 |
| 3 | AN | Staff export DOCX cùng report stale | Không footer (DOCX unchanged) |
| 4 | CL | Portal download PDF report stale (published) | Footer portal + watermark CONFIDENTIAL |
| 5 | CL | Portal download PDF report fresh | Không footer |
| 6 | QA | `GET portal/research/reports/:id` JSON | Không đổi (P24 banner UI tách) |
| 7 | QA | Prod deploy P29 | RAG/pgvector flags không đổi |

---

## 7. Out of scope (P30+)

- IVFFlat/HNSW trên `embedding_vec`
- Drop JSONB `embedding` column
- Bake `valid_to` vào snapshot at publish
- Prod enable RAG / pgvector / OpenAI embed
- Live Talkwalker HTTP, conjoint simulator
- Inline stale markers trong PDF body (chỉ footer)

---

## 8. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| Footer che nội dung cuối trang | Footer cố định y=24; body vẫn LINES_PER_PAGE=48 — UAT in thử |
| Staff export draft insight chưa publish | Lookup theo project_id — vẫn cảnh báo valid_to (đúng compliance nội bộ) |
| Portal insight unpublished trong snapshot | P24 rule — không footer (map miss → not stale) |
| Copy dài wrap xấu | ≤90 chars + `wrapLine`; UAT tiếng Việt |
| Regression PDF không watermark portal | Test M2-1a + P29 footer cùng lúc (args 2+3) |

---

**Next step:** PO chốt hướng **1** → `code P29 theo hướng 1` → branch `feat/market-research-os-p29` → Task 1 TDD.
