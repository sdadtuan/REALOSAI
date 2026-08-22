# Market Research OS P32 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lúc **publish portal** (`visible=true`), đóng băng `published_valid_to` trên mỗi finding/rec trong `content_snapshot` — audit «hiệu lực lúc gửi khách» mà **không** đổi banner/footer live (RES-UC-093).

**Architecture:** `publishPortal` sau gate publishable: lookup `listInsightValidToForProject` (P29) → `bakePublishedValidTo(snapshot, map)` ghi field mới trên findings/recs → `updateReportVersionSnapshot` rồi mới `updateReportVersionPortalVisible`. `is_stale` / PDF / DOCX / P24 **vẫn** dùng live `valid_to`. Unpublish **không** xóa bake.

**Tech Stack:** snapshot util, `publishPortal`, portal `annotatePortalReportRow` (passthrough), Jest, bash deploy/smoke, api-only.

**Hướng đã khóa:** **1** — bake `published_valid_to`. IVFFlat = P33+.

---

## 1. Ba hướng P32

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Bake `published_valid_to` lúc publish** | **RES-UC-093** | **S–M (~1 ngày)** | **Đề xuất** — backlog từ P24/P31; không cần sudo; không đụng live-stale |
| 2 | IVFFlat index trên `embedding_vec` | — | L | VPS **chưa** `install_pgvector_vps.sh`; mix 64/256-d |
| 3 | Live Talkwalker HTTP | — | L | Cần token + bake-off PO; P23 stub đủ cho prod |

**Khuyến nghị PO:** chọn **hướng 1**.

- Stale **runtime** đã kín (P18–P31). Thiếu audit: «lúc publish, insight còn hạn hay không?»
- Bake **tách** field — không ghi đè `valid_to` live, không đổi footer/banner.
- IVFFlat premature đến khi extension + P13 256-d đồng nhất.

---

## 2. Global constraints

- **No new DDL** (field nằm trong JSON `content_snapshot`)
- **No new endpoints**
- **Cấm** dùng `published_valid_to` cho `is_stale` / PDF / DOCX footer
- Unpublish (`visible=false`): **không** xóa bake
- Re-publish: **ghi đè** bake bằng `valid_to` **lúc đó** (đúng «lần publish này»)
- Insight miss / unpublished: `published_valid_to: null` (cùng rule map miss P24)
- Deploy: flags RAG/pgvector **không** đổi
- Branch: `feat/market-research-os-p32` from `main` (`582d4bdb`+)
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: **api-only** + `NODE_OPTIONS=--max-old-space-size=2048`

---

## 3. Hành vi chi tiết (RES-UC-093)

### 3.1 Util

```ts
// market-research-report-snapshot.util.ts (hoặc report-publish-bake.util.ts)

export function bakePublishedValidTo(
  snapshot: { findings?: unknown; recs?: unknown },
  validToById: Map<number, string | null>,
): { findings: unknown[]; recs: unknown[] } {
  const stamp = (row: unknown) => {
    if (!row || typeof row !== 'object') return row;
    const id = Number((row as { insight_id?: unknown }).insight_id);
    if (!Number.isFinite(id) || id <= 0) return row;
    return {
      ...(row as Record<string, unknown>),
      published_valid_to: validToById.has(id) ? validToById.get(id) ?? null : null,
    };
  };
  return {
    findings: Array.isArray(snapshot.findings) ? snapshot.findings.map(stamp) : [],
    recs: Array.isArray(snapshot.recs) ? snapshot.recs.map(stamp) : [],
  };
}
```

### 3.2 `publishPortal`

Khi `input.visible === true` (sau `assertPublishableInsights` + self-approve):

```ts
const ids = collectReportInsightIds(version.content_snapshot);
const validToById = await this.repo.listInsightValidToForProject(project.id, ids);
const baked = bakePublishedValidTo(version.content_snapshot, validToById);
await this.repo.updateReportVersionSnapshot(reportId, versionId, {
  ...version.content_snapshot,
  findings: baked.findings,
  recs: baked.recs,
});
// rồi updateReportVersionPortalVisible(...)
```

