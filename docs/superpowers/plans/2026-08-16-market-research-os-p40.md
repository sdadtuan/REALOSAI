# Market Research OS P40 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff chạy **RAG re-embed backfill** từ ops-web (preview + batch) thay vì curl — reuse API P13/P39 playbook, cap `configure`, ẩn khi embed off prod (RES-UC-102).

**Architecture:** Panel trên `/crm/research/analytics` (đã có `fetchResearchHealth`). Gọi `GET/POST /api/v1/research/rag/reembed/*` hiện có. Không endpoint/DDL mới. Banner staging-only; prod deploy flags-off.

**Tech Stack:** ops-web (React, vitest), `market-research-api.ts`, bash deploy/smoke. API unchanged trừ test fixture.

**Hướng đề xuất:** **1** — staff re-embed panel. Portal list stale = P41+.

---

## 1. Ba hướng P40

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staff ops-web RAG re-embed panel** | **RES-UC-102** | **S–M** | **Đề xuất** — P39 out-of-scope; API P13 sẵn; không sudo |
| 2 | Portal report list stale badge | RES-UC-103 | M | `listReports` + badge; api + portal-web |
| 3 | Staff report version live stale rows | RES-UC-104 | S–M | Parity portal P24 trên snapshot; ops-web |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **Reuse API P13** — không endpoint/DDL mới
- Cap **`crm_research.configure`** (giống controller hiện tại)
- Panel **ẩn hoàn toàn** khi `health.rag_openai_embed_enabled !== true` (prod default)
- **Cấm** ghi `OPENAI_API_KEY` / flip RAG flags từ UI
- **Cấm** `createInsight` · batch chỉ re-embed corpus hiện có
- Copy banner: «Chỉ staging/UAT — không tạo insight; PII skip server-side»
- Default `limit` UI = **50** (khớp Actions P13/P39)
- Không portal-web · prod deploy không bật flags
- Branch: `feat/market-research-os-p40` from `main` @ P39 (`d996114f`)
- Commit chỉ khi user yêu cầu · không gộp GTM WIP
- Deploy: **api** (tests) + **ops-web**

---

## 3. Hành vi — RES-UC-102 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P40 |
|-------|----------|-------------|
| P13 | `GET/POST …/rag/reembed/*` | Preview + start batch |
| P39 | Runbook + `--enable-rag-staging` | PO bật flags trước UAT |
| Analytics | `fetchResearchHealth` | Gate panel |

### 3.2 UI — `ResearchRagReembedPanel`

**Vị trí:** `services/ops-web/src/app/crm/research/analytics/page.tsx` — dưới KPI ops, trên theme table (hoặc dưới RAG search khi `rag_enabled`).

**Hiển thị khi:** `rag_openai_embed_enabled === true` **và** user có `crm_research.configure`.

**Ẩn khi:** embed off (prod) — không placeholder/error noisy.

| testid | Element |
|--------|---------|
| `rag-reembed-panel` | Khối panel |
| `rag-reembed-preview-count` | `stale_count` sau preview |
| `rag-reembed-limit` | Input number, default 50, min 1 max 200 |
| `rag-reembed-run` | Nút «Chạy batch» |
| `rag-reembed-result` | `processed` / `skipped_pii` / `remaining` / `status` |

**Luồng:**
1. Mount → auto `GET …/rag/reembed/preview` (optional client_id — YAGNI phase 1: all scope)
2. User chỉnh limit → `POST …/rag/reembed` `{ limit }`
3. Success → refresh preview + hiện result inline
4. `rag_reembed_disabled` / `rag_disabled` → message tiếng Việt + link runbook (không crash)

### 3.3 API client (ops-web)

Thêm vào `market-research-api.ts`:

```ts
export type RagReembedPreview = {
  ok: boolean;
  stale_count: number;
  target_dims: number;
  target_model: string;
};

export type RagReembedStart = {
  ok: boolean;
  status: 'pending' | 'succeeded' | 'noop' | string;
  processed?: number;
  skipped_pii?: number;
  failed?: number;
  remaining?: number;
  note?: string;
};

export async function previewResearchRagReembed(token: string, query?: { client_id?: string })
export async function startResearchRagReembed(token: string, body: { limit?: number; client_id?: string })
```

POST dùng `researchMutate` pattern hiện có (202 Accepted).

### 3.4 Errors (map giống API)

| error | UI copy |
|-------|---------|
| `rag_disabled` | RAG chưa bật staging |
| `rag_reembed_disabled` | OpenAI embed chưa bật — xem runbook P39 |
| `forbidden` | Thiếu quyền configure |
| `jobs_disabled` | Worker off — batch có thể không chạy |

---

## 4. Hành vi sketch — hướng 2 (P41+, không code P40)

| | |
|--|--|
| Scope | `GET /portal/research/reports` thêm `has_stale_insights` trên mỗi card |
| API | Batch `listPublishedInsightValidTo` + `reportSnapshotHasStaleInsights` |
| UI | Badge vàng trên `/research` list |
| Không gộp | re-embed panel |

