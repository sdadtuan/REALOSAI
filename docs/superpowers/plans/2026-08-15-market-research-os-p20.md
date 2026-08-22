# Market Research OS P20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in pgvector dual-write on insight embeddings, plus a gated ANN prefilter for staff/portal RAG, without replacing JSONB ranking or enabling any RAG flag on prod.

**Architecture:** P20 adds `CREATE EXTENSION vector` + nullable `embedding_vec` on `crm_research_insight_embeddings`. `upsertInsightEmbedding` writes JSONB always; writes `embedding_vec` only when `RESEARCH_RAG_PGVECTOR_ENABLED=1`. Search stays `listEmbeddings` + `rankRagHits` when the flag is off. When on, repo ANN (`<=>`) prefilters same-dim rows, then the same `rankRagHits` (cosine + keyword + stale fields) ranks the shortlist. Health exposes `rag_pgvector_enabled` (default false).

**Tech Stack:** PostgreSQL pgvector, NestJS `market-research` + `portal-research`, Jest, bash smoke/deploy.

**Hướng đã khóa:** 3c — pgvector opt-in (RES-UC-081). Conjoint lite / Talkwalker / staff RAG stale banner / portal report-detail stale / IVFFlat-HNSW tune / JSONB cutover = out.

## Global Constraints

- **DDL P20 only** — `vector` extension + `embedding_vec` column; no other schema
- Flag `RESEARCH_RAG_PGVECTOR_ENABLED` default **`0`**
- Deploy **must not** set `RESEARCH_RAG_PGVECTOR_ENABLED`, `RESEARCH_RAG_ENABLED`, or OpenAI embed flags
- Flag off → identical retrieval to P19 (JSONB in-memory `rankRagHits`)
- Flag on → ANN prefilter then **reuse** `rankRagHits` — do not reimplement score math
- Mixed dims stay valid: local-hash 64-d and OpenAI 256-d; ANN only compares rows whose `vector_dims(embedding_vec)` equals `queryVec.length`
- Apply script is **fail-soft** if `CREATE EXTENSION vector` fails (package missing) — deploy continues; flag stays off
- **No** ops-web / portal-web UI change (health extra JSON field is additive)
- Deploy rebuilds **api only**
- Branch: `feat/market-research-os-p20` from `main`

---

## File map

| File | Role |
|------|------|
| `docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql` | Extension + `embedding_vec` + schema_migrations |
| `scripts/apply_pg_ddl_market_research_p20.sh` | Fail-soft apply |
| `services/ptt-crm-api/src/config/app-config.service.ts` | `researchRagPgvectorEnabled` |
| `services/ptt-crm-api/src/market-research/market-research.types.ts` | Health field; `toPgvectorLiteral` input types |
| `services/ptt-crm-api/src/market-research/pgvector.util.ts` | `toPgvectorLiteral`, `shouldUsePgvectorAnn` |
| `services/ptt-crm-api/src/market-research/pgvector.util.spec.ts` | Literal + gate tests |
| `services/ptt-crm-api/src/market-research/market-research.repository.ts` | Dual-write upsert; `listEmbeddingsByVec` |
| `services/ptt-crm-api/src/market-research/market-research.repository.spec.ts` | SQL asserts |
| `services/ptt-crm-api/src/market-research/market-research.service.ts` | Health + search branch |
| `services/ptt-crm-api/src/market-research/market-research.service.spec.ts` | Flag-off path unchanged; flag-on uses ANN |
| `services/ptt-crm-api/src/portal-research/portal-research.repository.ts` | Portal ANN list (published only) |
| `services/ptt-crm-api/src/portal-research/portal-research.service.ts` | Same flag branch |
| `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts` | Flag off still `listPublishedEmbeddings` |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | Catalog + RES-UC-081 |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | P20 section |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | UAT P20 |
| `scripts/smoke_market_research_p20*.sh` | M1–M5 |
| `scripts/deploy_market_research_p20_vps.sh` | Clone P18 api-only + apply P20 DDL |

**Unchanged:** `rankRagHits` score formula, ops-web UI, portal-web UI, OpenAI embed client, re-embed job, IVFFlat/HNSW indexes.

