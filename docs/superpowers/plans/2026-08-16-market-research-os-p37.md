# Market Research OS P37 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff xem **ISO 20252 gap-check** read-only trên project — đối chiếu Planning → Execution → Supervision → Reporting với artifact OS hiện có (RES-UC-099). **Không** chứng nhận ISO.

**Architecture:** `GET /api/v1/research/projects/:id/governance/iso-gap` trả checklist `{ items[] }` tính từ DB (project, RQ, sources, evidence, insights, reviews, reports). Util thuần + spec fixture. ops-web panel read-only trên project detail.

**Tech Stack:** NestJS, Jest, ops-web vitest, bash deploy/smoke. **Không** DDL (phase 1). Không portal.

**Hướng đề xuất:** **1** — ISO gap-check. Persist what-if = P38.

---

## 1. Ba hướng P37

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **ISO 20252 gap-check (read-only)** | **RES-UC-099** | **M** | **Đề xuất** — Design §17 exit; không sudo/vendor/flags |
| 2 | Persist conjoint what-if (staff) | RES-UC-100 | S–M | Unblocked; F5 giữ scenario; cần DDL nhỏ |
| 3 | Gộp gap-check + persist | — | L | **Cấm** — 2 subsystem; vi phạm slice |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **Read-only** — không mutate project / insight / report
- **Cấm** ghi «ISO certified» / «đạt chuẩn 20252» — copy «Gap-check nội bộ»
- **Cấm** `createInsight` · không portal · không RAG/Talkwalker flags
- Tenancy: `loadScopedProject` + JWT scope giống GET project
- Không DDL P37 (checks derive từ bảng P0–P23)
- Deploy: api + ops-web; flags prod không đổi
- Branch: `feat/market-research-os-p37` from `main` @ P36
- Commit chỉ khi user yêu cầu · không gộp GTM WIP

---

## 3. Hành vi — RES-UC-099 (hướng 1)

### 3.1 Phases (ISO 20252 MVP mapping — Design §6)

| Phase | Label VI | Checks (id) |
|-------|----------|-------------|
| planning | Lên kế hoạch | `decision_statement`, `has_rq`, `product_type`, `geo` |
| execution | Thu thập & phân tích | `has_source`, `has_verified_evidence`, `has_study_or_desk` |
| supervision | Giám sát | `has_insight_review`, `no_draft_published`, `acf_has_evidence` |
| reporting | Báo cáo | `has_report_version`, `methodology_not_stub` (TC/CB), `report_has_findings` |

Mỗi item: `{ id, phase, label_vi, status: 'pass'|'partial'|'fail'|'na', hint_vi? }`.

**Rule status:**
- `pass` — điều kiện đủ
- `partial` — có artifact nhưng thiếu chi tiết (vd. methodology stub trên TC)
- `fail` — thiếu hoàn toàn
- `na` — không áp dụng (vd. `has_study_or_desk` khi chỉ desk — vẫn pass nếu có source)

**Aggregate:** `{ ok: true, project_id, product_type, items, summary: { pass, partial, fail, na } }` — **không** score % cert.

### 3.2 API

```
GET /api/v1/research/projects/:id/governance/iso-gap
→ 200 IsoGapCheckPayload
→ 403/404 scope giống getProject
```

Cap `view`. Không query params (YAGNI).

### 3.3 Util (TDD first)

File: `iso20252-gap.util.ts`

```ts
export type IsoGapStatus = 'pass' | 'partial' | 'fail' | 'na';

export type IsoGapItem = {
  id: string;
  phase: 'planning' | 'execution' | 'supervision' | 'reporting';
  label_vi: string;
  status: IsoGapStatus;
  hint_vi?: string;
};

export type IsoGapInput = {
  project: { decision_statement?: string | null; product_type: string; geo?: string[] };
  rq_count: number;
  source_count: number;
  verified_evidence_count: number;
  study_count: number;
  ai_run_count: number;
  insight_counts: { draft: number; published: number; approved_client_facing: number };
  review_count: number;
  latest_report?: { methodology?: Record<string, unknown>; findings_count: number } | null;
};

export function buildIso20252GapCheck(input: IsoGapInput): IsoGapItem[];
```

Repo helper: `getIsoGapFacts(projectId)` — 1–2 SQL aggregates (không N+1 leak title).

