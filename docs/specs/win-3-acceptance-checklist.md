# WIN-3 — Acceptance checklist (PO sign-off)

> **Phiên bản:** 1.1 · **Cập nhật:** 2026-08-07  
> **Spec:** [`2026-08-07-win-3-implementation-plan.md`](./2026-08-07-win-3-implementation-plan.md) §1.2, §7  
> **Deploy:** VPS `rs.pttads.vn` @ `a3d4de8` (WIN-3-C)  
> **Automated runner:** `bash scripts/run_win3_uat.sh`

---

## Preconditions

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| P1 | DDL `staff_user_clients` applied | ☐ | `apply_pg_ddl_staff_user_clients_r3_a.sh` |
| P2 | `STAFF_SCOPE_PILOT=1` on Nest `.env` | ☐ | VPS `.env` |
| P3 | `NEXT_PUBLIC_WIN_SCOPE_PILOT=1` ops-web build | ☐ | deploy_win3c |
| P4 | WIN-3-A/B flags on (sets, simulator, break-glass) | ☐ | deploy_win3 / win3b |
| P5 | `run_win3_uat.sh` automated PASS | ☐ | `docs/exports/win-3-uat-results-*.md` |

---

## EC-W3 exit criteria

| ID | Scenario | Owner | Status | Evidence |
|----|----------|-------|--------|----------|
| **EC-W3-01** | Permission Set: KD-01 + `SET-SOLUTION-BACKUP` → claim OK; revoke → 403 | PO | ☐ | Screen capture W3-UAT-02 |
| **EC-W3-02** | Simulator 5 personas — menu = prod 100% | IT + QA | ☐ | W3-UAT-01 screenshots |
| **EC-W3-03** | Access review quý ZIP MD+JSON archived | IT | ☐ | IT compliance folder |
| **EC-W3-04** | GDKD matrix supplement signed; override audit log | PO + GDKD | ☐ | PDF + audit query |
| **EC-W3-05** | Break-glass request → approve → auto-revoke ≤24h | IT + GDKD | ☐ | Grant TTL log |
| **EC-W3-06** | MAPE badge + renewal T-90 cards on staging | GDKD | ☐ | `/crm/forecast` + home |
| **EC-W3-07** | VUX-04 content vs design menu diff | QA | ☐ | 2-browser script |
| **EC-W3-08** | PO sign `WIN-3-acceptance-YYYY-MM-DD.pdf` | PO | ☐ | `docs/exports/signed/` |

---

## R3 client scope pilot (WIN-3-C)

| ID | Scenario | Owner | Status | Evidence |
|----|----------|-------|--------|----------|
| **R3-C-01** | Bind client scope → re-login → `client_ids[]` in JWT/me | IT | ☐ | `/auth/me` JSON |
| **R3-C-02** | Scoped AM — lead list filtered | QA | ☐ | API + UI |
| **R3-C-03** | Lead detail out-of-scope → 403 | QA | ☐ | Direct URL test |
| **R3-C-04** | Unrestricted internal user — full list | QA | ☐ | No bindings user |
| **R3-C-05** | Super-admin bypass with bindings | IT | ☐ | super-admin login |
| **R3-C-06** | `WinScopeBadge` on leads + org users | QA | ☐ | Screenshot |

---

## Sprint deliverables (engineering)

### WIN-3-A — Permission Sets + GDKD

- [x] DDL + API permission sets
- [x] Effective caps union
- [x] Admin UI `/admin/crm/permission-sets`
- [x] GDKD caps migration

### WIN-3-B — Simulator + break-glass + AI surfaces

- [x] Break-glass API + modal
- [x] Simulator API + page
- [x] Access review ZIP
- [x] MAPE badge + renewal T-90 + payroll bonus UI

### WIN-3-C — Scope pilot + checklist

- [x] `staff_user_clients` + lead filter
- [x] `WinScopeBadge` + `ClientScopePicker`
- [x] `win-3-acceptance-checklist.md`
- [x] `deploy_win3c_vps.sh`

---

## Automated gates

```bash
# Staging / VPS (requires ADMIN_PASSWORD or PTT_CRM_INTERNAL_KEY in .env)
OPS_UAT_URL=https://rs.pttads.vn OPS_UAT_API=https://rs.pttads.vn \
  bash scripts/run_win3_uat.sh

# Local
cd services/ptt-crm-api && npm test -- staff-client-scope
cd services/ops-web && npm run build
```

Latest report: see newest file in `docs/exports/win-3-uat-results-*.md`.

---

## UAT scripts (manual)

### W3-UAT-01 — Simulator 5 personas

1. AM-01 (position only)  
2. KD-01 + `content`  
3. CSKH + `SET-SOLUTION-BACKUP`  
4. GDKD + override caps  
5. Compare `compare_user_id` → diff

### W3-UAT-02 — Permission Set demo

Assign set → effective caps → login → action → revoke → 403.

### W3-UAT-03 — Access review archive

Download `?quarter=2026-Q3` → store in IT folder.

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| PO | | | |
| IT Lead | | | |
| QA | | | |
| GDKD | | | |

**Gate WIN-3:** EC-W3-01…08 + R3-C-01…06 + PO PDF → **unlock WIN-4 kickoff**.

**WIN-4 blockers after WIN-3 sign:** IT Keycloak `ptt-staff` ([`keycloak-staff-auth.md`](../runbooks/keycloak-staff-auth.md)) · PO sign WIN-4 plan ([`win-4-acceptance-checklist.md`](./win-4-acceptance-checklist.md) § kickoff gate).