---

## Milestone M1 — DDL + flag + literal util

**Files:**
- Create: `docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql`
- Create: `scripts/apply_pg_ddl_market_research_p20.sh`
- Create: `services/ptt-crm-api/src/market-research/pgvector.util.ts`
- Create: `services/ptt-crm-api/src/market-research/pgvector.util.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.types.ts`

**Interfaces:**
- Produces: `toPgvectorLiteral(values: number[]): string` → `'[1,2,3]'`
- Produces: `shouldUsePgvectorAnn(flag: boolean, queryVec: number[] | undefined): boolean`
- Produces: `AppConfigService.researchRagPgvectorEnabled: boolean` (env `RESEARCH_RAG_PGVECTOR_ENABLED`, default false)

- [ ] **Step 1: Write failing util tests**

```ts
import { shouldUsePgvectorAnn, toPgvectorLiteral } from './pgvector.util';

describe('pgvector.util', () => {
  it('P20 toPgvectorLiteral formats a finite vector', () => {
    expect(toPgvectorLiteral([1, 0, -0.5])).toBe('[1,0,-0.5]');
  });

  it('P20 toPgvectorLiteral rejects empty or non-finite', () => {
    expect(() => toPgvectorLiteral([])).toThrow('invalid_pgvector');
    expect(() => toPgvectorLiteral([Number.NaN])).toThrow('invalid_pgvector');
  });

  it('P20 shouldUsePgvectorAnn requires flag and non-empty queryVec', () => {
    expect(shouldUsePgvectorAnn(false, [1, 0])).toBe(false);
    expect(shouldUsePgvectorAnn(true, undefined)).toBe(false);
    expect(shouldUsePgvectorAnn(true, [])).toBe(false);
    expect(shouldUsePgvectorAnn(true, [0.1, 0.2])).toBe(true);
  });
});
```

Run: `cd services/ptt-crm-api && npx jest src/market-research/pgvector.util.spec.ts --testNamePattern='P20' -v`  
Expected: FAIL (module missing)

- [ ] **Step 2: Implement util**

```ts
export function toPgvectorLiteral(values: number[]): string {
  if (!values.length || values.some((n) => !Number.isFinite(n))) {
    throw new Error('invalid_pgvector');
  }
  return `[${values.join(',')}]`;
}

export function shouldUsePgvectorAnn(
  flag: boolean,
  queryVec: number[] | undefined,
): boolean {
  return Boolean(flag && queryVec && queryVec.length > 0);
}
```

- [ ] **Step 3: Config flag**

In `app-config.service.ts` add field next to `researchRagOpenaiEmbedEnabled`:

```ts
readonly researchRagPgvectorEnabled: boolean;
```

In constructor (same bool parse as RAG flags):

```ts
this.researchRagPgvectorEnabled = ['1', 'true', 'yes', 'on'].includes(
  (process.env.RESEARCH_RAG_PGVECTOR_ENABLED ?? '0').trim().toLowerCase(),
);
```

- [ ] **Step 4: Health type**

Add `rag_pgvector_enabled: boolean` to staff `health()` return type, `PortalResearchHealth`, and both `health()` implementations. Default false. Do **not** put the env name or connection string in JSON.

Update existing health tests that `toEqual` the full object so they include `rag_pgvector_enabled: false`.

- [ ] **Step 5: DDL**

`docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql`:

```sql
-- Market Research OS P20 — 2026-08-15 (pgvector dual-write column)
-- Requires postgresql-xx-pgvector. Apply script is fail-soft if missing.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE crm_research_insight_embeddings
  ADD COLUMN IF NOT EXISTS embedding_vec vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-15-market-research-p20',
        'P20: pgvector extension + embedding_vec dual-write column'
    )
ON CONFLICT (version) DO NOTHING;
```

No IVFFlat / HNSW in P20 (mixed 64/256 dims; small n).

- [ ] **Step 6: Fail-soft apply script**

