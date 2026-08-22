# Kế hoạch triển khai RBAC R1 — Checklist theo tuần

> **Document ID:** RBAC-R1-PLAN-20260806  
> **Spec:** [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md)  
> **Ước lượng:** ~28–35 dev-days · **Calendar gợi ý:** 8 tuần (1 dev full-time + IT part-time)

---

## 0. Phụ thuộc & prereq

| Prereq | Trạng thái |
|--------|------------|
| **Chính sách: RBAC PostgreSQL-only (cấm SQLite)** | ✅ spec v1.2 |
| P3-S1/S2/S3 deployed (handoff + guards) | ✅ 2026-08-06 |
| Ma trận Excel CSKH/KD/MKT | ✅ `docs/exports/` |
| PostgreSQL `staff_section_permissions` | ✅ có bảng |
| Dev/staging có `DATABASE_URL` PG | ☐ IT (bắt buộc — không SQLite) |
| User pilot xác định | ☐ PO/HR |
| Staging env mirror prod RBAC | ☐ IT |

---

## Tuần 1 — R1-S0 Sign-off

| Ngày | Việc | Output | Owner |
|------|------|--------|-------|
| D1 | Review ma trận với GDKD Sales | Comment sheet KD-01 | PO |
| D2 | Review với Head Solution/MKT | Comment sheet MKT-01 | PO |
| D3 | Review CSKH lead | Comment sheet CSKH-01 | CSKH lead |
| D4 | Ký PDF ma trận + lưu `docs/exports/signed/` | PDF signed | PO |
| D5 | List user pilot (email, position, phòng) | `docs/exports/rbac-pilot-users.csv` | HR |

**Gate tuần 1:** PDF ký + ≥7 user pilot.

---

## Tuần 2–3 — R1-S1 PG sync

### Sprint backlog

| ID | Story | Files / scripts | DoD |
|----|-------|-----------------|-----|
| S1-1 | PG migration runner | `scripts/migrate_staff_permissions_pg.py` | `--dry-run` + `--apply` |
| S1-2 | Super admin sync | `scripts/sync_super_admin_caps_pg.py` | Diff + apply caps position 1 |
| S1-3 | Email section catalog | `admin_page_permissions.py` | `crm_email_mkt` in ADMIN_CRM_SECTIONS |
| S1-4 | Presales migrate PG | `migrate_presales_solution_permissions.py` | PG path |
| S1-5 | CI gate catalog | `scripts/rbac_catalog_gate.sh` | Fail on orphan guard section |
| S1-6 | CI gate no SQLite | `scripts/rbac_no_sqlite_gate.sh` | Fail on RBAC sqlite3 / *.db |
| S1-7 | Retire SQLite migrators | `migrate_*_permissions.py` | PG-only or delete |
| S1-8 | DDL staff_positions | `docs/specs/2026-08-06-postgresql-ddl-staff-positions.sql` | Applied staging |
| S1-9 | Seed positions 2–4 | SQL or script | MKT-01, KD-01, CSKH-01 codes |

### Lệnh staging

```bash
export DATABASE_URL=postgresql://…   # bắt buộc — cấm SQLite
python3 scripts/sync_super_admin_caps_pg.py --dry-run
python3 scripts/sync_super_admin_caps_pg.py --apply
python3 scripts/migrate_staff_permissions_pg.py --position KD-01 --apply
python3 scripts/migrate_staff_permissions_pg.py --position MKT-01 --apply
python3 scripts/migrate_staff_permissions_pg.py --position CSKH-01 --apply
./scripts/rbac_catalog_gate.sh
./scripts/rbac_no_sqlite_gate.sh
```

### Deploy prod (cuối tuần 3)

```bash
ssh deploy@rs.pttads.vn
cd /var/www/rnosai && git pull
python3 scripts/sync_super_admin_caps_pg.py --apply
python3 scripts/migrate_staff_permissions_pg.py --all-pilot --apply
sudo systemctl restart ptt-crm-api
```

**Gate tuần 3:** T1–T6 test plan pass trên staging.

---

## Tuần 4 — R1-S2 Fail-closed UI

