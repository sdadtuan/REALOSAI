# Gate R1 — Prod pilot sign-off

> **Wave:** R1 · **Deliverable:** Automated gate + manual sign-off + pilot enable  
> **Master runbook:** [`ai-service-operations.md`](./ai-service-operations.md) §12–§13  
> **UAT:** [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md) — 8 bước pilot walkthrough

## Gate R1 criteria (§8.3 / §12)

| # | Criteria | Automated check |
|---|----------|-----------------|
| 1 | Lead created → score ≤30s | E2E + SQL `g1-score-coverage` |
| 2 | Summarize P95 ≤5s | SQL `g2-summarize-p95` |
| 3 | Draft requires approve; no auto-send | RNOS-39 E2E `assertNoOutboundSendButtons` |
| 4 | 100% AI calls audited | SQL `g4-audit-24h` |
| 5 | No PII prompt logs prod | `PTT_AI_LOG_PII=0` + `PTT_AI_LOG_PROMPTS=0` |
| 6 | Copilot on `/crm/leads/[id]` | RNOS-39 E2E + UAT 8-step sign-off |

## Quick start (local / staging)

```bash
cd RNOSAI
source deploy/env.local.example          # DATABASE_URL → rnosaidb:5433
export PTT_AI_LOG_PII=0 PTT_AI_LOG_PROMPTS=0

# Full orchestrator (RNOS-40 + RNOS-39 E2E + metrics + artifacts)
bash scripts/rnos_r1_prod_pilot_gate.sh
# → .local-dev/rnos-r1-prod-pilot-gate-report.json
```

**Skip heavy steps (artifact-only smoke):**

```bash
R1_SKIP_E2E=1 R1_SKIP_RNOS40=1 R1_SKIP_METRICS=1 \
  bash scripts/rnos_r1_prod_pilot_gate.sh
```

## Sub-gates (run individually)

| Script | Purpose | Report |
|--------|---------|--------|
| `scripts/rnos40_gate.sh` | Env safety, rollback drill, UAT smoke | `.local-dev/rnos40-gate-report.json` |
| `scripts/rnos39_gate.sh` | Playwright 8-step copilot E2E | `.local-dev/rnos39-gate-report.json` |
| `scripts/rnos_r1_metrics_probe.sh` | SQL probes G1–G6 | `.local-dev/rnos-r1-metrics-probe.json` |
| `scripts/rnos_r1_pilot_enable.sh` | Validate cohort JSON, print env | dry-run (default) |

## Prod pilot go-live sequence

### 1. Pre-flight (staging)

```bash
source deploy/env.local.example
bash scripts/rnos_r1_prod_pilot_gate.sh
```

Tất cả automated checks **PASS** (manual sign-off có thể SKIP cho đến bước 4).

### 2. Chuẩn bị cohort

```bash
cp deploy/pilot-cohort.example.json deploy/pilot-cohort.json
# Điền UUID staff thật (5–8 CSKH) — KHÔNG commit pilot-cohort.json
R1_PILOT_COHORT=deploy/pilot-cohort.json bash scripts/rnos_r1_pilot_enable.sh
```

### 3. UAT 8 bước (CSKH lead)

Chạy walkthrough trong [`09-AI-ACTIONS.md`](../use-cases/actions/09-AI-ACTIONS.md#pilot-walkthrough--8-bước-uat-tuần-11).  
Xác nhận BR-AI-01: draft **không** gửi Zalo/email tự động.

### 4. Manual sign-off

Copy template và điền:

```bash
cp deploy/r1-signoff.template.json .local-dev/r1-signoff.json
# Set "signed": true + signed_by / signed_at cho từng criteria
R1_SIGNOFF=.local-dev/r1-signoff.json bash scripts/rnos_r1_prod_pilot_gate.sh
```

### 5. Enable pilot trên VPS

```bash
bash scripts/rnos_r1_pilot_enable.sh --apply --cohort deploy/pilot-cohort.json
# Trên VPS:
set -a && source .local-dev/r1-pilot-env.sh && set +a
sudo systemctl restart ptt-crm-api.service
# Rebuild ops-web với NEXT_PUBLIC_* từ cohort ops_web_build_env
sudo systemctl restart ptt-ops-web.service
```

### 6. Monitor 48h

Theo [`ai-service-operations.md`](./ai-service-operations.md) §6.3 — score latency, summarize P95, error rate, acceptance ≥35%.

### 7. Rollback (≤5 phút)

```bash
PTT_AI_COPILOT_ENABLED=0
sudo systemctl restart ptt-crm-api ptt-ops-web
bash scripts/rnos40_rollback_drill.sh
```

Chi tiết §8 runbook master.

## CI

Workflow [`.github/workflows/rnos-r1-prod-pilot-gate.yml`](../../.github/workflows/rnos-r1-prod-pilot-gate.yml) chạy trên PR/push khi đụng scripts gate R1, deploy templates, hoặc copilot paths.

## Environment variables

| Var | Default | Mô tả |
|-----|---------|-------|
| `R1_ENV` | `deploy/env.local.example` | Env file cho metrics + RNOS-40 |
| `R1_SKIP_E2E` | `0` | `1` = bỏ RNOS-39 Playwright |
| `R1_SKIP_RNOS40` | `0` | `1` = bỏ RNOS-40 gate |
| `R1_SKIP_METRICS` | `0` | `1` = bỏ SQL probes |
| `R1_PILOT_COHORT` | `deploy/pilot-cohort.json` | Cohort JSON (optional) |
| `R1_SIGNOFF` | `deploy/r1-signoff.template.json` | Signed JSON path |
| `R1_PILOT_DAYS` | `7` | Window SQL metrics |

## Artifacts checklist

- [ ] `scripts/rnos_r1_prod_pilot_gate.sh`
- [ ] `scripts/rnos_r1_metrics_probe.sh`
- [ ] `scripts/rnos_r1_pilot_enable.sh`
- [ ] `deploy/r1-signoff.template.json`
- [ ] `docs/runbooks/rnos-r1-prod-pilot-gate.md` (this file)
- [ ] `.github/workflows/rnos-r1-prod-pilot-gate.yml`

---

*Gate R1 — cập nhật khi đổi criteria §8.3 hoặc copilot contract.*
