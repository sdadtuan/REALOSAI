# Presales P2 — Prod batch migrate runbook (P2-TPL-05 / S4)

**Phạm vi:** Cohort presales active với task Consult generic (`<4` form fields) → template theo `service_slug` (pilot `lead-gen` 4 field).  
**PO Q2:** Chỉ **Ops batch off-hours** — AM không tự chạy migrate.  
**Spec:** [2026-08-05-presales-p2-ecosystem-design.md](../specs/2026-08-05-presales-p2-ecosystem-design.md) §5.5 · §10.2

---

## 0. Kill switch & gates

| Biến / script | Mục đích |
|---------------|----------|
| `PTT_PRESALES_BATCH_UPGRADE=0` (default) | API `POST .../batch-upgrade-workflow` **chỉ dry-run** |
| `PTT_PRESALES_BATCH_UPGRADE=1` | Bật **apply** sau gate PASS |
| `./scripts/presales_p2_prod_gate.sh` | S4 hardening gate (S1–S3 tests + docs) |
| `./scripts/presales_template_upgrade_gate.sh` | Template + lifecycle parity |
| `./scripts/presales_funnel_metrics_gate.sh` | Metrics parity |

**Trước prod apply:** gate PASS → set `PTT_PRESALES_BATCH_UPGRADE=1` trên VPS → restart `ptt-crm-api`.

---

## 1. Prerequisites

- [ ] Deploy S1–S3: `ptt-crm-api`, `ops-web`, lifecycle JSON `lead-gen`
- [ ] `PTT_PRESALES_ON_LEAD=1`
- [ ] `PTT_CRM_INTERNAL_KEY` + `DATABASE_URL` (PG prod)
- [ ] Backup: `pg_dump` + snapshot task consult (optional CSV từ dry-run)
- [ ] Change window **off-hours** (PO Q2)
- [ ] `./scripts/presales_p2_prod_gate.sh` → `{"ok":true}`

---

## 2. Rollout steps (bắt buộc thứ tự)

### 2.1 Dry-run full cohort

```bash
cd /var/www/rnosai && set -a && source .env && set +a
./scripts/migrate_presales_workflow_batch.sh --dry-run --csv-out /tmp/presales-upgrade-$(date +%F).csv
```

- [ ] Review CSV: `lead_id, service_slug, old_field_keys`
- [ ] Ghi cohort size; không có lead lạ / archived

### 2.2 Pilot single lead `#900000002`

```bash
./scripts/migrate_presales_workflow_template.sh --lead-id 900000002 --apply
LEAD_ID=900000002 PRESALES_P2_SKIP_API=0 ./scripts/consult_phase3_pilot_uat.sh
```

- [ ] Task Consult **4 field**; prefill OK
- [ ] AM smoke: tab **Tư vấn** → Prefill → AI → Proposal handoff

### 2.3 Batch wave 1 (≤20 lead)

```bash
export PTT_PRESALES_BATCH_UPGRADE=1   # on API .env + restart Nest
./scripts/migrate_presales_workflow_batch.sh --apply --limit 20 --confirm
```

- [ ] `upgraded` = cohort; `skipped` = 0
- [ ] AM notify: task ✓ cũ có thể thiếu field mới → bổ sung trước Proposal

### 2.4 Monitor 1 tuần

- [ ] `/crm/leads/b2b` — **Metrics funnel** card: `consult_form_completion_pct`, `consult_task_done_rate`
- [ ] `/crm/staff-kpi` — AM KPI 7d / median Go→Consult
- [ ] Escalation nếu completion < 80% pilot target

### 2.5 Full cohort

```bash
./scripts/migrate_presales_workflow_batch.sh --apply --confirm
```

- [ ] Dry-run lại → cohort_size = 0
- [ ] AM sign-off 2 tuần: [presales-p2-am-signoff.md](../templates/presales-p2-am-signoff.md)

---

## 3. Rollback

| Tình huống | Hành động |
|------------|-----------|
| Batch lỗi giữa chừng | `PTT_PRESALES_BATCH_UPGRADE=0`; restore PG từ backup nếu cần |
| AM confusion 7d vs 48h | Training §4; labels trên metrics card |
| Consult tab regression | `PTT_CONSULT_WORKSPACE_TAB=0` (optional flag) — fallback Tổng quan |

Không có auto-rollback task template — **dry-run bắt buộc** trước apply.

---

## 4. Post-batch smoke (UAT §11.1)

| Step | Check |
|------|-------|
| U1 | Tab **Tư vấn** @ consult/proposal |
| U5 | Tạo Proposal từ Consult |
| U6 | 4 field consult sau upgrade |
| U7 | Metrics card 7d + 48h + median |
| U8 | Promote lead-gen staging → deliver tasks |

```bash
PRESALES_P2_SKIP_API=0 ./scripts/consult_phase3_pilot_uat.sh
./scripts/presales_p2_prod_gate.sh
```

---

## 5. E3 defer (INT-P25.2)

Epic E3 (**full_b2b stepper / deprecate bar**) **không** thuộc P2. Trigger khi PO mở lại — xem spec §6.

---

*PTT · RNOSAI presales-on-lead · S4 prod batch*