| ID | Story | Files | DoD |
|----|-------|-------|-----|
| S2-1 | hasCap fail-closed | `ops-web/src/lib/auth.ts` | Unit test |
| S2-2 | 403 page | `ops-web/src/app/403/page.tsx` | UX copy VI |
| S2-3 | Route guard middleware | `ops-web/src/middleware.ts` | `/crm`, `/seo`, `/email` |
| S2-4 | Guard audit checklist | `docs/runbooks/rbac-guard-audit.md` | 100% write routes |
| S2-5 | Jest RBAC pack | `presales-solution-rbac`, auth caps | CI green |

**Gate tuần 4:** T8 pass; deploy ops-web staging.

---

## Tuần 5–6 — R1-S3 Admin PG + audit

| ID | Story | Estimate | DoD |
|----|-------|----------|-----|
| S3-1 | Nest permissions API | 3d | GET/PATCH positions |
| S3-2 | Audit table + hook | 1d | Every PATCH logged |
| S3-3 | Admin UI matrix | 4d | Checkbox grid |
| S3-4 | Export from Admin | 1d | Reuse export script |
| S3-5 | Remove SQLite admin permissions | 1d | Code/route gỡ hẳn; PG-only |

**API sketch:**

```
GET  /api/v1/staff/permissions/catalog
GET  /api/v1/staff/permissions/positions
GET  /api/v1/staff/permissions/positions/:id
PATCH /api/v1/staff/permissions/positions/:id
GET  /api/v1/staff/permissions/audit?position_id=
```

**Gate tuần 6:** Admin thay đổi cap → user refresh → behavior đổi; audit có log.

---

## Tuần 7–8 — R1-S4 Row-level + UAT

| ID | Story | DoD |
|----|-------|-----|
| S4-1 | Lead list scope AM | `GET /leads` filter owner |
| S4-2 | GDKD bypass + log | assign cap → no filter |
| S4-3 | UAT script | `scripts/rbac_uat_smoke.sh` |
| S4-4 | Update PHAN_QUYEN doc | § PG prod |
| S4-5 | Training 30' | Slide + recording |

**Gate tuần 8:** T9 pass; PO sign-off R1 complete.

---

## Tuần 9–12 — R1.5 HR · Org · Job Function (+ R2-HR start)

> **Spec:** [`2026-08-07-rbac-hr-org-job-function-design.md`](./2026-08-07-rbac-hr-org-job-function-design.md)  
> **Plan chi tiết:** [`2026-08-07-rbac-hr-org-job-function-implementation-plan.md`](./2026-08-07-rbac-hr-org-job-function-implementation-plan.md)

| Tuần | Focus | Gate |
|------|-------|------|
| 9 | R1.5-S0 sign-off function matrix + DDL seed | Supplement PDF |
| 10 | Nest `loadEffectiveCaps` + API assign | Tests green |
| 11 | Admin UI user + function assign | T-HR-03 staging |
| 12 | R2-HR org CRUD start + prod R1.5 | Onboard ≤ 15 ph |

---

## Phân công gợi ý

| Vai trò | Trách nhiệm |
|---------|-------------|
| **Backend dev** | S1 scripts, Nest API S3, guards S4 |
| **Frontend dev** | S2 UI, Admin matrix S3 |
| **IT / DevOps** | DDL prod, deploy, backup, monitoring |
| **PO** | Sign-off matrix, UAT, pilot users |
| **GDKD / MKT lead** | UAT T1–T6, row-level acceptance |

---

## Effort summary

| Phase | Dev-days | Calendar |
|-------|----------|----------|
| R1-S0 Sign-off | 3 | 1 tuần |
| R1-S1 PG sync | 8 | 2 tuần |
| R1-S2 Fail-closed | 5 | 1 tuần |
| R1-S3 Admin + audit | 10 | 2 tuần |
| R1-S4 Row-level | 6 | 2 tuần |
| **Tổng R1** | **~32** | **~8 tuần** |
| R1.5 HR · Job Function | 15 | 3 tuần |
| R2-HR Org UI | 15 | 3 tuần |
| **Tổng HR-ORG program** | **~50** | **~10 tuần** (sau R1) |