Khi `visible === false`: **không** gọi bake / snapshot update (chỉ unpublish).

### 3.3 Portal GET report

`annotatePortalReportRow` **giữ** `published_valid_to` từ snapshot (spread) rồi ghi đè `valid_to` + `is_stale` **live**.

JSON finding:

```json
{ "insight_id": 11, "valid_to": "2020-01-01", "is_stale": true, "published_valid_to": "2026-12-31" }
```

**Không** ops-web/portal-web UI mới trong P32 (field sẵn cho UAT/API). Optional copy P33.

### 3.4 Types

`ReportFinding` / `ReportRec` thêm `published_valid_to?: string | null`.

---

## 4. File map

| File | Role |
|------|------|
| `report-publish-bake.util.ts` | **Create** — `bakePublishedValidTo` |
| `report-publish-bake.util.spec.ts` | **Create** — P32 unit |
| `market-research-report-snapshot.util.ts` | **Modify** — optional type field |
| `market-research.service.ts` | **Modify** — `publishPortal` bake |
| `market-research.service.spec.ts` | **Modify** — P32 publish stamps / unpublish no-op |
| `portal-research.service.spec.ts` | **Modify** — GET giữ `published_valid_to` + live stale |
| `scripts/deploy_market_research_p32_vps.sh` | **Create** — clone P31 api-only |
| `scripts/smoke_market_research_p32*.sh` | **Create** — m1–m5 |
| Catalog / OS / Actions | RES-UC-093; UAT P32; backlog P33+ |

**Unchanged:** `reportSnapshotHasStaleInsights`, PDF/DOCX footer, `rankRagHits`, ops-web UI.

---

## 5. Tasks (subagent-ready)

### Task 1 — Bake util (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/report-publish-bake.util.ts`
- Create: `services/ptt-crm-api/src/market-research/report-publish-bake.util.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
it('P32 stamps published_valid_to from map', () => {
  const out = bakePublishedValidTo(
    { findings: [{ insight_id: 11, text: 'x' }], recs: [{ insight_id: 11, text: 'r' }] },
    new Map([[11, '2026-12-31']]),
  );
  expect(out.findings[0]).toMatchObject({ insight_id: 11, published_valid_to: '2026-12-31' });
  expect(out.recs[0]).toMatchObject({ published_valid_to: '2026-12-31' });
});

it('P32 null when id missing from map', () => {
  const out = bakePublishedValidTo(
    { findings: [{ insight_id: 99, text: 'x' }], recs: [] },
    new Map(),
  );
  expect(out.findings[0]).toMatchObject({ published_valid_to: null });
});
```

- [ ] **Step 2: Implement + PASS**

Run: `cd services/ptt-crm-api && npx jest src/market-research/report-publish-bake.util.spec.ts --testNamePattern='P32'`

- [ ] **Step 3: Commit** `feat(research): P32 bake published_valid_to util`

---

### Task 2 — publishPortal + portal passthrough (TDD)

**Files:**
- Modify: `market-research.types.ts` / snapshot types
- Modify: `market-research.service.ts` `publishPortal`
- Modify: `market-research.service.spec.ts`
- Modify: `portal-research.service.spec.ts` (P24 getReport + `published_valid_to`)

- [ ] **Step 1: Red — publish visible stamps snapshot**

```ts
it('P32 publishPortal visible bakes published_valid_to then sets visible', async () => {
  // version snapshot findings [{ insight_id: 11 }]
  // getInsight status approved_client_facing
  // listInsightValidToForProject → Map([[11, '2026-12-31']])
  await service.publishPortal(1, 10, scope, { visible: true }, 'lead@ptt');
  expect(repo.updateReportVersionSnapshot).toHaveBeenCalledWith(
    1, 10, expect.objectContaining({
      findings: [expect.objectContaining({ insight_id: 11, published_valid_to: '2026-12-31' })],
    }),
  );
  expect(repo.updateReportVersionPortalVisible).toHaveBeenCalled();
});

it('P32 publishPortal unpublish does not rewrite snapshot', async () => {
  await service.publishPortal(1, 10, scope, { visible: false }, 'lead@ptt');
  expect(repo.updateReportVersionSnapshot).not.toHaveBeenCalled();
});
```

