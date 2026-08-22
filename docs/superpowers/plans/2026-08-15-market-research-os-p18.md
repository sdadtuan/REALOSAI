# Market Research OS P18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Staff insight list and drawer show a stale banner when `valid_to` is before today (FR-INS-07), with optional filter for expired insights.

**Architecture:** `isInsightStale` util in API `mapInsight` adds `is_stale` on every insight row. ops-web reuses banner + filter on project Insights tab; no new endpoints or DDL.

**Tech Stack:** NestJS, Next.js ops-web, Jest, Vitest, bash smoke/deploy.

**Hướng đã khóa:** 1 — stale `valid_to` banner (RES-UC-079). Portal / conjoint / Talkwalker / pgvector = out.

## Global Constraints

- **No DDL** · **No** new endpoint · **No** portal changes · **No** RAG flag changes
- Stale when `valid_to` set and `valid_to < today` (UTC calendar); `valid_to === today` → not stale
- Deploy **api + ops-web** (not portal-web)

---

## Milestones

- M1: `insight-stale.util` + `is_stale` on `ResearchInsightRow` / repository `mapInsight`
- M2: ops-web banner (InsightCard + InsightDrawer) + filter «Chỉ hết hạn»
- M3: RES-UC-079 docs + smoke + deploy
- M4: `bash scripts/smoke_market_research_p18.sh`

## Out of scope (P19+)

Conjoint lite, Talkwalker bake-off, pgvector, ISO 20252, portal stale banner.
