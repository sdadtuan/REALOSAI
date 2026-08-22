# Market Research OS P21 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `PRICE_OFFER` projects, Analyst imports choice-based conjoint CSV → evidence `value+unit+base`; computes a **lite** attribute-level preference table + recommended level per attribute (no market simulator, no MOE / “95% confidence”, no `createInsight`).

**Architecture:** Mirror P6 Van Westendorp. Parser CSV sync Nest → existing `createEvidence` path. Conjoint = util thuần + bảng `crm_research_cj_summaries` + `GET/POST …/conjoint` gated `product_type === 'PRICE_OFFER'` (reuse `assertPriceOffer` pattern, error `cj_not_price_offer`). Import extends `POST …/import-survey` with `format=conjoint`. ops-web tab **Conjoint** cạnh **Giá VW**.

**Tech Stack:** NestJS `services/ptt-crm-api`, Next.js `services/ops-web`, PostgreSQL, Jest, Vitest, bash smoke/deploy. **Không** thêm npm mới. **Không** portal-web.

**Hướng đã khóa:** 2 — Conjoint lite `PRICE_OFFER` (RES-UC-082). Staff RAG stale / Talkwalker / pgvector prod / IVFFlat / portal report-detail stale = out.

## Global Constraints

- Mọi BR P0–P20 vẫn binding, đặc biệt **BR-RES-02, 03, 06/08, 11, 12**
- **BR-RES-03:** cấm MOE / “95% confidence” / “sai số mẫu” trên output conjoint. `statistical_inference: false` cứng. `assertNoFakeConfidence` trên payload số.
- **BR-RES-06/08:** import / compute conjoint **không** `createInsight` / publish-portal
- **BR-RES-11:** PII trên mọi cell CSV → 400 `survey_pii_forbidden`
- Conjoint chỉ **`PRICE_OFFER`**. Khác → 400 `cj_not_price_offer`
- **Lite cap:** 2–3 thuộc tính (cột sau `task_id`); không part-worth regression; không what-if simulator
- CSV only, ≤ 2 MB, ≤ 500 dòng data (reuse codebook caps). **Không** `xlsx`
- Deploy rebuilds **api + ops-web** (not portal-web). **Không** bật RAG / pgvector / Qualtrics flags
- Branch: `feat/market-research-os-p21` from `main` (`57669f98`+)
- Commit chỉ khi user yêu cầu

---

## 0. Milestone map (P21 = M1–M5)

| M | User outcome | UC | Ước lượng |
|---|--------------|-----|-----------|
| **M1** | Util `computeConjointLite` + TDD + shared types | 082 | 1 ngày |
| **M2** | DDL + repo + `GET/POST …/conjoint` | 082 | 1 ngày |
| **M3** | Import `format=conjoint` + service wiring | 082 | 0.5 ngày |
| **M4** | Tab **Conjoint** + `ConjointPane` (ops-web) | 082 | 0.5 ngày |
| **M5** | Catalog + UAT + smoke + deploy | — | 0.5 ngày |

**P21 sign-off = smoke P21 PASS + UAT Actions P21.**

---

## File map

| Tạo | Trách nhiệm |
|-----|-------------|
| `docs/specs/2026-08-15-postgresql-ddl-market-research-p21.sql` | `crm_research_cj_summaries` |
| `scripts/apply_pg_ddl_market_research_p21.sh` | Apply P21 DDL |
| `services/ptt-crm-api/src/market-research/conjoint-lite.util.ts` + spec | Level shares + recommendation |
| `scripts/fixtures/research-conjoint.sample.csv` | 4 respondents × 2 tasks × 2 attrs |
| `scripts/smoke_market_research_p21*.sh` | m1–m5 |
| `scripts/deploy_market_research_p21_vps.sh` | Clone P18 (api + ops-web) + P21 DDL |

