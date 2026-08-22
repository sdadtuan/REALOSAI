# Market Research OS P28 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Staging-safe pgvector ANN path — gate ANN on DB readiness (`rag_pgvector_ready`) + optional staging flag flip (`RESEARCH_RAG_PGVECTOR_ENABLED=1`) after P26 install; prod deploy stays off (RES-UC-090).

**Architecture:** P20 already implements dual-write + `listEmbeddingsByVec` / `listPublishedEmbeddingsByVec`. P26 probes DB → `rag_pgvector_ready`. P28 tightens `shouldUsePgvectorAnn` to require **flag ∧ ready ∧ queryVec**, falling back to JSONB `listEmbeddings` when flag on but extension missing. Staging deploy adds `--enable-pgvector-staging` (never default prod). UAT documents backfill via P13 re-embed + approve path for `embedding_vec`.

**Tech Stack:** `pgvector.util.ts`, staff/portal search services (P26 cache), bash install/verify/deploy, Jest, api-only deploy.

**Hướng đã khóa:** **2** — pgvector ANN staging. PDF stale footer = P29+.

---

## 1. Ba hướng P28 (đã chọn)

| # | Hướng | UC | Trạng thái |
|---|--------|-----|------------|
| 1 | PDF stale footer | RES-UC-089 | **P29+** |
| **2** | **pgvector ANN staging** | **RES-UC-090** | **Đã chọn** |
| 3 | Bake `valid_to` vào snapshot publish | — | Backlog |

---

## 2. Global constraints

- **No new DDL** · reuse P20 `embedding_vec` column
- **No** IVFFlat/HNSW index · **No** JSONB column drop
- **No** ops-web / portal-web UI
- Default prod deploy: **không** set `RESEARCH_RAG_PGVECTOR_ENABLED` / `RESEARCH_RAG_ENABLED` / OpenAI embed
- Staging opt-in only: `--enable-pgvector-staging` on deploy script (PO sign-off)
- ANN vẫn → `rankRagHits` (P27 stale exclude unchanged)
- Branch: `feat/market-research-os-p28` from `main` (`8a6492b3`+)
- Commit chỉ khi user yêu cầu

---

## 3. Hành vi chi tiết (RES-UC-090)

### 3.1 ANN gate (code)

```ts
export function shouldUsePgvectorAnn(
  flag: boolean,
  pgvectorReady: boolean,
  queryVec: number[] | undefined,
): boolean {
  return Boolean(flag && pgvectorReady && queryVec && queryVec.length > 0);
}
```

| flag | ready | queryVec | Path |
|------|-------|----------|------|
| off | * | * | `listEmbeddings` (P19) |
| on | false | * | **Fallback** JSONB (fail-soft — VPS chưa cài pgvector) |
| on | true | set | `listEmbeddingsByVec` / `listPublishedEmbeddingsByVec` |
| on | true | empty (local hash) | JSONB — ANN cần queryVec |

**Call sites:** `market-research.service.ts` `searchInsights`, `insightCopilot` (if ANN used there — copilot uses listEmbeddings not ByVec today, unchanged), `portal-research.service.ts` `searchInsights`.

**Dual-write:** `upsertInsightEmbedding({ write_vec: flag && ready })` — không ghi `embedding_vec` khi DB chưa ready (tránh INSERT fail).

### 3.2 Health (unchanged fields, clearer semantics)

| Field | Meaning |
|-------|---------|
| `rag_pgvector_enabled` | env `RESEARCH_RAG_PGVECTOR_ENABLED` |
| `rag_pgvector_ready` | DB extension + column (P26) |
| ANN live | both true + non-empty queryVec at search time |

Optional P28 doc note only — **không** thêm field JSON mới trừ khi PO muốn `rag_pgvector_ann_live`.

### 3.3 Ops / staging enable

**Tiền đề VPS (P26 one-time, cần sudo):**

```bash
cd /var/www/rnosai && bash scripts/install_pgvector_vps.sh
bash scripts/verify_pgvector_market_research.sh
sudo systemctl restart ptt-crm-api
```

**Deploy P28 (default prod-safe):**

```bash
APPLY=1 ./scripts/deploy_market_research_p28_vps.sh
# Staging UAT only:
APPLY=1 ./scripts/deploy_market_research_p28_vps.sh   # with ENABLE_PGVECTOR_STAGING=1 env or --enable-pgvector-staging
```

`--enable-pgvector-staging` patches `deploy/runtime.env` + `.env`:

