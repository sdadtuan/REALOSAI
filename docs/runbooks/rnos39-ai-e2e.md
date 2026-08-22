# RNOS-39 — AI Copilot Playwright E2E

> **Deliverable:** `ai-copilot.spec.ts` in CI + pilot 8-step flow + BR-AI-01  
> **Spec README:** [`services/ops-web/e2e/README.md`](../../services/ops-web/e2e/README.md)

## Quick start

```bash
source deploy/env.local.example
bash scripts/playwright_ops_ai_copilot_e2e.sh
```

Report: `.local-dev/rnos39-e2e-report.json`

## Gate (full checklist)

```bash
bash scripts/rnos39_gate.sh
# → .local-dev/rnos39-gate-report.json
```

## CI

GitHub Actions: [`.github/workflows/rnos39-ai-copilot-e2e.yml`](../../.github/workflows/rnos39-ai-copilot-e2e.yml)

Triggers on changes to ops-web AI components, `ai-intelligence` module, and E2E scripts.

## Pilot 8 bước (automated)

Single serial test `pilot walkthrough — 8 steps UAT` covers:

1. Login pilot staff  
2. Open lead detail  
3. Score card visible  
4. Lead brief (Tóm tắt nhanh)  
5. Summarize activity (paste)  
6–7. Follow-up draft → Duyệt (activity note, no send)  
8. Audit runs list grows (`GET /api/v1/ai/runs`)

## Staging env (minimum)

```bash
export OPS_E2E_URL=https://ops-staging.pttads.vn
export OPS_E2E_API_URL=https://ops-staging.pttads.vn
export OPS_E2E_STAFF_EMAIL=pilot@example.com
export OPS_E2E_STAFF_PASSWORD='***'
export OPS_E2E_AI_LEAD_ID=<sqlite_lead_id>
export OPS_E2E_SKIP_SERVER=1
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
```

Run: `cd services/ops-web && npx playwright test e2e/ai-copilot.spec.ts`
