# SOC 2 Type I — Evidence index (PTTCRM GTM path)

> **Scope W4:** Marketing site (`pttcrm.com`), public demo API, CMS public read, ops demo inbox — **not** full 129-screen ops-web unless PO expands scope with auditor.

## Before auditor engagement

- [ ] PO confirms W3 exit: ≥ 3 ASEAN demos in pipeline
- [ ] Sub-processors list published at `https://pttcrm.com/en/trust/subprocessors` (PO-approved names)
- [ ] Trust Center live at `/en/trust` — no fake SOC2 report link (`po_approved: false` until report exists)
- [ ] Public status API: `GET /api/v1/public/gtm/status`

## Evidence folders (populate per control)

| Folder | Examples |
|--------|----------|
| `access-control/` | Staff RBAC exports, sandbox grant logs, joiner/leaver tickets |
| `change-management/` | GitHub PR reviews, deploy runbooks, CI green for W0–W4 |
| `logging/` | Demo request audit, CMS publish audit, rate-limit hits (no raw IP) |
| `vendors/` | Stripe DPA, cloud provider DPA, email provider DPA |
| `availability/` | Uptime monitor exports per [sla-999 runbook](../../runbooks/sla-999-uptime-monitoring.md) |

## Control mapping

See [control-matrix.csv](./control-matrix.csv) — map TSC criteria to evidence file paths.

## Site cross-links

- Trust: `/en/trust`
- Status: `/en/status`
- DPA: `/en/legal/dpa`
- Residency: [region-singapore-data-residency.md](../../runbooks/region-singapore-data-residency.md)

## Sign-off

| Role | Name | Date |
|------|------|------|
| PO | | |
| IT | | |
| Auditor | | |
