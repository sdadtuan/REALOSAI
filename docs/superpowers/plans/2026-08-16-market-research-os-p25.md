# Market Research OS P25 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Portal RAG (`/research`) adds optional «Chỉ hết hạn» filter (RES-UC-086), mirroring staff P18 Insight tab copy while ranking only stale published hits when `stale_only=1`.

**Architecture:** Extend existing `GET /api/v1/portal/research/insights/search` with query `stale_only`. `rankRagHits` filters `is_stale` before `limit` slice. portal-web checkbox re-searches with the flag; default search unchanged (warn-only banners P19).

**Tech Stack:** NestJS `portal-research`, `research-rag.util.ts`, Next.js `PortalResearchRagSearch`, Jest, bash smoke/deploy.

**Hướng đã khóa:** 1 — portal RAG «Chỉ hết hạn». pgvector prod / hide stale from ranking / live Talkwalker = out.

## Global Constraints

- **No DDL** · **No** new endpoint · **No** ops-web · **No** RAG/Talkwalker/pgvector flag changes on prod deploy
- Stale rule (P18/P19): UTC calendar via `isInsightStale`
- Corpus: **published + JWT `client_id` only**
- **Do not** hide stale hits by default — filter is opt-in via checkbox / `stale_only=1`
- Deploy: api + portal-web
- Branch: `feat/market-research-os-p25` from `main` (`71666161`+)
- Commit chỉ khi user yêu cầu

## File map

| File | Role |
|------|------|
| `market-research.types.ts` | `PortalRagSearchInput.stale_only` |
| `research-rag.util.ts` | `stale_only` opt + `parseRagStaleOnlyFlag` |
| `portal-research.service.ts` | pass flag to `rankRagHits` |
| `PortalResearchRagSearch.tsx` | checkbox «Chỉ hết hạn (N)» |
| `portal-web/src/lib/api.ts` | pass `stale_only=1` |
| Catalog / OS / Actions / smoke / deploy | RES-UC-086 |

## Out of scope (P26+)

pgvector prod, hide stale from default ranking, PDF stale footer, live Talkwalker, conjoint simulator.
