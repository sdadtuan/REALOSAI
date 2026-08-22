# Market Research OS P36 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** IVFFlat index fail-soft trên `embedding_vec` + Talkwalker Search API live khi có `TALKWALKER_PROJECT_ID` (RES-UC-097 / RES-UC-098).

**Architecture:** P36 DDL tạo IVFFlat index nếu extension `vector` sẵn; health `rag_ivfflat_ready`. `runTalkwalker`: flag+token+project_id → HTTP `api.talkwalker.com`; thiếu project_id → stub P23.

**Tech Stack:** PostgreSQL pgvector IVFFlat, NestJS, Jest, bash deploy/smoke. Không portal-web.

**Hướng đã khóa:** **3** — IVFFlat fail-soft + live Talkwalker.

---

## Global constraints

- **Cấm** bật `RESEARCH_TALKWALKER_ENABLED` / token / `RESEARCH_RAG_PGVECTOR_ENABLED` trên deploy prod mặc định
- Stub path **giữ nguyên** khi thiếu `TALKWALKER_PROJECT_ID`
- Live path: **cấm** `createInsight`; sources only; PII → 400 trước HTTP
- IVFFlat apply **fail-soft** nếu thiếu extension (như P20)
- Không drop JSONB; không ops-web UI mới (banner copy optional)
- Branch: `feat/market-research-os-p36`

---

## Tasks

### Task 1 — IVFFlat (TDD)

- [x] DDL + apply script fail-soft
- [x] `pgvector-ivfflat.util` + repo probe + health `rag_ivfflat_ready`

### Task 2 — Live Talkwalker (TDD)

- [x] `talkwalker-client.util` + `talkwalker-collect` + config `TALKWALKER_PROJECT_ID`
- [x] Service: live vs stub; `note: talkwalker_live | talkwalker_stub`
- [x] Tests: live persist, HTTP fail → `talkwalker_failed`, stub unchanged

### Task 3 — Docs + deploy + smoke

- [x] RES-UC-097 / 098; OS §P36; UAT P36; deploy api-only + P36 DDL
