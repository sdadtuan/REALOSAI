# Zero SQLite Wave 3 — VPS (Flask + scripts + e2e)

Prerequisite: Wave 2 deployed (`7efaa7c`+, `PTT_SQLITE_DISABLED=1`, `/health` → `sqlite_disabled: true`).

Wave 3 removes `ptt.db` dependency from **Flask enforcement**, **gate scripts**, and **Playwright e2e** — not from Nest `*-sqlite.repository.ts` files (Wave 4).

## W3 commit milestones

| Sub-wave | Scope | Commit message prefix |
|----------|-------|------------------------|
| P1 | Prod env template + CI gate + Flask retired verify | `feat: zero-sqlite W3 P1` |
| P2 | Shared PG e2e bootstrap | `feat: zero-sqlite W3 P2` |
| P3 | Playwright 24 scripts + seed lib | `feat: zero-sqlite W3 P3` |
| P4 | Staging/local/backup scripts | `feat: zero-sqlite W3 P4` |
| P5 | Verification matrix | `feat: zero-sqlite W3 P5` |
| P6 | Optional ptt.db absence acceptance | `feat: zero-sqlite W3 P6` |

---

## P1 — Prod env + CI gate

### Prod env template

Use `deploy/env.zero-sqlite-w3-prod.example` as the canonical zero-sqlite production flag matrix:

```bash
# Merge into VPS /var/www/realosai/.env — do not commit secrets
set -a && source deploy/env.zero-sqlite-w3-prod.example && set +a
# edit DATABASE_URL, JWT secrets, channel tokens
```

**Required deltas vs legacy VPS `.env`:**

| Variable | Target |
|----------|--------|
| `PTT_SQLITE_DISABLED` | `1` |
| `PTT_SQLITE_PATH` | **unset** (remove from prod) |
| `PTT_FLASK_MONOLITH_MODE` | `retired` |
| `PTT_WEBHOOKS_FLASK_FALLBACK` | `0` |
| `PTT_CRM_*_PG` | all `1` |
| `PTT_BDS_PACK` / `PTT_BDS_PG` | `1` |

### VPS verify (manual)

```bash
ssh deploy@real.gomira.vn 'grep -E "SQLITE|FLASK" /var/www/realosai/.env; systemctl is-active ptt.service || echo ptt-inactive'
```

Expected: `PTT_SQLITE_DISABLED=1`, `PTT_FLASK_MONOLITH_MODE=retired`, `ptt.service` **inactive**.

Apply env delta (example — review before running):

