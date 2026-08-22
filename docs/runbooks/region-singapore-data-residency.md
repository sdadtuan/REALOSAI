# Data residency — Singapore (PTTCRM)

> **Audience:** Legal, sales US/EU, Trust Center copy review.

## Statement (public)

Production CRM and portal data for PTTCRM customers is hosted in **Singapore** (AWS `ap-southeast-1`) unless a signed contract specifies otherwise.

## In scope (W4)

| System | Region | Notes |
|--------|--------|-------|
| Marketing site (`pttcrm.com`) | Global CDN origin PO-defined | Static/ISR; no customer CRM data at rest on edge |
| Demo API + `gtm_demo_request` | Singapore | PostgreSQL region per IT |
| CMS public read (`gtm_cms_*`) | Singapore | Same DB cluster as GTM |
| Staff ops app | PO production config | Document actual region in IT runbook |

## Out of scope W4

- EU-only data residency / EU region tenant
- Cross-border transfer assessments beyond DPA + SCCs (Legal)

## Verification checklist (IT)

- [ ] RDS/Postgres region = `ap-southeast-1` (or PO-approved SG equivalent)
- [ ] Backups remain in same region
- [ ] Subprocessor list matches Trust Center JSON
- [ ] Trust Center `data_residency.statement_en` matches this runbook

## Rollback / exception

Any exception requires PO + Legal written approval and Trust Center update before sales use.
