# Leader depth planning — WS-P4-02

> **UC:** MKTP-UC-026 (partial S2), MKTP-UC-031  
> **Flags:** `PTT_MKT_AI_PLAN_DEPTH_ENABLED=1`, `PTT_MKT_AI_BRIEF_UPLOAD_ENABLED=1`

## S2 deliverables (shipped)

| Task | API / UI |
|------|----------|
| P4-02-D3 | `POST .../brief/upload` + BriefIntakeForm upload |
| P4-02-D6 | `kpi_tree_json` on draft + `AiKpiTreeEditor` |
| P4-02-D8 | `brief_readiness` in context + banner &lt;70 |

## DDL (once per DB)

```bash
psql "$DATABASE_URL" -f docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner-p4.sql
```

## Deploy

```bash
export PTT_MKT_AI_PLAN_DEPTH_ENABLED=1
export PTT_MKT_AI_BRIEF_UPLOAD_ENABLED=1
sudo systemctl restart ptt-crm-api
```

## Verify

```bash
LIFECYCLE_ID=1 bash scripts/smoke_mkt_ai_plan_depth.sh
```

## S3 next (not S2)

- Section regenerate + reasoning (D1, D2)
- Milestones + risks gate (D4, D5)
- Content variants (D7)
