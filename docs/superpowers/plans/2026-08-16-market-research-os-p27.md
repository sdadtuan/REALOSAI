# Market Research OS P27 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Default RAG search (staff + portal + copilot inject) **không xếp hạng** insight hết hạn (`valid_to` stale); chỉ hiện lại khi opt-in `stale_only=1` (portal P25) hoặc staff tab «Chỉ hết hạn» (P18 table — không đổi).

**Architecture:** Một thay đổi tập trung trong `rankRagHits`: sau sort theo score, **mặc định** `filter(!is_stale)` trước `slice(limit)`; `stale_only: true` giữ hành vi P25 (chỉ stale). Copilot gọi cùng util → corpus inject cũng bỏ stale. Không endpoint mới, không DDL.

**Tech Stack:** `research-rag.util.ts`, NestJS staff/portal search + copilot, Jest, bash smoke/deploy (api + portal-web nếu đổi copy empty-state).

**Hướng đã khóa:** 1 — hide stale from default RAG ranking (RES-UC-088). PDF footer / pgvector ANN = out.

---

## 1. Ba hướng P27 (chọn 1)

| # | Hướng | UC đề xuất | Effort | Giá trị |
|---|--------|------------|--------|---------|
| **1** | **Ẩn stale khỏi RAG mặc định** (staff + portal + copilot) | RES-UC-088 | **S** (~1 ngày) | Hoàn tất cung stale P18–P25; giảm rủi ro khách/staff cite insight hết hạn |
| 2 | PDF export: footer cảnh báo khi báo cáo có finding/rec stale | RES-UC-089 | M (~2 ngày) | Compliance offline; không ảnh hưởng search |
| 3 | Demote stale (sort sau fresh, vẫn có thể lọt top-N) | — | S | Yếu hơn hướng 1; khó UAT (“vẫn thấy stale đôi khi”) |

**Khuyến nghị:** **Hướng 1** — backlog Actions ghi rõ «hide stale from ranking»; P25 đã có `stale_only` opt-in; thay đổi 1 hàm util + test là đủ.

---

## 2. Global constraints (P27 hướng 1)

- **No DDL** · **No** endpoint mới · **No** ops-web bắt buộc (staff RAG UI không có checkbox stale — hành vi API đủ)
- Rule stale: UTC calendar `isInsightStale` (P18/P19) — không đổi
- **`stale_only=1`** (portal) vẫn trả **chỉ** hit stale (P25 regression)
- Copilot inject: cùng rule — không tham chiếu stale trong `rag_hits` mặc định
- Deploy **không** bật `RESEARCH_RAG_ENABLED` / OpenAI / pgvector / Talkwalker
- Branch: `feat/market-research-os-p27` from `main` (`a82f6138`+)
- Commit chỉ khi user yêu cầu

---

## 3. Hành vi chi tiết (RES-UC-088)

### 3.1 `rankRagHits` (core)

```typescript
hits.sort((a, b) => b.score - a.score);

let pool: RagHit[];
if (opts?.stale_only) {
  pool = hits.filter((h) => h.is_stale);
} else {
  pool = hits.filter((h) => !h.is_stale); // P27 default
}
return pool.slice(0, limit);
```

| Mode | Kết quả |
|------|---------|
| Default (`stale_only` off/absent) | Top-N **chỉ** insight còn hiệu lực |
| `stale_only=1` (portal P25) | Top-N **chỉ** insight hết hạn |
| 0 hit sau filter | `[]` (portal copy P25 vẫn áp dụng cho stale_only) |

**Không** thêm `include_stale=1` trong P27 — staff muốn xem stale dùng tab Insight «Chỉ hết hạn» (P18), portal dùng checkbox P25.

### 3.2 Call sites (không đổi signature service)

| Caller | File | Ghi chú |
|--------|------|---------|
| Staff search | `market-research.service.ts` → `searchInsights` | Mặc định loại stale |
| Portal search | `portal-research.service.ts` → `searchInsights` | Pass `stale_only` khi có |
| Copilot | `market-research.service.ts` → `insightCopilot` | `rankRagHits` + `RAG_COPILOT_HIT_LIMIT` — stale excluded |

### 3.3 UI (minimal)

| Surface | P27 change |
|---------|------------|
| Portal RAG | Default search: không còn banner P19 trên hit (vì hit stale không trả về). Checkbox «Chỉ hết hạn» **không đổi** |
| Staff RAG (`InsightsRagSearch`) | Hit stale biến mất khỏi kết quả mặc định; banner P22 chỉ còn relevant nếu sau này thêm opt-in |
| Insight tab table (P18) | **Không đổi** — vẫn list + filter stale local |

Optional (out P27): portal empty-state copy «Kết quả chỉ gồm insight còn hiệu lực» — chỉ khi PO muốn.

