# Market Research OS P16 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Staff theme-quarter analytics shows QoQ and YoY percent deltas per theme/quarter without new endpoints or DDL.

**Architecture:** Reuse P14 `GET /analytics/themes`; service fetches `year` + `year-1`, enriches rows via `enrichThemeQuarterRows`. ops-web table renders Δ under each quarter cell.

**Tech Stack:** NestJS, Next.js ops-web, Jest, bash smoke/deploy.

## Global Constraints

- Same corpus/tenancy as P14 · **No DDL** · **No** portal changes · **No** RAG flag changes
- `delta_*_pct = null` when prior count is 0 or missing (Q1 QoQ always null)

---

## Milestones

- M1: `theme-quarter-delta.util` + unit tests
- M2: Service dual-year fetch + enrich; service spec P16
- M3: ops-web table Δ QoQ/YoY + API types
- M4: RES-UC-077 docs + smoke + deploy (api + ops-web)
- M5: `bash scripts/smoke_market_research_p16.sh`

## Out of scope (P17+)

Portal QoQ, conjoint, Talkwalker, pgvector, stale `valid_to` banner.