Service: `getIsoGapCheck(projectId, scope)` → `{ items: buildIso20252GapCheck(facts) }`.

### 3.4 ops-web

- Component `ResearchIsoGapPanel` `data-testid="iso-gap-panel"`
- Banner: `ISO_GAP_BANNER` — «Gap-check nội bộ — không thay audit ISO 20252»
- Mount trên `/crm/research/[id]` (tab hoặc section dưới meta) — **read-only**, không nút sửa
- `fetchResearchIsoGap(token, projectId)` trong `market-research-api.ts`

---

## 4. Hành vi sketch — hướng 2 (P38, không code P37)

Nếu PO chọn persist what-if thay P37:

| | |
|--|--|
| DDL | `crm_research_cj_whatif_runs` (project_id, study_id, scenario jsonb, n_match, n_choices, match_pct, created_by) |
| API | `POST …/conjoint/what-if` body `{ persist?: true }` → insert sau compute; `GET …/conjoint/what-if` → latest 20 |
| Cấm | MOE, `createInsight`, portal |
| UI | ConjointPane: checkbox «Lưu kết quả» + list lịch sử |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `iso20252-gap.util.ts` + `.spec.ts` | Pure checklist logic |
| `market-research.repository.ts` + spec | `getIsoGapFacts` aggregates |
| `market-research.service.ts` + spec | `getIsoGapCheck` |
| `market-research.controller.ts` | `GET governance/iso-gap` |
| `market-research.types.ts` | `IsoGapCheckPayload` |
| `ops-web` `ResearchIsoGapPanel.tsx` + util spec | Panel + banner |
| `ops-web` `research/[id]/page.tsx` | Mount panel |
| `ops-web` `market-research-api.ts` | Client fetch |
| Catalog / OS / Actions | RES-UC-099; UAT P37; P38+ |
| `scripts/deploy_market_research_p37_vps.sh` | api + ops-web |
| `scripts/smoke_market_research_p37*.sh` | m1–m5 |

**Unchanged:** portal-web, conjoint what-if compute, Talkwalker, pgvector flags.

---

## 6. Tasks (hướng 1)

### Task 1 — Util + repo (TDD)

- [x] Spec: empty project → planning fails, execution fails
- [x] Spec: fixture TC + verified evidence + report → mixed pass/partial
- [x] Repo spec: SQL scoped `project_id`, không leak `title`

### Task 2 — Service + controller

- [x] `GET governance/iso-gap` trước `:id` routes conflict
- [x] Service spec: cross-tenant 403; facts bind scoped project

### Task 3 — ops-web + docs + deploy

- [x] Panel render items by phase; banner no cert wording
- [x] RES-UC-099 catalog; OS §P37; Actions UAT P37
- [x] Deploy api + ops-web; smoke m1–m5

---

## 7. Smoke (hướng 1)

| Smoke | Check |
|-------|--------|
| m1 | `iso20252-gap.util.spec.ts` P37 |
| m2 | service spec P37 |
| m3 | grep `governance/iso-gap` + `iso-gap-panel` |
| m4 | docs RES-UC-099 + deploy |
| m5 | api + ops util regression |

---

## 8. UAT P37 (≈8 phút)

**Mục tiêu:** *«Lead mở project → thấy checklist ISO gap; không claim certified; prod flags không đổi.»*

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | Lead | Mở project mới (intake) | Nhiều `fail` ở execution/reporting |
| 2 | AN | Thêm source + verified evidence + insight ACF | Execution/supervision cải thiện |
| 3 | Lead | Report TC + methodology stub | `methodology_not_stub` = partial/fail |
| 4 | QA | JSON response | Không «certified»; không leak client title |
| 5 | QA | Prod deploy | RAG/Talkwalker flags không đổi |

---

## 9. Out of scope (P38+)

- Persist conjoint what-if (RES-UC-100)
- ISO **certification** / external auditor workflow
- Portal gap-check widget
- Auto-fix / mutate project from checklist
- pgvector install / IVFFlat prod enable

---

## 10. Self-review

| Requirement | Task |
|-------------|------|
| Read-only gap-check | Task 1–2 |
| No cert wording | Util banner + UAT |
| Design §6 phases | Util phases table |
| No DDL | Global constraints |
| api + ops-web deploy | Task 3 |

**Next step:** PO khóa **hướng 1 hoặc 2** → `code P37 theo hướng X` → branch `feat/market-research-os-p37`.
