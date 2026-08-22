# Kế hoạch triển khai — HR · Org · Job Function · RBAC

> **Document ID:** RBAC-HR-ORG-PLAN-20260807  
> **Spec:** [`2026-08-07-rbac-hr-org-job-function-design.md`](./2026-08-07-rbac-hr-org-job-function-design.md)  
> **Parent RBAC:** [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md)  
> **Ước lượng:** ~42–47 dev-days · **Calendar:** ~10 tuần (1 BE + 1 FE + HR/IT part-time)

---

## 0. Trạng thái nền (prerequisite)

| Prereq | Owner | Trạng thái |
|--------|-------|------------|
| R1-S1 PG sync + CI gates | Dev | ✅ |
| R1-S2 fail-closed UI | Dev | ✅ |
| R1-S3 Admin matrix + audit API | Dev | ✅ prod `925b4fb` |
| Ma trận position ký CSKH/KD/MKT | PO | ✅ `docs/exports/` |
| Supplement ma trận **Position × Function** | PO | ☐ R1.5-S0 |
| `python3-psycopg2` trên VPS | IT | ☐ |
| Staging PG mirror prod RBAC | IT | ☐ |

**Gate bắt đầu R1.5:** PO ký supplement function matrix (sheet `Function-AddOn`).

---

## 1. Tổng quan phase

| Phase | Tuần | Dev-days | Deliverable chính |
|-------|------|----------|-------------------|
| **R1.5-S0** | 1 | 2 | PO sign-off function catalog |
| **R1.5-S1** | 2 | 4 | DDL + seed job functions |
| **R1.5-S2** | 2–3 | 5 | Nest effective caps |
| **R1.5-S3** | 3–4 | 6 | Admin UI functions + user assign |
| **R2-HR-S1** | 5–6 | 6 | Org API departments/teams/positions |
| **R2-HR-S2** | 6–7 | 6 | Admin Org UI + staff user CRUD |
| **R2-HR-S3** | 7 | 3 | SoD validator + audit org |
| **R2-B** | 8–9 | 8 | Permission sets (spec R2) |
| **R2-C** | 9–10 | 8 | Teams JWT + queue filter |
| **UAT + deploy** | 10 | 4 | PO sign-off EC-01…06 |

---

## 2. R1.5-S0 — Sign-off function matrix (Tuần 1)

| Ngày | Việc | Output | Owner |
|------|------|--------|-------|
| D1 | PO + GDKD review add-on `leader`, `sales` | Sheet signed | PO |
| D2 | Head MKT review `content`, `design`, `analyst` | Sheet signed | MKT |
| D3 | CSKH lead review `ops`, `leader` | Sheet signed | CSKH |
| D4 | Export supplement Excel | `docs/exports/ma-tran-position-x-function-2026-08-07.xlsx` | PO |
| D5 | HR review persona §5 spec | Checklist OK | HR |

**Gate:** File supplement trong `docs/exports/signed/`.

---

## 3. R1.5-S1 — DDL & catalog (Tuần 2)

### Backlog

| ID | Story | Files | DoD |
|----|-------|-------|-----|
| S1-1 | DDL job functions | `docs/specs/2026-08-07-postgresql-ddl-staff-job-functions.sql` | Applied staging |
| S1-2 | Apply script | `scripts/apply_pg_ddl_staff_job_functions_r1_5.sh` | Idempotent |
| S1-3 | Python catalog | `scripts/seed_staff_job_functions_pg.py` | 8 functions seeded |
| S1-4 | Export catalog JSON | extend `scripts/export_rbac_admin_catalog.py` | `job_functions` in JSON |
| S1-5 | Unit tests | `tests/test_staff_job_functions_seed.py` | CI green |

### Lệnh staging

```bash
export DATABASE_URL=postgresql://…
./scripts/apply_pg_ddl_staff_job_functions_r1_5.sh
python3 scripts/seed_staff_job_functions_pg.py --apply
python3 scripts/export_rbac_admin_catalog.py
./scripts/rbac_catalog_gate.sh
```

### Task chi tiết: S1-1 DDL

**Files:**
- Create: `docs/specs/2026-08-07-postgresql-ddl-staff-job-functions.sql`
- Create: `scripts/apply_pg_ddl_staff_job_functions_r1_5.sh`

**Nội dung DDL:** theo spec §8.1 (`staff_job_functions`, `staff_job_function_grants`, `staff_user_job_functions`, `crm_staff.job_function_primary`).

**Verify:**

```bash
psql "$DATABASE_URL" -c "\d staff_job_functions"
psql "$DATABASE_URL" -c "SELECT code FROM staff_job_functions ORDER BY sort_order;"
```

Expected: 8 rows (`leader`, `sales`, `content`, …).

