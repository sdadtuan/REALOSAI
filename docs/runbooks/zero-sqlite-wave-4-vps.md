# Zero SQLite Wave 4 — VPS (delete sqlite code + archive)

**Status:** complete on `real.gomira.vn` (2026-08-24, commits through `97e630b`).

Prerequisite: Wave 3 complete (`090a2c2`+, `./scripts/ci_zero_sqlite_w3_verify.sh` PASS).

Wave 4 removes Nest `*-sqlite.repository.ts` runtime code, wires PG stragglers, drops Nest `PTT_SQLITE_PATH` reads, and permanently archives `ptt.db` on VPS.

## W4 commit milestones

| Sub-wave | Scope | Commit |
|----------|-------|--------|
| P0 | 4 stragglers PG-only | `c2f4796` |
| P1 | B1 unwrap + delete (CSKH) | `a20e1c1` |
| P2 | B2–B7 delete batches | `54318fb` |
| P3 | sqlite-leads PG-only read | `6c08f07` |
| P4 | app-config / guard cleanup | `369f7bf` |
| P5 | CI W4 gate + verify | `2f0bcb4` |
| P6 | VPS archive `ptt.db` | `97e630b` |
| P7 | Runbook + spec §7 | (this doc) |

Full plan: [`docs/superpowers/plans/2026-08-24-zero-sqlite-wave-4.md`](../superpowers/plans/2026-08-24-zero-sqlite-wave-4.md)

---

## Pre-deploy gates

```bash
# Local (full matrix)
./scripts/ci_zero_sqlite_w4_verify.sh

# Fast inventory only
./scripts/ci_zero_sqlite_w4_gate.sh --skip-build
```

Reports: `.local-dev/zero-sqlite-w4-verify-report.json`, `zero-sqlite-w4-gate-report.json`.

---

## Deploy code

```bash
cd services/ptt-crm-api && npm run build
rsync -az --delete services/ptt-crm-api/dist/ \
  deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/dist/
rsync -az --delete services/ptt-crm-api/src/ \
  deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/src/
rsync -az scripts/ deploy@real.gomira.vn:/var/www/realosai/scripts/
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

---

## W4 P6 — permanent `ptt.db` archive

After W4 code deployed and `./scripts/ci_zero_sqlite_w4_verify.sh` PASS:

```bash
# Dry-run (VPS)
HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
  ./scripts/ci_zero_sqlite_w4_p6_accept.sh

# Live archive + PG backup + smoke regression
APPLY=1 ARCHIVE=1 WITH_BACKUP=1 \
  HEALTH_URL=http://127.0.0.1:3010/health PTT_APP_DIR=/var/www/realosai \
  ./scripts/ci_zero_sqlite_w4_p6_accept.sh
```

The script auto-sources `$PTT_APP_DIR/.env` for `pg_dump` and falls back to `$PTT_APP_DIR/backups` when `/var/backups/ptt` is not writable.

### VPS acceptance (2026-08-24)

| Check | Result |
|-------|--------|
| PG dump | `/var/www/realosai/backups/rnosaidb-20260824-0542.dump` |
| Archive | `/var/www/realosai/backups/ptt-archived-20260824-054245.db` |
| Live `ptt.db` | absent |
| `.env` | no active `PTT_SQLITE_PATH` |
| W4-P6-04 smoke | PASS (no 503 `sqlite_disabled`) |

Verify:

```bash
test ! -f /var/www/realosai/ptt.db && echo "archived OK"
ls -la /var/www/realosai/backups/ptt-archived-*.db
curl -sS https://real.gomira.vn/health | jq '{sqlite, sqlite_disabled, postgres, leads_read_source}'
```

---

## W4 P7 — completion checklist

- [x] Zero `*-sqlite.repository.ts` in Nest `src/` (`W4-G01`)
- [x] Zero `new DatabaseSync` outside `*.spec.ts` (`W4-G02`)
- [x] `./scripts/ci_zero_sqlite_w4_verify.sh` PASS locally
- [x] VPS `/health` → `sqlite_disabled: true`, `postgres: true`, `sqlite: false`
- [x] VPS `ptt.db` archived; API healthy without sqlite file
- [x] Ops smoke: health, leads, finance, BĐS accounting, tickets → 401/200/404 (not 503)

### ops-web smoke routes (post-W4)

| Route | Expect |
|-------|--------|
| `GET /health` | 200, `sqlite_disabled: true` |
| `GET /api/v1/leads/1/status-options` | 401/200 |
| `GET /api/crm/finance/business-dashboard` | 401/200 |
| `GET /api/crm/re-projects/1/accounting/dashboard` | 401/200 |
| `GET /api/crm/tickets` | 401/200 |

Automated in `ci_zero_sqlite_w4_p6_accept.sh` (W4-P6-04).

---

## Rollback

1. Revert W4 commits, rsync previous `dist/`, restart API — PG data unchanged.
2. Restore `ptt.db` from `$PTT_APP_DIR/backups/ptt-archived-*.db` for local emergency only.
3. Keep `PTT_SQLITE_DISABLED=1` on prod — do not re-enable sqlite OLTP.

## W4b backlog (optional)

- [x] `SqliteSyncDb` type alias — zero `node:sqlite` imports outside `*.spec.ts` (W4b-G01)
- [x] Legacy script manifest — `scripts/legacy/zero-sqlite/README.md`
- [x] Active staging/local scripts PG-only — `ci_zero_sqlite_w4b_gate.sh` W4b-G02
- [ ] Flask/Python `:memory:` sqlite tests (out of scope)

## Related

- Wave 3 runbook: [`zero-sqlite-wave-3-vps.md`](zero-sqlite-wave-3-vps.md)
- Wave 2 runbook: [`zero-sqlite-wave-2-vps.md`](zero-sqlite-wave-2-vps.md)
- Spec: [`docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md`](../superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md) §7 Wave 4