`scripts/apply_pg_ddl_market_research_p20.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-08-15-postgresql-ddl-market-research-p20.sql"
echo "==> Apply Market Research P20 DDL (pgvector, fail-soft)"
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector" >/tmp/p20_vector_ext.log 2>&1; then
  echo "WARN  P20 skipped: CREATE EXTENSION vector failed (install postgresql-*-pgvector to enable)"
  cat /tmp/p20_vector_ext.log || true
  exit 0
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  market research P20 DDL"
```

`chmod +x` the script.

Run util tests: Expected PASS.

---

## Milestone M2 — Dual-write upsert + ANN list (staff)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.service.spec.ts`

**Interfaces:**
- Consumes: `toPgvectorLiteral`, `shouldUsePgvectorAnn`
- Produces: `upsertInsightEmbedding` writes `embedding_vec` when `writeVec: true`
- Produces: `listEmbeddingsByVec(filters, queryVec, limit): Promise<RagEmbeddingRow[]>`

- [ ] **Step 1: Extend upsert input**

In `market-research.types.ts` `UpsertInsightEmbeddingInput` add optional:

```ts
write_vec?: boolean;
```

- [ ] **Step 2: Failing repo tests**

```ts
it('P20 upsertInsightEmbedding writes embedding_vec when write_vec', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  const repo = repoWithMock();
  await repo.upsertInsightEmbedding({
    insight_id: 1,
    project_id: 9,
    embedding: [1, 0],
    embed_text: 'Giá',
    embed_model: 'local-hash',
    embed_dims: 2,
    write_vec: true,
  });
  const sql = String(queryMock.mock.calls[0][0]);
  expect(sql).toMatch(/embedding_vec/);
  expect(queryMock.mock.calls[0][1]).toContain('[1,0]');
});

it('P20 upsertInsightEmbedding skips embedding_vec when write_vec false', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  const repo = repoWithMock();
  await repo.upsertInsightEmbedding({
    insight_id: 1,
    project_id: 9,
    embedding: [1, 0],
    embed_text: 'Giá',
    embed_model: 'local-hash',
    embed_dims: 2,
  });
  const sql = String(queryMock.mock.calls[0][0]);
  expect(sql).not.toMatch(/embedding_vec/);
});

it('P20 listEmbeddingsByVec orders by <=> and filters same dims', async () => {
  queryMock.mockResolvedValue({ rows: [] });
  const repo = repoWithMock();
  await repo.listEmbeddingsByVec({ client_id: 'acme' }, [1, 0], 50);
  const sql = String(queryMock.mock.calls[0][0]);
  expect(sql).toMatch(/embedding_vec <=> \$/);
  expect(sql).toMatch(/vector_dims\(e\.embedding_vec\)/);
  expect(sql).toMatch(/p\.client_id = \$/);
});
```

- [ ] **Step 3: Implement upsert dual-write**

When `input.write_vec`:

```sql
INSERT INTO crm_research_insight_embeddings
  (insight_id, project_id, embedding, embed_text, embed_model, embed_dims, embedding_vec)
VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::vector)
ON CONFLICT (insight_id) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  embedding = EXCLUDED.embedding,
  embed_text = EXCLUDED.embed_text,
  embed_model = EXCLUDED.embed_model,
  embed_dims = EXCLUDED.embed_dims,
  embedding_vec = EXCLUDED.embedding_vec,
  updated_at = now()
```

Bind `$7` = `toPgvectorLiteral(input.embedding)`.  
When `write_vec` is falsy, keep the current JSONB-only SQL (do not null out `embedding_vec`).

- [ ] **Step 4: `listEmbeddingsByVec`**

Clone `listEmbeddings` SELECT (include `i.valid_to::text AS valid_to` and GROUP BY it — P19 field). Add:

```sql
AND e.embedding_vec IS NOT NULL
AND vector_dims(e.embedding_vec) = $DIM
ORDER BY e.embedding_vec <=> $VEC::vector
LIMIT $K
```

`$VEC` = `toPgvectorLiteral(queryVec)`, `$DIM` = `queryVec.length`, `$K` = `Math.min(Math.max(limit, 1), 50)`.  
Reuse the same client/theme WHERE as `listEmbeddings`. Map `valid_to` like portal P19.

- [ ] **Step 5: Service search branch**

