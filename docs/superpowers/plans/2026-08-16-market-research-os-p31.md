# Market Research OS P31 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff DOCX export in footer cảnh báo khi báo cáo tham chiếu ≥1 insight stale (live `valid_to`) — đóng lỗ compliance offline còn lại sau P29 PDF (RES-UC-092).

**Architecture:** Tái dùng P29 `reportSnapshotHasStaleInsights` + `listInsightValidToForProject` + copy `REPORT_PDF_STALE_FOOTER_STAFF`. `buildResearchReportDocx(sections, footerLine?)` thêm OOXML `word/footer1.xml` + `w:footerReference` trên mọi trang. Portal không có DOCX. Không mutate `content_snapshot`.

**Tech Stack:** `market-research-docx.util.ts` (archiver OOXML), `report-pdf-stale.util.ts`, staff `exportReportVersion`, Jest, bash deploy/smoke, api-only deploy.

**Hướng đã khóa:** **1** — DOCX stale footer. IVFFlat / bake snapshot = P32+.

---

## 1. Ba hướng P31

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff DOCX stale footer** | **RES-UC-092** | **S–M (~1 ngày)** | **Đề xuất** — P29 UAT bước 3 còn «DOCX không footer»; cùng lookup/copy |
| 2 | IVFFlat index trên `embedding_vec` | — | L | VPS **chưa** `install_pgvector_vps.sh`; mix 64/256-d; n nhỏ |
| 3 | Bake `published_valid_to` lúc publish | — | M | Audit đóng băng; P24/P29/P31 footer **vẫn live** |

**Khuyến nghị PO:** chọn **hướng 1**.

- Stale UI/API/PDF đã kín (P18–P30). Kênh offline còn lại là **DOCX** (default export staff).
- IVFFlat premature cho đến khi sudo cài extension + P13 backfill đồng nhất 256-d.
- Bake snapshot không thay footer live — để P32+ nếu PO cần audit «lúc publish còn hạn».

---

## 2. Global constraints

