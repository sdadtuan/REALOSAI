# Market Research OS P30 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff RAG search (`GET /api/v1/research/insights/search`) nhận `stale_only=1` giống portal P25 — analyst xem lại insight hết hạn sau khi P27 ẩn chúng khỏi ranking mặc định (RES-UC-091).

**Architecture:** `rankRagHits` đã hỗ trợ `stale_only` (P25/P27). P30 chỉ **wire** flag vào staff `searchInsights` + controller query + ops-web checkbox clone portal. Copilot **không** nhận `stale_only` (vẫn exclude stale). Không DDL, không endpoint mới.

**Tech Stack:** `research-rag.util.ts` (`parseRagStaleOnlyFlag`), `market-research.service.ts`, `InsightsRagSearch.tsx`, Jest, bash deploy/smoke.

**Hướng đã khóa:** **1** — staff RAG «Chỉ hết hạn». IVFFlat / bake snapshot = P31+.

---

## 1. Ba hướng P30

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff RAG `stale_only=1` + checkbox ops-web** | **RES-UC-091** | **S (~1 ngày)** | **Đề xuất** — đóng lỗ P27; portal P25 đã có; `rankRagHits` sẵn |
| 2 | IVFFlat/HNSW trên `embedding_vec` | — | L | VPS **chưa** cài pgvector (sudo); mixed 64/256-d; n nhỏ — premature |
| 3 | Bake `valid_to` vào `content_snapshot` lúc publish | — | M | Xung đột P24/P29 **live** `valid_to`; chỉ hữu ích nếu PO muốn audit đóng băng |

**Khuyến nghị PO:** chọn **hướng 1**.

- P27 cố ý **không** thêm `include_stale` — staff phải dùng tab Insight «Chỉ hết hạn» (bảng, không RAG).
- Sau P27, staff RAG **không thể** tìm insight hết hạn. Portal thì có checkbox P25.
- IVFFlat chờ `bash scripts/install_pgvector_vps.sh` + backfill đồng nhất dims (P13 OpenAI 256-d).
- Bake snapshot **không** thay live footer/banner — nếu làm sau thì field audit tách (`published_valid_to`), không ghi đè live.

---

## 2. Global constraints