In `searchInsights`, after `queryVec` is resolved (local hash or OpenAI):

```ts
const useAnn = shouldUsePgvectorAnn(this.config.researchRagPgvectorEnabled, queryVec ?? embedInsightText(q));
const annVec = queryVec ?? embedInsightText(q);
const rows = useAnn
  ? await this.repo.listEmbeddingsByVec({ client_id: clientId || undefined, allowedClientIds, theme_code: themeCode }, annVec, 50)
  : await this.repo.listEmbeddings({ client_id: clientId || undefined, allowedClientIds, theme_code: themeCode });
return { hits: rankRagHits(q, rows, { theme_code: themeCode, limit, queryVec: annVec }) };
```

When flag off, **must** call `listEmbeddings` (not ByVec) so P7–P19 tests stay valid.

On approve upsert, pass `write_vec: this.config.researchRagPgvectorEnabled`.

- [ ] **Step 6: Service tests**

- Existing search tests: flag off → `listEmbeddings` called, `listEmbeddingsByVec` not called.
- New: `P20 searchInsights uses listEmbeddingsByVec when pgvector flag on`.

If health `toEqual` snapshots break, add `rag_pgvector_enabled: false`.

Run: `npm test -- --testPathPattern='market-research' --testNamePattern='P20|searchInsights|health rag' --no-coverage`  
Expected: PASS

---

## Milestone M3 — Portal ANN + docs + smoke + deploy

**Files:**
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.repository.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts`
- Modify: docs catalog / OS / UAT
- Create: smoke + deploy scripts

- [ ] **Step 1: Portal repo `listPublishedEmbeddingsByVec`**

Clone `listPublishedEmbeddings` (published + jwt `client_id` + `valid_to`). Add same `<=>` / `vector_dims` / `LIMIT` as staff. Corpus stays **`published` only**.

Spec: SQL matches `i.status = 'published'`, `embedding_vec <=>`, no `approved_client_facing`.

- [ ] **Step 2: Portal service**

Same `shouldUsePgvectorAnn` branch as staff. Flag off → `listPublishedEmbeddings` only (P12/P19 tests unchanged).

```ts
it('P20 searchInsights uses listPublishedEmbeddingsByVec when pgvector flag on', async () => {
  config.researchRagEnabled = true;
  config.researchRagPgvectorEnabled = true;
  const statement = 'Giá sữa học đường tăng tại Hà Nội';
  repo.listPublishedEmbeddingsByVec.mockResolvedValue([
    {
      insight_id: 20,
      project_id: 9,
      status: 'published',
      statement,
      observation: null,
      embedding: embedInsightText(statement),
      theme_codes: [],
      client_id: ACME,
      valid_to: null,
    },
  ]);
  const out = await makeService().searchInsights(acmeUser, { q: statement });
  expect(repo.listPublishedEmbeddingsByVec).toHaveBeenCalled();
  expect(repo.listPublishedEmbeddings).not.toHaveBeenCalled();
  expect(out.hits[0].insight_id).toBe(20);
});
```

Add `listPublishedEmbeddingsByVec: jest.fn()` on the repo mock.

- [ ] **Step 3: Catalog + RES-UC-081**

| RES-UC-081 | pgvector dual-write + gated ANN | P20 | P20 | Spec ready | FR-INT · NFR-AI-04 |

### RES-UC-081 — pgvector dual-write + gated ANN

- **Actor chính:** Analyst / portal (cùng search hiện có)
- **API:** không endpoint mới — `GET …/insights/search` (staff + portal)
- **Flag:** `RESEARCH_RAG_PGVECTOR_ENABLED` default 0
- **DDL:** `vector` extension + `embedding_vec`; apply fail-soft nếu thiếu package
- **Off:** JSONB + `rankRagHits` như P19
- **On:** ANN prefilter same-dim → `rankRagHits`
- **Cấm** bật flag trên prod deploy; không cắt JSONB; không IVFFlat/HNSW; không Talkwalker / conjoint

- [ ] **Step 4: OS + UAT**

```markdown
## P20 — RES-UC-081

