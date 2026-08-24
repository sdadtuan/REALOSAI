# Zero SQLite — legacy scripts (W4b)

One-time **migration**, **backfill**, and **historical cutover** scripts that still read `PTT_SQLITE_PATH` or `ptt.db`. They are **not** used in prod deploy or Playwright e2e (PG-only since Wave 3).

Active local/staging entrypoints use `scripts/e2e_pg_bootstrap.sh` instead.

## When to use

| Use case | Script pattern |
|----------|----------------|
| Replay Wave 1 backfill from archived sqlite | `backfill_zero_sqlite_w1_*.py` |
| One-time sqlite → PG migration | `migrate_*_to_pg.py`, `migrate_sqlite_*.py` |
| Historical phase cutover drill | `phase*_prod_cutover*.sh`, `write_cutover_*.sh` |
| Dual-run comparison (deprecated) | `local_dual_run_check.sh`, `dual_run_leads_check.py` |

## Manifest (requires `PTT_SQLITE_PATH` or `ptt.db`)

### Python backfill / migration

- `backfill_zero_sqlite_w1_cases.py`
- `backfill_zero_sqlite_w1_customers.py`
- `backfill_zero_sqlite_w1_invoices.py`
- `backfill_zero_sqlite_w1_orders.py`
- `backfill_zero_sqlite_w1_proposals.py`
- `backfill_zero_sqlite_w1_tickets.py`
- `backfill_bds_legacy_tenant.py`
- `backfill_bds_products.py`
- `bds_count_gate.py`
- `migrate_crm_aeo_to_pg.py`
- `migrate_sqlite_hub_sop_to_pg.py`
- `migrate_sqlite_seo_aeo_to_pg.py`
- `seed_hub_migration_gate_data.py`
- `ensure_re_projects_sqlite_schema.py`

### Shell cutover / drill (historical)

- `apply_seo_gate_d_schema.sh`
- `apply_seo_gate_e_schema.sh`
- `close_phase3_prod_cutover.sh`
- `intake_bant_phase25_e2e_bootstrap.sh`
- `local_dual_run_check.sh`
- `local_leads_cutover_drill.sh`
- `local_leads_write_cutover_drill.sh`
- `phase2_prod_cutover.sh`
- `phase3_hub_migration_gate.sh`
- `phase3_prod_cutover_vps.sh`
- `phase3_prod_uat_gate.sh`
- `prod_write_cutover.sh`
- `rnos06_uat.sh`
- `rnos39_e2e_bootstrap.sh` (legacy branch when `PTT_SQLITE_DISABLED=0`)
- `rnos40_rollback_drill.sh`
- `run_phase_closure.sh`
- `staging_closed_loop_pilot.sh`
- `staging_phase3_up.sh`
- `staging_write_cutover_pilot.sh`
- `write_cutover_prod_gates.sh`
- `write_soak_record.sh`

### Intentional sqlite references (gates / absence tests)

- `backup_ptt_data.sh` — `--with-sqlite-archive` optional
- `ci_zero_sqlite_w3_gate.sh`, `ci_zero_sqlite_w3_verify.sh`, `ci_zero_sqlite_w4_*`
- `deploy_post_v3.sh` — skips hub sync when sqlite absent
- `dual_run_leads_check.py` — `--sqlite` override for drills
- `e2e_pg_bootstrap.sh` — **unsets** `PTT_SQLITE_PATH`
- `zero_sqlite_w3_ptt_db_absence_test.sh`

## Prod target

Do **not** set `PTT_SQLITE_PATH` on VPS. See `deploy/env.zero-sqlite-w3-prod.example` and `docs/runbooks/zero-sqlite-wave-4-vps.md`.
