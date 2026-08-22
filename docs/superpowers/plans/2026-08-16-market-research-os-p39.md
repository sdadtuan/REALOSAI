# Market Research OS P39 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng milestone **staging pgvector + RAG re-embed backfill** — PO có playbook một lần chạy được trên VPS, verify health/ANN, chạy batch 64-d → 256-d mà **prod deploy vẫn flags-off** (RES-UC-101).

**Architecture:** API re-embed đã có từ **P13** (`previewRagReembed`, `startRagReembed`). pgvector install **P26**, ANN gate **P28**, IVFFlat **P36**. P39 **không** thêm endpoint mới trừ khi gap thực tế — tập trung: gom script/runbook, mở rộng `install_pgvector_vps.sh` (P20 + P36), deploy flag `--enable-rag-staging` (3 biến RAG, **không** ghi `OPENAI_API_KEY`), smoke + catalog.

**Tech Stack:** bash (install/verify/deploy/smoke), NestJS health probes (đã có), Jest smoke grep, docs (OS / Actions / BA catalog / runbook).

**Hướng đề xuất:** **1** — staging pgvector + RAG backfill playbook. Portal stale = P40+.

---

## 1. Ba hướng P39

| # | Hướng | UC | Effort | Ghi chú |
|---|--------|-----|--------|---------|
| **1** | **Staging pgvector install + RAG re-embed backfill playbook** | **RES-UC-101** | **M** | **Đề xuất** — backlog P38 §hướng 2; API P13 sẵn; cần sudo PO một lần |
| 2 | Portal report-detail stale banner / ranking polish | RES-UC-085+ | M | Track portal; không liên quan pgvector |
| 3 | Live Talkwalker prod enable | RES-UC-098 | L | Blocked PO/vendor/token; flags prod cấm |

**Khóa hướng:** PO chọn **1 / 2 / 3** trước khi code. Mặc định plan này mô tả **hướng 1**.

---

## 2. Global constraints (hướng 1)

- **Prod deploy mặc định:** không set `RESEARCH_RAG_ENABLED`, `RESEARCH_RAG_OPENAI_EMBED_ENABLED`, `RESEARCH_RAG_PGVECTOR_ENABLED`, `OPENAI_API_KEY`, `RESEARCH_TALKWALKER_ENABLED`
- **`--enable-rag-staging`** chỉ khi PO sign-off staging/UAT; **không** default trên `APPLY=1` laptop
- **Không** ghi secret vào repo / deploy script / runtime.env commit
- **Không** DDL mới trừ khi phát hiện gap (reuse P20 `embedding_vec`, P36 IVFFlat)
- **Không** ops-web / portal-web UI mới (UAT qua curl + Actions)
- **Không** drop JSONB embedding column · **không** auto-prod pgvector
- Re-embed vẫn: PII skip, không `createInsight`, job type `research_rag_reembed`
- Branch: `feat/market-research-os-p39` from `main` @ P38 (`01f35927`)
- Commit chỉ khi user yêu cầu · không gộp GTM/sandbox WIP
- Deploy P39: DDL P0–P38 (fail-soft P20/P36) + **api + worker** (re-embed job); ops-web **không bắt buộc** trừ khi copy banner

---

## 3. Hành vi — RES-UC-101 (hướng 1)

### 3.1 Phụ thuộc đã ship

| Phase | Artifact | Vai trò P39 |
|-------|----------|-------------|
| P13 | `GET/POST /api/v1/research/rag/reembed/*` | Batch backfill 64→256-d |
| P20 | `embedding_vec`, dual-write | Ghi vec khi flag∧ready |
| P26 | `install_pgvector_vps.sh`, `rag_pgvector_ready` | Extension + column probe |
| P28 | `shouldUsePgvectorAnn`, `--enable-pgvector-staging` | ANN path staging |
| P36 | IVFFlat fail-soft, `rag_ivfflat_ready` | Index sau install |

### 3.2 Staging enable matrix

| Biến | Ai set | Ghi chú |
|------|--------|---------|
| `RESEARCH_RAG_ENABLED=1` | `--enable-rag-staging` hoặc PO manual | Bắt buộc re-embed |
| `RESEARCH_RAG_OPENAI_EMBED_ENABLED=1` | cùng patch | Bắt buộc re-embed |
| `RESEARCH_RAG_PGVECTOR_ENABLED=1` | cùng patch | Dual-write + ANN |
| `OPENAI_API_KEY` | **PO manual** trên VPS `.env` | **Không** patch script |
| `PTT_JOBS_ENABLED=1` | đã có worker | Job async re-embed |

**Health kỳ vọng sau staging enable + restart api:**

```json
{
  "rag_enabled": true,
  "rag_openai_embed_enabled": true,
  "rag_pgvector_enabled": true,
  "rag_pgvector_ready": true,
  "rag_ivfflat_ready": true
}
```

