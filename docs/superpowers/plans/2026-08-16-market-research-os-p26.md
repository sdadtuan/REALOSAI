# Market Research OS P26 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install pgvector on VPS and expose DB readiness via health (`rag_pgvector_ready`) without enabling RAG/pgvector flags on prod (RES-UC-087).

**Architecture:** Ops scripts install `postgresql-*-pgvector` and re-apply P20 DDL. API probes `pg_extension vector` + `embedding_vec` column on `OnModuleInit`, caches result for sync `health()`. Distinct from `rag_pgvector_enabled` (env flag, stays off prod).

**Tech Stack:** bash (apt/psql), NestJS `market-research` + `portal-research`, Jest, api-only deploy.

**Hướng đã khóa:** 1 — pgvector prod / VPS readiness. hide stale from ranking / PDF footer / live Talkwalker = out.

## Global Constraints

- **No new DDL file** · reuse P20 DDL + fail-soft apply script
- **No** ops-web / portal-web rebuild
- **Do not** set `RESEARCH_RAG_PGVECTOR_ENABLED` / RAG / OpenAI embed on prod deploy
- **No** IVFFlat/HNSW, JSONB cutover, or ANN behavior change
- Branch: `feat/market-research-os-p26` from `main` (`5133d557`+)
- Commit chỉ khi user yêu cầu

## File map

| File | Role |
|------|------|
| `pgvector-ready.util.ts` | SQL + `parsePgvectorReadyRow` |
| `market-research.repository.ts` | `probePgvectorReady()` |
| `portal-research.repository.ts` | same probe |
| `market-research.service.ts` | `OnModuleInit` cache + `rag_pgvector_ready` |
| `portal-research.service.ts` | mirror health field |
| `install_pgvector_vps.sh` | apt install + extension + P20 DDL |
| `verify_pgvector_market_research.sh` | psql check exit 0/1 |
| `deploy_market_research_p26_vps.sh` | api-only; warn if verify fails |
| Catalog / OS / Actions / smoke | RES-UC-087 |

## Out of scope (P27+)

Hide stale from default RAG ranking, PDF stale footer, enable `RESEARCH_RAG_PGVECTOR_ENABLED` on prod, IVFFlat/HNSW, live Talkwalker, conjoint simulator.
