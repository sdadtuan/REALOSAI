# RBAC guard audit — ops-web + Nest (R1-S2 / R1 ongoing)

> **Spec:** [`2026-08-06-rbac-enterprise-design.md`](../specs/2026-08-06-rbac-enterprise-design.md) §4  
> **Cập nhật:** 2026-08-06 · R1-S2 fail-closed UI

## ops-web (UI)

| Check | Trạng thái | Ghi chú |
|-------|:----------:|---------|
| `hasCap` fail-closed (caps rỗng → false) | ✅ | `src/lib/auth.ts` |
| Middleware login redirect `/crm`, `/seo`, `/email`, … | ✅ | `src/middleware.ts` + cookie `ptt_ops_auth` |
| Zone cap guard → `/403` | ✅ | `StaffRouteGuard` in `crm/seo/email/layout.tsx` |
| Trang `/403` tiếng Việt | ✅ | `src/app/403/` |
| Unit tests | ✅ | `src/lib/auth.spec.ts` |

## Nest API — write routes audit checklist

Mỗi `POST` / `PATCH` / `PUT` / `DELETE` staff route phải có guard module tương ứng.

### CRM leads / presales (P3)

| Route area | Guard | Section.action |
|------------|-------|----------------|
| Solution queue GET | `StaffPresalesSolutionViewGuard` | `crm_presales_solution.view` |
| claim-solution | `StaffPresalesSolutionClaimGuard` | `crm_presales_solution.claim` |
| release-solution | `StaffPresalesSolutionReleaseGuard` | `crm_presales_solution.release` |
| handoff-solution | leads edit guard | `crm_leads.edit` |

### Quy trình audit mỗi release

1. `rg ' @(Post|Patch|Put|Delete)\(' services/ptt-crm-api/src --glob '*.controller.ts'`
2. Đối chiếu controller → guard trong cùng module
3. Section mới → thêm vào `admin_page_permissions.py` + `rbac_catalog_gate.sh` (R1-S1)
4. Chạy `presales-solution-rbac.util.spec.ts` + pytest RBAC

### Lệnh grep nhanh (controller thiếu `@UseGuards`)

```bash
cd services/ptt-crm-api
rg '@(Post|Patch|Put|Delete)\(' src -l | while read f; do
  rg -q 'UseGuards' "$f" || echo "REVIEW $f"
done
```

## Test plan mapping (spec §7)

| ID | Case | Layer |
|----|------|-------|
| T5 | KD claim → 403 | Nest API |
| T8 | caps=[] → no CRM menu | ops-web `hasCap` + OpsNav |
| T8+ | caps=[] → `/crm` → `/403` | StaffRouteGuard |

## Việc tiếp (R1-S3+)

- [ ] Admin PATCH permissions → audit log
- [ ] Row-level lead list (R1-S4)
- [ ] `rbac_catalog_gate.sh` CI