Nếu `rag_pgvector_ready=false` → chạy `install_pgvector_vps.sh` (sudo) trước re-embed.

### 3.3 Playbook VPS (thứ tự bắt buộc)

```bash
# 0) PO: OPENAI_API_KEY trong /var/www/rnosai/.env (không commit)

# 1) One-time pgvector (sudo)
cd /var/www/rnosai
bash scripts/install_pgvector_vps.sh          # P39: P20 + P36
bash scripts/verify_pgvector_market_research.sh

# 2) Deploy code + DDL (prod-safe default)
git pull --ff-only origin main
bash scripts/deploy_market_research_p39_vps.sh --local

# 3) Staging flags (PO sign-off)
bash scripts/deploy_market_research_p39_vps.sh --local --enable-rag-staging
sudo systemctl restart ptt-crm-api ptt-worker

# 4) Re-embed UAT (staff JWT)
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/research/rag/reembed/preview"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}' \
  "$API/api/v1/research/rag/reembed"

# 5) Verify DB + search G3 paraphrase (Actions §P13 + §P39)
```

### 3.4 Re-embed semantics (unchanged P13)

| Input | Cap | Output |
|-------|-----|--------|
| `GET …/rag/reembed/preview` | staff scope | `{ stale_count, target_dims: 256, target_model }` |
| `POST …/rag/reembed` `{ limit }` | staff + jobs | `{ status, processed, skipped_pii, remaining }` |

**Stale:** insight embed `embed_dims=64` (hash/local) khi target OpenAI 256-d.

**Dual-write on re-embed:** `write_vec = RESEARCH_RAG_PGVECTOR_ENABLED && rag_pgvector_ready`.

### 3.5 Gap cần sửa trong P39 (ops code)

| Gap hiện tại | Fix P39 |
|--------------|---------|
| `install_pgvector_vps.sh` chỉ apply P20 | Thêm apply P36 IVFFlat sau P20 |
| RAG flags rải P11/P13/P28 manual | `--enable-rag-staging` gom 3 biến trong deploy P39 |
| Actions §P39 trống | UAT walkthrough đầy đủ (P13 + pgvector + ANN) |
| Không runbook riêng | `docs/runbooks/market-research-rag-staging-backfill.md` |

**Không làm nếu không cần:** endpoint mới, ops-web panel re-embed.

---

## 4. Hành vi sketch — hướng 2 (P40+, không code P39)

| | |
|--|--|
| Scope | Portal report-detail stale banner polish |
| UC | RES-UC-085 area |
| Không gộp | pgvector sudo playbook |

---

## 5. File map (hướng 1)

| File | Role |
|------|------|
| `scripts/install_pgvector_vps.sh` | + apply P36 sau P20; verify message |
| `scripts/deploy_market_research_p39_vps.sh` | DDL P0–P38; `--enable-rag-staging`; api + worker |
| `scripts/smoke_market_research_p39_m*.sh` | m1 prod-safe; m2–m5 grep/runbook refs |
| `scripts/smoke_market_research_p39.sh` | orchestrator m1–m5 |
| `docs/runbooks/market-research-rag-staging-backfill.md` | PO/LD runbook đầy đủ |
| `docs/specs/modules/RNOSAI-BA-RES-UseCases.md` | RES-UC-101 row + section |
| `docs/use-cases/12-MARKET-RESEARCH-OS.md` | §P39 |
| `docs/use-cases/actions/12-RES-ACTIONS.md` | §P39 UAT (thay backlog trống) |

**Unchanged (trừ bugfix):** `market-research.service.ts` re-embed logic · conjoint P38 · ISO gap P37 · portal.

---

## 6. Tasks (hướng 1)

### Task 1 — install_pgvector chain P20+P36

- [x] Sửa `install_pgvector_vps.sh`: sau P20 gọi `apply_pg_ddl_market_research_p36.sh`
- [x] Cập nhật header comment + verify output gợi ý `rag_ivfflat_ready`
- [x] Chạy local dry: script syntax `bash -n`

**Verify:** comment trong script liệt kê đúng thứ tự extension → P20 → P36 → verify.

### Task 2 — deploy P39 + staging patch

- [x] Tạo `deploy_market_research_p39_vps.sh` (pattern P38):
  - DDL P0–P38 (copy list từ P38 deploy)
  - `verify_pgvector` → WARN nếu fail (giống P28)
  - `--enable-rag-staging` patch 3 keys vào `deploy/runtime.env` + `.env` (writable only)
  - Build/test api; restart `ptt-crm-api` + `ptt-worker`
  - **Không** rebuild ops-web/portal mặc định
- [x] `patch_rag_staging_env` helper: idempotent sed như P28