- **No new DDL** · **No new endpoints**
- **No** portal-web (portal chỉ PDF — P29 đã cover)
- **No** mutate `content_snapshot`
- **No** ẩn finding/rec trong body — chỉ footer
- Stale rule: FR-INS-07 UTC (`isInsightStale`)
- Copy: **reuse** `REPORT_PDF_STALE_FOOTER_STAFF` (không nhân bản string)
- Deploy mặc định: RAG / OpenAI / pgvector **không** đổi
- Branch: `feat/market-research-os-p31` from `main` (`d10de85a`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: **api-only** (như P29)

---

## 3. Hành vi chi tiết (RES-UC-092)

### 3.1 Khi nào có footer?

Cùng `reportSnapshotHasStaleInsights(snapshot, validToById)` (P29).

| Điều kiện | DOCX footer |
|-----------|-------------|
| 0 insight_id / tất cả fresh / id miss map | Không — zip giống P0 |
| ≥1 id stale | `word/footer1.xml` chứa copy staff; mọi section |

### 3.2 OOXML

`buildResearchReportDocx(sections, footerLine?: string)`:

Khi **không** `footerLine` — giữ zip 3 file: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml` + `<w:sectPr/>` (regression P0).

Khi **có** `footerLine`:

1. `word/footer1.xml` — một `w:p` / `w:t` escaped
2. `word/_rels/document.xml.rels` — `rIdFtr` → `footer1.xml` type `footer`
3. `[Content_Types].xml` — Override `/word/footer1.xml`
4. `document.xml` `w:sectPr`:

```xml
<w:sectPr>
  <w:footerReference w:type="default" r:id="rIdFtr"/>
</w:sectPr>
```

`w:document` thêm `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`.

### 3.3 Staff export — gộp lookup PDF + DOCX

```ts
const ids = collectReportInsightIds(snapshot);
const validToById = await this.repo.listInsightValidToForProject(project.id, ids);
const footer = reportSnapshotHasStaleInsights(snapshot, validToById)
  ? REPORT_PDF_STALE_FOOTER_STAFF
  : undefined;

if (format === 'pdf') {
  const buffer = buildResearchReportPdf(sections, undefined, footer);
  // ...
}
const buffer = await buildResearchReportDocx(sections, footer);
```

**Cấm** lookup 2 lần khi PDF (refactor P29 path vào chung).

---

## 4. File map

| File | Role |
|------|------|
| `market-research-docx.util.ts` | **Modify** — `footerLine?`, footer part + rels |
| `market-research-docx.util.spec.ts` | **Modify** — P31 footer present / absent |
| `market-research.service.ts` | **Modify** — shared stale lookup for pdf + docx |
| `market-research.service.spec.ts` | **Modify** — P31 DOCX footer spy / unzip |
| `scripts/deploy_market_research_p31_vps.sh` | **Create** — clone P29 api-only + `NODE_OPTIONS=2048` |
| `scripts/smoke_market_research_p31*.sh` | **Create** — m1–m5 |
| Catalog / OS / Actions | RES-UC-092; UAT P31; backlog P32+ |

**Unchanged:** PDF renderer, portal PDF, RAG, ops-web UI, `report-pdf-stale.util.ts` logic.

---

## 5. Tasks (subagent-ready)

### Task 1 — DOCX footer renderer (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research-docx.util.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research-docx.util.spec.ts`

**Interfaces:**
- Produces: `buildResearchReportDocx(sections, footerLine?: string): Promise<Buffer>`

- [ ] **Step 1: Write failing tests** (reuse `unzipEntry` helper)

```ts
import { REPORT_PDF_STALE_FOOTER_STAFF } from './report-pdf-stale.util';

it('P31 embeds footerLine in word/footer1.xml when set', async () => {
  const buffer = await buildResearchReportDocx(
    [{ title: 'Cover', lines: ['x'] }],
    REPORT_PDF_STALE_FOOTER_STAFF,
  );
  const footer = unzipEntry(buffer, 'word/footer1.xml');
  expect(footer).toContain(REPORT_PDF_STALE_FOOTER_STAFF);
  const doc = unzipEntry(buffer, 'word/document.xml');
  expect(doc).toMatch(/footerReference/);
});

it('P31 omits footer part when footerLine omitted', async () => {
  const buffer = await buildResearchReportDocx([{ title: 'Cover', lines: ['x'] }]);
  expect(() => unzipEntry(buffer, 'word/footer1.xml')).toThrow(/zip entry missing/);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/market-research/market-research-docx.util.spec.ts --testNamePattern='P31'`

- [ ] **Step 3: Implement footer parts** (escape `footerLine` via `xmlEscape`)

```ts
export async function buildResearchReportDocx(
  sections: ResearchDocxSection[],
  footerLine?: string,
): Promise<Buffer> {
  const bodyXml = sections.map(sectionToWordXml).join('');
  const sectPr = footerLine
    ? `<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr"/></w:sectPr>`
    : `<w:sectPr/>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}${sectPr}</w:body>
</w:document>`;
  // if footerLine: append footer1.xml + document.xml.rels + Content_Types Override
}
```

- [ ] **Step 4: Run — expect PASS** (kể cả test P0 Evidence unzip)

- [ ] **Step 5: Commit** `feat(research): P31 DOCX per-section stale footer part`

---

### Task 2 — Staff export wire (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.ts` (~L2950)
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.spec.ts`

- [ ] **Step 1: Red**

```ts
it('P31 exportReportVersion docx adds stale footer when finding expired', async () => {
  // snapshot findings [{ insight_id: 11 }]
  // listInsightValidToForProject → Map([[11, '2020-01-01']])
  const spy = jest.spyOn(docxUtil, 'buildResearchReportDocx');
  await service.exportReportVersion(1, 10, scope, 'docx');
  expect(spy).toHaveBeenCalledWith(expect.anything(), REPORT_PDF_STALE_FOOTER_STAFF);
});

