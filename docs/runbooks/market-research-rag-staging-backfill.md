# Runbook — Market Research RAG staging backfill (P39 / RES-UC-101)

**Mục tiêu:** Bật pgvector + RAG re-embed trên **staging/UAT VPS** để backfill embedding 64-d (hash) → 256-d (OpenAI) và dual-write `embedding_vec`. **Prod deploy mặc định không bật flags.**

**Phụ thuộc đã ship:** P13 re-embed API · P20 dual-write · P26 install · P28 ANN gate · P36 IVFFlat.

---

## 1. Biến môi trường

| Biến | Ai set | Bắt buộc re-embed |
|------|--------|-------------------|
| `RESEARCH_RAG_ENABLED=1` | `--enable-rag-staging` hoặc PO manual | Có |
| `RESEARCH_RAG_OPENAI_EMBED_ENABLED=1` | cùng patch | Có |
| `RESEARCH_RAG_PGVECTOR_ENABLED=1` | cùng patch | Có (dual-write + ANN) |
| `OPENAI_API_KEY` | **PO manual** trong `/var/www/rnosai/.env` | Có |
| `PTT_JOBS_ENABLED=1` | worker systemd | Có (job async) |

**Không** commit hoặc ghi `OPENAI_API_KEY` vào deploy script / repo.

---

## 2. Playbook VPS (thứ tự)

```bash
cd /var/www/rnosai

# 0) PO: OPENAI_API_KEY trong .env (không commit)
# vi .env   # OPENAI_API_KEY=sk-...

# 1) One-time pgvector (sudo — cần apt)
bash scripts/install_pgvector_vps.sh
bash scripts/verify_pgvector_market_research.sh

# 2) Deploy code + DDL (prod-safe — flags off)
git pull --ff-only origin main
bash scripts/deploy_market_research_p39_vps.sh --local

# 3) Staging flags (chỉ sau PO sign-off)
bash scripts/deploy_market_research_p39_vps.sh --local --enable-rag-staging
sudo systemctl restart ptt-crm-api ptt-worker

# 4) Health check
curl -sS http://127.0.0.1:3000/api/v1/research/health | jq .
# Kỳ vọng: rag_enabled, rag_openai_embed_enabled, rag_pgvector_enabled = true
# rag_pgvector_ready, rag_ivfflat_ready = true (nếu bước 1 OK)

# 5) Re-embed (staff JWT)
export API=https://rs.pttads.vn
export TOKEN=<staff_jwt>
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/research/rag/reembed/preview"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}' \
  "$API/api/v1/research/rag/reembed"

# 6) Verify DB + RAG search (xem Actions §P39)
bash scripts/smoke_market_research_p39.sh
```

**Laptop prod deploy (flags off):**

```bash
APPLY=1 ./scripts/deploy_market_research_p39_vps.sh
```

---

## 3. Health kỳ vọng (staging)

```json
{
  "rag_enabled": true,
  "rag_openai_embed_enabled": true,
  "rag_pgvector_enabled": true,
  "rag_pgvector_ready": true,
  "rag_ivfflat_ready": true
}
```

Nếu `rag_pgvector_ready=false` → chạy lại `install_pgvector_vps.sh` (sudo). Nếu `rag_openai_embed_enabled=false` → kiểm tra `--enable-rag-staging` và restart api.

---

## 4. Re-embed API (P13 — không đổi)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/v1/research/rag/reembed/preview` | `stale_count`, `target_dims: 256` |
| POST | `/api/v1/research/rag/reembed` body `{ "limit": 50 }` | Batch; PII skip; job async nếu worker on |

Lặp POST cho đến `stale_count=0` (preview trước mỗi batch lớn).

---

## 5. Rollback staging flags

```bash
cd /var/www/rnosai
# Trong deploy/runtime.env và .env — set về 0 hoặc xóa dòng:
# RESEARCH_RAG_ENABLED=0
# RESEARCH_RAG_OPENAI_EMBED_ENABLED=0
# RESEARCH_RAG_PGVECTOR_ENABLED=0
sudo systemctl restart ptt-crm-api ptt-worker
curl -sS http://127.0.0.1:3000/api/v1/research/health | jq '.rag_enabled, .rag_openai_embed_enabled, .rag_pgvector_enabled'
```

Extension pgvector trên DB **không** cần gỡ khi rollback flags.

---

## 6. Troubleshooting

| Triệu chứng | Hướng xử lý |
|-------------|-------------|
| `verify_pgvector` FAIL | `PG_MAJOR=15 bash scripts/install_pgvector_vps.sh` hoặc cài `postgresql-*-pgvector` thủ công |
| `rag_reembed_disabled` | Bật `RESEARCH_RAG_OPENAI_EMBED_ENABLED=1` + `OPENAI_API_KEY` |
| `rag_disabled` | `RESEARCH_RAG_ENABLED=1` + restart api |
| `embedding_vec` NULL sau re-embed | `RESEARCH_RAG_PGVECTOR_ENABLED=1` và `rag_pgvector_ready=true` |
| apt pgvector sai PG major | `psql --version` → set `PG_MAJOR` đúng |
| OpenAI cost | Giữ `limit` nhỏ (50); preview `stale_count` trước |

---

## 7. UAT

Chi tiết checklist: `docs/use-cases/actions/12-RES-ACTIONS.md` §P39.

Cross-ref re-embed cơ bản: §Walkthrough UAT P13.

---

## 8. Out of scope

- Bật RAG/pgvector trên **prod** mặc định
- Cron auto re-embed không giám sát
- ops-web UI re-embed
- DROP cột JSONB embedding