| Sửa | Việc |
|-----|------|
| `survey-codebook.util.ts` + spec | `parseConjointCsv`; extend `SURVEY_IMPORT_FORMATS` |
| `market-research.types.ts` | `CjSummary`, `CJ_LIMITATION`, error codes |
| `market-research.service.ts` / `.controller.ts` / `.repository.ts` | conjoint GET/POST; import branch |
| `StudiesPane.tsx` | Import format **conjoint** |
| `page.tsx` | tab `conjoint` khi `PRICE_OFFER` |
| `ConjointPane.tsx` + util + tests | Bảng preference + recommendation |
| `market-research-api.ts` | types + fetch/create conjoint + error VI |
| Catalog / OS / Actions | RES-UC-082; UAT P21; backlog P22+ |

**Unchanged:** RAG/pgvector, portal-web, VW tab logic, Qualtrics, rankRagHits.

---

## Shared types

```typescript
export const SURVEY_IMPORT_FORMATS = ['codebook', 'vw', 'conjoint'] as const;

export const CJ_MAX_ATTRIBUTES = 3;
export const CJ_MIN_ATTRIBUTES = 2;

export type CjLevelShare = {
  label: string;
  count: number;
  share_pct: number; // 0–100, within attribute
};

export type CjAttributeSummary = {
  name: string;
  levels: CjLevelShare[];
  top_level: string | null;
};

export type CjRecommendation = {
  levels: Array<{ attribute: string; level: string; share_pct: number }>;
};

export type CjSummary = {
  n: number; // unique respondents
  n_choices: number; // valid choice rows
  attributes: CjAttributeSummary[];
  recommendation: CjRecommendation;
  limitation_note: string;
  statistical_inference: false;
};

export const CJ_LIMITATION =
  'Conjoint lite trên mẫu convenience — đếm mức được chọn theo thuộc tính, không mô hình hoá tương tác. Không market simulator. Không ghi MOE / 95% confidence.';
```

---

## Quyết định kỹ thuật (không mở lại khi code)

1. **Choice-based lite.** Mỗi dòng CSV = một lựa chọn (profile được chọn) trong một task.
2. **CSV header bắt buộc:**
   `respondent_id,task_id,<attr1>[,<attr2>[,<attr3>]]`
   Tên cột attr = tên thuộc tính (vd `price`, `pack_size`, `brand`). **2–3** cột attr; <2 → 400 `cj_too_few_attributes`; >3 → 400 `cj_too_many_attributes`.
3. **Evidence mapping** (reuse BR-RES-02):
   - `locator`: `C-{respondent_id}:task-{task_id}:{attr_name}`
   - `value_base`: `{attr_name}`
   - `unit`: chuỗi level (cell trim)
   - `value_num`: `Number(cell)` nếu finite và >0; else `1`
   - `period_note` / `geography` từ form import (giống vw)
4. **Compute input:** đọc evidence locator prefix `C-` trên study `survey` scoped (clone VW study pick: latest survey study nếu không `study_id`).
5. **Share:** với mỗi attribute, `share_pct = 100 * count(level) / n_choices` (mỗi choice góp đúng 1 level/attr).
6. **Recommendation:** level share cao nhất mỗi attribute (tie → lexicographic `label` asc — deterministic).
7. **Gates:** `n < 4` respondents → 400 `cj_insufficient_n`; `n_choices < 4` → 400 `cj_insufficient_choices`. Drop row thiếu `respondent_id`/`task_id`/attr trống; nếu sau drop không đủ → 400 tương ứng.
8. **POST body:** `{ study_id?: number | null }` — giống VW.
9. **Persist:** `INSERT crm_research_cj_summaries` (append-only như VW); GET trả bản mới nhất.
10. **Deploy:** clone P18 path + `apply_pg_ddl_market_research_p21.sh`; chain P20 fail-soft giữ nguyên.

---

## Milestone M1 — Util + types (TDD)

**Files:**
- Create: `conjoint-lite.util.ts`, `conjoint-lite.util.spec.ts`
- Modify: `market-research.types.ts`

- [ ] **Step 1: Failing tests**

Fixture 4 respondents, 2 attrs (`price`, `pack_size`), 8 choices:

