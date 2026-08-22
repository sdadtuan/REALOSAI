# MKT-AI Planner — GA rollout runbook (WS-P4-06 / MKTP-UC-024 + UC-025)

> **Staging:** https://rs.pttads.vn · **Repo:** `RNOSAI`  
> **Parent SOP:** [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md)

---

## 1. Pre-GA gates (blocking)

| # | Gate | Command | Exit |
|---|------|---------|------|
| 1 | Full regression P0…P4 | `./scripts/run_mkt_ai_planner_full_regression.sh` | 0 |
| 2 | Weekly ops report | `./scripts/report_mkt_ai_ops_weekly.sh` | 0 (2 = SLO alert) |
| 3 | Phase 3 sign-off doc | PO signed [`mkt-ai-phase3-signoff.md`](./mkt-ai-phase3-signoff.md) | ✓ |
| 4 | Prod pilot soak (optional) | `bash scripts/mkt_ai_prod_pilot_monitor.sh` × 7d | SLO green |

```bash
cd /var/www/rnosai && source .env
export LIFECYCLE_ID=1
bash scripts/run_mkt_ai_planner_full_regression.sh
bash scripts/report_mkt_ai_ops_weekly.sh
```

---

## 2. Env template (GA pack)

Copy [`deploy/env.mkt-ai-ga.example`](../deploy/env.mkt-ai-ga.example) → merge into `deploy/runtime.env` + `.env`:

| Flag | Staging GA | Prod GA |
|------|------------|---------|
| `PTT_MKT_AI_PLANNER_ENABLED` | `1` | `1` |
| `PTT_MKT_AI_PLANNER_SLUGS` | 3 slugs | **empty** (no whitelist) |
| `PTT_MKT_AI_MULTI_AGENT_ASYNC` | `1` | `1` after UAT |
| `PTT_MKT_AI_PLAN_DEPTH_ENABLED` | `1` | opt-in per client |
| `PTT_MKT_AI_SCENARIO_COMPARE` | `1` | opt-in |
| `PTT_MKT_AI_PORTAL_SUMMARY` | `1` | opt-in |
| `PTT_MKT_AI_OPS_WEEKLY_REPORT` | `1` | `1` |
| `NEXT_PUBLIC_MKT_AI_PLANNER` | `1` | `1` |

Deploy:

```bash
APPLY=1 ./scripts/deploy_mkt_ai_planner_staging.sh
# prod pilot first:
APPLY=1 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh
```

---

## 3. Monitoring (MKTP-UC-025)

### 3.1 Weekly cron

```cron
# Monday 08:00 ICT — VPS deploy user
0 8 * * 1 cd /var/www/rnosai && source .env && PTT_MKT_AI_OPS_WEEKLY_REPORT=1 ./scripts/report_mkt_ai_ops_weekly.sh >> /var/log/mkt-ai-ops-weekly.log 2>&1
```

Optional Slack: `MKT_AI_OPS_SLACK_WEBHOOK=https://hooks.slack.com/...`

### 3.2 SLO thresholds

| Metric | Alert |
|--------|-------|
| Global job fail rate | >5% / 7d window |
| Hourly fail rate | >5% when ≥5 jobs/h |
| Multi-agent parent p95 | >120s staging |
| Apply → TMMT gate pass | <70% |
| Export count | Review week-over-week delta in report |

Report output: `docs/exports/mkt-ai-ops-*.md`

---

## 4. Rollback (≤5 min)

```bash
PTT_MKT_AI_PLANNER_ENABLED=0
NEXT_PUBLIC_MKT_AI_PLANNER=0
sudo systemctl restart ptt-crm-api
sudo ./scripts/deploy_ops_web.sh --restart
```

DDL tables retained — re-enable with flags `=1`.

Emergency prod pilot: `bash scripts/mkt_ai_prod_pilot_rollback.sh`

---

## 5. PO sign-off checklist

- [ ] Full regression exit 0 on staging @ known git SHA
- [ ] Weekly ops report shows fail rate + apply/gate ratio
- [ ] No open P0/P1 bugs on AI Planner tab
- [ ] RBAC caps seeded (`crm_mkt_ai.view|generate|export`)
- [ ] Portal summary smoke pass (or documented SKIP with creds)
- [ ] GA date + slug rollout order agreed (meta → bds → seo → all)
- [ ] PO + Solution Lead sign below

| Vai trò | Họ tên | Ngày | SHA |
|---------|--------|------|-----|
| PO | | | |
| Solution Lead | | | |
| DevOps | | | |

---

*Runbook v1.0 — WS-P4-06 GA rollout.*
