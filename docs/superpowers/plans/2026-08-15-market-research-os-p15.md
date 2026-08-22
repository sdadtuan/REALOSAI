# Market Research OS P15 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal clients see theme counts by quarter on published insights for their JWT `client_id`, with click-to-prefill portal RAG search.

**Architecture:** Mirror P14 staff analytics in `portal-research` module — published-only SQL, JWT tenancy, no free `client_id` param. Portal-web pivot table on `/research` + `prefillThemeCode` on existing portal RAG search.

**Tech Stack:** NestJS `portal-research`, Next.js `portal-web`, PostgreSQL, Jest, bash smoke/deploy.

## Global Constraints

- Corpus: **`published` only** — no `approved_client_facing`, no draft
- Tenancy: JWT `client_id` only — ignore spoofed `client_id` query on search
- **No DDL** · **No** `createInsight` · **No** staff CRM links from portal UI
- Deploy **must not** set `RESEARCH_RAG_ENABLED` / OpenAI embed flags on prod
- Deploy rebuilds **portal-web** (not ops-web)

---

## Milestone M1 — Portal repo SQL (RES-UC-076)

**Files:**
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.repository.ts`
- Test: `services/ptt-crm-api/src/portal-research/portal-research.repository.spec.ts`

- [ ] `getThemeQuarterAnalytics(clientId, year)` — published + `p.client_id = $1` + year filter + `date_trunc('quarter', i.updated_at)`
- [ ] Repo spec: no `title`, no `approved_client_facing`

## Milestone M2 — Portal API (RES-UC-076)

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/market-research.types.ts` (`PortalThemeQuarterAnalyticsPayload`)
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.service.ts`
- Modify: `services/ptt-crm-api/src/portal-research/portal-research.controller.ts`
- Test: `services/ptt-crm-api/src/portal-research/portal-research.service.spec.ts`

- [ ] `GET /api/v1/portal/research/analytics/themes?year=`
- [ ] `invalid_year` → 400; default year = UTC current
- [ ] Service spec: corpus `published`, no title leak

## Milestone M3 — portal-web UI

**Files:**
- Create: `services/portal-web/src/components/PortalThemeQuarterTable.tsx`
- Modify: `services/portal-web/src/lib/api.ts`
- Modify: `services/portal-web/src/app/research/page.tsx`
- Modify: `services/portal-web/src/components/PortalResearchRagSearch.tsx`

- [ ] Year dropdown + theme Q1–Q4 table + banner
- [ ] Click theme → prefill portal RAG `theme_code` (when RAG flag on)
- [ ] Table visible even when `rag_enabled=false`

## Milestone M4 — Docs + smoke + deploy

**Files:**
- Modify: `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` (RES-UC-076)
- Modify: `docs/use-cases/12-MARKET-RESEARCH-OS.md` (P15 section)
- Modify: `docs/use-cases/actions/12-RES-ACTIONS.md` (UAT P15)
- Create: `scripts/smoke_market_research_p15*.sh`
- Create: `scripts/deploy_market_research_p15_vps.sh`

- [ ] UAT walkthrough ~8 phút
- [ ] Deploy: DDL → api → portal-web; flags untouched

## Milestone M5 — Verification

- [ ] `bash scripts/smoke_market_research_p15.sh` — all pass

---

## Out of scope (P16+)

Conjoint lite, Talkwalker bake-off, pgvector, ISO 20252, staff QoQ delta, ops-web changes.
