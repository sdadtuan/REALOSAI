# WIN-3 Acceptance — PO Sign-off Template

> **Date:** 2026-08-07 · **Environment:** `rs.pttads.vn` @ `a3d4de8`  
> **Checklist:** [`docs/specs/win-3-acceptance-checklist.md`](../specs/win-3-acceptance-checklist.md)  
> **UAT report:** run `bash scripts/run_win3_uat.sh` → `docs/exports/win-3-uat-results-*.md`

---

## Summary

Sprint WIN-3 (A/B/C) delivers enterprise RBAC: Permission Sets, GDKD caps, break-glass, permission simulator, quarterly access review export, forecast MAPE + renewal T-90 UI, and R3 client scope pilot.

---

## Exit criteria attestation

| ID | Criterion | PO confirm |
|----|-----------|------------|
| EC-W3-01 | Permission Set demo pass | ☐ |
| EC-W3-02 | Simulator 5 personas 100% menu match | ☐ |
| EC-W3-03 | Access review ZIP archived | ☐ |
| EC-W3-04 | GDKD matrix signed + audit | ☐ |
| EC-W3-05 | Break-glass E2E + auto-revoke | ☐ |
| EC-W3-06 | MAPE + T-90 UI visible | ☐ |
| EC-W3-07 | VUX-04 pass | ☐ |
| EC-W3-08 | This document signed | ☐ |

R3-C-01…06 client scope pilot: ☐ confirmed by IT/QA

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **PO** | | | |
| IT Lead | | | |
| QA | | | |
| GDKD | | | |

---

*Export PDF:* `python3 scripts/export_win3_acceptance_pdf.py` → `docs/exports/signed/WIN-3-acceptance-2026-08-07.pdf`

**Next:** WIN-4 kickoff after this PDF archived + IT Keycloak `ptt-staff` provisioned.