---

## 4. File map

| File | Role |
|------|------|
| `research-rag.util.ts` | Default exclude stale; giữ `stale_only` |
| `research-rag.util.spec.ts` | P27 tests + cập nhật case P19 nếu expect stale in default |
| `market-research.service.spec.ts` | P27 search + copilot không inject stale |
| `portal-research.service.spec.ts` | P27 default off; P25 stale_only regression |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | RES-UC-088 |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | § P27 |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | UAT P27; backlog P28+ |
| `scripts/smoke_market_research_p27*.sh` | m1–m5 |
| `scripts/deploy_market_research_p27_vps.sh` | api (+ portal-web nếu copy) |

---

## 5. Tasks (subagent-ready)

### Task 1 — Util + tests (TDD)

**Files:** `research-rag.util.ts`, `research-rag.util.spec.ts`

1. Red: `P27 rankRagHits default excludes stale hits even when high score`
2. Red: `P27 stale_only still returns only stale (P25 regression)`
3. Red: `P27 all stale + default → []`
4. Green: implement filter branch
5. Review P19 test «sets is_stale» — field vẫn set; chỉ default pool đổi

Run: `npx jest src/market-research/research-rag.util.spec.ts --testNamePattern='P27|P25' -v`

### Task 2 — Service specs

**Files:** `market-research.service.spec.ts`, `portal-research.service.spec.ts`

- Staff `searchInsights`: corpus có 1 stale + 1 fresh → default chỉ fresh
- Copilot: embeddings có stale → `rag_hits` không chứa stale id
- Portal: default idem; `stale_only: true` chỉ stale

### Task 3 — Catalog / OS / Actions

- RES-UC-088 row + detail (cấm endpoint mới; cấm ẩn stale trên report-detail/PDF)
- UAT P27 (~8 phút, 6 bước)
- Replace `## P27+ (backlog — …)` → UAT P27 + `## P28+ (backlog — PDF stale footer / …)`

### Task 4 — Smoke + deploy

| Script | Assert |
|--------|--------|
| `p27_m1.sh` | jest P27 util |
| `p27_m2.sh` | jest P27 service specs |
| `p27_m3.sh` | grep exclude stale in util |
| `p27_m4.sh` | RES-UC-088 + deploy script |
| `p27_m5.sh` | full market-research\|portal-research tests |

Deploy: api-only **đủ** nếu không đổi portal copy; nếu có copy → rebuild portal-web (giống P25).

---

## 6. Walkthrough UAT P27 (draft)

**Tiền đề:** staging `RESEARCH_RAG_ENABLED=1`; corpus có insight published/ACF với `valid_to` quá khứ + còn hiệu lực

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | AN | Staff RAG search keyword khớp cả stale + fresh | Chỉ hit fresh |
| 2 | AN | Copilot draft (flag on) | `rag_hits` không có insight stale |
| 3 | CL | Portal `/research` search mặc định | Không hit stale; không banner P19 |
| 4 | CL | Bật «Chỉ hết hạn» | Chỉ hit stale (P25 regression) |
| 5 | QA | GET search không `stale_only` | JSON không có `is_stale: true` |
| 6 | QA | Prod deploy P27 | RAG flags không đổi |

---

## 7. Out of scope (P28+)

- PDF stale footer (hướng 2 → RES-UC-089)
- Demote-score thay vì exclude
- `include_stale=1` query opt-in trên staff RAG
- Bật pgvector ANN / IVFFlat prod
- Live Talkwalker, conjoint simulator, snapshot bake `valid_to` at publish

---

## 8. Hướng 2 sketch (P28 candidate — PDF stale footer)

Nếu PO chọn PDF thay vì RAG cho P27, dùng plan ngắn sau:

- **UC:** RES-UC-089
- **API:** cùng export PDF staff + portal download — scan `findings`/`recs` insight_id → `valid_to` live
- **Util:** `buildResearchReportPdf(sections, watermark?, footerLine?)` — footer mỗi trang khi có ≥1 stale ref
- **Copy:** rút gọn từ `INSIGHT_STALE_BANNER` / `PORTAL_INSIGHT_STALE_BANNER`
- **Cấm** mutate `content_snapshot`; footer runtime only
- Deploy: api-only

---

## 9. Rủi ro & mitigations

| Rủi ro | Mitigation |
|--------|------------|
| Staging users quen thấy stale + banner trong RAG | UAT note; portal vẫn có «Chỉ hết hạn» |
| Copilot “thiếu” context từ insight cũ | Chấp nhận by design; analyst xem tab Insight |
| Test P19/P22 assume stale in default hits | Cập nhật expectation hoặc pass `stale_only` trong test cũ |

---

**Next step:** PO chốt hướng 1 vs 2 → `feat/market-research-os-p27` → Task 1 TDD.