```ts
const FIXTURE: CjChoice[] = [
  { respondent_id: 'R001', task_id: '1', attributes: { price: '99k', pack_size: '500ml' } },
  { respondent_id: 'R001', task_id: '2', attributes: { price: '89k', pack_size: '500ml' } },
  // ... R002–R004
];

it('M1-1: computeConjointLite returns level shares and recommendation', () => {
  const out = computeConjointLite(FIXTURE);
  expect(out.n).toBe(4);
  expect(out.n_choices).toBe(8);
  expect(out.attributes).toHaveLength(2);
  expect(out.recommendation.levels).toHaveLength(2);
  expect(out.statistical_inference).toBe(false);
  expect(out.limitation_note).toBe(CJ_LIMITATION);
});

it('M1-1b: 3 respondents → cj_insufficient_n', () => {
  expect(() => computeConjointLite(FIXTURE.slice(0, 3))).toThrow('cj_insufficient_n');
});
```

Run: `cd services/ptt-crm-api && npx jest src/market-research/conjoint-lite.util.spec.ts -v`  
Expected: FAIL

- [ ] **Step 2: Implement util**

`choicesFromCjEvidence(rows)` parse locator `^C-(.+):task-(.+):(.+)$`.  
`computeConjointLite(choices: CjChoice[])` aggregate + `assertNoFakeConfidence` on numeric JSON.

- [ ] **Step 3: Types in `market-research.types.ts`**

Export `CjSummary`, `CjAttributeSummary`, `CJ_LIMITATION`, `ResearchCjSummaryRow` (DB row shape).

Expected: PASS

---

## Milestone M2 — DDL + API

**Files:**
- Create: DDL + apply script
- Modify: `market-research.repository.ts`, `.service.ts`, `.controller.ts`, specs

- [ ] **Step 1: DDL**

```sql
CREATE TABLE IF NOT EXISTS crm_research_cj_summaries (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  study_id        BIGINT REFERENCES crm_research_studies(id) ON DELETE SET NULL,
  n               INT NOT NULL,
  n_choices       INT NOT NULL,
  attributes      JSONB NOT NULL,
  recommendation  JSONB NOT NULL,
  limitation_note TEXT NOT NULL,
  statistical_inference BOOLEAN NOT NULL DEFAULT false,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_cj_summaries_project_idx
  ON crm_research_cj_summaries (project_id, id DESC);
```

- [ ] **Step 2: Repository**

`getLatestCjSummary(projectId)`, `insertCjSummary(projectId, payload, actor)` — clone VW repo methods.

- [ ] **Step 3: Service**

`getConjoint(projectId, scope)` → `{ summary: null | row }`  
`createConjoint(projectId, scope, { study_id? }, actor)`:

1. `assertPriceOffer(project)` — on fail throw `{ error: 'cj_not_price_offer' }` (reuse private `assertPriceOffer` but map error code OR dedicated `assertPriceOfferConjoint` with `cj_not_price_offer`)
2. Load evidence, filter `C-` locators, scope study (clone VW lines 1027–1044)
3. `choicesFromCjEvidence` → `computeConjointLite`
4. `insertCjSummary`

**Decision:** Add `assertPriceOfferConjoint` throwing `cj_not_price_offer` (VW keeps `vw_not_price_offer`).

- [ ] **Step 4: Controller**

```typescript
@Get('projects/:id/conjoint')
@Post('projects/:id/conjoint')
```

Caps: GET `view`, POST `edit` (giống VW).

- [ ] **Step 5: Service specs**

- POST on `CAT_REVIEW` → 400 `cj_not_price_offer`
- PRICE_OFFER + fixture evidence → summary persisted; `createInsight` not called
- GET outside scope → 403

Run: `npx jest ...market-research.service.spec.ts --testNamePattern='conjoint|cj_' -v`

---

## Milestone M3 — Import `format=conjoint`

**Files:**
- Modify: `survey-codebook.util.ts`, `.spec.ts`, `market-research.service.ts` (import-survey branch), `StudiesPane.tsx`