| UC | Tóm tắt |
|----|---------|
| 081 | Cột embedding_vec + ANN khi RESEARCH_RAG_PGVECTOR_ENABLED=1; mặc định tắt. |

**API:** cùng insights/search  
**Gates:** api + DDL P20 fail-soft; không ops-web/portal-web UI; không RAG/pgvector flags prod.
```

**Walkthrough UAT P20 — pgvector opt-in (≈8 phút)**

**Mục tiêu:** *«Prod flag off = search như P19. Staging flag on = ANN prefilter, cùng hit contract (kể cả is_stale).»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | QA | `GET /api/v1/research/health` | `rag_pgvector_enabled=false` |
| 2 | QA | Prod search (RAG off) | `rag_disabled` như cũ |
| 3 | AN | Staging RAG on, pgvector off | `listEmbeddings` path; hits có `is_stale` |
| 4 | AN | Staging cả hai flag on | Search 200; không leak tenant |
| 5 | QA | `\d crm_research_insight_embeddings` | Có `embedding_vec` **hoặc** WARN skip nếu thiếu extension |
| 6 | QA | Prod sau deploy P20 | Không ghi `RESEARCH_RAG_PGVECTOR_ENABLED=1` |

Replace `## P19+ (backlog — conjoint / Talkwalker)` with P20 UAT + `## P20+ (backlog — conjoint / Talkwalker / staff RAG stale)`.

- [ ] **Step 5: Smoke**

`scripts/smoke_market_research_p20.sh` loops m1–m5.

| Script | Gate |
|--------|------|
| `p20_m1.sh` | `npx jest src/market-research/pgvector.util.spec.ts --testNamePattern='P20'` |
| `p20_m2.sh` | `npx jest src/market-research/market-research.repository.spec.ts --testNamePattern='P20'` |
| `p20_m3.sh` | grep `RESEARCH_RAG_PGVECTOR_ENABLED` in app-config; grep `embedding_vec` in P20 SQL; grep `fail-soft` or `WARN  P20 skipped` in apply script |
| `p20_m4.sh` | grep `RES-UC-081`, `P20` in OS doc, `Walkthrough UAT P20`; `test -f scripts/deploy_market_research_p20_vps.sh` |
| `p20_m5.sh` | `npm test -- --testPathPattern='market-research\|portal-research' --passWithNoTests --no-coverage` |

- [ ] **Step 6: Deploy script**

Clone `scripts/deploy_market_research_p18_vps.sh` → `deploy_market_research_p20_vps.sh`:

- Header: P20 — P0–P19 stack + pgvector DDL
- Path: 1/3 DDL **including** `apply_pg_ddl_market_research_p20.sh` → 2/3 api → **stop** (no ops-web, no portal-web)
- Echo flags untouched: RAG + OpenAI embed + **pgvector** stay off
- Echo `UAT: bash scripts/smoke_market_research_p20.sh`

`chmod +x` all new scripts.

---

## Milestone M4 — Verification

- [ ] `bash scripts/smoke_market_research_p20.sh` — m1–m5 pass
- [ ] Confirm no ops-web / portal-web UI diff
- [ ] Confirm deploy script does not write `RESEARCH_RAG_PGVECTOR_ENABLED=1`
- [ ] Confirm `rankRagHits` score lines unchanged

---

## Out of scope (P21+)

Conjoint lite, Talkwalker bake-off, staff RAG stale banner, portal report-detail stale, filter «Chỉ hết hạn» portal, IVFFlat/HNSW, drop JSONB column, force re-embed backfill into `embedding_vec`, enable pgvector/RAG on prod.

---

## Self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| Extension + column | M1 DDL |
| Fail-soft missing package | M1 apply script |
| Flag default 0 | M1 config |
| Dual-write only when flag | M2 upsert `write_vec` |
| ANN then rankRagHits | M2/M3 service branch |
| Portal published-only | M3 portal repo |
| No prod flag flip | M3 deploy |
| Health additive field | M1 health |

No placeholders. Names: `embedding_vec`, `RESEARCH_RAG_PGVECTOR_ENABLED`, `listEmbeddingsByVec`, `listPublishedEmbeddingsByVec`, `rag_pgvector_enabled`.
