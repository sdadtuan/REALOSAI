# ops-web E2E — RNOS-39 AI Copilot

Playwright specs for the R1 AI Copilot pilot walkthrough (8 bước UAT).

## Specs

| File | Scope |
|------|--------|
| `e2e/ai-copilot.spec.ts` | Pilot 8 bước, API smoke, mobile tab, BR-AI-01, follow-up API |
| `e2e/helpers/ai-copilot-helpers.ts` | Shared login, lead resolve, score, outbound audit |

## Environment variables

### ops-web (Playwright / build)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_E2E_URL` | `http://127.0.0.1:3200` | ops-web base URL |
| `OPS_E2E_API_URL` | `http://127.0.0.1:3000` | Nest `ptt-crm-api` base URL |
| `OPS_E2E_SKIP_SERVER` | *(unset)* | `1` = do not start ops-web (reuse running server) |
| `OPS_E2E_USE_DEV` | `1` | `0` = use `next start` (requires prod build) |
| `NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED` | `1` in `playwright.config.ts` | Must be `1` for Copilot panel |
| `NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS` | *(empty)* | Optional; must match Nest cohort |

### Nest API (required for AI tests)

| Variable | Local demo | Staging |
|----------|------------|---------|
| `PTT_AI_COPILOT_ENABLED` | `1` | `1` |
| `PTT_AI_PILOT_USER_IDS` | *(empty = all staff)* | 5–8 UUID pilot list |
| `PTT_STAFF_ALLOW_STUB` | `1` | `0` (use PG staff) |
| `PTT_STAFF_STUB_USERS` | `staff@demo.local:demo12345:1:1:Pilot` | — |
| `PTT_CRM_INTERNAL_KEY` | set for realistic guards | required prod/staging |
| `PTT_STAFF_JWT_SECRET` | min 32 chars | vault |
| `DATABASE_URL` | `postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb` | staging DSN |
| `PTT_SQLITE_PATH` | `$REPO/ptt.db` | path on VPS |
| `PTT_LEADS_READ_SOURCE` | `pg` | `pg` |

### Test data

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_E2E_STAFF_EMAIL` | `staff@demo.local` | Pilot staff login |
| `OPS_E2E_STAFF_PASSWORD` | `demo12345` | Password |
| `OPS_E2E_AI_LEAD_ID` | `9000050` | SQLite lead id; owner should be staff `sub=1` |

See also: [`deploy/env.ai.example`](../../deploy/env.ai.example), [`docs/runbooks/rnos40-ai-gate.md`](../../docs/runbooks/rnos40-ai-gate.md).

## Local run

```bash
# Terminal 1 — postgres + API (or use docker compose)
source deploy/env.local.example
docker compose up -d postgres
APPLY=1 bash scripts/apply_pg_ddl_revenue_os_ai.sh   # once
PTT_AI_COPILOT_ENABLED=1 npm run start:prod --prefix services/ptt-crm-api

# Full gate (bootstrap + API + Playwright + JSON report)
bash scripts/playwright_ops_ai_copilot_e2e.sh

# Or Playwright only (API + ops-web already up)
cd services/ops-web
OPS_E2E_SKIP_SERVER=1 npm run test:e2e:ai-copilot
```

## Staging run

```bash
export OPS_E2E_URL=https://ops-staging.example.com
export OPS_E2E_API_URL=https://api-staging.example.com
export OPS_E2E_STAFF_EMAIL=pilot1@pttads.vn
export OPS_E2E_STAFF_PASSWORD='***'
export OPS_E2E_AI_LEAD_ID=12345
export OPS_E2E_SKIP_SERVER=1
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1

cd services/ops-web && npx playwright test e2e/ai-copilot.spec.ts
```

## CI

Workflow: [`.github/workflows/rnos39-ai-copilot-e2e.yml`](../../.github/workflows/rnos39-ai-copilot-e2e.yml)

Gate script: `bash scripts/rnos39_gate.sh`

## Pilot 8 bước mapping

| # | E2E coverage |
|---|----------------|
| 1 | `loginAsStaff` |
| 2–3 | `/crm/leads/[id]` + score card |
| 4 | Tóm tắt nhanh + bullets |
| 5 | Summarize paste mode |
| 6–7 | Follow-up draft → Duyệt |
| 8 | `GET /api/v1/ai/runs` count increase |

BR-AI-01: dedicated test + assert in walkthrough (no outbound send buttons).
