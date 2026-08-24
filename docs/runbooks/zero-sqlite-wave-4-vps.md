# Zero SQLite Wave 4 — VPS (delete sqlite code + archive)

Prerequisite: Wave 3 complete (`090a2c2`+, `./scripts/ci_zero_sqlite_w3_verify.sh` PASS, P6 absence OK).

Wave 4 removes Nest `*-sqlite.repository.ts` runtime code, wires 4 PG stragglers, and permanently archives `ptt.db` on VPS.

## W4 commit milestones

| Sub-wave | Scope | Commit message prefix |
|----------|-------|------------------------|
| P0 | 4 stragglers PG-only | `feat: zero-sqlite W4 P0 stragglers PG-only` |
| P1 | B1 unwrap + delete (CSKH) | `feat: zero-sqlite W4 P1` |
| P2 | B2–B7 delete batches | `feat: zero-sqlite W4 P2` … `P2b` |
| P3 | sqlite-leads + presales util | `feat: zero-sqlite W4 P3` |
| P4 | app-config / guard cleanup | `feat: zero-sqlite W4 P4` |
| P5 | CI W4 gate | `feat: zero-sqlite W4 P5` |
| P6 | VPS archive ptt.db | `feat: zero-sqlite W4 P6` |

Full plan: [`docs/superpowers/plans/2026-08-24-zero-sqlite-wave-4.md`](../superpowers/plans/2026-08-24-zero-sqlite-wave-4.md)

---

## Baseline (before W4 code)

```bash
find services/ptt-crm-api/src -name '*-sqlite.repository.ts' | wc -l   # 22
./scripts/ci_zero_sqlite_w3_verify.sh                                     # PASS
```

4 stragglers (fix in W4 P0 before delete):

```
service-lifecycle/lifecycle-finance-confirm.repository.ts
service-lifecycle/lifecycle-tasks.repository.ts
seo-admin/seo-admin.repository.ts
re-projects/re-projects-accounting.repository.ts
```

---

## Deploy code (each sub-wave)

```bash
cd services/ptt-crm-api && npm run build
rsync -avz --delete services/ptt-crm-api/dist/ \
  deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/dist/
# After P2+ also sync src if verify gate runs on VPS:
rsync -avz services/ptt-crm-api/src/ \
  deploy@real.gomira.vn:/var/www/realosai/services/ptt-crm-api/src/
ssh deploy@real.gomira.vn 'sudo systemctl restart realosai-api'
```

---

## W4 P6 — permanent ptt.db archive

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

Checks (W4-P6-01…04):

| Check | Expect |
|-------|--------|
| `ptt.db` absent | `test ! -f /var/www/realosai/ptt.db` |
| Archive | `/var/backups/ptt/ptt-archived-*.db` |
| `.env` | no active `PTT_SQLITE_PATH` line |
| Smoke | `/health` 200; CRM routes 401/200/404 — not 503 `sqlite_disabled` |

Verify:

```bash
test ! -f /var/www/realosai/ptt.db && echo "archived OK"
ls -la /var/backups/ptt/ptt-archived-*.db 2>/dev/null || ls -la /var/www/realosai/.local-dev/backups/
curl -sS http://127.0.0.1:3010/health | jq '{sqlite, sqlite_disabled, postgres}'
```

---

## Rollback

1. Revert W4 commits, rsync previous `dist/`, restart API.
2. Restore `ptt.db` from archive if needed for local emergency.
3. Keep `PTT_SQLITE_DISABLED=1` on prod.

## Related

- Wave 3 runbook: `docs/runbooks/zero-sqlite-wave-3-vps.md`
- Spec: `docs/superpowers/specs/2026-08-23-zero-sqlite-full-stack-design.md` § Wave 4
