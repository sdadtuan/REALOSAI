# WIN-2 — Acceptance checklist (PO sign-off)

> **Phiên bản:** 1.0 · **Ngày:** 2026-08-07  
> **Spec:** [`2026-08-07-win-2-implementation-plan.md`](./2026-08-07-win-2-implementation-plan.md)

---

## Exit criteria (EC-W2)

| ID | Tiêu chí | Owner | Trạng thái | Evidence |
|----|----------|-------|------------|----------|
| EC-W2-01 | Onboard wizard ≤15 ph × 3 NV HR Ops | HR | ☐ | Timed log + VUX-03 |
| EC-W2-02 | `/crm/kpi/solution` số khớp API | QA | ☐ | `e2e/win-2-kpi-vux-07.spec.ts` |
| EC-W2-03 | Payroll Excel CFO/HR mở được | HR/CFO | ☐ | VUX-06 download |
| EC-W2-04 | 0 JSON-primary UI staff/payroll | QA | ☐ | Visual + e2e `pre` count |
| EC-W2-05 | VUX-03, 06, 07 automated pass | QA | ☐ | Playwright WIN-2 specs |
| EC-W2-06 | PO sign acceptance PDF | PO | ☐ | `signed/WIN-2-acceptance-*.pdf` |

---

## Sprint deliverables

### WIN-2-A — Org foundation

- [x] DDL + apply script
- [x] Nest org CRUD
- [x] Admin `/admin/crm/org/*`
- [x] Feature flag `NEXT_PUBLIC_WIN_ORG_UI`

### WIN-2-B — Workforce & payroll UI

- [x] Onboard wizard (VUX-03)
- [x] UserIdentityCard + offboard
- [x] Levels/competency forms
- [x] StaffEditDrawer + roster WinRbacBadge
- [ ] Payroll PG full cutover — **partial**

### WIN-2-C — KPI moat & CRM admin

- [x] KPI solution API + pages
- [x] Payroll Excel export
- [x] Custom-fields + pipeline admin
- [x] WinHomeDashboard

### WIN-2-D — Polish & UAT

- [x] WinOrgChart + `/admin/crm/org/chart`
- [x] Mobile regression e2e
- [x] Playwright VUX-03/06/07
- [ ] HR timed UAT 3 NV
- [ ] PO sign-off PDF

---

## Automated gates

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern='staff-org|crm-config'
cd services/ops-web && npx playwright test e2e/win-2-*.spec.ts
```