```bash
ssh deploy@real.gomira.vn 'grep -q PTT_SQLITE_DISABLED /var/www/realosai/.env || echo PTT_SQLITE_DISABLED=1 | sudo tee -a /var/www/realosai/.env'
# Remove PTT_SQLITE_PATH line if present; restart API after merge
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

### CI / pre-deploy gate

```bash
./scripts/ci_zero_sqlite_w3_gate.sh
```

Report: `.local-dev/zero-sqlite-w3-p1-gate-report.json`

| Gate | Check |
|------|-------|
| W3-G01 | `PTT_SQLITE_DISABLED=1` |
| W3-G02 | No `PTT_SQLITE_PATH` in prod templates |
| W3-G03 | `PTT_FLASK_MONOLITH_MODE=retired` |
| W3-G04 | `python3 -m ptt_crm.phase5_flask_retirement_gates` PASS |
| W3-G05 | `tests.test_crm_flask_retirement` — 21/21 RETIRED |
| W3-G06 | Playwright sqlite count | **0** required |
| W3-G07 | Staging gate packs source `e2e_pg_bootstrap.sh`; backup PG-primary |
| W3-V01 | Nest `DatabaseSync` stragglers = **4** (Wave 4 boundary) |
| W3-V02 | `ai-intelligence/` zero `DatabaseSync` |
| W3-V03 | PG e2e bootstrap library present |
| W3-V04 | dual-run deprecated when sqlite disabled |

Full matrix: `./scripts/ci_zero_sqlite_w3_verify.sh`

```bash
# Before rsync dist to VPS
./scripts/ci_zero_sqlite_w3_gate.sh && npm run build
```

### Script inventory baseline (W3 P3 target)

```bash
rg -l 'PTT_SQLITE_PATH|ptt\.db' scripts/ | wc -l          # ~76 at W3 start
rg -l 'PTT_SQLITE_PATH' scripts/playwright_ops_*e2e*.sh   # 24 at W3 start
```

---

## P2 — Shared PG e2e bootstrap

### Bootstrap env (no ptt.db)

```bash
set -a && source .env && set +a
source scripts/e2e_pg_bootstrap.sh
```

Sets `PTT_SQLITE_DISABLED=1`, all `PTT_CRM_*_PG=1`, and **unsets** `PTT_SQLITE_PATH`.

### Minimal PG seed

```bash
./scripts/e2e_pg_seed_minimal.sh
```

Runs `seed_crm_catalog_pg.py` + `seed_crm_e2e_pg.py` (customers/cases/tickets/leads/kpi stubs).

### Local Nest with PG-only

```bash
export PTT_SQLITE_DISABLED=1
source scripts/e2e_pg_bootstrap.sh
./scripts/e2e_pg_seed_minimal.sh
./scripts/local_crm_api_up.sh
```

`local_crm_api_up.sh` auto-sources `e2e_pg_bootstrap.sh` when `PTT_SQLITE_DISABLED=1`.

### Playwright (W3 P3)

All `playwright_ops_*_e2e.sh` scripts use PG bootstrap — grep gate:

```bash
rg 'PTT_SQLITE_PATH' scripts/playwright_ops_*e2e*.sh
# Expect: 0 matches
```

---

## P4 — Staging / local / backup scripts

### Staging gate packs (PG-only)

Phase 2–5 staging wrappers source `e2e_pg_bootstrap.sh` — no `PTT_SQLITE_PATH`:

```bash
./scripts/staging_phase4_gate_pack.sh
./scripts/staging_phase5_full_gate.sh --skip-refresh   # Phase 5 only
```

`staging_phase4_gate_pack.py` accepts `PTT_FLASK_MONOLITH_MODE=retired` (W3) or legacy `readonly`.

### Local Nest

```bash
export PTT_SQLITE_DISABLED=1
export DATABASE_URL=postgresql://...
./scripts/local_crm_api_up.sh   # fails fast if DATABASE_URL missing
```

### Backup (PG required, sqlite optional)

```bash
./scripts/backup_ptt_data.sh                        # pg_dump only (prod default)
./scripts/backup_ptt_data.sh --with-sqlite-archive  # legacy local ptt.db copy
```

### Deprecated dual-run

`local_dual_run_check.sh` and `dual_run_leads_check.py` exit with error when `PTT_SQLITE_DISABLED=1` or Flask `retired`.

---

## P5 — Verification matrix

Full W3 verify (gates G01–G07 + verify V01–V04):

```bash
./scripts/ci_zero_sqlite_w3_verify.sh
```

Report: `.local-dev/zero-sqlite-w3-p5-verify-report.json`

| Check | Expect |
|-------|--------|
| W3-G01…G07 | CI gate PASS (see P1) |
| W3-V01 | Exactly **4** Nest `DatabaseSync` stragglers (Wave 4) |
| W3-V02 | `ai-intelligence/` zero `DatabaseSync` |
| W3-V03 | `e2e_pg_bootstrap.sh`, `e2e_pg_seed_minimal.sh`, `seed_crm_e2e_pg.py` |
| W3-V04 | `local_dual_run_check.sh` fails when `PTT_SQLITE_DISABLED=1` |

### Nest stragglers (Wave 4 — document only)

```
services/ptt-crm-api/src/re-projects/re-projects-accounting.repository.ts
services/ptt-crm-api/src/seo-admin/seo-admin.repository.ts
services/ptt-crm-api/src/service-lifecycle/lifecycle-finance-confirm.repository.ts
services/ptt-crm-api/src/service-lifecycle/lifecycle-tasks.repository.ts
```

Prod routes hitting these return **503** `sqlite_disabled` — acceptable until Wave 4 delete.

### Grep gates (manual)

```bash
rg 'PTT_SQLITE_PATH' scripts/playwright_ops_*e2e*.sh    # 0
rg '^[^#]*PTT_SQLITE_PATH' deploy/env.zero-sqlite-w3-prod.example deploy/runtime.env.example  # 0
```

### VPS smoke

```bash
curl -sS https://real.gomira.vn/health | jq '{sqlite_disabled, postgres, leads_read_source}'
ssh deploy@real.gomira.vn 'grep -E "FLASK|SQLITE" /var/www/realosai/.env; systemctl is-active ptt.service || echo ptt-inactive'
```

Expected: `PTT_SQLITE_DISABLED=1`, `PTT_FLASK_MONOLITH_MODE=retired`, `ptt.service` inactive.

### Playwright sample matrix (local, optional)

Requires PG + ops-web dev stack:

```bash
./scripts/playwright_ops_crm_tickets_e2e.sh
./scripts/playwright_ops_forecast_e2e.sh
./scripts/playwright_ops_order_invoice_e2e.sh
```

---

## P6 — Optional ptt.db absence acceptance

After backup, confirm API stays healthy without `ptt.db`:

```bash
# Dry-run
HEALTH_URL=https://real.gomira.vn/health PTT_APP_DIR=/var/www/realosai \
  ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh

# Execute (renames aside + health + auto-restore)
APPLY=1 HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
  ./scripts/zero_sqlite_w3_ptt_db_absence_test.sh
```

Script auto-restores `ptt.db` on exit via trap.

---

## W3 complete checklist

- [x] P1 — prod env template + CI gate + Flask retired
- [x] P2 — shared PG e2e bootstrap + seed
- [x] P3 — Playwright 40/40 PG-only
- [x] P4 — staging/local/backup scripts
- [x] P5 — `ci_zero_sqlite_w3_verify.sh` PASS
- [ ] P6 — optional `ptt.db` rename on VPS (manual)

Wave 4 (out of scope W3): delete `*-sqlite.repository.ts`, archive `ptt.db`.

---

## Rollback

1. Re-add `PTT_SQLITE_PATH` + set `PTT_SQLITE_DISABLED=0` (emergency only).
2. `PTT_FLASK_MONOLITH_MODE=readonly` + `systemctl start ptt` (Flask emergency — registry already RETIRED).
3. PG data unchanged.

## Related

- Wave 2 runbook: `docs/runbooks/zero-sqlite-wave-2-vps.md`
- Flask retirement: `docs/runbooks/phase5-flask-retirement-checklist.md`
- Spec: `docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md` § Wave 3