---

## 5. Hành vi sketch — hướng 3 (P41+, không code P40)

| | |
|--|--|
| Scope | Staff tab Báo cáo — banner stale **live** dưới finding/rec snapshot (giống portal P24) |
| Cách | Client-side join `project.insights` + `content_snapshot` insight_id (ưu tiên — no API) |
| Không gộp | re-embed panel |

---

## 6. File map (hướng 1)

| File | Role |
|------|------|
| `services/ops-web/src/lib/market-research-api.ts` | preview + start re-embed types/fetch |
| `services/ops-web/src/components/research/ResearchRagReembedPanel.tsx` | Panel UI |
| `services/ops-web/src/components/research/research-rag-reembed.util.ts` | Format result / error VI (optional, nếu >10 dòng) |
| `services/ops-web/src/components/research/research-rag-reembed.util.spec.ts` | Error mapping unit |
| `services/ops-web/src/app/crm/research/analytics/page.tsx` | Wire panel + configure cap check |
| Catalog / OS / Actions | RES-UC-102; UAT P40; P41+ |
| `scripts/deploy_market_research_p40_vps.sh` | api + ops-web; flags off |
| `scripts/smoke_market_research_p40*.sh` | m1–m5 |

**Unchanged:** `market-research.service.ts` re-embed logic · portal · pgvector install · conjoint P38.

---

## 7. Tasks (hướng 1)

### Task 1 — API client + util (TDD)

- [x] Types `RagReembedPreview` / `RagReembedStart` trong `market-research-api.ts`
- [x] `previewResearchRagReembed` + `startResearchRagReembed`
- [x] Util spec: map `rag_reembed_disabled` → message; format result `{ processed, remaining }`

**Verify:** vitest pass; grep không leak secret.

### Task 2 — Panel component

- [x] `ResearchRagReembedPanel` — mount preview, limit input, run button, result area
- [x] Banner verbatim staging copy
- [x] Disabled state khi `loading` / đang POST
- [x] `data-testid` theo §3.2

**Verify:** component render với mock fetch (util spec đủ nếu không vitest component).

### Task 3 — Analytics page wire

- [x] Import panel; show khi `health.rag_openai_embed_enabled && hasCap(configure)`
- [x] Không show trên prod health (embed false) — regression grep

**Verify:** analytics page compile; panel không mount khi embed off.

### Task 4 — Docs + deploy + smoke

- [x] RES-UC-102 catalog + OS §P40
- [x] Actions §P40 UAT (~8 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | Staging flags P39 + OPENAI_API_KEY | health embed true |
| 2 | LD | Mở `/crm/research/analytics` | Panel hiện |
| 3 | LD | Configure user | Preview `stale_count` ≥ 0 |
| 4 | LD | Chạy batch limit 50 | Result `processed` ≥ 1 hoặc `noop` |
| 5 | Viewer | Mở analytics | Panel ẩn (no configure) |
| 6 | QA | Prod deploy P40 | Panel ẩn; flags off |

- [x] `deploy_market_research_p40_vps.sh` — api test + ops-web build
- [x] Smoke m1–m5: FE contract + deploy prod-safe + grep no OPENAI_KEY

**Verify:** `bash scripts/smoke_market_research_p40.sh` exit 0.

---

## 8. Deploy

```bash
# Prod-safe
APPLY=1 ./scripts/deploy_market_research_p40_vps.sh

# Staging UAT panel (flags đã bật P39)
# Mở ops-web analytics → panel re-embed
```

**Services:** api + ops-web. Không portal/worker bắt buộc (worker đã có từ P13).

---

## 9. UAT gates (hướng 1)

- [ ] ops-web vitest (util + api types)
- [ ] api `market-research` tests không regression
- [ ] Smoke P40 m1–m5
- [ ] Staging UAT Actions §P40 (cần P39 staging flags)
- [ ] Prod: panel ẩn; health embed false

---

## 10. Out of scope (P41+)

- Portal report list stale badge (hướng 2)
- Staff report live stale rows (hướng 3)
- Auto cron re-embed · pgvector prod enable
- Portal what-if / conjoint persist
- MOE / ISO cert claim
- Ghi secret / flip env từ UI

---

## 11. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| User prod thấy panel trống/lỗi | Gate `rag_openai_embed_enabled`; ẩn hoàn toàn |
| Batch lớn tốn OpenAI | Default limit 50; copy runbook |
| Viewer thấy panel | Cap `configure` |
| Worker off | Hiện `jobs_disabled` note từ API |
| GTM WIP lẫn commit | Stage chỉ file P40 |

---

## 12. Self-review

| Requirement | Task |
|-------------|------|
| Đóng P39 out-of-scope UI | Task 2–3 |
| Reuse P13 API | §3.1 — no new endpoints |
| Prod flags off | Global constraints + UAT #6 |
| Staging UAT path | Link P39 runbook + Actions |
| ops-web deploy | Task 4 |

**Next step:** PO khóa **hướng 1** → `code P40 theo hướng 1` → branch `feat/market-research-os-p40`.
