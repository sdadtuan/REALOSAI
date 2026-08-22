# HR & Payroll

> **Chương trình:** WIN (Competitive) · HR module  
> **App:** ops-web · ptt-crm-api

## Tính năng

| Tính năng | Mô tả | Route |
|-----------|-------|-------|
| HR Hub | Trang chủ HR | `/crm/hr` |
| Leave (lite) | Xin nghỉ, duyệt nghỉ | `/crm/hr/leave` |
| Payroll admin | Quản lý bảng lương | `/crm/payroll` |
| Payslip self-service | NV xem phiếu lương | `/crm/payroll/me` |
| Staff roster | Liên kết CRM staff | `/crm/staff` |

## WIN Program waves

| Wave | Focus | Trạng thái |
|------|-------|------------|
| WIN-0 | Foundation HR Hub + R1 RBAC | ✅ |
| WIN-1 | PWA mobile + Excel export | ✅ Pass 19/19 |
| WIN-2 | Moat + HR UI + org chart | ✅ |
| WIN-3 | Permission sets, forecast, break-glass | ✅ Automated PASS |
| WIN-4 | SSO Keycloak, OPA, field ABAC | ⬜ Draft |

## API chính

```
/api/v1/hr/leave
/api/crm/payroll
/api/v1/payroll/me
/api/crm/staff
```

## Feature flags

```
NEXT_PUBLIC_WIN_ORG_UI=1
NEXT_PUBLIC_WIN_LEAVE_LITE=1
NEXT_PUBLIC_WIN_PAYROLL=1
PTT_HR_LEAVE_ENABLED=1
PTT_PAYROLL_ENABLED=1
```

## Tích hợp

- Org chart (MOD-PLAT)
- Staff KPI (MOD-CRM)
- RBAC permission sets

## Tài liệu tham chiếu

- `docs/specs/2026-08-07-rnosai-competitive-win-master-spec.md`
- `docs/specs/modules/RNOSAI-BA-HR-UseCases.md` (nếu có)
