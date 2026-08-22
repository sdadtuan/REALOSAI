# Market Research OS P34 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Analyst chọn gói giả định trên tab Conjoint → API đếm `n_match / n_choices` trong mẫu P21 — what-if lite, **không** MOE / logit / persist (RES-UC-095).

**Architecture:** Util `simulateConjointWhatIf(choices, scenario)` lọc AND theo level. `POST /projects/:id/conjoint/what-if` (cap `view`) tái dùng evidence `C-` như `createConjoint`, **không** `insertCjSummary` / `createInsight`. ops-web form select theo `summary.attributes`.

**Tech Stack:** NestJS, Jest, ops-web vitest, bash deploy/smoke. Không DDL, không portal.

**Hướng đã khóa:** **1** — conjoint what-if lite. IVFFlat / live Talkwalker = P35+.

---

## 1. Ba hướng P34

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Conjoint what-if lite (staff)** | **RES-UC-095** | **M** | **Đã khóa** |
| 2 | IVFFlat trên `embedding_vec` | — | L | VPS chưa pgvector |
| 3 | Live Talkwalker HTTP | — | L | Scorecard chưa chấm |

---

## 2. Global constraints

- **No new DDL** · **No portal-web** · **No persist** what-if
- **Cấm** `createInsight` · **cấm** MOE / «95% confidence» / part-worth / logit
- `statistical_inference: false` cứng
- Chỉ `PRICE_OFFER` (400 `cj_not_price_offer`)
- Scenario rỗng → `cj_whatif_empty`; attr không có trong mẫu → `cj_whatif_unknown_attribute`; 0 choice → `cj_whatif_no_choices`
- Partial scenario = AND trên attr đã chọn
- Level lạ → `n_match=0` (không 400)
- Deploy: flags RAG / pgvector / Talkwalker **không** đổi
- Branch: `feat/market-research-os-p34` from `main` (`f792492e`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: DDL P0–P23 + api (heap 2048) + ops-web

---

## 3. Hành vi (RES-UC-095)

### 3.1 Util

```ts
export const CJ_WHATIF_LIMITATION =
  'What-if conjoint lite — đếm lựa chọn trong mẫu khớp gói giả định. Không mô hình hoá tương tác. Không market share. Không suy diễn thống kê.';

export function simulateConjointWhatIf(
  choices: CjChoice[],
  scenario: Record<string, string>,
): CjWhatIfResult {
  if (!Array.isArray(choices) || choices.length === 0) coded('cj_whatif_no_choices');
  const pairs = Object.entries(scenario ?? {}).filter(
    ([k, v]) => k.trim() !== '' && String(v).trim() !== '',
  );
  if (pairs.length === 0) coded('cj_whatif_empty');
  const known = new Set(choices.flatMap((c) => Object.keys(c.attributes)));
  for (const [attr] of pairs) {
    if (!known.has(attr)) coded('cj_whatif_unknown_attribute');
  }
  const n_choices = choices.length;
  const n_match = choices.filter((c) =>
    pairs.every(([attr, level]) => c.attributes[attr] === String(level).trim()),
  ).length;
  return {
    n_match,
    n_choices,
    match_pct: (100 * n_match) / n_choices,
    scenario: Object.fromEntries(pairs.map(([k, v]) => [k, String(v).trim()])),
    limitation_note: CJ_WHATIF_LIMITATION,
    statistical_inference: false,
  };
}
```

Fixture P21: `{ price: '99k', pack_size: '500ml' }` → `n_match=2`, `n_choices=8`, `match_pct=25`.

### 3.2 API

`POST /api/v1/research/projects/:id/conjoint/what-if`  
Guards: staff + `view`  
Body: `{ study_id?: number, scenario: Record<string, string> }`  
200 `{ n_match, n_choices, match_pct, scenario, limitation_note, statistical_inference: false }`

### 3.3 Staff UI

Form `data-testid="cj-whatif-form"` khi có `summary.attributes`. Default = recommendation levels. Nút `data-testid="cj-whatif-run"`. Kết quả `data-testid="cj-whatif-result"`: `Khớp mẫu: 2 / 8 (25%)`.

---

## 4. File map

| File | Role |
|------|------|
| `conjoint-whatif.util.ts` + `.spec.ts` | **Create** — util TDD |
| `market-research.types.ts` | **Modify** — `CjWhatIfResult`, `CJ_WHATIF_LIMITATION` |
| `market-research.service.ts` | **Modify** — `simulateConjointWhatIf` |
| `market-research.service.spec.ts` | **Modify** — P34 CAT_REVIEW / PRICE_OFFER |
| `market-research.controller.ts` | **Modify** — POST what-if |
| `ops-web market-research-api.ts` | **Modify** — client + error VI |
| `ConjointPane.tsx` + `conjoint-pane.util.ts` | **Modify** — form |
| Catalog / OS / Actions | RES-UC-095; UAT P34; backlog P35+ |
| `scripts/deploy_market_research_p34_vps.sh` | **Create** — api + ops-web |
| `scripts/smoke_market_research_p34*.sh` | **Create** — m1–m5 |

**Unchanged:** `computeConjointLite`, `CJ_LIMITATION` P21, portal, PDF/DOCX, RAG flags.

---

## 5. Tasks

### Task 1: simulateConjointWhatIf (TDD)

**Files:** Create util + spec; modify types.

- [ ] **Step 1: Failing spec** (fixture 8 choices như P21)

```ts
it('P34 matches AND scenario on fixture', () => {
  const out = simulateConjointWhatIf(FIXTURE, { price: '99k', pack_size: '500ml' });
  expect(out).toMatchObject({ n_match: 2, n_choices: 8, match_pct: 25, statistical_inference: false });
});
```

- [ ] **Step 2: Run — FAIL missing export**
- [ ] **Step 3: Implement util + types**
- [ ] **Step 4: PASS** including empty / unknown attr / no choices / partial `{ price: '89k' }` → 4/8

### Task 2: API + staff UI

- [ ] Service: PRICE_OFFER + `cjEvidenceForStudy(5)` + `{ price: '99k', pack_size: '500ml' }` → 2/8; `insertCjSummary` / `createInsight` not called; CAT_REVIEW → 400
- [ ] Controller POST `conjoint/what-if`
- [ ] ops-web client + ConjointPane form
- [ ] Error VI: `cj_whatif_empty`, `cj_whatif_unknown_attribute`, `cj_whatif_no_choices`

### Task 3: Docs + deploy + smoke

| Smoke | Check |
|-------|--------|
| m1 | `conjoint-whatif.util.spec.ts` P34 |
| m2 | service spec P34 |
| m3 | grep `conjoint/what-if` + `cj-whatif-form` |
| m4 | docs RES-UC-095 + deploy |
| m5 | api market-research + ops conjoint-pane util |

UAT P34:

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | PRICE_OFFER, đã tính lite, chọn 99k+500ml, Đếm khớp | `2 / 8 (25%)` trên fixture |
| 2 | AN | CAT_REVIEW POST what-if | 400 `cj_not_price_offer` |
| 3 | AN | Scenario rỗng | 400 `cj_whatif_empty` |
| 4 | AN | F5 | Không hàng what-if mới (không persist) |
| 5 | QA | Insights | Không insight mới |
| 6 | QA | Prod deploy | RAG/pgvector/Talkwalker flags không đổi |

---

## 6. Out of scope (P35+)

- IVFFlat/HNSW, drop JSONB, prod RAG flags
- Live Talkwalker, Brandwatch
- Portal conjoint, MOE, logit / part-worth
- Persist what-if rows

---

## 7. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Copy «market share» bị hiểu là census | Limitation + `statistical_inference: false` |
| FE nhầm what-if = persist | Không insert; UAT F5 |
| GTM WIP lẫn commit | Stage chỉ file P34 |