Backlog R2–R4: xem spec § Phase R2–R4 và **§1.4 Competitive positioning** (không block P3 handoff vận hành).

---

## Backlog R2 — Flexibility & SoD (~18–22 dev-days · 4–6 tuần)

**Spec:** [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md) § Phase R2

**Prereq:** R1 complete (PG SSoT, Admin audit)

| Sprint | Focus | Gate |
|--------|-------|------|
| R2-A | GDKD cap split (`crm_gdkd.*`) | Ma trận supplement; override audit |
| R2-B | Permission Sets + Admin UI | User + set → effective caps |
| R2-C | Role hierarchy + teams | MKT-02 inherit; team filter queue |
| R2-D | Break-glass 24h | Auto-revoke + runbook |

### Checklist R2 (Linear/Jira)

```
[ ] R2-A-01 Section crm_gdkd catalog + migration
[ ] R2-A-02 Guards override / view_all_leads
[ ] R2-A-03 Matrix supplement signed
[ ] R2-B-01 DDL permission_sets + grants
[ ] R2-B-02 JWT effective caps union
[ ] R2-B-03 Admin Sets UI
[ ] R2-C-01 staff_positions.parent_id + teams DDL
[ ] R2-C-02 Inheritance + metrics team filter
[ ] R2-D-01 Break-glass DDL + cron revoke
[ ] R2-D-02 Runbook rbac-break-glass.md
[ ] R2-UAT PO sign-off R2
```

---

## Backlog R3 — Data scope & agency trust (~28–35 dev-days · 8–10 tuần)

**Spec:** [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md) § Phase R3

**Prereq:** R1-S4 row-level, R2-B Sets, R2-C teams

| Sprint | Focus | Gate |
|--------|-------|------|
| R3-A | Client scope JWT + agency modules | 403 cross-client |
| R3-B | Field-level registry + strip/mask | Financial/PII pilot |
| R3-C | Permission simulator Admin | Preview match prod |
| R3-D | OPA policy pilot (3 rules) | no_release_without_handoff |
| R3-E | Quarterly access review | 1 cycle report |

### Checklist R3

```
[ ] R3-A-01 staff_user_clients + JWT claim
[ ] R3-A-02 Guards meta/seo/email client filter
[ ] R3-B-01 rbac_field_registry.json
[ ] R3-B-02 Serializer + UI mask pilot fields
[ ] R3-C-01 simulate API + Admin preview
[ ] R3-D-01 PolicyService + 3 policies CI
[ ] R3-E-01 Quarterly report + revoke workflow
[ ] R3-DEMO Competitive demo script (§1.4.4)
[ ] R3-UAT PO + agency client sign-off
```

---

## Backlog R4 — Staff SSO (~6–8 tuần)

Xem spec § Phase R4. Blocker deal enterprise; không bắt đầu trước R1.

---

## Theo dõi tiến độ (copy vào Linear/Jira)

```
[ ] R1-S0-01 Ma trận signed PDF
[ ] R1-S0-02 Pilot users CSV
[ ] R1-S1-01 migrate_staff_permissions_pg.py
[ ] R1-S1-02 sync_super_admin_caps_pg.py
[ ] R1-S1-03 rbac_catalog_gate CI
[ ] R1-S1-04 rbac_no_sqlite_gate CI
[ ] R1-S1-05 Retire SQLite permission migrators
[ ] R1-S1-06 Prod seed pilot positions
[ ] R1-S2-01 hasCap fail-closed
[ ] R1-S2-02 middleware + 403 page
[ ] R1-S3-01 permissions API
[ ] R1-S3-02 Admin UI matrix
[ ] R1-S3-03 audit log
[ ] R1-S4-01 lead list scope
[ ] R1-S4-02 UAT smoke + PO sign-off
```

---

## Liên kết nhanh

- Spec chi tiết: [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md)
- Ma trận ký: [`../exports/ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.xlsx`](../exports/ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.xlsx)
- Hướng dẫn vận hành hiện tại: [`../PHAN_QUYEN_HUONG_DAN.md`](../PHAN_QUYEN_HUONG_DAN.md)