**Verify:** default deploy không chứa `RESEARCH_RAG_ENABLED=1` trong output; `--enable-rag-staging` có 3 dòng.

### Task 3 — smoke P39

- [x] `smoke_market_research_p39_m1.sh`: deploy script tồn tại; default không flip RAG
- [x] `m2`: runbook file tồn tại; link P13 UAT
- [x] `m3`: `install_pgvector_vps.sh` gọi P36 apply
- [x] `m4`: grep deploy không ghi `OPENAI_API_KEY`
- [x] `m5`: orchestrator pass

**Verify:** `bash scripts/smoke_market_research_p39.sh` exit 0 trên main + branch.

### Task 4 — Docs + catalog

- [x] RES-UC-101: «RAG re-embed backfill staging playbook (pgvector + flags)»
- [x] OS §P39: tóm tắt UC, gates api+worker, không portal
- [x] Actions §P39 UAT (~12 phút):

| # | Actor | Thao tác | Kỳ vọng |
|---|-------|----------|---------|
| 1 | PO | `install_pgvector_vps.sh` + verify | ext + column OK |
| 2 | PO | Deploy P39 default | WARN pgvector nếu chưa install; flags off |
| 3 | PO | `--enable-rag-staging` + `OPENAI_API_KEY` manual + restart | health 5 field true (ready phụ thuộc bước 1) |
| 4 | LD | `GET …/rag/reembed/preview` | `stale_count` ≥ 1 |
| 5 | LD | `POST …/rag/reembed` limit 50 | `processed` ≥ 1 |
| 6 | AN | DB | `embed_dims=256`, `embedding_vec` NOT NULL (staging flag on) |
| 7 | AN | RAG search paraphrase G3 | hit re-embedded insight |
| 8 | AN | Health ANN | `rag_pgvector_enabled` ∧ `rag_pgvector_ready` → ByVec path (log/metrics nếu có) |
| 9 | LD | PII row in batch | `skipped_pii` ≥ 1 |
| 10 | QA | Prod deploy P39 **không** `--enable-rag-staging` | RAG/embed/pgvector flags false |

- [x] Runbook: copy playbook §3.3 + rollback (unset 3 flags, restart)

**Verify:** Actions checklist copy-paste được cho LD.

### Task 5 — VPS staging execution (PO, không commit)

- [ ] PO chạy playbook trên VPS thật
- [ ] Tick UAT §P39 Actions
- [ ] Ghi note vào runbook nếu PG major / apt khác dev

---

## 7. Deploy

```bash
# Laptop (prod-safe — không staging flags)
APPLY=1 ./scripts/deploy_market_research_p39_vps.sh

# VPS staging (sau PO sign-off)
cd /var/www/rnosai && git pull --ff-only origin main
bash scripts/install_pgvector_vps.sh                    # one-time, sudo
bash scripts/deploy_market_research_p39_vps.sh --local --enable-rag-staging
# PO: OPENAI_API_KEY in .env
sudo systemctl restart ptt-crm-api ptt-worker
bash scripts/smoke_market_research_p39.sh
```

**Services:** api + worker (bắt buộc job re-embed). ops-web/portal optional.

---

## 8. UAT gates (hướng 1)

- [ ] `npm test` market-research (api) — không regression
- [ ] Smoke P39 m1–m5 pass CI/local
- [ ] Staging UAT Actions §P39 bước 1–10
- [ ] Prod deploy: health `rag_*` false; không leak API key

---

## 9. Out of scope (P40+)

- pgvector / RAG **prod** enable
- Mass re-embed không giám sát (cron auto)
- ops-web UI re-embed dashboard
- DROP JSONB embedding
- Portal what-if / conjoint persist
- Live Talkwalker prod (hướng 3)
- MOE / ISO cert claim

---

## 10. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| sudo apt pgvector fail (PG major lệch) | Runbook `PG_MAJOR=15`; PO manual package |
| OPENAI cost batch lớn | UAT `limit: 50`; PO approve batch size |
| Mix 64/256-d trong corpus | Re-embed until `stale_count=0`; preview first |
| Deploy vô tình bật staging flags | Smoke m1/m4; default off; QA step 10 |
| IVFFlat trên corpus nhỏ | Fail-soft OK; ANN vẫn chạy sequential scan |
| GTM WIP lẫn commit | Stage chỉ file P39 |

---

## 11. Self-review

| Requirement | Task |
|-------------|------|
| Đóng backlog P38 hướng 2 | Task 1–5 |
| Prod flags off | Task 2 smoke + deploy default |
| Reuse P13 API | §3.1 — no new endpoints |
| PO runnable playbook | Task 4 runbook + §3.3 |
| Worker restart | Task 2 deploy |

**Next step:** PO khóa **hướng 1** → `code P39 theo hướng 1` → branch `feat/market-research-os-p39`.