- [ ] **Step 1: Parser**

`parseConjointCsv(text): CjChoice[]` — validate 2–3 attr columns, PII gate, row cap.

`draftsFromConjoint(csvText, periodNote, geography)` → `CodebookEvidenceDraft[]`.

- [ ] **Step 2: Import branch**

In `importSurvey`, when `format === 'conjoint'`:

- Parse → drafts → `persistSurveyImport` (existing)
- **Không** auto-compute conjoint (Analyst bấm nút riêng — giống VW)

- [ ] **Step 3: Locator gate**

Extend `isSurveyEvidenceLocator`:

```typescript
return /^Q-\S+$/.test(s) || /^R-[^:]+:[a-z_]+$/.test(s) || /^C-[^:]+:task-[^:]+:.+$/.test(s);
```

- [ ] **Step 4: Fixture**

`scripts/fixtures/research-conjoint.sample.csv`:

```csv
respondent_id,task_id,price,pack_size
R001,1,99k,500ml
R001,2,89k,500ml
R002,1,99k,1L
...
```

- [ ] **Step 5: Studies UI**

Import dropdown thêm **Conjoint (CSV)** khi `PRICE_OFFER`; ẩn trên product type khác.

---

## Milestone M4 — ops-web Conjoint tab

**Files:**
- Create: `ConjointPane.tsx`, `conjoint-pane.util.ts`, tests
- Modify: `page.tsx`, `market-research-api.ts`

- [ ] **Step 1: API client**

```typescript
export async function fetchResearchConjoint(token, projectId)
export async function createResearchConjoint(token, projectId, body?)
export type ResearchCjSummaryRow = { n, n_choices, attributes, recommendation, limitation_note }
```

Error VI map:

```typescript
cj_not_price_offer: 'Conjoint lite chỉ dùng cho dự án PRICE_OFFER.',
cj_insufficient_n: 'Cần ≥4 người trả lời hợp lệ.',
cj_insufficient_choices: 'Cần ≥4 lựa chọn hợp lệ.',
cj_too_many_attributes: 'Conjoint lite tối đa 3 thuộc tính.',
cj_too_few_attributes: 'Conjoint lite cần ít nhất 2 thuộc tính.',
```

- [ ] **Step 2: `shouldShowConjointTab(productType)`**

`productType === 'PRICE_OFFER'` (mirror `shouldShowVwTab`).

- [ ] **Step 3: `ConjointPane`**

Banner:

```typescript
export const CJ_TAB_BANNER =
  'Conjoint lite — đếm mức được chọn theo thuộc tính. Không market simulator. Không suy MOE.';
```

UI:
- Nút **Tính conjoint lite** (cap edit)
- Bảng từng attribute: Level | Count | Share %
- Khối **Gợi ý gói** từ `recommendation.levels`
- `limitation_note` footer
- Empty state: «Chưa có bảng conjoint.»

- [ ] **Step 4: Project page tabs**

```typescript
...(shouldShowConjointTab(project.product_type) ? ([{ id: 'conjoint', label: 'Conjoint' }] as const) : []),
```

Render `<ConjointPane />` when `tab === 'conjoint'`.

Vitest: banner copy + tab gate.

---

## Milestone M5 — Docs + smoke + deploy

- [ ] **Step 1: RES-UC-082 catalog**

| RES-UC-082 | Conjoint lite PRICE_OFFER | P21 | P21 | Spec ready | BR-RES-03 · Design PRICE_OFFER |

### RES-UC-082 — Conjoint lite PRICE_OFFER

- `GET /api/v1/research/projects/:id/conjoint` cap `view` → `{ summary }`
- `POST /api/v1/research/projects/:id/conjoint` body `{ study_id? }` cap `edit`
- `POST …/import-survey` `format=conjoint` → evidence `C-…` locators
- Không `PRICE_OFFER` → 400 `cj_not_price_offer`; n < 4 → `cj_insufficient_n`; n_choices < 4 → `cj_insufficient_choices`
- Bảng level share + recommendation; **cấm** MOE / simulator / `createInsight`
- Fixture: `scripts/fixtures/research-conjoint.sample.csv`