---

## 4. R1.5-S2 — Nest effective caps (Tuần 2–3)

### Backlog

| ID | Story | Files | DoD |
|----|-------|-------|-----|
| S2-1 | Repository | `staff-permissions/staff-job-functions.repository.ts` | load grants by user |
| S2-2 | Extend auth | `staff-auth/staff-auth.service.ts` | `loadEffectiveCaps()` |
| S2-3 | JWT claims | `staff-auth.types.ts`, `staff-jwt.util.ts` | `job_functions[]` in `/me` |
| S2-4 | API assign | `staff-org.controller.ts` (new module) | PUT user job-functions |
| S2-5 | Audit | `staff-org.repository.ts` | INSERT `staff_org_audit` |
| S2-6 | Tests | `staff-auth.effective-caps.spec.ts` | union caps test |

### API sketch

```
GET  /api/v1/staff/org/job-functions/catalog
GET  /api/v1/staff/org/users/:id/job-functions
PUT  /api/v1/staff/org/users/:id/job-functions   body: { functions: ["content","design"] }
GET  /api/v1/staff/org/users/:id/effective-caps
```

**Cap guard:** `crm_data_config.configure` (assign), `crm_staff_roster.view` (read).

### Task chi tiết: S2-2 loadEffectiveCaps

**Modify:** `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts`

**Logic:**

```typescript
async loadEffectiveCaps(payload: StaffJwtPayload): Promise<StaffSectionCap[]> {
  const base = await this.loadCaps(payload.position_id);
  let fnCaps: StaffSectionCap[] = [];
  try {
    fnCaps = await this.jobFunctionsRepo.loadCapsForUser(payload.sub);
  } catch { /* table missing on old env */ }
  return unionSectionCaps(base, fnCaps);
}
```

