# MKT-AI Planner — Production pilot checklist (1 client · P4-01-T7)

> **Prerequisite:** Staging P3 sign-off PASS (`docs/exports/mkt-ai-p3-signoff-*.md`)  
> **Env:** [`deploy/env.mkt-ai-prod-pilot.example`](../../deploy/env.mkt-ai-prod-pilot.example)  
> **Deploy:** `MKT_AI_PILOT_LIFECYCLE_ID=<id> APPLY=1 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh`  
> **Gate:** `./scripts/mkt_ai_prod_pilot_gate.sh`  
> **Monitor:** `./scripts/mkt_ai_prod_pilot_monitor.sh` (daily × 7 days)  
> **Rollback:** `./scripts/mkt_ai_prod_pilot_rollback.sh` (≤5 min)

---

## Participants

| Role | Name | Sign-off |
|------|------|----------|
| PO / Product | | [ ] |
| Solution Lead (SP pilot) | | [ ] |
| AM (pilot client) | | [ ] |
| DevOps | | [ ] |

---

## A. Pilot identifiers (fill before deploy)

| Field | Value |
|-------|-------|
| `MKT_AI_PILOT_LIFECYCLE_ID` | __________ |
| `MKT_AI_PILOT_SERVICE_SLUG` | `meta-lead-gen` |
| Client name | __________ |
| SP email | __________ |
| AM email | __________ |
| Official TMMT plan id | __________ |
| Go-live date (D0) | __________ |

**Rules:**

- Lifecycle phải **real client** — không dùng tag `mkt-ai-smoke-seed` / `mkt-ai-seed-*`
- Stage `onboard` hoặc `deliver`; có `marketing_plan_id` (official)
- Chỉ **1 slug** trong `PTT_MKT_AI_PLANNER_SLUGS` cho prod pilot

---

## B. Pre-deploy (staging evidence)

| # | Check | Evidence | ✓ |
|---|-------|----------|---|
| 1 | P3 API UAT pass | `docs/exports/mkt-ai-p3-signoff-*.md` PASS=30 | |
| 2 | Staging multi-slug smoke | `smoke_mkt_ai_multi_slug.sh` exit 0 | |
| 3 | `pg_dump` backup prod PG | path: __________ | |
| 4 | RBAC SP có `crm_mkt_ai.generate` | Admin / seed script | |
| 5 | Rollback drill rehearsed | `mkt_ai_prod_pilot_rollback.sh` on staging | |

---

## C. Cutover (D0)

```bash
cd /var/www/rnosai
cp deploy/env.mkt-ai-prod-pilot.example deploy/runtime.env.mkt-ai-prod-pilot
# Edit MKT_AI_PILOT_LIFECYCLE_ID + client name
source .env && source deploy/runtime.env

export MKT_AI_PILOT_LIFECYCLE_ID=<id>
export MKT_AI_PILOT_CLIENT_NAME="Client Pilot A"
APPLY=1 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh
```

| # | Gate | Pass | Owner |
|---|------|------|-------|
| 1 | DDL verified | | DevOps |
| 2 | Flags single slug `meta-lead-gen` | | DevOps |
| 3 | ops-web tab AI Planner visible (SP login) | | SP |
| 4 | Context 200 on pilot lifecycle | gate script | DevOps |
| 5 | SP walkthrough Brief → Apply (1 lần) | | SP |
| 6 | Optional: Pipeline AI chạy 1 lần | | SP |

**Không bật:** slug bds/seo cho đến khi pilot pass 7 ngày.

---

## D. 7-day soak monitor

Chạy hàng ngày (cron 09:00):

```bash
cd /var/www/rnosai && source .env && source deploy/runtime.env
bash scripts/mkt_ai_prod_pilot_monitor.sh
```

| Day | Date | Monitor report | Fail rate ≤5% | SEV-1 | Notes |
|-----|------|----------------|---------------|-------|-------|
| D0 | | | | | |
| D1 | | | | | |
| D2 | | | | | |
| D3 | | | | | |
| D4 | | | | | |
| D5 | | | | | |
| D6 | | | | | |
| D7 | | | | | |

**SLO (pilot):**

- Job fail rate ≤ **5%** / 7 ngày (lifecycle pilot)
- Không SEV-1 (API down, tab broken, apply mất TMMT)
- Multi-agent parent hoàn tất ≤ **120s** stub (staging baseline)

**Escalation:** fail rate >5% hoặc SEV-1 → `mkt_ai_prod_pilot_rollback.sh` + postmortem.

---

## E. Rollback (≤5 phút)

```bash
bash scripts/mkt_ai_prod_pilot_rollback.sh
# Verify: tab ẩn, GET context → 404 mkt_ai_planner_disabled
# Data giữ nguyên — re-enable bằng redeploy prod pilot script
```

| Step | Target time | ✓ |
|------|-------------|---|
| Set flags OFF | 1 min | |
| Restart ptt-crm-api | 2 min | |
| Restart / rebuild ops-web | 5 min | |
| Confirm 404 context | | |

---

## F. Day-7 sign-off (PO)

Copy [`deploy/mkt-ai-prod-pilot-signoff.template.json`](../../deploy/mkt-ai-prod-pilot-signoff.template.json) → `.local-dev/mkt-ai-prod-pilot-signoff.json` (gitignore).

| Criterion | Met | Signed by |
|-----------|-----|-----------|
| 7-day monitor reports attached | | |
| No SEV-1 during soak | | |
| SP completed ≥1 full wizard apply | | |
| Rollback drill documented | | |
| Ready to expand slug whitelist | | |

**Next:** mở slug thứ 2 (`bds-lead-gen`) hoặc clear whitelist cho GA (WS-P4-04).

---

*Git prod pilot kickoff:* `________` · *Monitor reports:* `docs/exports/mkt-ai-prod-pilot-monitor-*.md`
