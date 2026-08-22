# RNOS-40 — AI Gate & Rollback Drill

> **Deliverable:** Runbook published + env template + automated rollback drill  
> **Master runbook:** [`ai-service-operations.md`](./ai-service-operations.md)

## Quick start (local)

```bash
source deploy/env.local.example   # DATABASE_URL → rnosaidb
bash scripts/rnos40_rollback_drill.sh
bash scripts/rnos40_gate.sh
```

Reports:

| Script | Output |
|--------|--------|
| `rnos40_rollback_drill.sh` | `.local-dev/rnos40-rollback-drill.json` |
| `rnos40_gate.sh` | `.local-dev/rnos40-gate-report.json` |
| (included) `rnos06_uat.sh` | `.local-dev/rnos06-uat-report.json` |

## Checklist (PR RNOS-40)

- [ ] `deploy/env.ai.example` — all vars documented, defaults safe (`COPILOT=0`, `LOG_PII=0`)
- [ ] `deploy/pilot-cohort.example.json` — ≥5 pilot members
- [ ] Runbook §3–§9 aligned with code (use_case, status `succeeded`)
- [ ] Rollback drill PASS locally or staging
- [ ] User outside cohort → panel hidden / API 403

## Pilot enable (staging → prod)

1. Copy `deploy/pilot-cohort.example.json` → `pilot-cohort.json` (gitignore) with real staff UUIDs.
2. Set Nest env from `nest_env` block; rebuild ops-web with `ops_web_build_env`.
3. Run `bash scripts/rnos40_gate.sh` — all PASS.
4. UAT 8-step [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md).
5. Monitor 48h per runbook §6.3.

## Rollback (≤5 min)

```bash
PTT_AI_COPILOT_ENABLED=0
# rebuild ops-web NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=0
sudo systemctl restart ptt-crm-api ptt-ops-web
bash scripts/rnos40_rollback_drill.sh   # verify flag-off checks
```

See runbook §8–§9 for model/prompt rollback.