- **No new DDL** · **No new endpoints** (cùng `GET …/insights/search`)
- Copilot inject: **không** pass `stale_only` — vẫn exclude stale (P27)
- Portal P25: **không đổi**
- PDF footer P29 / report-detail P24: **không đổi**
- Stale rule: FR-INS-07 UTC (`isInsightStale`)
- Deploy mặc định: RAG / OpenAI / pgvector **không** bật
- Branch: `feat/market-research-os-p30` from `main` (`6c1f13b5`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: **api + ops-web** (checkbox staff); không portal-web

---

## 3. Hành vi chi tiết (RES-UC-091)

### 3.1 API

`GET /api/v1/research/insights/search?q=&stale_only=1` (cùng cap `crm_research.view`)

```ts
// market-research.service.ts searchInsights
const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
return {
  hits: rankRagHits(q, rows, {
    theme_code: themeCode,
    limit,
    queryVec: annVec,
    stale_only: staleOnly,
  }),
};
```

| Query | Kết quả |
|-------|---------|
| không `stale_only` / `0` | Top-N **chỉ** fresh (P27) |
| `stale_only=1` | Top-N **chỉ** stale (P25 semantics) |
| 0 hit stale | `{ hits: [] }` — UI copy «Không có insight hết hạn khớp tìm kiếm.» |

`SearchInsightsInput` thêm `stale_only?: string | boolean` (cùng parser portal).

Controller query type thêm `stale_only?: string`.

### 3.2 ops-web `InsightsRagSearch`

Clone portal `PortalResearchRagSearch`:

- State `staleOnly`
- Checkbox `data-testid="staff-rag-stale-only"` copy: `Chỉ hết hạn (N)`
- `searchResearchInsights(..., { stale_only: staleOnly || undefined })`
- Empty khi `staleOnly && hits.length === 0 && q.trim()`: `Không có insight hết hạn khớp tìm kiếm.`
- Banner P22 (`InsightStaleBanner`) hiện lại trên hit khi filter on (mọi hit đều stale)

**Màn hình:** `/crm/research/analytics` + project `?tab=insights` (cùng component).

### 3.3 Không làm

- `include_stale=1` (mixed fresh+stale) — YAGNI; hai mode đủ
- Copilot `stale_only`
- Đổi `rankRagHits` formula

---

## 4. File map

| File | Role |
|------|------|
| `market-research.types.ts` | `SearchInsightsInput.stale_only` |
| `market-research.controller.ts` | Query `stale_only` |
| `market-research.service.ts` | Pass `parseRagStaleOnlyFlag` → `rankRagHits` |
| `market-research.service.spec.ts` | P30 staff search stale_only / default |
| `ops-web/.../market-research-api.ts` | `stale_only` query param |
| `ops-web/.../InsightsRagSearch.tsx` | Checkbox + empty copy |
| `scripts/deploy_market_research_p30_vps.sh` | api + ops-web; flags untouched |
| `scripts/smoke_market_research_p30*.sh` | m1–m5 |
| Catalog / OS / Actions | RES-UC-091; UAT P30; backlog P31+ |

**Unchanged:** `rankRagHits` body, portal search, PDF, pgvector gate, copilot.

---

## 5. Tasks (subagent-ready)

### Task 1 — Staff API `stale_only` (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.types.ts` (`SearchInsightsInput`)
- Modify: `services/ptt-crm-api/src/market-research/market-research.controller.ts` (~L134)
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.ts` (~L1899)
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.spec.ts`

**Interfaces:**
- Consumes: `parseRagStaleOnlyFlag`, `rankRagHits(..., { stale_only })`
- Produces: staff search respects `input.stale_only`

- [ ] **Step 1: Write failing tests** (clone P27 / portal P25)

```ts
it('P30 searchInsights stale_only returns only stale hits', async () => {
  // flag RAG on; listEmbeddings returns stale + fresh
  const out = await service.searchInsights(scope, { q: 'giá', stale_only: '1' });
  expect(out.hits.every((h) => h.is_stale)).toBe(true);
  expect(out.hits.some((h) => h.insight_id === STALE_ID)).toBe(true);
});

it('P30 searchInsights default still excludes stale (P27)', async () => {
  const out = await service.searchInsights(scope, { q: 'giá' });
  expect(out.hits.every((h) => !h.is_stale)).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL** (stale_only ignored today)

Run: `cd services/ptt-crm-api && npx jest src/market-research/market-research.service.spec.ts --testNamePattern='P30'`

- [ ] **Step 3: Wire service + types + controller query**

```ts
const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
return {
  hits: rankRagHits(q, rows, {
    theme_code: themeCode,
    limit,
    queryVec: annVec,
    stale_only: staleOnly,
  }),
};
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** `feat(research): P30 staff RAG stale_only query`

---

### Task 2 — ops-web checkbox

**Files:**
- Modify: `services/ops-web/src/lib/market-research-api.ts` (`searchResearchInsights`)
- Modify: `services/ops-web/src/components/research/InsightsRagSearch.tsx`

**Interfaces:**
- Consumes: API `stale_only=1`
- Produces: checkbox + empty-state copy

- [ ] **Step 1: API client**

```ts
params: { q: string; theme_code?: string; client_id?: string; limit?: number; stale_only?: boolean }
if (params.stale_only) qs.set('stale_only', '1');
```

- [ ] **Step 2: UI** — clone portal checkbox (`staleOnly` state, recount `staleCount` from last default search **or** show `hits.length` when on). Portal pattern:

```tsx
<label data-testid="staff-rag-stale-only">
  <input type="checkbox" checked={staleOnly} onChange={...} />
  Chỉ hết hạn ({staleOnly ? hits.length : staleCount})
</label>
```

Empty: `Không có insight hết hạn khớp tìm kiếm.`

`staleCount`: optional — nếu không giữ dual-fetch, dùng `hits.length` khi on và `—` khi off, **hoặc** đơn giản `{staleOnly ? hits.length : '…'}` như portal khi đã search. Minimal: chỉ `Chỉ hết hạn` + count = `hits.length` khi `staleOnly`.

- [ ] **Step 3: Commit** `feat(research): P30 staff RAG stale-only checkbox`

---

### Task 3 — Deploy + smoke + docs

**Files:**
- Create: `scripts/deploy_market_research_p30_vps.sh` — clone P29 + **rebuild ops-web**
- Create: `scripts/smoke_market_research_p30.sh`, `m1`–`m5`
- Modify: `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` — RES-UC-091
- Modify: `docs/use-cases/12-MARKET-RESEARCH-OS.md` — § P30
- Modify: `docs/use-cases/actions/12-RES-ACTIONS.md` — UAT P30; backlog P31+

**Smoke:**

| Script | Checks |
|--------|--------|
| m1 | service spec P30 |
| m2 | grep `stale_only` in staff service + controller |
| m3 | grep checkbox `staff-rag-stale-only` + API client |
| m4 | docs RES-UC-091 + deploy exists |
| m5 | jest `market-research\|portal-research` |

**Deploy:**

```bash
APPLY=1 ./scripts/deploy_market_research_p30_vps.sh
# 1/2 DDL P0–P23 (idempotent)
# 2/3 ptt-crm-api
# 3/3 ops-web
# flags untouched
```

Dùng `NODE_OPTIONS=--max-old-space-size=2048` trên `nest build` (P29 VPS OOM).

- [ ] **Commit** `docs(research): P30 RES-UC-091 catalog + deploy smoke`

---

## 6. Walkthrough UAT P30 (≈8 phút)

**Tiền đề:** staging `RESEARCH_RAG_ENABLED=1`; corpus có ≥1 insight stale + ≥1 fresh cùng client.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff RAG search mặc định | Chỉ hit fresh; không `is_stale: true` |
| 2 | AN | Bật «Chỉ hết hạn» | Chỉ hit stale + banner P22 |
| 3 | AN | Query không khớp stale | Copy «Không có insight hết hạn…» |
| 4 | AN | Tab Insight «Chỉ hết hạn» (P18 bảng) | Không đổi |
| 5 | CL | Portal RAG `stale_only` (P25) | Không regress |
| 6 | QA | Copilot draft | `rag_hits` không chứa stale |
| 7 | QA | Prod deploy P30 | RAG/pgvector flags không đổi |

---

## 7. Out of scope (P31+)

- IVFFlat/HNSW (cần install pgvector + đồng nhất 256-d)
- Drop JSONB `embedding`
- Bake `valid_to` / `published_valid_to` vào snapshot
- Prod enable RAG / pgvector / OpenAI
- Live Talkwalker HTTP, conjoint simulator
- `include_stale=1` mixed pool
- DOCX stale footer

---

## 8. Hướng 2 / 3 sketch (không code trừ khi PO đổi)

### 8.1 IVFFlat (P31 candidate)

```sql
-- chỉ khi: extension vector + mọi embedding_vec cùng dims (256)
CREATE INDEX CONCURRENTLY crm_research_emb_vec_ivf
  ON crm_research_insight_embeddings
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 10);
```

Cấm khi còn mix 64-d local-hash. Tiền đề: P26 install + P13 re-embed. Lists ≈ `sqrt(n)`.

### 8.2 Bake snapshot (P31+ candidate)

Publish ghi `content_snapshot.findings[].published_valid_to` — **không** thay `is_stale` live. PDF/P24 vẫn live. Dùng cho audit «lúc publish còn hạn».

---

## 9. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| Staff quên tắt checkbox → chỉ thấy stale | Copy rõ «Chỉ hết hạn»; default off |
| Test P27 assume không có `stale_only` trên staff | P30 test tách; P27 test giữ default |
| Deploy OOM nest build | `NODE_OPTIONS=--max-old-space-size=2048` |
| GTM WIP lẫn commit | Stage chỉ file P30 |

---

**Next step:** PO chốt hướng **1** → `code P30 theo hướng 1` → branch `feat/market-research-os-p30` → Task 1 TDD.