Clone fixture từ test `publish stamps published_by` hiện có.

- [ ] **Step 2: Green — wire bake trước `updateReportVersionPortalVisible`**

- [ ] **Step 3: Portal GET** — snapshot đã có `published_valid_to`; annotate không xóa:

```ts
it('P32 getReport keeps published_valid_to and live is_stale', async () => {
  // finding { insight_id: 11, published_valid_to: '2026-12-31' }
  // listPublishedInsightValidTo → Map([[11, '2020-01-01']])
  expect(body.findings[0]).toMatchObject({
    published_valid_to: '2026-12-31',
    valid_to: '2020-01-01',
    is_stale: true,
  });
});
```

(`annotatePortalReportRow` spread đã đủ — chỉ cần test.)

- [ ] **Step 4: Commit** `feat(research): P32 bake published_valid_to on portal publish`

---

### Task 3 — Deploy + smoke + docs

**Files:**
- Create: `scripts/deploy_market_research_p32_vps.sh` (clone P31)
- Create: `scripts/smoke_market_research_p32.sh`, `m1`–`m5`
- Modify: catalog RES-UC-093; OS §P32; Actions UAT P32; backlog P33+

**Smoke:**

| Script | Checks |
|--------|--------|
| m1 | bake util spec P32 |
| m2 | service publish P32 |
| m3 | grep `bakePublishedValidTo` + `published_valid_to` |
| m4 | docs RES-UC-093 + deploy |
| m5 | jest `market-research\|portal-research` |

```bash
APPLY=1 ./scripts/deploy_market_research_p32_vps.sh
```

- [ ] **Commit** `docs(research): P32 RES-UC-093 catalog + deploy smoke`

---

## 6. Walkthrough UAT P32 (≈8 phút)

**Tiền đề:** report draft có finding `insight_id` với `valid_to` tương lai; Lead ≠ generated_by.

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | Lead | Publish portal `visible=true` | Snapshot findings có `published_valid_to` = `valid_to` lúc đó |
| 2 | AN | Đổi insight `valid_to` quá khứ | Portal GET: `is_stale=true`, `valid_to` mới; `published_valid_to` **cũ** |
| 3 | AN | Export PDF/DOCX | Footer **có** (live stale) — P29/P31 |
| 4 | Lead | Unpublish | `published_valid_to` **còn** trong snapshot |
| 5 | Lead | Publish lại | `published_valid_to` **cập nhật** theo `valid_to` hiện tại |
| 6 | QA | Prod deploy P32 | RAG/pgvector flags không đổi |

---

## 7. Out of scope (P33+)

- IVFFlat/HNSW
- Drop JSONB `embedding`
- Prod enable RAG / pgvector / OpenAI
- Live Talkwalker, conjoint simulator
- Portal/ops-web UI hiện `published_valid_to`
- Dùng bake cho `is_stale`

---

## 8. Hướng 2 / 3 sketch (không code trừ khi PO đổi)

### 8.1 IVFFlat (P33 candidate)

```sql
CREATE INDEX CONCURRENTLY crm_research_emb_vec_ivf
  ON crm_research_insight_embeddings
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 10);
```

Fail-soft như P20 nếu extension thiếu. Tiền đề: `install_pgvector_vps.sh` + P13 256-d.

### 8.2 Live Talkwalker (P33+ candidate)

Thay `TALKWALKER_STUB_RESULTS` bằng HTTP Search API; **cấm** bật prod cho đến bake-off PO.

---

## 9. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| FE nhầm `published_valid_to` = stale | P32 không UI; `is_stale` vẫn live; docs UAT bước 2 |
| Publish fail sau bake, trước visible | Gọi snapshot **rồi** visible; nếu visible fail, bake vẫn OK (idempotent re-publish) |
| Test publish cũ không mock `listInsightValidToForProject` | Default mock `new Map()` từ P29 |
| GTM WIP lẫn commit | Stage chỉ file P32 |

---

**Next step:** PO chốt hướng **1** → `code P32 theo hướng 1` → branch `feat/market-research-os-p32` → Task 1 TDD.
