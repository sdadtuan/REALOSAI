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
| P5–P6 | Verify matrix + optional ptt.db rename | `feat: zero-sqlite W3 P5` |

---

## P1 — Prod env + CI gate (this milestone)

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
| W3-G06 | Playwright sqlite count (WARN until P3) |

Wire into deploy pipeline:

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

### Playwright (W3 P3 — next)

Replace per-script `PTT_SQLITE_PATH` with:

```bash
source "$ROOT/scripts/e2e_pg_bootstrap.sh"
"$ROOT/scripts/e2e_pg_seed_minimal.sh" || true
```

---

## P2–P6 (planned)

See `docs/superpowers/plans/2026-08-24-zero-sqlite-wave-3.md` for Playwright migration batches, PG seed library, and optional `ptt.db` rename acceptance test.

---

## Rollback

1. Re-add `PTT_SQLITE_PATH` + set `PTT_SQLITE_DISABLED=0` (emergency only).
2. `PTT_FLASK_MONOLITH_MODE=readonly` + `systemctl start ptt` (Flask emergency — registry already RETIRED).
3. PG data unchanged.

## Related

- Wave 2 runbook: `docs/runbooks/zero-sqlite-wave-2-vps.md`
- Flask retirement: `docs/runbooks/phase5-flask-retirement-checklist.md`
- Spec: `docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md` § Wave 3