it('P31 exportReportVersion docx no footer when insights fresh', async () => {
  repo.listInsightValidToForProject.mockResolvedValue(new Map([[11, null]]));
  const spy = jest.spyOn(docxUtil, 'buildResearchReportDocx');
  await service.exportReportVersion(1, 10, scope, 'docx');
  expect(spy).toHaveBeenCalledWith(expect.anything(), undefined);
});
```

Import `* as docxUtil from './market-research-docx.util'` (cùng pattern P29 `pdfUtil`).

- [ ] **Step 2: Green — shared lookup trước `if (format === 'pdf')`**

- [ ] **Step 3: P29 PDF tests vẫn pass** (footer arg không đổi)

- [ ] **Step 4: Commit** `feat(research): P31 staff DOCX stale footer on export`

---

### Task 3 — Deploy + smoke + docs

**Files:**
- Create: `scripts/deploy_market_research_p31_vps.sh` — clone P29; `NODE_OPTIONS=--max-old-space-size=2048`; api-only
- Create: `scripts/smoke_market_research_p31.sh`, `m1`–`m5`
- Modify: catalog RES-UC-092; OS §P31; Actions UAT P31; backlog P32+

**Smoke:**

| Script | Checks |
|--------|--------|
| m1 | `market-research-docx.util.spec.ts` P31 |
| m2 | service spec P31 |
| m3 | grep `footerLine` / `footer1.xml` in docx util |
| m4 | docs RES-UC-092 + deploy exists |
| m5 | jest `market-research\|portal-research` |

```bash
APPLY=1 ./scripts/deploy_market_research_p31_vps.sh
```

- [ ] **Commit** `docs(research): P31 RES-UC-092 catalog + deploy smoke`

---

## 6. Walkthrough UAT P31 (≈8 phút)

**Tiền đề:** report version có finding stale; 1 report chỉ insight còn hiệu lực.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff export **DOCX** report stale | Mở Word: footer staff mọi trang |
| 2 | AN | Staff export DOCX report fresh | Không footer / không `footer1` semantics |
| 3 | AN | Staff export **PDF** cùng report stale | Footer P29 không regress |
| 4 | CL | Portal PDF stale | Footer portal P29 không đổi |
| 5 | QA | `content_snapshot` DB | Không thêm field |
| 6 | QA | Prod deploy P31 | RAG/pgvector flags không đổi |

---

## 7. Out of scope (P32+)

- IVFFlat/HNSW
- Drop JSONB `embedding`
- Bake `published_valid_to`
- Prod enable RAG / pgvector / OpenAI
- Live Talkwalker, conjoint simulator
- Portal DOCX (không có endpoint)
- Inline stale markers trong body

---

## 8. Hướng 2 / 3 sketch (không code trừ khi PO đổi)

### 8.1 IVFFlat (P32 candidate)

```sql
-- chỉ khi extension vector + mọi embedding_vec = 256-d
CREATE INDEX CONCURRENTLY crm_research_emb_vec_ivf
  ON crm_research_insight_embeddings
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 10);
```

Tiền đề: `install_pgvector_vps.sh` + P13 re-embed. Fail-soft apply nếu `CREATE EXTENSION` fail (như P20).

### 8.2 Bake snapshot (P32+ candidate)

`publishPortal` ghi `findings[].published_valid_to` / `recs[].published_valid_to`. Banner/footer **vẫn** live `valid_to`.

---

## 9. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| Word không hiện footer (thiếu rels/content-type) | Test unzip 3 parts; UAT mở file thật |
| Copy XML break (`&` trong tiếng Việt) | `xmlEscape` |
| P0 DOCX regression | Test Evidence unzip giữ nguyên khi không footer |
| GTM WIP lẫn commit | Stage chỉ file P31 |
| nest build OOM | `NODE_OPTIONS=--max-old-space-size=2048` |

---

**Next step:** PO chốt hướng **1** → `code P31 theo hướng 1` → branch `feat/market-research-os-p31` → Task 1 TDD.