- [ ] **Step 2: OS doc**

```markdown
## P21 — RES-UC-082

| UC | Tóm tắt |
|----|---------|
| 082 | Conjoint lite: import CSV choice → bảng share theo thuộc tính + gợi ý gói. |

**Gates:** api + ops-web + DDL P21; không portal; không RAG flags.
```

- [ ] **Step 3: UAT P21**

Replace `## P20+ (backlog — conjoint / Talkwalker / staff RAG stale)` with P21 UAT + `## P21+ (backlog — Talkwalker / staff RAG stale / pgvector prod)`.

**Walkthrough UAT P21 — Conjoint lite (≈10 phút)**

**Mục tiêu:** *«Analyst import conjoint CSV → evidence; PRICE_OFFER tính bảng share + gợi ý; không insight; F5 còn.»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Project `PRICE_OFFER` → Studies → import conjoint fixture | Study + evidence `C-…`; không insight mới |
| 2 | AN | Tab **Conjoint** → **Tính conjoint lite** | Bảng 2–3 attr; share %; gợi ý gói |
| 3 | AN | F5 | Summary còn |
| 4 | AN | Project `CAT_REVIEW` → POST conjoint | 400 `cj_not_price_offer` |
| 5 | AN | <4 respondents | 400 `cj_insufficient_n` |
| 6 | QA | Prod sau deploy | Không đổi RAG/pgvector flags |

- [ ] **Step 4: Smoke scripts**

`scripts/smoke_market_research_p21.sh` loops m1–m5.

| Script | Gate |
|--------|------|
| `p21_m1.sh` | `npx jest conjoint-lite.util.spec.ts` |
| `p21_m2.sh` | `npx jest ...service.spec.ts --testNamePattern='cj_|conjoint'` |
| `p21_m3.sh` | grep `format=conjoint` / `parseConjointCsv`; grep `crm_research_cj_summaries` in DDL |
| `p21_m4.sh` | grep `ConjointPane`, `RES-UC-082`, `Walkthrough UAT P21`; `test -f deploy_market_research_p21_vps.sh` |
| `p21_m5.sh` | `npm test -- --testPathPattern='market-research' --passWithNoTests --no-coverage` + ops-web vitest conjoint util |

- [ ] **Step 5: Deploy script**

Clone `scripts/deploy_market_research_p18_vps.sh` → `deploy_market_research_p21_vps.sh`:

- Header: P21 — P0–P20 stack + conjoint lite
- Path: 1/3 DDL (P0–P7 + P10 + P11 + P13 + **P20 fail-soft** + **P21**) → 2/3 api → 3/3 **ops-web**
- Do **not** rebuild portal-web
- Echo `UAT: bash scripts/smoke_market_research_p21.sh`

`chmod +x` all new scripts.

---

## Milestone M6 — Verification

- [ ] `bash scripts/smoke_market_research_p21.sh` — m1–m5 pass
- [ ] Confirm VW tab + RAG unchanged
- [ ] Confirm no portal-web diff

---

## Out of scope (P22+)

Staff RAG stale banner (RES-UC-082 draft cũ → đổi số UC hoặc 083), Talkwalker bake-off, portal report-detail stale, filter «Chỉ hết hạn» portal, pgvector prod enable / IVFFlat / install pgvector VPS, conjoint đầy đủ / market simulator / MOE calculator, logit/MNL part-worth.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| Design PRICE_OFFER conjoint lite | M1–M4 |
| BR-RES-03 no fake confidence | M1 assertNoFakeConfidence |
| BR-RES-06/08 no insight | M2–M3 specs |
| Mirror VW architecture | DDL + GET/POST + tab |
| CSV import reuse P6 | M3 |
| Deploy api + ops-web | M5 deploy |

No placeholders. Stable error codes: `cj_not_price_offer`, `cj_insufficient_n`, `cj_insufficient_choices`, `cj_too_many_attributes`, `cj_too_few_attributes`.
