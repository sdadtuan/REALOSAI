# Market Research OS P38 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff **lưu lịch sử what-if conjoint** trên project `PRICE_OFFER` — F5 vẫn thấy scenario đã chạy (RES-UC-100). Compute logic giữ nguyên P34; thêm DDL + list read-only.

**Architecture:** Bảng `crm_research_cj_whatif_runs`. `POST …/conjoint/what-if` body `{ persist?: true }` → compute rồi insert khi `persist=true`. `GET …/conjoint/what-if` → 20 run mới nhất. ops-web: checkbox «Lưu kết quả» + bảng lịch sử.

**Tech Stack:** NestJS, Jest, ops-web vitest, bash deploy/smoke. DDL P38 nhỏ. Không portal.

**Hướng đề xuất:** **1** — persist what-if staff. pgvector backfill = P39+.

---

## 1. Ba hướng P38

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Persist conjoint what-if (staff)** | **RES-UC-100** | **S–M** | **Đề xuất** — đóng gap P34 UAT F5; DDL nhỏ; unblocked |
| 2 | pgvector install + embedding backfill | — | L | Blocked: sudo VPS; mix 64/256-d |
| 3 | Portal what-if / lịch sử khách | — | M | **Cấm** — P35 portal chỉ read summary; không what-if |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **Backward compatible:** `persist` mặc định `false` → hành vi P34 không đổi
- **Cấm** MOE / logit / part-worth / `createInsight` / market share copy
- `statistical_inference: false` cứng trên mọi row
- Chỉ `PRICE_OFFER` (400 `cj_not_price_offer`)
- Persist cần cap **`edit`**; compute-only giữ cap **`view`**
- GET list cap **`view`**; không DELETE/PATCH run (YAGNI)
- Tenancy: `loadScopedProject` + scope giống conjoint P21/P34
- DTO list: không leak `title`; có `created_by`, `created_at`
- Không portal-web · flags RAG/pgvector/Talkwalker prod không đổi
- Branch: `feat/market-research-os-p38` from `main` @ P37 (`adb2c652`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: DDL P0–P38 + api + ops-web

---

## 3. Hành vi — RES-UC-100 (hướng 1)

### 3.1 DDL P38

File: `docs/specs/2026-08-16-postgresql-ddl-market-research-p38.sql`

```sql
CREATE TABLE IF NOT EXISTS crm_research_cj_whatif_runs (
  id                    BIGSERIAL PRIMARY KEY,
  project_id            BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  study_id              BIGINT REFERENCES crm_research_studies(id) ON DELETE SET NULL,
  scenario              JSONB NOT NULL,
  n_match               INT NOT NULL,
  n_choices             INT NOT NULL,
  match_pct             NUMERIC(6,2) NOT NULL,
  limitation_note       TEXT NOT NULL,
  statistical_inference BOOLEAN NOT NULL DEFAULT false,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_cj_whatif_project_idx
  ON crm_research_cj_whatif_runs (project_id, id DESC);
```

Apply: `scripts/apply_pg_ddl_market_research_p38.sh` (pattern P21).

### 3.2 API

**POST** ` /api/v1/research/projects/:id/conjoint/what-if`

Body:
```json
{
  "study_id": 5,
  "scenario": { "price": "99k", "pack_size": "500ml" },
  "persist": true
}
```

| persist | Cap | Hành vi |
|---------|-----|---------|
| absent / false | `view` | P34 — compute only, không INSERT |
| true | `edit` | compute + `insertCjWhatIfRun` |

200 (giữ shape P34 + optional persist metadata):
```json
{
  "n_match": 2,
  "n_choices": 8,
  "match_pct": 25,
  "scenario": { "price": "99k", "pack_size": "500ml" },
  "limitation_note": "...",
  "statistical_inference": false,
  "run_id": 12,
  "persisted_at": "2026-08-16T10:00:00.000Z"
}
```

`run_id` / `persisted_at` **chỉ** khi `persist=true`.

**GET** `/api/v1/research/projects/:id/conjoint/what-if`

Cap `view`. Query: không (fixed `LIMIT 20`).

200:
```json
{
  "runs": [
    {
      "id": 12,
      "project_id": 9,
      "study_id": 5,
      "scenario": { "price": "99k", "pack_size": "500ml" },
      "n_match": 2,
      "n_choices": 8,
      "match_pct": 25,
      "limitation_note": "...",
      "statistical_inference": false,
      "created_by": "an@ptt",
      "created_at": "2026-08-16T10:00:00.000Z"
    }
  ]
}
```

Validation/errors: giữ P34 (`cj_whatif_empty`, `cj_whatif_unknown_attribute`, `cj_whatif_no_choices`, `cj_not_price_offer`).

### 3.3 Service / repo

```ts
// market-research.types.ts
export type CjWhatIfPersistResult = CjWhatIfResult & {
  run_id?: number;
  persisted_at?: string;
};

export type CjWhatIfRunRow = {
  id: number;
  project_id: number;
  study_id: number | null;
  scenario: Record<string, string>;
  n_match: number;
  n_choices: number;
  match_pct: number;
  limitation_note: string;
  statistical_inference: false;
  created_by: string | null;
  created_at: string;
};
```

Repo:
- `insertCjWhatIfRun(projectId, studyId, result, actor)` → row
- `listCjWhatIfRuns(projectId, limit = 20)` → rows DESC id

Service `simulateConjointWhatIf`:
1. compute (existing)
2. if `input.persist === true` → assert edit cap via controller guard split **hoặc** service throw 403 nếu không edit — **khuyến nghị:** controller route POST dùng guard động: `persist` → `StaffMarketResearchEditGuard`, else `ViewGuard` (Nest: 2 handler methods hoặc custom guard)
3. insert + attach `run_id`, `persisted_at`

**YAGNI:** không cap số run/project; 20-row list đủ P38.

### 3.4 ops-web

**ConjointPane** (chỉ tab Conjoint staff):

| UI | testid |
|----|--------|
| Checkbox «Lưu kết quả» | `cj-whatif-persist` |
| Bảng lịch sử | `cj-whatif-history` |
| Row | `cj-whatif-history-row-{id}` |

- Load mount: `fetchResearchConjointWhatIfRuns(token, projectId)`
- Submit: `simulateResearchConjointWhatIf(..., { scenario, persist })`
- Sau persist OK → refresh list + giữ result inline
- Banner: `CJ_WHATIF_PERSIST_BANNER` — «Lưu scenario staff — không tạo insight; không portal»

**Unchanged:** portal `PortalConjointLite` · ISO gap panel · compute conjoint lite P21.

---

## 4. Hành vi sketch — hướng 2 (P39+, không code P38)

| | |
|--|--|
| Scope | `install_pgvector_vps.sh` + reembed backfill staging |
| Blocker | sudo VPS; PO bật flags |
| Không gộp | persist what-if |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `docs/specs/2026-08-16-postgresql-ddl-market-research-p38.sql` | DDL what-if runs |
| `scripts/apply_pg_ddl_market_research_p38.sh` | Apply fail-soft |
| `market-research.repository.ts` + spec | insert + list |
| `market-research.service.ts` + spec | persist branch; list |
| `market-research.controller.ts` | GET what-if; POST persist guard |
| `market-research.types.ts` | `CjWhatIfRunRow`, `CjWhatIfPersistResult` |
| `ops-web ConjointPane.tsx` + `conjoint-pane.util.ts` | checkbox + history |
| `market-research-api.ts` | `fetchResearchConjointWhatIfRuns` |
| Catalog / OS / Actions | RES-UC-100; UAT P38; P39+ |
| `scripts/deploy_market_research_p38_vps.sh` | DDL + api + ops-web |
| `scripts/smoke_market_research_p38*.sh` | m1–m5 |

**Unchanged:** `conjoint-whatif.util.ts` logic · portal · Talkwalker · pgvector flags.

---

## 6. Tasks (hướng 1)

### Task 1 — DDL + repo (TDD)

- [x] DDL P38 + apply script + migration row
- [x] Repo spec: INSERT scoped `project_id`; LIST `ORDER BY id DESC LIMIT 20`; SQL không `title`
- [x] Service spec: `persist=true` gọi insert; `persist=false` không insert

### Task 2 — API + guards

- [x] GET `conjoint/what-if` trước POST conflict (Nest order)
- [x] POST persist → `edit` guard; default → `view`
- [x] Cross-tenant 403; PRICE_OFFER only

### Task 3 — ops-web + docs + deploy

- [x] ConjointPane persist checkbox + history table
- [x] RES-UC-100 catalog; OS §P38; Actions UAT P38
- [x] Deploy api + ops-web; smoke m1–m5

---

## 7. Smoke (hướng 1)

| Smoke | Check |
|-------|--------|
| m1 | service spec P38 persist / no-persist |
| m2 | repo spec P38 SQL |
| m3 | grep `cj-whatif-persist` + `GET.*conjoint/what-if` |
| m4 | docs RES-UC-100 + deploy P38 |
| m5 | api + ops conjoint util regression |

---

## 8. UAT P38 (≈8 phút)

**Mục tiêu:** *«Analyst chạy what-if + Lưu → F5 vẫn thấy hàng lịch sử; không insight mới; portal không đổi.»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | PRICE_OFFER, what-if 99k+500ml, **không** tick Lưu | Kết quả inline; GET list rỗng / không tăng |
| 2 | AN | Cùng scenario, tick **Lưu kết quả** | `run_id` trong response; hàng trong history |
| 3 | AN | F5 tab Conjoint | History còn; scenario + `2/8 (25%)` |
| 4 | AN | Viewer (chỉ view) tick Lưu | 403 forbidden |
| 5 | QA | Portal `/research` | Không what-if / không history staff |
| 6 | QA | Prod deploy | RAG/Talkwalker flags không đổi |

---

## 9. Out of scope (P39+)

- MOE / logit / part-worth / market simulator
- Portal what-if hoặc persist
- DELETE / edit run · export CSV
- pgvector prod enable + mass reembed
- Auto `createInsight` từ what-if

---

## 10. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| User tưởng persist = insight | Banner + UAT #5; không `createInsight` |
| POST breaking P34 clients | `persist` default false |
| Viewer persist by mistake | `edit` guard khi persist |
| GTM WIP lẫn commit | Stage chỉ file P38 |

---

## 11. Self-review

| Requirement | Task |
|-------------|------|
| F5 giữ scenario | Task 3 + UAT #3 |
| P34 compute unchanged | Global constraints |
| No portal | Out of scope |
| DDL nhỏ | Task 1 |
| api + ops-web deploy | Task 3 |

**Next step:** PO khóa **hướng 1** → `code P38 theo hướng 1` → branch `feat/market-research-os-p38`.
