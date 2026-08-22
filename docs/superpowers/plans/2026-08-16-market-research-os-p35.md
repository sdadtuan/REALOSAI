# Market Research OS P35 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách portal xem bảng conjoint lite (share + gợi ý gói) của project `PRICE_OFFER` cùng `client_id` — **chỉ đọc**, không what-if / compute (RES-UC-096).

**Architecture:** `GET /api/v1/portal/research/conjoint` → latest `crm_research_cj_summaries` JOIN project `client_id` + `product_type='PRICE_OFFER'`. DTO portal **không** `created_by` / `title`. FE ẩn khối khi `summary=null`.

**Tech Stack:** NestJS portal-research, Jest, portal-web vitest, bash deploy/smoke. Không DDL, không ops-web.

**Hướng đã khóa:** **1** — portal conjoint lite. IVFFlat / live Talkwalker = P36+.

---

## Global constraints

- **No new DDL** · **No ops-web** · **Cấm** POST compute / what-if trên portal
- **Cấm** `createInsight` · **cấm** MOE / logit
- Tenancy: chỉ `p.client_id = JWT` · `PRICE_OFFER`
- Không summary → `{ summary: null }` (200), không 404
- Payload không `created_by`, không `p.title`
- Deploy: flags RAG / pgvector / Talkwalker **không** đổi
- Branch: `feat/market-research-os-p35` from `main`
- Commit chỉ khi user yêu cầu · **không** gộp GTM WIP
- Deploy: DDL P0–P23 + api (heap 2048) + portal-web

---

## Hành vi

### Repo

```sql
SELECT s.n, s.n_choices, s.attributes, s.recommendation,
       s.limitation_note, s.statistical_inference
FROM crm_research_cj_summaries s
JOIN crm_research_projects p ON p.id = s.project_id
WHERE p.client_id = $1 AND p.product_type = 'PRICE_OFFER'
ORDER BY s.id DESC
LIMIT 1
```

### DTO

```ts
export type PortalCjSummary = {
  n: number;
  n_choices: number;
  attributes: Array<{ name: string; levels: Array<{ label: string; count: number; share_pct: number }>; top_level: string | null }>;
  recommendation: { levels: Array<{ attribute: string; level: string; share_pct: number }> };
  limitation_note: string;
  statistical_inference: false;
};
```

### UI

`/research` — `PortalConjointLite` `data-testid="portal-conjoint-lite"`. Banner: không MOE / market share. Ẩn khi null.

---

## File map

| File | Role |
|------|------|
| `portal-research.repository.ts` + spec | `getLatestCjSummaryForClient` |
| `portal-research.service.ts` + spec | `getConjoint` |
| `portal-research.controller.ts` | `GET conjoint` |
| `portal-research.types.ts` | `PortalCjSummary` |
| `portal-web api.ts` | `portalResearchConjoint` |
| `portal-conjoint.util.ts` + spec | format share |
| `PortalConjointLite.tsx` | bảng |
| `app/research/page.tsx` | mount |
| Catalog / OS / Actions | RES-UC-096; UAT P35; P36+ |
| `scripts/deploy_market_research_p35_vps.sh` | api + portal-web |
| `scripts/smoke_market_research_p35*.sh` | m1–m5 |

---

## Tasks

### Task 1 — Repo + service (TDD)

- [x] Repo spec: SQL có `client_id`, `PRICE_OFFER`; **không** `title` / `created_by`
- [x] Service: JWT acme → summary mapped; null → `{ summary: null }`; repo bind `user.client_id`

### Task 2 — Controller + portal UI

- [x] `GET conjoint` trước `reports/:id` không conflict
- [x] Component bảng + gợi ý; **không** nút Đếm khớp / Tính conjoint
- [x] vitest `formatSharePct`

### Task 3 — Docs + deploy + smoke

| Smoke | Check |
|-------|--------|
| m1 | repo spec P35 |
| m2 | service spec P35 |
| m3 | grep `GET conjoint` + `portal-conjoint-lite` |
| m4 | docs RES-UC-096 + deploy |
| m5 | api portal-research + portal util |

UAT: CL thấy bảng khi staff đã tính; JWT client B không thấy dữ liệu A; không nút what-if; flags không đổi.
