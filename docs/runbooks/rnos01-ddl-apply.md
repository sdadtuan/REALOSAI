# RNOS-01 — Apply Revenue OS + AI DDL (PostgreSQL)

> **RNOS:** RNOS-01 · **UC:** AI-UC-008 · **Wave:** Phase 0 · **Repo:** https://github.com/sdadtuan/RNOSAI

---

# RNOSAI local — tách biệt dự án khác (ptt_agency :5432)

> **KHÔNG** chạy RNOSAI DDL trên `ptt_agency` — dự án khác đang dùng port **5432**.  
> RNOSAI local: database **`rnosaidb`**, Docker host port **`5433`**.

---

## Mục tiêu

Apply idempotent DDL tạo **16 bảng** Revenue OS + AI trên PostgreSQL **`rnosaidb`** (local + VPS prod `@127.0.0.1:5433`), ghi `schema_migrations` version `2026-07-26-revenue-os-ai`.

**R1 core (5 bảng P0):** `ai_prompts`, `ai_agent_runs`, `ai_scores`, `ai_recommendations`, `customer_timeline_events`

---

## Tiên quyết

| # | Check | Lệnh verify |
|---|-------|-------------|
| 1 | PostgreSQL reachable | `psql "$DATABASE_URL" -c 'SELECT 1'` |
| 2 | PG v3 applied | `python3 -c "from ptt_crm.pg_schema import pg_v3_ready; assert pg_v3_ready()"` |
| 3 | `clients`, `domain_events`, `crm_leads` | `./scripts/apply_pg_ddl_v3.sh` nếu thiếu |
| 4 | Backup (prod) | `pg_dump "$DATABASE_URL" > backup-pre-rnos01.sql` |

**Thứ tự DDL platform (nếu DB mới):** xem [`vps-full-system-deploy.md`](vps-full-system-deploy.md) §PostgreSQL — apply v1→v3 trước RNOS-01.

---

## Apply staging / local

```bash
cd RNOSAI

# Option A — Docker RNOSAI riêng (port 5433 — không đụng :5432)
open -a Docker   # đợi Running
docker compose up -d postgres
source deploy/env.local.example
# DATABASE_URL=postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb

# Option B — Chỉ khi có Postgres RIÊNG (không phải instance dự án khác)
# ./scripts/create_rnosaidb.sh local

# Dry-run (pre-check only)
DRY_RUN=1 ./scripts/apply_pg_ddl_revenue_os_ai.sh

# Apply + verify
chmod +x scripts/apply_pg_ddl_revenue_os_ai.sh
./scripts/apply_pg_ddl_revenue_os_ai.sh
```

**Gate đầy đủ (apply + JSON report):**

```bash
./scripts/rnos01_pg_ddl_gate.sh
cat .local-dev/rnos01-gate-report.json
```

Verify-only (đã apply):

```bash
APPLY=0 ./scripts/rnos01_pg_ddl_gate.sh
```

---

## Apply production

1. Maintenance window + `pg_dump` backup  
2. Staging gate PASS trong 7 ngày  
3. `./scripts/apply_pg_ddl_revenue_os_ai.sh` trên prod  
4. Smoke CRM lead ingest (không regression)  
5. Ghi biên bản: migration version, gate report, operator  

**Không rollback DDL** — forward-only. Rollback app = tắt `PTT_AI_COPILOT_ENABLED=0`.

---

## Bảng tạo bởi RNOS-01

| Nhóm | Bảng |
|------|------|
| AI R1 | `ai_prompts`, `ai_agent_runs`, `ai_scores`, `ai_recommendations`, `ai_insights`, `ai_model_predictions` |
| Timeline / behavior | `customer_timeline_events`, `customer_events`, `behavior_signals`, `revenue_actions` |
| R2+ skeleton | `automation_workflows`, `automation_workflow_nodes`, `automation_workflow_executions` |
| R3 skeleton | `revenue_forecast_snapshots`, `customer_health_scores`, `renewal_opportunities` |

DDL source: [`docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql`](../specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql)

---

## Tiêu chí Done (RNOS-01)

- [ ] `schema_migrations.version = 2026-07-26-revenue-os-ai`
- [ ] 16/16 bảng tồn tại (`pg_revenue_os_ai_ready()`)
- [ ] Smoke insert/delete `ai_agent_runs` OK
- [ ] Gate report `"ok": true`
- [ ] CRM ingest không regression
- [ ] PR merged: title `RNOS-01: …` + checklist ticked

---

## SQL verify thủ công

```sql
SELECT version, applied_at FROM schema_migrations
WHERE version = '2026-07-26-revenue-os-ai';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'ai_%'
   OR table_name IN (
     'customer_timeline_events', 'customer_events', 'behavior_signals',
     'revenue_actions', 'revenue_forecast_snapshots',
     'automation_workflows', 'automation_workflow_nodes',
     'automation_workflow_executions', 'customer_health_scores',
     'renewal_opportunities'
   )
ORDER BY 1;
```

---

## Bước tiếp theo

| RNOS | Việc |
|------|------|
| RNOS-02 | `AiIntelligenceModule` + `/api/v1/ai/health` |
| RNOS-05 | `AiAuditService` wrap LLM calls |
| RNOS-16 | Hook activity → `customer_timeline_events` |

Issue: https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml

---

## Tài liệu liên quan

| Doc | Nội dung |
|-----|----------|
| [`ai-service-operations.md`](ai-service-operations.md) | Ops AI sau RNOS-02+ |
| [`2026-07-26-ai-phase1-90-day-plan.md`](../specs/2026-07-26-ai-phase1-90-day-plan.md) | Tuần 1 backlog |
| [`pr-checklist-rnos-uc-ui-uat.md`](../templates/pr-checklist-rnos-uc-ui-uat.md) | PR RNOS-01 block |
