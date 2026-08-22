# WIN-4 — Acceptance checklist (PO sign-off)

> **Phiên bản:** 1.0 · **Ngày:** 2026-08-07  
> **Spec:** [`2026-08-07-win-4-implementation-plan.md`](./2026-08-07-win-4-implementation-plan.md) §1.2  
> **Prerequisite:** WIN-3 accepted · Keycloak `ptt-staff` provisioned ([`keycloak-staff-auth.md`](../runbooks/keycloak-staff-auth.md))

---

## Preconditions

- [ ] WIN-3 EC-W3-01…08 + R3-C-01…06 signed ([`win-3-acceptance-checklist.md`](./win-3-acceptance-checklist.md))
- [ ] IT-KC-01…06 Keycloak realm `ptt-staff` live on staging
- [ ] PO approved [`2026-08-07-win-4-implementation-plan.md`](./2026-08-07-win-4-implementation-plan.md)

---

## EC-W4 exit criteria

| ID | Scenario | Steps | Expected | Status | Evidence |
|----|----------|-------|----------|--------|----------|
| **EC-W4-01** | SSO pilot 100+ NV | Keycloak login → caps match Nest shadow | ≥100 NV login 2 tuần | ☐ | IT login log |
| **EC-W4-02** | MFA GDKD/super-admin | Login without OTP → blocked | acr=mfa required | ☐ | Keycloak flow screenshot |
| **EC-W4-03** | Field ABAC | KD-01 PATCH expected_value; export CSV | 403 / strip PII | ☐ | API trace |
| **EC-W4-04** | Scope multi-module | AM scoped — Meta + leads | 403 cross-client | ☐ | R3-C extend log |
| **EC-W4-05** | OPA handoff | Release without handoff | 403 policy id | ☐ | Policy banner UI |
| **EC-W4-06** | CPL digest | `/crm/ai/cpl-digest` weekly | Narrative + anomalies | ☐ | Staging URL |
| **EC-W4-07** | Budget recommend | Meta hub cards read-only | No auto budget change | ☐ | Screenshot |
| **EC-W4-08** | Payslip self | `/crm/payroll/me` | NV chỉ xem bản thân | ☐ | HR UAT |
| **EC-W4-09** | Leave lite | Submit → approve stub | Audit row | ☐ | HR UAT |
| **EC-W4-10** | @mention notify | Activity @email | In-app bell unread | ☐ | E2E clip |
| **EC-W4-11** | Demo 60 ph | Master §16.2 12 scenes | VUX-10 recording pass | ☐ | `win-ux-recordings/WIN-4/` |
| **EC-W4-12** | Scorecard §4 bold | All categories ≥ bold target | Spreadsheet audit | ☐ | PO worksheet |
| **EC-W4-13** | Multi-sign PDF | PO + GDKD + HR + IT + Eng Lead | `signed/WIN-4-acceptance-*.pdf` | ☐ | Archive |

---

## Sprint deliverables tracking

### WIN-4-A — SSO + MFA

- [ ] `STAFF_AUTH_MODE=dual` staging
- [ ] `staff-keycloak.util.ts` + OIDC exchange API
- [ ] `KeycloakRedirect` + MFA screen
- [ ] `staff_keycloak_group_map` DDL + admin UI
- [ ] IT-KC-01…08 complete

### WIN-4-B — Field ABAC + scope expand

- [ ] `rbac_field_registry.json` + caps seed
- [ ] Lead financial/PII mask + export strip
- [ ] Meta / SEO / Email client scope guards
- [ ] Client scope CSV import

### WIN-4-C — OPA + AI ROAS

- [ ] 3 OPA policies on mutate path
- [ ] `PresalesPolicyBanner`
- [ ] CPL digest page + API
- [ ] Budget recommend cards

### WIN-4-D — HR + collab + sign-off

- [ ] `/crm/payroll/me` + leave form
- [ ] @mention + notification bell
- [ ] Access review workflow (R3-E)
- [ ] SSO cutover prod + EC-W4-13 PDF

---

## Automated gates

```bash
# After each sprint deploy
bash scripts/run_win4_uat.sh   # planned — mirror run_win3_uat.sh

# SSO local smoke
docker compose -f docker-compose.keycloak.yml up -d
bash scripts/keycloak_import_staff_realm.sh
curl -sf http://127.0.0.1:8080/realms/ptt-staff/.well-known/openid-configuration
```

---

## UAT scripts (manual)

| ID | Script | Persona | Duration |
|----|--------|---------|----------|
| W4-UAT-01 | Demo 60 ph Master §16.2 | PO + QA | 60 ph |
| W4-UAT-02 | SSO 100 NV smoke | IT | 2 ngày |
| W4-UAT-03 | Scorecard §4 audit | PO | 4h |
| W4-UAT-04 | FAQ 3 prospects | PO + Sales | async |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| PO | | | |
| GDKD | | | |
| HR Manager | | | |
| IT Lead | | | |
| Eng Lead | | | |
| QA | | | |

**Gate WIN-4:** EC-W4-01…13 complete · Scorecard §4 bold · no OUT scope shipped (Master §17).

---

## WIN-4 kickoff gate (from WIN-3)

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | WIN-3 PO signed PDF archived | ☐ |
| G2 | `run_win3_uat.sh` automated PASS on staging | ☐ |
| G3 | IT Keycloak `ptt-staff` issuer in staging `.env` | ☐ |
| G4 | PO signed WIN-4 implementation plan | ☐ |