**Test:**

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=effective-caps
```

Expected: user MKT-02 + `content` includes `crm_seo_aeo_write.create` not in base alone.

---

## 5. R1.5-S3 — Admin UI (Tuần 3–4)

### Backlog

| ID | Story | Files | DoD |
|----|-------|-------|-----|
| S3-1 | API client | `ops-web/src/lib/api.ts` | org + job-function endpoints |
| S3-2 | Function matrix page | `ops-web/src/app/admin/crm/permissions/functions/page.tsx` | CRUD grants per function |
| S3-3 | User assign panel | `ops-web/src/app/admin/crm/org/users/page.tsx` | position + functions multi-select |
| S3-4 | Nav links | `module-nav.ts`, `OpsNav.tsx`, `admin/crm/layout.tsx` | 3 links mới |
| S3-5 | Staff badge | `crm/staff/page.tsx`, `StaffPageShell` | show function tags |
| S3-6 | Jest | `ops-web/src/lib/effective-caps-display.spec.ts` | badge render |

### UX flow — Admin gán function cho NV

1. `/admin/crm/org/users` → tìm email
2. Chọn **Chức vụ** (dropdown `crm_positions`)
3. Tick **Job functions** (max 3, SoD warning)
4. **Lưu** → PUT API → audit
5. NV logout/login → badge + menu đổi

### Deploy ops-web + API

```bash
ssh deploy@rs.pttads.vn
cd /var/www/rnosai && git pull
cd services/ptt-crm-api && npm ci && npm run build
sudo systemctl restart ptt-crm-api
cd /var/www/rnosai && ./scripts/deploy_ops_web.sh build
sudo ./scripts/deploy_ops_web.sh --restart
```

---

## 6. R2-HR — Org CRUD (Tuần 5–7)

### Backlog

| ID | Story | Files | DoD |
|----|-------|-------|-----|
| HR-1 | DDL teams | `docs/specs/2026-08-07-postgresql-ddl-staff-org.sql` | staging applied |
| HR-2 | Nest org module | `services/ptt-crm-api/src/staff-org/*` | CRUD dept/team/position |
| HR-3 | User admin API | POST/PATCH `/staff/org/users` | create staff_users |
| HR-4 | UI departments | `/admin/crm/org/departments` | table + form |
| HR-5 | UI teams | `/admin/crm/org/teams` | link department |
| HR-6 | UI positions | `/admin/crm/org/positions` | code, name, dept, parent |
| HR-7 | Password reset flow | reuse portal hash util | temp password email |
| HR-8 | Update PHAN_QUYEN | `docs/PHAN_QUYEN_HUONG_DAN.md` §5 | PG-only paths |

### Cap mapping UI → section

| UI module | Section cap |
|-----------|-------------|
| Departments | `crm_staff_departments.view/configure` |
| Teams | `crm_staff_departments.configure` |
| Positions | `crm_data_config.configure` |
| Users | `crm_staff_roster.edit` + configure |
| Function matrix | `crm_data_config.configure` |

---

## 7. R2-HR-S3 — SoD & audit (Tuần 7)

| ID | Task | DoD |
|----|------|-----|
| SoD-1 | `staff-org.sod.ts` rules SoD-01…04 | unit tests |
| SoD-2 | PATCH blocked → `409 { error: 'sod_violation', rules: [...] }` | API test |
| SoD-3 | Admin UI banner | cannot save until fix |
| SoD-4 | `staff_org_audit` on all org writes | query by user |

---

## 8. R2-B / R2-C (Tuần 8–10)

Thực thi theo [`2026-08-06-rbac-enterprise-design.md`](./2026-08-06-rbac-enterprise-design.md) § R2-B, R2-C với dependency:

- **R2-B** sau R1.5 (effective caps union đã có)
- **R2-C** sau R2-HR (teams table + UI)

Không lặp chi tiết — xem master spec. Milestone chung:

| Milestone | Verify |
|-----------|--------|
| R2-B complete | SET-SOLUTION-BACKUP → claim 24h |
| R2-C complete | Queue filter “team của tôi” |

---

## 9. UAT checklist

| ID | Scenario | Steps | Pass |
|----|----------|-------|------|
| T-HR-01 | HR tạo dept + team | Admin org UI | ☐ |
| T-HR-02 | HR tạo user MKT-02 + content | Assign functions | ☐ |
| T-HR-03 | Content user không thấy FB Ads | Login → menu | ☐ |
| T-HR-04 | Design user thấy FB Ads, không approve | Login | ☐ |
| T-HR-05 | Leader assign trong team only | R2-C | ☐ |
| T-HR-06 | SoD block content+approve | Admin save → 409 | ☐ |
| T-HR-07 | Audit trail complete | Query audit tables | ☐ |
| T-HR-08 | P3 regression KD/MKT | Handoff flow | ☐ |

---

## 10. CI gates (bổ sung)

| Gate | Script | Trigger |
|------|--------|---------|
| Catalog + functions | `rbac_catalog_gate.sh` | PR paths `staff-*`, `admin_page*` |
| No SQLite | `rbac_no_sqlite_gate.sh` | PR RBAC scripts |
| Function catalog sync | `scripts/verify_job_function_catalog.py` | PR if JSON ≠ PG seed |
| Effective caps unit | `npm test effective-caps` | PR ptt-crm-api |

---

## 11. Phân công

| Vai trò | Trách nhiệm |
|---------|-------------|
| **Backend dev** | R1.5-S2, R2-HR API, effective caps, SoD |
| **Frontend dev** | R1.5-S3, R2-HR UI |
| **PO** | S0 sign-off, UAT, supplement matrix |
| **HR** | Persona validation, runbook review, pilot users |
| **IT** | DDL prod, psycopg2, deploy, backup before DDL |

---

## 12. Effort summary

| Phase | Dev-days | Calendar |
|-------|----------|----------|
| R1.5 | 15 | 3 tuần |
| R2-HR | 15 | 3 tuần |
| R2-B/C | 16 | 3 tuần |
| UAT/deploy | 4 | 1 tuần |
| **Total** | **~50** | **~10 tuần** |

---

## 13. Checklist tracking (copy vào sprint board)

```
R1.5
[ ] R1.5-S0 PO sign-off function matrix
[ ] R1.5-S1 DDL + seed job functions
[ ] R1.5-S2 Nest loadEffectiveCaps
[ ] R1.5-S3 Admin UI function + user assign
[ ] R1.5 deploy prod + smoke

R2-HR
[ ] R2-HR-S1 Org DDL + API
[ ] R2-HR-S2 Admin Org UI
[ ] R2-HR-S3 SoD + org audit
[ ] R2-HR update PHAN_QUYEN doc

R2-B/C
[ ] R2-B permission sets
[ ] R2-C teams JWT + filters

Closeout
[ ] UAT T-HR-01…08 pass
[ ] Runbook published
[ ] PO sign-off EC-01…06
```

---

## 14. Tài liệu deliverable

| File | Phase |
|------|-------|
| [`2026-08-07-rbac-hr-org-job-function-design.md`](./2026-08-07-rbac-hr-org-job-function-design.md) | ✅ Spec |
| [`../runbooks/rbac-hr-org-workflow.md`](../runbooks/rbac-hr-org-workflow.md) | R1.5-S3 |
| `docs/exports/ma-tran-position-x-function-2026-08-07.xlsx` | R1.5-S0 |
| `docs/exports/signed/` PDF supplement | R1.5-S0 |

---

*Plan v1.0 — 2026-08-07. Execute R1.5 trước; R2-HR song song PO sign-off.*