- `RESEARCH_RAG_PGVECTOR_ENABLED=1`
- **Does not** set `RESEARCH_RAG_ENABLED` or OpenAI embed (PO bật riêng cho full RAG UAT)

**Backfill `embedding_vec` (staging UAT manual):**

1. Bật pgvector flag + restart api
2. Chạy P13 `POST .../rag/reembed/start` (OpenAI embed flag) **hoặc** re-approve corpus để `upsertInsightEmbedding` dual-write
3. Verify: `SELECT count(*) FROM crm_research_insight_embeddings WHERE embedding_vec IS NOT NULL`

---

## 4. File map

| File | Role |
|------|------|
| `pgvector.util.ts` | Add `pgvectorReady` param to `shouldUsePgvectorAnn` |
| `pgvector.util.spec.ts` | P28 ready gate tests |
| `market-research.service.ts` | Pass `this.ragPgvectorReady`; `write_vec: flag && ready` |
| `portal-research.service.ts` | Pass ready to `shouldUsePgvectorAnn` |
| `market-research.service.spec.ts` | P28 fallback when flag on, ready false |
| `portal-research.service.spec.ts` | P28 ANN when flag+ready |
| `scripts/deploy_market_research_p28_vps.sh` | verify pgvector + `--enable-pgvector-staging` |
| `scripts/smoke_market_research_p28*.sh` | m1–m5 |
| Catalog / OS / Actions | RES-UC-090; UAT P28 |

**Unchanged:** `rankRagHits`, P27 stale filter, PDF export, portal-web.

---

## 5. Tasks (subagent-ready)

### Task 1 — Util gate (TDD)

1. Red: `P28 shouldUsePgvectorAnn false when flag on but ready false`
2. Green: add `pgvectorReady` parameter
3. Update P20 tests call signature

Run: `npx jest src/market-research/pgvector.util.spec.ts --testNamePattern='P20|P28' -v`

### Task 2 — Services + dual-write

1. Staff search: flag+ready → `listEmbeddingsByVec`; flag+!ready → `listEmbeddings`
2. Portal search: same with `listPublishedEmbeddingsByVec`
3. `write_vec: this.config.researchRagPgvectorEnabled && this.ragPgvectorReady` on approve/re-embed paths

### Task 3 — Deploy + smoke

`deploy_market_research_p28_vps.sh`:

- P0–P23 DDL chain + verify pgvector WARN
- `--enable-pgvector-staging` → patch `RESEARCH_RAG_PGVECTOR_ENABLED=1`
- api rebuild + restart

Smoke m1 util · m2 service · m3 grep ready gate · m4 docs · m5 full test suite

### Task 4 — Docs

- RES-UC-090 in catalog (extends UC-081 staging ops)
- § P28 OS doc
- UAT P28 (~8 phút): install → health both flags → staging enable → search ANN path → prod deploy flags off
- Backlog P29+: PDF footer (UC-089)

---

## 6. Walkthrough UAT P28 (draft)

**Tiền đề:** sudo VPS · corpus có embedding JSONB

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | DevOps | `install_pgvector_vps.sh` + verify | exit 0 |
| 2 | QA | GET health | `rag_pgvector_ready=true` |
| 3 | DevOps | Deploy `--enable-pgvector-staging` | `rag_pgvector_enabled=true` |
| 4 | AN | Re-embed / approve 1 insight | `embedding_vec` NOT NULL |
| 5 | AN | Staff search (RAG+OpenAI on staging) | SQL/log path `listEmbeddingsByVec`; hits hợp lệ |
| 6 | QA | Prod deploy **không** `--enable-pgvector-staging` | `rag_pgvector_enabled=false` |

---

## 7. Out of scope (P29+)

- PDF stale footer (RES-UC-089)
- IVFFlat/HNSW tuning
- Drop JSONB `embedding` column
- Prod enable pgvector/RAG flags
- Live Talkwalker, conjoint simulator

---

## 8. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| Flag on, pgvector missing → query error | P28 `ready` gate + fail-soft JSONB |
| ANN prefilter empty (no `embedding_vec`) | UAT backfill step; JSONB fallback still works |
| Prod accidental flag flip | Deploy default không patch; staging flag tách `--enable-pgvector-staging` |
| Local-hash search (no queryVec) | ANN off by design; JSONB path |

---

**Next step:** `code P28 theo hướng 2` → branch `feat/market-research-os-p28` → Task 1 TDD.
